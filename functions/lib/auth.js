/* ==================================================================
   Accounts, passwords and sessions on Cloudflare.

   Workers have WebCrypto rather than Node's crypto, so passwords are
   hashed with PBKDF2-SHA256 — the strongest key-derivation function
   the platform offers natively.
   ================================================================== */
import { badRequest, unauthorized, forbidden, tooMany, rateLimit, clearRateLimit } from './http.js';

const encoder = new TextEncoder();

export const SESSION_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 8;
const LOCKOUT_MS = 15 * 60 * 1000;

/** Higher is safer but costs CPU on every sign-in; PBKDF2_ITERATIONS
 *  can lower it if Cloudflare's free CPU limit becomes a problem. */
function iterations(env) {
  const n = Number.parseInt(env.PBKDF2_ITERATIONS || '', 10);
  return Number.isFinite(n) && n >= 10_000 && n <= 1_000_000 ? n : 100_000;
}

const toBase64 = (bytes) => btoa(String.fromCharCode(...new Uint8Array(bytes)));
const fromBase64 = (text) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));

async function derive(password, salt, iters) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(password.normalize('NFKC')), 'PBKDF2', false, ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: iters, hash: 'SHA-256' }, key, 256,
  );
  return new Uint8Array(bits);
}

export async function hashPassword(password, env) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iters = iterations(env);
  const hash = await derive(password, salt, iters);
  return `pbkdf2$${iters}$${toBase64(salt)}$${toBase64(hash)}`;
}

export async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;

  const iters = Number(parts[1]);
  if (!Number.isFinite(iters) || iters < 1000) return false;

  let salt;
  let expected;
  try {
    salt = fromBase64(parts[2]);
    expected = fromBase64(parts[3]);
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  const actual = await derive(password, salt, iters);
  if (actual.length !== expected.length) return false;

  /* Constant-time compare, so the check leaks nothing through timing. */
  let diff = 0;
  for (let i = 0; i < actual.length; i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}

/* ------------------------------------------------------------------ *
 * E-mail
 * ------------------------------------------------------------------ */
const EMAIL_RE = /^[^\s@,;:<>()[\]\\]+@[^\s@.,;:<>()[\]\\]+(\.[^\s@.,;:<>()[\]\\]+)+$/;

export const normalizeEmail = (v) => String(v ?? '').trim().toLowerCase();

export function assertValidEmail(email) {
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    throw badRequest('Please enter a valid e-mail address.', 'invalid_email');
  }
  return email;
}

export function adminEmails(env) {
  return String(env.ADMIN_EMAILS || 'carsyardltd@icloud.com')
    .split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
}

export const isAdminEmail = (email, env) => adminEmails(env).includes(normalizeEmail(email));

/* ------------------------------------------------------------------ *
 * Accounts
 * ------------------------------------------------------------------ */
export const findUserByEmail = (db, email) =>
  db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();

/** Keep the stored role in step with ADMIN_EMAILS, both ways. */
async function syncRole(db, user, env) {
  const role = isAdminEmail(user.email, env) ? 'admin' : 'customer';
  if (user.role !== role) {
    await db.prepare('UPDATE users SET role = ? WHERE id = ?').bind(role, user.id).run();
    user.role = role;
  }
  return user;
}

export function checkPasswordStrength(password) {
  const value = String(password ?? '');
  if (value.length < 8) return 'Your password needs at least 8 characters.';
  if (value.length > 200) return 'That password is too long.';
  if (!/[^\s]/.test(value)) return 'Your password cannot be only spaces.';
  return '';
}

export async function createUser(db, env, { email, password, name = '', phone = '' }) {
  assertValidEmail(email);
  const problem = checkPasswordStrength(password);
  if (problem) throw badRequest(problem, 'weak_password');

  if (await findUserByEmail(db, email)) {
    throw badRequest('An account with this e-mail already exists. Please sign in instead.', 'email_taken');
  }

  const hash = await hashPassword(password, env);
  const role = isAdminEmail(email, env) ? 'admin' : 'customer';
  await db
    .prepare('INSERT INTO users (email, password_hash, name, phone, role) VALUES (?, ?, ?, ?, ?)')
    .bind(email, hash, String(name).trim().slice(0, 80), String(phone).trim().slice(0, 30), role)
    .run();

  return findUserByEmail(db, email);
}

/**
 * A wrong address and a wrong password fail identically and cost the
 * same time, so this cannot be used to discover who has an account.
 */
export async function authenticate(db, env, email, password) {
  const bucket = `login:${email}`;
  const limited = await rateLimit(db, bucket, MAX_LOGIN_ATTEMPTS, LOCKOUT_MS);
  if (!limited.allowed) {
    throw tooMany(
      `Too many sign-in attempts for this address. Please try again in ${Math.ceil(limited.retryAfter / 60)} minutes.`,
      limited.retryAfter,
    );
  }

  const user = await findUserByEmail(db, email);
  /* Hash against a decoy when the address is unknown, so both paths
   * take the same time. */
  const stored = user?.password_hash || (await decoyHash(env));
  const ok = await verifyPassword(password, stored);

  if (!user || !ok) throw unauthorized('That e-mail or password is not correct.');
  if (user.is_blocked) throw forbidden('This account has been disabled.');

  await clearRateLimit(db, bucket);
  await syncRole(db, user, env);
  await db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").bind(user.id).run();
  return user;
}

