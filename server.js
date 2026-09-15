/**
 * Serves the built panel and proxies /api to the backend.
 *
 * This is the DigitalOcean equivalent of the rewrites in `vercel.json`, and it
 * exists for one reason: the admin session cookie is `Secure; SameSite=Strict`,
 * so the panel MUST call the API from its own origin. A static host cannot
 * rewrite to another host, so the panel is served by this process instead and
 * the API rides along under /api on the same origin.
 *
 * Deliberately dependency-free — Node's own http/https is enough for a JSON
 * API with cookies, and a build that installs nothing extra cannot break on a
 * transitive update of something it did not choose.
 */
import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// The package is `"type": "module"`, so `__dirname` has to be derived.
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = Number(process.env.PORT) || 8080;
const DIST = path.join(__dirname, 'dist');
const API_ORIGIN = (
  process.env.API_ORIGIN || 'https://regal-backend-ypkwe.ondigitalocean.app'
).replace(/\/$/, '');

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

/** The same headers `vercel.json` sets — an admin panel must never be indexed. */
function securityHeaders(res) {
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-Frame-Options', 'DENY');
}

// Headers that describe one hop and must not be copied to the next.
const HOP_BY_HOP = new Set([
  'connection',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
  'host',
]);

function proxy(req, res) {
  const target = new URL(API_ORIGIN + req.url);
  const headers = {};
  for (const [k, v] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(k.toLowerCase())) headers[k] = v;
  }
  // The API signs cookies against its own host, so it must see that host.
  headers.host = target.host;
  headers['x-forwarded-proto'] = 'https';
  headers['x-forwarded-host'] = req.headers.host ?? '';

  const client = target.protocol === 'http:' ? http : https;
  const upstream = client.request(
    {
      protocol: target.protocol,
      hostname: target.hostname,
      port: target.port || (target.protocol === 'http:' ? 80 : 443),
      method: req.method,
      path: target.pathname + target.search,
      headers,
    },
    (upRes) => {
      // Status and headers pass through untouched — Set-Cookie above all, which
      // is the whole point of proxying rather than calling the API directly.
      res.writeHead(upRes.statusCode || 502, upRes.headers);
      upRes.pipe(res);
    },
  );

  upstream.on('error', (err) => {
    if (!res.headersSent) res.writeHead(502, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: { code: 'BAD_GATEWAY', message: err.message } }));
  });

  req.pipe(upstream);
}

function sendFile(res, file, { immutable }) {
  const type = TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream';
  res.setHeader('Content-Type', type);
  // Vite fingerprints everything under /assets, so those can be cached hard.
  // index.html never is — it is what points at the current build.
  res.setHeader(
    'Cache-Control',
    immutable ? 'public, max-age=31536000, immutable' : 'no-cache',
  );
  fs.createReadStream(file).pipe(res);
}

/**
 * Invitation links for the mobile app.
 *
 * An invitation is `https://admin.regalapp.net/i/<code>`. With Regal installed,
 * iOS and Android open the app straight away — but only after fetching the two
 * association files below from this exact host and finding the app named in
 * them. Without Regal, the link opens here and the landing page sends the person
 * to the store.
 *
 * Only `/i/*` and `/download` are claimed, in both files and in the app's own
 * manifest, so every other admin URL still opens in the browser.
 */
