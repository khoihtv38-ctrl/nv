// Cloudflare Worker: proxy RSS riêng cho VC Now Canada (index.html) và Người Việt Today (us.html).
// Cách dùng:
//   https://<ten-worker>.workers.dev/?url=<link RSS đã encode>     → trả nội dung RSS
//   https://<ten-worker>.workers.dev/?og=<link bài báo đã encode>  → trả {"image": "..."} (ảnh đại diện bài)
// Chỉ cho phép các nguồn trong danh sách dưới để người khác không lợi dụng proxy.

const ALLOWED_HOSTS = [
  'www.cbc.ca',
  'globalnews.ca',
  'feeds.bbci.co.uk',
  'e.vnexpress.net',
  // Nguồn Hoa Kỳ cho trang Người Việt Today (us.html)
  'moxie.foxnews.com',
  'feeds.npr.org',
  'www.cnbc.com'
];

// Trang bài báo được phép đọc để lấy ảnh đại diện (feed CNBC không có ảnh, NPR nhiều bài thiếu ảnh)
const OG_HOSTS = [
  'www.npr.org',
  'www.cnbc.com',
  'www.foxnews.com',
  'www.foxbusiness.com'
];

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

function parseUrl(str) {
  try { return new URL(str); } catch (e) { return null; }
}

function json(data, maxAge) {
  return new Response(JSON.stringify(data), {
    headers: {
      ...CORS,
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${maxAge}`
    }
  });
}

// Đọc trang bài báo, lấy og:image (hoặc twitter:image)
async function handleOgImage(articleUrl) {
  const res = await fetch(articleUrl.toString(), {
    headers: { 'User-Agent': BROWSER_UA, 'Accept': 'text/html,*/*' },
    // Ảnh bài báo gần như không đổi: lưu 1 ngày
    cf: { cacheTtl: 86400, cacheEverything: true }
  });
  if (!res.ok) return json({ image: null, status: res.status }, 3600);

  let ogImage = null;
  let twImage = null;
  const rewriter = new HTMLRewriter()
    .on('meta', {
      element(el) {
        const key = (el.getAttribute('property') || el.getAttribute('name') || '').toLowerCase();
        const content = el.getAttribute('content');
        if (!content) return;
        if (key === 'og:image' && !ogImage) ogImage = content;
        if ((key === 'twitter:image' || key === 'twitter:image:src') && !twImage) twImage = content;
      }
    });
  await rewriter.transform(res).arrayBuffer();

  let image = ogImage || twImage;
  if (image) image = new URL(image, articleUrl).toString();
  return json({ image }, 86400);
}

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const params = new URL(request.url).searchParams;

    const og = params.get('og');
    if (og) {
      const articleUrl = parseUrl(og);
      if (!articleUrl) return new Response('og không hợp lệ', { status: 400, headers: CORS });
      if (!OG_HOSTS.includes(articleUrl.hostname)) {
        return new Response('Nguồn không được phép', { status: 403, headers: CORS });
      }
      try {
        return await handleOgImage(articleUrl);
      } catch (e) {
        return json({ image: null }, 600);
      }
    }

    const target = params.get('url');
    if (!target) return new Response('Thiếu tham số url', { status: 400, headers: CORS });

    const feedUrl = parseUrl(target);
    if (!feedUrl) return new Response('url không hợp lệ', { status: 400, headers: CORS });
    if (!ALLOWED_HOSTS.includes(feedUrl.hostname)) {
      return new Response('Nguồn không được phép', { status: 403, headers: CORS });
    }

    const upstream = await fetch(feedUrl.toString(), {
      headers: {
        'User-Agent': BROWSER_UA,
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      },
      // Cloudflare lưu 5 phút: tin vẫn mới, nguồn gốc không bị gọi quá nhiều
      cf: { cacheTtl: 300, cacheEverything: true }
    });

    return new Response(upstream.body, {
      status: upstream.status,
      headers: {
        ...CORS,
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=300'
      }
    });
  }
};
