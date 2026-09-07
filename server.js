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

const server = http.createServer((req, res) => {
  securityHeaders(res);

  if (req.url === '/healthz') {
    res.writeHead(200, { 'content-type': 'text/plain' });
    return res.end('ok');
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