let decoyCache = null;
async function decoyHash(env) {
  if (!decoyCache) {
    decoyCache = await hashPassword(crypto.randomUUID() + crypto.randomUUID(), env);
  }
  return decoyCache;
}

export async function setPassword(db, env, userId, password) {
  const problem = checkPasswordStrength(password);
  if (problem) throw badRequest(problem, 'weak_password');

  const hash = await hashPassword(password, env);
  await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').bind(hash, userId).run();

  /* Forgetting a password is the usual reason an address gets locked
   * out, so a new password has to lift the lockout with it. */
  const row = await db.prepare('SELECT email FROM users WHERE id = ?').bind(userId).first();
  if (row) await clearRateLimit(db, `login:${normalizeEmail(row.email)}`);
}

/** Sign in someone returning from Google or Apple. The e-mail is the
 *  identity, so a password account with the same address is reused. */
export async function userFromProvider(db, env, { provider, providerId, email, name }) {
  assertValidEmail(email);
  const existing = await findUserByEmail(db, email);

  if (existing) {
    if (existing.is_blocked) throw forbidden('This account has been disabled.');
    await db
      .prepare(
        `UPDATE users SET provider = ?, provider_id = ?,
           name = CASE WHEN name = '' THEN ? ELSE name END,
           last_login_at = datetime('now')
         WHERE id = ?`,
      )
      .bind(provider, providerId || '', String(name || '').trim().slice(0, 80), existing.id)
      .run();
    await clearRateLimit(db, `login:${email}`);
    return syncRole(db, await findUserByEmail(db, email), env);
  }

  const role = isAdminEmail(email, env) ? 'admin' : 'customer';
  await db
    .prepare(
      `INSERT INTO users (email, password_hash, name, role, provider, provider_id, last_login_at)
       VALUES (?, '', ?, ?, ?, ?, datetime('now'))`,
    )
    .bind(email, String(name || '').trim().slice(0, 80), role, provider, providerId || '')
    .run();

  return findUserByEmail(db, email);
}

export function publicUser(user) {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email,
    name: user.name || '',
    phone: user.phone || '',
    city: user.city || '',
    address: user.address || '',
    role: user.role,
    is_admin: user.role === 'admin',
    created_at: user.created_at,
  };
}

/* ------------------------------------------------------------------ *
 * Sessions — the cookie holds a random token, the database only its
 * hash, so a leaked database cannot impersonate anyone.
 * ------------------------------------------------------------------ */
async function hashToken(token, env) {
  const key = await crypto.subtle.importKey(
    'raw', encoder.encode(String(env.SECRET_KEY || 'insecure-development-key')),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(token));
  return toBase64(sig);
}

export async function createSession(db, env, userId, { ip = '', userAgent = '' } = {}) {
  const token = toBase64(crypto.getRandomValues(new Uint8Array(32)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const now = Date.now();

  await db
    .prepare(
      `INSERT INTO sessions (id, user_id, expires_at, ip, user_agent, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .bind(await hashToken(token, env), userId, now + SESSION_MS, ip, String(userAgent).slice(0, 250), now)
    .run();

  await db.prepare('DELETE FROM sessions WHERE expires_at < ?').bind(now).run();
  return token;
}

export async function getSessionUser(db, env, token) {
  if (!token) return null;
  const row = await db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .bind(await hashToken(token, env), Date.now())
    .first();
  if (!row || row.is_blocked) return null;
  return syncRole(db, row, env);
}

export async function destroySession(db, env, token) {
  if (!token) return;
  await db.prepare('DELETE FROM sessions WHERE id = ?').bind(await hashToken(token, env)).run();
}

export const destroyAllSessions = (db, userId) =>
  db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();

/* ------------------------------------------------------------------ *
 * Guards
 * ------------------------------------------------------------------ */
export function requireUser(user) {
  if (!user) throw unauthorized('Please sign in to continue.');
  return user;
}

export function requireAdmin(user) {
  requireUser(user);
  if (user.role !== 'admin') throw forbidden('This area is for the store owner only.');
  return user;
}

/**
 * Make sure the owner account exists.
 *
 * There is no terminal on Cloudflare to print a generated password
 * into, so the owner password comes from ADMIN_PASSWORD and the
 * account is created, or brought back in step, on first use.
 */
export async function ensureOwner(db, env) {
  const email = adminEmails(env)[0];
  const chosen = String(env.ADMIN_PASSWORD || '');
  if (!email || !chosen || checkPasswordStrength(chosen)) return;

  const existing = await findUserByEmail(db, email);
  if (!existing) {
    await createUser(db, env, { email, password: chosen });
    return;
  }
  if (!(await verifyPassword(chosen, existing.password_hash))) {
    await setPassword(db, env, existing.id, chosen);
  }
}
