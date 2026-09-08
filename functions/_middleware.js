/* ==================================================================
   Runs before every request.

   Two jobs: keep the shop behind the sign-in wall when asked to, and
   put the security headers on whatever goes out.
   ================================================================== */
import { SESSION_COOKIE, readCookie } from './lib/http.js';
import { getSessionUser, sessionToken } from './lib/auth.js';

/* Reachable without signing in, so the login page can load and work. */
const OPEN_PAGES = new Set(['/login', '/login.html']);

const isOpenAsset = (p) =>
  p.startsWith('/assets/') || p.startsWith('/api/') || p.startsWith('/auth/') ||
  p.startsWith('/uploads/') || p === '/favicon.ico';

const requireLogin = (env) => String(env.REQUIRE_LOGIN ?? 'true').toLowerCase() !== 'false';

function harden(response) {
  const headers = new Headers(response.headers);
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  headers.set(
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
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

export async function onRequest(context) {
  const { request, env, next } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  /* Pages serves /login from login.html and redirects the .html form
   * to it, so this must not rewrite paths itself — doing both sends
   * the browser round in circles. */
  if (!isOpenAsset(path)) {
    let user = null;
    if (env.DB) {
      try {
        user = await getSessionUser(env.DB, env, sessionToken(request, readCookie(request, SESSION_COOKIE)));
      } catch {
        user = null;
      }
    }

    /* The dashboard page is for the owner; the API re-checks anyway. */
    if ((path === '/admin' || path === '/admin.html') && (!user || user.role !== 'admin')) {
      return Response.redirect(new URL('/login?next=/admin', url), 302);
    }

    if (requireLogin(env) && !user && !OPEN_PAGES.has(path)) {
      const next = path === '/' ? '' : `?next=${encodeURIComponent(path)}`;
      return Response.redirect(new URL(`/login${next}`, url), 302);
    }
  }

  return harden(await next());
}
