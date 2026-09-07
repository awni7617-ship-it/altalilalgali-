/* ==================================================================
   Request and response helpers for the Cloudflare Functions backend.
   ================================================================== */

export const SESSION_COOKIE = 'shop_session';

export class HttpError extends Error {
  constructor(status, message, code = '') {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (msg, code) => new HttpError(400, msg, code);
export const unauthorized = (msg = 'Please sign in to continue.') => new HttpError(401, msg, 'unauthorized');
export const forbidden = (msg = 'Not allowed.') => new HttpError(403, msg, 'forbidden');
export const notFound = (msg = 'Not found.') => new HttpError(404, msg, 'not_found');
export const tooMany = (msg, retryAfter = 60) => {
  const e = new HttpError(429, msg, 'rate_limited');
  e.retryAfter = retryAfter;
  return e;
};

export function json(payload, status = 200, headers = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
  });
}

export function errorResponse(err) {
  if (err instanceof HttpError) {
    const headers = err.retryAfter ? { 'Retry-After': String(err.retryAfter) } : {};
    return json({ ok: false, error: err.message, code: err.code }, err.status, headers);
  }
  console.error('[error]', err && err.stack ? err.stack : err);
  return json(
    { ok: false, error: 'Something went wrong on our side. Please try again.', code: 'server_error' },
    500,
  );
}

export async function readJson(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    throw badRequest('The request body is not valid JSON.');
  }
  if (body === null || typeof body !== 'object' || Array.isArray(body)) {
    throw badRequest('Expected a JSON object.');
  }
  return body;
}

/* ------------------------------------------------------------------ *
 * Cookies
 * ------------------------------------------------------------------ */
export function readCookie(request, name) {
  const header = request.headers.get('Cookie');
  if (!header) return '';
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() === name) {
      try {
        return decodeURIComponent(part.slice(eq + 1).trim());
      } catch {
        return part.slice(eq + 1).trim();
      }
    }
  }
  return '';
}

/** Cookie security follows the connection, so signing in still works
 *  over http://localhost while staying locked down in production. */
export function cookieHeader(request, name, value, maxAgeMs) {
  const secure = new URL(request.url).protocol === 'https:';
  const parts = [`${name}=${encodeURIComponent(value)}`, 'Path=/', 'SameSite=Lax', 'HttpOnly'];
  if (secure) parts.push('Secure');
  if (maxAgeMs !== undefined) parts.push(`Max-Age=${Math.floor(maxAgeMs / 1000)}`);
  return parts.join('; ');
}

export function withCookie(response, cookie) {
  const headers = new Headers(response.headers);
  headers.append('Set-Cookie', cookie);
  return new Response(response.body, { status: response.status, headers });
}

export function redirect(location, cookie) {
  const headers = { Location: location };
  const response = new Response(null, { status: 302, headers });
  return cookie ? withCookie(response, cookie) : response;
}

export function clientIp(request) {
  return request.headers.get('CF-Connecting-IP') ||
    (request.headers.get('X-Forwarded-For') || '').split(',')[0].trim() || '';
}

/* ------------------------------------------------------------------ *
 * Cross-site request protection.
 *
 * Browsers always send Origin on a cross-origin POST, so a mismatch is
 * a forgery. Same-origin fetch from our own pages always passes.
 * ------------------------------------------------------------------ */
export function assertSameOrigin(request) {
  const method = request.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return;

  const origin = request.headers.get('Origin');
  if (!origin) {
    if (request.headers.get('X-Shop-Request') !== '1') {
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
  if (host !== new URL(request.url).host) throw forbidden('Blocked cross-site request.');
}

/* ------------------------------------------------------------------ *
 * Rate limiting.
 *
 * Workers isolates are short-lived and spread across the world, so a
 * counter in memory would forget everything between requests. The
 * attempts live in the database instead.
 * ------------------------------------------------------------------ */
export async function rateLimit(db, bucket, limit, windowMs) {
  const now = Date.now();
  const since = now - windowMs;

  const row = await db
    .prepare('SELECT COUNT(*) AS n, MIN(at) AS oldest FROM login_attempts WHERE bucket = ? AND at > ?')
    .bind(bucket, since)
    .first();

  if ((row?.n || 0) >= limit) {
    const retryAfter = Math.max(1, Math.ceil((windowMs - (now - (row.oldest || now))) / 1000));
    return { allowed: false, retryAfter };
  }

  await db.prepare('INSERT INTO login_attempts (bucket, at) VALUES (?, ?)').bind(bucket, now).run();
  /* Opportunistic cleanup so the table cannot grow without bound. */
  if (Math.random() < 0.05) {
    await db.prepare('DELETE FROM login_attempts WHERE at < ?').bind(now - 86_400_000).run();
  }
  return { allowed: true };
}

export async function clearRateLimit(db, bucket) {
  await db.prepare('DELETE FROM login_attempts WHERE bucket = ?').bind(bucket).run();
}

/* ------------------------------------------------------------------ *
 * A tiny router over the path segments Pages hands us.
 * ------------------------------------------------------------------ */
export class Routes {
  constructor() {
    this.list = [];
  }

  add(method, pattern, handler) {
    this.list.push({ method, parts: pattern.split('/').filter(Boolean), handler });
    return this;
  }

  get(p, h) { return this.add('GET', p, h); }
  post(p, h) { return this.add('POST', p, h); }
  put(p, h) { return this.add('PUT', p, h); }
  patch(p, h) { return this.add('PATCH', p, h); }
  delete(p, h) { return this.add('DELETE', p, h); }

  match(method, segments) {
    let pathMatched = false;
    for (const route of this.list) {
      if (route.parts.length !== segments.length) continue;
      const params = {};
      let ok = true;
      for (let i = 0; i < route.parts.length; i++) {
        const part = route.parts[i];
        if (part.startsWith(':')) params[part.slice(1)] = segments[i];
        else if (part !== segments[i]) { ok = false; break; }
      }
      if (!ok) continue;
      pathMatched = true;
      if (route.method !== method) continue;
      return { handler: route.handler, params };
    }
    return pathMatched ? { methodNotAllowed: true } : null;
  }
}
