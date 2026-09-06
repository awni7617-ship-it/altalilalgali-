/**
 * The shopkeeper's session.
 *
 * The cookie carries an opaque random id and nothing else; the row lives in
 * D1, so a stolen cookie can be revoked and nothing about the account travels
 * in it. HttpOnly, so a script on the page can never read it.
 */
import { nowIso, uid, fail } from './lib/model.js';
import { bytesToHex, hashPassword, verifyPassword } from './lib/password.js';

const SESSION_DAYS = 30;
export const COOKIE = 'dk_session';

export { hashPassword, verifyPassword };

export async function createSession(env, user, request) {
  const id = `${uid()}.${bytesToHex(crypto.getRandomValues(new Uint8Array(24)))}`;
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000).toISOString();
  await env.DB.prepare(
    'INSERT INTO sessions (id, user_id, created_at, expires_at, user_agent) VALUES (?, ?, ?, ?, ?)',
  ).bind(id, user.id, nowIso(), expires, (request.headers.get('user-agent') || '').slice(0, 200)).run();
  return id;
}

export async function endSession(env, request) {
  const id = readCookie(request);
  if (id) await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
}

export function cookieHeader(id, url) {
  const secure = url.protocol === 'https:' ? ' Secure;' : '';
  return id
    ? `${COOKIE}=${id}; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`
    : `${COOKIE}=; Path=/; HttpOnly;${secure} SameSite=Lax; Max-Age=0`;
}

export function readCookie(request) {
  const raw = request.headers.get('cookie') || '';
  const match = raw.match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  return match ? match[1] : null;
}

/** The signed-in shopkeeper, or null. Expired sessions are swept on sight. */
export async function currentUser(env, request) {
  const id = readCookie(request);
  if (!id) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.email, u.password, s.expires_at
       FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.id = ?`,
  ).bind(id).first();
  if (!row) return null;
  if (Date.parse(row.expires_at) < Date.now()) {
    await env.DB.prepare('DELETE FROM sessions WHERE id = ?').bind(id).run();
    return null;
  }
  return { id: row.id, email: row.email, password: row.password, session_id: id };
}

/**
 * Sign-in is the only door into the back office and the shop is on the open
 * internet, so attempts are counted per IP. Kept in D1 rather than KV so the
 * one-click deploy has one resource to create instead of two.
 */
export async function throttle(env, request, { limit = 10, windowSeconds = 600 } = {}) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  const now = Date.now();
  let row = null;
  try {
    row = await env.DB.prepare('SELECT count, window_end FROM login_attempts WHERE ip = ?').bind(ip).first();
  } catch {
    return; // A throttle that is broken must not lock the shopkeeper out.
  }
  const open = row && Date.parse(row.window_end) > now;
  if (open && Number(row.count) >= limit) {
    fail(429, 'محاولات كثيرة. انتظري عشر دقائق ثم جرّبي مرة أخرى.');
  }
  const count = open ? Number(row.count) + 1 : 1;
  const end = open ? row.window_end : new Date(now + windowSeconds * 1000).toISOString();
  try {
    await env.DB.prepare(
      `INSERT INTO login_attempts (ip, count, window_end) VALUES (?, ?, ?)
       ON CONFLICT(ip) DO UPDATE SET count = excluded.count, window_end = excluded.window_end`,
    ).bind(ip, count, end).run();
  } catch { /* best effort */ }
}

/** A successful sign-in clears the count, so one bad day is not a lockout. */
export async function clearThrottle(env, request) {
  const ip = request.headers.get('cf-connecting-ip') || 'unknown';
  try {
    await env.DB.prepare('DELETE FROM login_attempts WHERE ip = ?').bind(ip).run();
  } catch { /* best effort */ }
}
