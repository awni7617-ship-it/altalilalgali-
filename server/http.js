import { createReadStream, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { config } from './config.js';

/* ------------------------------------------------------------------ *
 * A very small router. Patterns look like "/api/products/:id".
 * ------------------------------------------------------------------ */
export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler) {
    const keys = [];
    const regex = new RegExp(
      '^' +
        pattern
          .replace(/\/+$/, '')
          .replace(/[.+*?^${}()|[\]\\]/g, '\\$&')
          .replace(/\/:([A-Za-z_][A-Za-z0-9_]*)/g, (_m, key) => {
            keys.push(key);
            return '/([^/]+)';
          }) +
        '/?$',
    );
    this.routes.push({ method, regex, keys, handler });
    return this;
  }

  get(p, h) { return this.add('GET', p, h); }
  post(p, h) { return this.add('POST', p, h); }
  put(p, h) { return this.add('PUT', p, h); }
  patch(p, h) { return this.add('PATCH', p, h); }
  delete(p, h) { return this.add('DELETE', p, h); }

  match(method, pathname) {
    const clean = pathname.replace(/\/+$/, '') || '/';
    let pathMatched = false;
    for (const route of this.routes) {
      const m = route.regex.exec(clean);
      if (!m) continue;
      pathMatched = true;
      if (route.method !== method) continue;
      const params = {};
      route.keys.forEach((key, i) => {
        params[key] = decodeURIComponent(m[i + 1]);
      });
      return { handler: route.handler, params };
    }
    return pathMatched ? { methodNotAllowed: true } : null;
  }
}

/* ------------------------------------------------------------------ *
 * Errors that carry an HTTP status.
 * ------------------------------------------------------------------ */
export class HttpError extends Error {
  constructor(status, message, code = '') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (msg, code) => new HttpError(400, msg, code);
export const unauthorized = (msg = 'Please sign in.') => new HttpError(401, msg, 'unauthorized');
export const forbidden = (msg = 'Not allowed.') => new HttpError(403, msg, 'forbidden');
export const notFound = (msg = 'Not found.') => new HttpError(404, msg, 'not_found');
export const tooMany = (msg, retryAfter = 60) => {
  const e = new HttpError(429, msg, 'rate_limited');
  e.retryAfter = retryAfter;
  return e;
};

/* ------------------------------------------------------------------ *
 * Request / response helpers
 * ------------------------------------------------------------------ */
const MAX_BODY_BYTES = 12 * 1024 * 1024; // room for a base64 product photo

export async function readJson(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) throw badRequest('The uploaded data is too large.', 'body_too_large');
    chunks.push(chunk);
  }
  if (size === 0) return {};
  const text = Buffer.concat(chunks).toString('utf8');
  try {
    const parsed = JSON.parse(text);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw badRequest('Expected a JSON object.');
    }
    return parsed;
  } catch (err) {
    if (err instanceof HttpError) throw err;
    throw badRequest('The request body is not valid JSON.');
  }
}

/** Read an `application/x-www-form-urlencoded` body — Apple replies
 *  to a sign-in with a form POST rather than a redirect. */
export async function readForm(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 256 * 1024) throw badRequest('That form submission is too large.', 'body_too_large');
    chunks.push(chunk);
  }
  return Object.fromEntries(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
}

export function sendJson(res, status, payload, extraHeaders = {}) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  });
  res.end(body);
}

export function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    const value = part.slice(eq + 1).trim();
    if (key) {
      try {
        out[key] = decodeURIComponent(value);
      } catch {
        out[key] = value;
      }
    }
  }
  return out;
}

export function setCookie(res, name, value, { maxAge, httpOnly = true, secure, sameSite = 'Lax' } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', `SameSite=${sameSite}`];
  if (httpOnly) parts.push('HttpOnly');
  if (secure ?? config.isProduction) parts.push('Secure');
  if (maxAge !== undefined) parts.push(`Max-Age=${Math.floor(maxAge / 1000)}`);
  const existing = res.getHeader('Set-Cookie');
  const list = existing ? (Array.isArray(existing) ? existing : [existing]) : [];
  list.push(parts.join('; '));
  res.setHeader('Set-Cookie', list);
}

