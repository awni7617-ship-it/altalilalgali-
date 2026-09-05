import { config, isAdminEmail } from '../config.js';
import { db, getSetting } from '../db.js';
import { sendMail, loginCodeEmail } from '../mailer.js';
import {
  SESSION_COOKIE,
  normalizeEmail,
  assertValidEmail,
  issueLoginCode,
  verifyLoginCode,
  createSession,
  destroySession,
  destroyAllSessions,
  publicUser,
  requireUser,
} from '../auth.js';
import { readJson, sendJson, setCookie, clearCookie, clientIp, rateLimit, tooMany, badRequest } from '../http.js';

export function registerAuthRoutes(router) {
  /* ---------------------------------------------------------------- *
   * Step 1 — ask for a code
   * ---------------------------------------------------------------- */
  router.post('/api/auth/request-code', async (req, res, ctx) => {
    const ip = clientIp(req);
    const perIp = rateLimit(`code:ip:${ip}`, 12, 3_600_000);
    if (!perIp.allowed) {
      throw tooMany('Too many requests from this device. Please try again later.', perIp.retryAfter);
    }

    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    assertValidEmail(email);

    const code = issueLoginCode(email, ip);
    const minutes = Math.round(config.auth.codeTtlMs / 60_000);
    const shopName = getSetting('shop_name_ar') || 'Al-Talil Al-Ghali';
    const admin = isAdminEmail(email);
    const { html, text } = loginCodeEmail({ code, shopName, minutes, isAdmin: admin });

    let delivery = { delivered: false, provider: config.mail.provider };
    try {
      delivery = await sendMail({
        to: email,
        subject: `${code} — رمز الدخول · your sign-in code`,
        html,
        text,
      });
    } catch (err) {
      console.error('[mail] delivery failed:', err.message);
      /* The code exists either way. Say so honestly rather than
       * pretending the mail was sent. */
      return sendJson(res, 502, {
        ok: false,
        error: 'The code could not be e-mailed. Please check the mail settings and try again.',
        code: 'mail_failed',
        detail: config.isProduction ? undefined : err.message,
      });
    }

    sendJson(res, 200, {
      ok: true,
      email,
      is_admin: admin,
      expires_in_minutes: minutes,
      delivered: delivery.delivered,
      /* Only when no mail provider is configured, so the owner can
       * still get in while setting the shop up. Never in production
       * with a real provider. */
      dev_code: delivery.provider === 'console' ? code : undefined,
      message: delivery.delivered
        ? 'We sent a sign-in code to your e-mail.'
        : 'Mail is not configured yet — the code is shown here and printed in the server log.',
    });
  });

  /* ---------------------------------------------------------------- *
   * Step 2 — exchange the code for a session
   * ---------------------------------------------------------------- */
  router.post('/api/auth/verify', async (req, res, ctx) => {
    const ip = clientIp(req);
    const perIp = rateLimit(`verify:ip:${ip}`, 30, 900_000);
    if (!perIp.allowed) {
      throw tooMany('Too many attempts from this device. Please wait a few minutes.', perIp.retryAfter);
    }

    const body = await readJson(req);
    const email = normalizeEmail(body.email);
    assertValidEmail(email);

    const user = verifyLoginCode(email, body.code);
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
    const fresh = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    sendJson(res, 200, { ok: true, user: publicUser(fresh) });
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
