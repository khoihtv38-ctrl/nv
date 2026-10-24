// Cloudflare Worker: proxy RSS cho Canada & US Geopolitical Terminal (terminal.html).
// Đang chạy tại: https://news.khoihtv38.workers.dev
// Cách dùng: https://news.khoihtv38.workers.dev/?url=<link RSS đã encode>
// Chỉ cho phép các nguồn trong danh sách dưới để người khác không lợi dụng proxy.

const ALLOWED_HOSTS = [
  'news.google.com',
  'www.cbc.ca',
  'www.ctvnews.ca',
  'financialpost.com',
  'globalnews.ca',
  'feeds.bbci.co.uk',
  'e.vnexpress.net'
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

    try {
      const upstream = await fetch(feedUrl.toString(), {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GeoTerminalRSS/1.0)',
          'Accept': 'application/rss+xml, application/xml, text/xml, */*'
        },
        // Cloudflare lưu 2 phút: tin vẫn mới, nguồn gốc không bị gọi quá nhiều
        cf: { cacheTtl: 120, cacheEverything: true }
      });

      return new Response(upstream.body, {
        status: upstream.status,
        headers: {
          ...CORS,
          'Content-Type': 'application/xml; charset=utf-8',
          'Cache-Control': 'public, max-age=120'
        }
      });
    } catch (e) {
      return new Response('Lỗi tải nguồn: ' + e.message, { status: 502, headers: CORS });
    }
  }
};