export function clearCookie(res, name) {
  setCookie(res, name, '', { maxAge: 0 });
}

export function clientIp(req) {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.length) {
    return forwarded.split(',')[0].trim();
  }
  return req.socket.remoteAddress || '';
}

/* ------------------------------------------------------------------ *
 * In-memory sliding-window rate limiter.
 * ------------------------------------------------------------------ */
const buckets = new Map();

export function rateLimit(key, limit, windowMs, { reset = false, peek = false } = {}) {
  if (reset) {
    buckets.delete(key);
    return { allowed: true, remaining: limit };
  }
  const now = Date.now();
  const hits = (buckets.get(key) || []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    const retryAfter = Math.ceil((windowMs - (now - hits[0])) / 1000);
    return { allowed: false, retryAfter };
  }
  if (!peek) hits.push(now);
  buckets.set(key, hits);
  return { allowed: true, remaining: limit - hits.length };
}

setInterval(() => {
  const now = Date.now();
  for (const [key, hits] of buckets) {
    const fresh = hits.filter((t) => now - t < 3_600_000);
    if (fresh.length === 0) buckets.delete(key);
    else buckets.set(key, fresh);
  }
}, 600_000).unref();

/* ------------------------------------------------------------------ *
 * Cross-site request protection.
 *
 * State-changing requests must come from our own origin. Browsers
 * always send Origin on cross-origin POSTs, so a mismatch is a forgery.
 * Same-origin fetch() from our pages always passes.
 * ------------------------------------------------------------------ */
export function assertSameOrigin(req) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS') return;
  const origin = req.headers.origin;
  if (!origin) {
    /* No Origin header at all: not a browser form post. Require our
     * custom header, which cross-site HTML forms cannot set. */
    if (req.headers['x-shop-request'] !== '1') {
      throw forbidden('Blocked cross-site request.');
    }
    return;
  }
  let host;
  try {
    host = new URL(origin).host;
  } catch {
    throw forbidden('Blocked cross-site request.');
  }
  const allowed = new Set([req.headers.host]);
  try {
    allowed.add(new URL(config.publicUrl).host);
  } catch { /* publicUrl may be malformed; the Host header still applies */ }
  if (!allowed.has(host)) throw forbidden('Blocked cross-site request.');
}

/* ------------------------------------------------------------------ *
 * Static files
 * ------------------------------------------------------------------ */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

export function serveStatic(req, res, pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded === '/' ? '/index.html' : decoded;
  const target = path.join(config.publicDir, relative);

  /* Never let a path escape the public directory. */
  const resolved = path.resolve(target);
  if (resolved !== config.publicDir && !resolved.startsWith(config.publicDir + path.sep)) {
    return false;
  }
  if (!existsSync(resolved)) return false;
  const stat = statSync(resolved);
  if (!stat.isFile()) return false;

  const ext = path.extname(resolved).toLowerCase();
  const isUpload = resolved.startsWith(path.join(config.publicDir, 'uploads') + path.sep);
  const etag = `W/"${stat.size}-${Math.floor(stat.mtimeMs)}"`;

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag });
    res.end();
    return true;
  }

  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    ETag: etag,
    /* Uploaded photos get a content-addressed name, so they can be
     * cached hard. Application files must revalidate. */
    'Cache-Control': isUpload ? 'public, max-age=31536000, immutable' : 'no-cache',
  });
  if (req.method === 'HEAD') {
    res.end();
    return true;
  }
  createReadStream(resolved).pipe(res);
  return true;
}

export function securityHeaders(res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "img-src 'self' data: blob: https:",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com data:",
      "script-src 'self'",
      "connect-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "base-uri 'self'",
    ].join('; '),
  );
}