const IOS_APP_ID = 'V586D4R468.com.regal.mobile';
const ANDROID_PACKAGE = 'com.regal.mobile';
// Play App Signing key (Play Console → Test and release → App integrity), plus
// the debug key so local builds verify too. Comma-separated.
const ANDROID_CERT_SHA256 = (
  process.env.ANDROID_CERT_SHA256 ||
  'FA:C6:17:45:DC:09:03:78:6F:B9:ED:E6:2A:96:2B:39:9F:73:48:F0:BB:6F:89:9B:83:32:66:75:91:03:3B:9C'
)
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
// Empty until the app is published; the page says so instead of a dead button.
const IOS_STORE_URL = process.env.IOS_STORE_URL || '';
const ANDROID_STORE_URL = `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;

const APPLE_APP_SITE_ASSOCIATION = JSON.stringify({
  applinks: {
    apps: [],
    details: [
      {
        // Both spellings: `appIDs`/`components` for iOS 13+, `appID`/`paths`
        // for anything older.
        appIDs: [IOS_APP_ID],
        components: [{ '/': '/i/*' }, { '/': '/download' }],
        appID: IOS_APP_ID,
        paths: ['/i/*', '/download'],
      },
    ],
  },
});

const ASSET_LINKS = JSON.stringify([
  {
    relation: ['delegate_permission/common.handle_all_urls'],
    target: {
      namespace: 'android_app',
      package_name: ANDROID_PACKAGE,
      sha256_cert_fingerprints: ANDROID_CERT_SHA256,
    },
  },
]);

function sendJson(res, body) {
  // Apple and Google both refuse a redirect or a cached HTML fallback here.
  res.writeHead(200, {
    'content-type': 'application/json',
    'cache-control': 'public, max-age=3600',
  });
  res.end(body);
}

/** Shown only when the app is not installed (or the link was opened on desktop). */
function invitePage(code) {
  const appUrl = code ? `regal://i/${code}` : 'regal://';
  const playUrl = code
    ? `${ANDROID_STORE_URL}&referrer=${encodeURIComponent(`code=${code}`)}`
    : ANDROID_STORE_URL;
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Regal</title>
<style>
  body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;
    font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
    background:linear-gradient(160deg,#B750F4,#6527F3);color:#fff;padding:0 20px}
  .card{max-width:380px;width:100%;text-align:center}
  h1{font-size:34px;margin:0 0 8px}
  p{font-size:16px;line-height:1.5;opacity:.9;margin:0 0 28px}
  a.btn{display:block;padding:16px;border-radius:30px;margin-bottom:12px;
    font-weight:600;text-decoration:none;font-size:16px}
  .primary{background:#fff;color:#6527F3}
  .secondary{border:1.5px solid rgba(255,255,255,.7);color:#fff}
  .note{font-size:13px;opacity:.75;margin-top:16px}
  [hidden]{display:none!important}
</style>
</head>
<body>
<main class="card">
  <h1>Regal</h1>
  <p data-es="Te invitaron a Regal. Descarga la app y regístrate con tu número de teléfono para conectar con quien te invitó."
     data-en="You've been invited to Regal. Get the app and sign up with your phone number to connect with the person who invited you."></p>
  <a id="store" class="btn primary" href="#" data-es="Descargar Regal" data-en="Get Regal"></a>
  <a id="open" class="btn secondary" href="${appUrl}" data-es="Ya tengo la app" data-en="I already have the app"></a>
  <div id="soon" class="note" hidden data-es="Regal estará disponible pronto en App Store." data-en="Regal is coming soon to the App Store."></div>
</main>
<script>
  var lang = (navigator.language || 'es').toLowerCase().indexOf('en') === 0 ? 'en' : 'es';
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-es]').forEach(function (el) { el.textContent = el.getAttribute('data-' + lang); });
  var ua = navigator.userAgent;
  var ios = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document);
  var android = /Android/i.test(ua);
  var iosUrl = ${JSON.stringify(IOS_STORE_URL)};
  var store = document.getElementById('store');
  if (ios) {
    if (iosUrl) store.href = iosUrl; else { store.hidden = true; document.getElementById('soon').hidden = false; }
  } else if (android) {
    store.href = ${JSON.stringify(playUrl)};
  } else {
    store.hidden = true;
    document.getElementById('open').hidden = true;
    document.getElementById('soon').hidden = false;
    document.getElementById('soon').textContent = lang === 'en'
      ? 'Open this link on your phone to get Regal.'
      : 'Abre este enlace en tu teléfono para obtener Regal.';
  }
</script>
</body>
</html>`;
}

const server = http.createServer((req, res) => {
  securityHeaders(res);

  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('ok');
  }

  const pathname = new URL(req.url, 'http://x').pathname;

  if (pathname === '/.well-known/apple-app-site-association' || pathname === '/apple-app-site-association') {
    return sendJson(res, APPLE_APP_SITE_ASSOCIATION);
  }
  if (pathname === '/.well-known/assetlinks.json') {
    return sendJson(res, ASSET_LINKS);
  }
  const invite = pathname.match(/^\/i\/([A-Za-z0-9]{4,32})\/?$/);
  if (invite || pathname === '/download') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
    return res.end(invitePage(invite ? invite[1].toUpperCase() : null));
  }

  if (req.url.startsWith('/api/')) return proxy(req, res);

  // Resolve inside dist and nowhere else: a request for /../../etc/passwd must
  // land on the SPA fallback, not on the filesystem.
  const requested = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  const file = path.join(DIST, requested);
  const inside = file === DIST || file.startsWith(DIST + path.sep);

  if (inside && requested !== '/' && fs.existsSync(file) && fs.statSync(file).isFile()) {
    return sendFile(res, file, { immutable: requested.startsWith('/assets/') });
  }

  // Everything else is a client-side route.
  return sendFile(res, path.join(DIST, 'index.html'), { immutable: false });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`admin panel on :${PORT} — /api proxied to ${API_ORIGIN}`);
});
