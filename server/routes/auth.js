import { config } from '../config.js';
import { db } from '../db.js';
import {
  SESSION_COOKIE,
  normalizeEmail,
  assertValidEmail,
  createUser,
  authenticate,
  setPassword,
  verifyPassword,
  findUserByEmail,
  createSession,
  destroySession,
  destroyAllSessions,
  publicUser,
  requireUser,
} from '../auth.js';
import {
  readJson, sendJson, setCookie, clearCookie, clientIp, rateLimit, tooMany, badRequest, unauthorized,
} from '../http.js';

export function registerAuthRoutes(router) {
  /* ---------------------------------------------------------------- *
   * Create an account
   * ---------------------------------------------------------------- */
  router.post('/api/auth/register', async (req, res, ctx) => {
    const ip = clientIp(req);
    const limited = rateLimit(`register:${ip}`, 10, 3_600_000);
    if (!limited.allowed) {
      throw tooMany('Too many accounts created from this device. Please try again later.', limited.retryAfter);
    }

    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    assertValidEmail(email);

    const user = await createUser({
      email,
      password: body.password,
      name: body.name,
      phone: body.phone,
    });

    const token = createSession(user.id, { ip, userAgent: req.headers['user-agent'] || '' });
    setCookie(res, SESSION_COOKIE, token, { maxAge: config.auth.sessionMs });
    sendJson(res, 201, { ok: true, user: publicUser(user) });
  });

  /* ---------------------------------------------------------------- *
   * Sign in
   * ---------------------------------------------------------------- */
  router.post('/api/auth/login', async (req, res, ctx) => {
    const ip = clientIp(req);
    const limited = rateLimit(`login:ip:${ip}`, 40, 900_000);
    if (!limited.allowed) {
      throw tooMany('Too many sign-in attempts from this device. Please wait a few minutes.', limited.retryAfter);
    }

    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    assertValidEmail(email);

    const user = await authenticate(email, String(body.password ?? ''), ip);
    const token = createSession(user.id, { ip, userAgent: req.headers['user-agent'] || '' });

    setCookie(res, SESSION_COOKIE, token, { maxAge: config.auth.sessionMs });
    sendJson(res, 200, { ok: true, user: publicUser(user) });
  });

  /* ---------------------------------------------------------------- *
   * Session
   * ---------------------------------------------------------------- */
  router.get('/api/auth/me', async (req, res, ctx) => {
    sendJson(res, 200, { ok: true, user: publicUser(ctx.user) });
  });

  router.post('/api/auth/logout', async (req, res, ctx) => {
    destroySession(ctx.token);
    clearCookie(res, SESSION_COOKIE);
    sendJson(res, 200, { ok: true });
  });

  /* ---------------------------------------------------------------- *
   * Change password
   *
   * The current password is required, so someone who walks up to an
   * unlocked browser still cannot lock the owner out of their shop.
   * ---------------------------------------------------------------- */
  router.post('/api/auth/change-password', async (req, res, ctx) => {
    const user = requireUser(ctx);
    const body = await readJson(req);

    const current = String(body.current_password ?? '');
    const next = String(body.new_password ?? '');

    const fresh = findUserByEmail(user.email);
    if (!(await verifyPassword(current, fresh.password_hash))) {
      throw unauthorized('Your current password is not correct.');
    }
    if (current === next) throw badRequest('Please choose a different password.', 'same_password');

    await setPassword(user.id, next);

    /* Every other device is signed out; this one gets a fresh session. */
    destroyAllSessions(user.id);
    const token = createSession(user.id, {
      ip: clientIp(req),
      userAgent: req.headers['user-agent'] || '',
    });
    setCookie(res, SESSION_COOKIE, token, { maxAge: config.auth.sessionMs });

    sendJson(res, 200, { ok: true, message: 'Your password was changed. Other devices were signed out.' });
  });

  router.post('/api/auth/logout-everywhere', async (req, res, ctx) => {
    const user = requireUser(ctx);
    destroyAllSessions(user.id);
    clearCookie(res, SESSION_COOKIE);
    sendJson(res, 200, { ok: true });
  });

  /* ---------------------------------------------------------------- *
   * The signed-in customer's own details and orders
   * ---------------------------------------------------------------- */
  router.patch('/api/auth/profile', async (req, res, ctx) => {
    const user = requireUser(ctx);
    const body = await readJson(req);
    const text = (v, max) => String(v ?? '').trim().slice(0, max);

    db.prepare('UPDATE users SET name = ?, phone = ?, city = ?, address = ? WHERE id = ?').run(
      text(body.name ?? user.name, 80),
      text(body.phone ?? user.phone, 30),
      text(body.city ?? user.city, 60),
      text(body.address ?? user.address, 250),
      user.id,
    );
    sendJson(res, 200, { ok: true, user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) });
  });

  router.get('/api/auth/orders', async (req, res, ctx) => {
    const user = requireUser(ctx);
    const orders = db
      .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 50')
      .all(user.id);
    const itemStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id');
    for (const order of orders) order.items = itemStmt.all(order.id);
    sendJson(res, 200, { ok: true, orders });
  });
}
