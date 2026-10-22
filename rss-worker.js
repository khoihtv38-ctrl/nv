// Cloudflare Worker: proxy RSS riêng cho VC Now Canada (index.html) và Người Việt Today (us.html).
// Cách dùng: https://<ten-worker>.workers.dev/?url=<link RSS đã encode>
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

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS'
};

export default {
  async fetch(request) {
    if (request.method === 'OPTIONS') return new Response(null, { headers: CORS });

    const target = new URL(request.url).searchParams.get('url');
    if (!target) return new Response('Thiếu tham số url', { status: 400, headers: CORS });

    let feedUrl;
    try { feedUrl = new URL(target); } catch (e) {
      return new Response('url không hợp lệ', { status: 400, headers: CORS });
    }
    if (!ALLOWED_HOSTS.includes(feedUrl.hostname)) {
      return new Response('Nguồn không được phép', { status: 403, headers: CORS });
    }

    const upstream = await fetch(feedUrl.toString(), {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; VCNowCanadaRSS/1.0)',
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
