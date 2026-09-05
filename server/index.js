import http from 'node:http';
import { config } from './config.js';
import { getSettings } from './db.js';
import { SESSION_COOKIE, getSessionUser } from './auth.js';
import {
  Router,
  HttpError,
  sendJson,
  serveStatic,
  parseCookies,
  securityHeaders,
  assertSameOrigin,
  notFound,
} from './http.js';
import { registerAuthRoutes } from './routes/auth.js';
import { registerShopRoutes } from './routes/shop.js';
import { registerAdminRoutes } from './routes/admin.js';

const router = new Router();
registerAuthRoutes(router);
registerShopRoutes(router);
registerAdminRoutes(router);

/* Pages that must not be served to someone who is not signed in as the
 * owner. The API is what actually enforces this — hiding the page just
 * avoids showing an empty dashboard. */
const ADMIN_PAGES = new Set(['/admin', '/admin.html']);

const server = http.createServer(async (req, res) => {
  securityHeaders(res);

  let url;
  try {
    url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  } catch {
    return sendJson(res, 400, { ok: false, error: 'Malformed request URL.' });
  }
  const pathname = url.pathname;

  const cookies = parseCookies(req);
  const token = cookies[SESSION_COOKIE] || '';
  let user = null;
  try {
    user = getSessionUser(token);
  } catch {
    user = null;
  }
  const ctx = { user, token, query: url.searchParams, params: {} };

  try {
    /* ---------------- API ---------------- */
    if (pathname.startsWith('/api/')) {
      assertSameOrigin(req);
      const match = router.match(req.method, pathname);
      if (!match) throw notFound('That endpoint does not exist.');
      if (match.methodNotAllowed) {
        res.setHeader('Allow', 'GET, POST, PUT, PATCH, DELETE');
        throw new HttpError(405, 'That method is not allowed here.', 'method_not_allowed');
      }
      ctx.params = match.params;
      await match.handler(req, res, ctx);
      if (!res.writableEnded) res.end();
      return;
    }

    /* ---------------- Pages ---------------- */
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { Allow: 'GET, HEAD' });
      return res.end('Method not allowed');
    }

    if (ADMIN_PAGES.has(pathname) && (!user || user.role !== 'admin')) {
      res.writeHead(302, { Location: '/login.html?next=/admin.html' });
      return res.end();
    }

    /* Friendly URLs. */
    const aliases = {
      '/admin': '/admin.html',
      '/login': '/login.html',
      '/account': '/account.html',
    };
    const target = aliases[pathname] || pathname;

    if (serveStatic(req, res, target)) return;

    /* Unknown page — fall back to the storefront. */
    if (serveStatic(req, res, '/index.html')) return;
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (err) {
    if (err instanceof HttpError) {
      const headers = err.retryAfter ? { 'Retry-After': String(err.retryAfter) } : {};
      return sendJson(res, err.status, { ok: false, error: err.message, code: err.code }, headers);
    }
    console.error('[error]', req.method, pathname, err);
    if (!res.headersSent) {
      return sendJson(res, 500, {
        ok: false,
        error: 'Something went wrong on our side. Please try again.',
        code: 'server_error',
      });
    }
    res.end();
  }
});

server.listen(config.port, () => {
  const settings = getSettings();
  const line = (label, value) => `  ${label.padEnd(13)} ${value}`;
  const title = settings.shop_name_en || 'Al-Talil Al-Ghali';
  const width = 56;
  console.log(`
╭${'─'.repeat(width)}╮
│  ${title.padEnd(width - 2)}│
╰${'─'.repeat(width)}╯
${line('Storefront', config.publicUrl)}
${line('Admin', `${config.publicUrl}/admin`)}
${line('Owner', config.adminEmails.join(', '))}
${line('Mail', config.mail.provider === 'console'
    ? 'console  ← codes are printed here, not e-mailed'
    : `${config.mail.provider} (${config.mail.from})`)}
${line('Database', config.dbFile)}
`);

  if (config.secretIsEphemeral) {
    console.warn(
      '  ⚠  SECRET_KEY is not set — everyone will be signed out on restart.\n' +
        '     Generate one:  node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"\n',
    );
  }
  if (config.isProduction && config.mail.provider === 'console') {
    console.warn(
      '  ⚠  MAIL_PROVIDER=console — login codes are NOT being e-mailed.\n' +
        '     Set MAIL_PROVIDER in .env before opening the shop to customers.\n',
    );
  }
});

const shutdown = () => {
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 3000).unref();
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
