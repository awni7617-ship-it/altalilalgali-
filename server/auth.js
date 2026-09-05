import { randomBytes, scrypt, createHmac, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { db } from './db.js';
import { config, isAdminEmail } from './config.js';
import { HttpError, badRequest, unauthorized, forbidden, tooMany, rateLimit } from './http.js';

const scryptAsync = promisify(scrypt);

export const SESSION_COOKIE = 'shop_session';

/* ------------------------------------------------------------------ *
 * E-mail addresses
 * ------------------------------------------------------------------ */
const EMAIL_RE = /^[^\s@,;:<>()[\]\\]+@[^\s@.,;:<>()[\]\\]+(\.[^\s@.,;:<>()[\]\\]+)+$/;

export function normalizeEmail(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function assertValidEmail(email) {
  if (!email || email.length > 254 || !EMAIL_RE.test(email)) {
    throw badRequest('Please enter a valid e-mail address.', 'invalid_email');
  }
  return email;
}

/* ------------------------------------------------------------------ *
 * Passwords
 *
 * scrypt is memory-hard and part of Node's standard library, so the
 * shop keeps its promise of having no dependencies while still storing
 * passwords properly. The parameters live in the stored string, so
 * they can be raised later without invalidating existing passwords.
 * ------------------------------------------------------------------ */
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64, maxmem: 64 * 1024 * 1024 };

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await scryptAsync(String(password).normalize('NFKC'), salt, SCRYPT.keylen, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(password, stored) {
  if (!stored || typeof stored !== 'string') return false;
  const parts = stored.split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;

  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isFinite(N) || !Number.isFinite(r) || !Number.isFinite(p)) return false;

  let salt;
  let expected;
  try {
    salt = Buffer.from(parts[4], 'base64');
    expected = Buffer.from(parts[5], 'base64');
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  const key = await scryptAsync(String(password).normalize('NFKC'), salt, expected.length, {
    N, r, p, maxmem: SCRYPT.maxmem,
  });
  return key.length === expected.length && timingSafeEqual(key, expected);
}

/** A hash of a value nobody can supply, so a login for an unknown
 *  address still costs the same time as a real one. */
const DECOY_HASH = await hashPassword(randomBytes(32).toString('hex'));

export function checkPasswordStrength(password) {
  const value = String(password ?? '');
  if (value.length < config.auth.minPasswordLength) {
    return `Your password needs at least ${config.auth.minPasswordLength} characters.`;
  }
  if (value.length > 200) return 'That password is too long.';
  if (!/[^\s]/.test(value)) return 'Your password cannot be only spaces.';
  return '';
}

/* ------------------------------------------------------------------ *
 * Accounts
 * ------------------------------------------------------------------ */
export function findUserByEmail(email) {
  return db.prepare('SELECT * FROM users WHERE email = ?').get(email) || null;
}

/** Keep the stored role in step with ADMIN_EMAILS, in both directions. */
function syncRole(user) {
  const role = isAdminEmail(user.email) ? 'admin' : 'customer';
  if (user.role !== role) {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user.id);
    user.role = role;
  }
  return user;
}

export async function createUser({ email, password, name = '', phone = '' }) {
  assertValidEmail(email);
  const problem = checkPasswordStrength(password);
  if (problem) throw badRequest(problem, 'weak_password');

  if (findUserByEmail(email)) {
    throw badRequest('An account with this e-mail already exists. Please sign in instead.', 'email_taken');
  }

  const hash = await hashPassword(password);
  const role = isAdminEmail(email) ? 'admin' : 'customer';
  db.prepare(
    'INSERT INTO users (email, password_hash, name, phone, role) VALUES (?, ?, ?, ?, ?)',
  ).run(email, hash, String(name).trim().slice(0, 80), String(phone).trim().slice(0, 30), role);

  return findUserByEmail(email);
}

/**
 * Check an e-mail and password.
 *
 * Wrong addresses and wrong passwords fail identically, and both cost
 * the same time, so this cannot be used to discover who has an account.
 */
export async function authenticate(email, password, ip = '') {
  const attemptKey = `login:${email}`;
  const attempts = rateLimit(attemptKey, config.auth.maxLoginAttempts, config.auth.lockoutMs);
  if (!attempts.allowed) {
    throw tooMany(
      `Too many sign-in attempts for this address. Please try again in ${Math.ceil(attempts.retryAfter / 60)} minutes.`,
      attempts.retryAfter,
    );
  }

  const user = findUserByEmail(email);
  const ok = await verifyPassword(password, user ? user.password_hash : DECOY_HASH);

  if (!user || !ok) {
    throw unauthorized('That e-mail or password is not correct.');
  }
  if (user.is_blocked) throw forbidden('This account has been disabled.');

  /* A clean sign-in clears the failure count for the address. */
  rateLimit(attemptKey, config.auth.maxLoginAttempts, config.auth.lockoutMs, { reset: true });

  syncRole(user);
  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
  return user;
}

export async function setPassword(userId, password) {
  const problem = checkPasswordStrength(password);
  if (problem) throw badRequest(problem, 'weak_password');
  const hash = await hashPassword(password);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, userId);

  /* Forgetting a password is the usual reason an address gets locked
   * out, so a new password has to lift the lockout too — otherwise the
   * reset hands someone a password they still cannot use. */
  const row = db.prepare('SELECT email FROM users WHERE id = ?').get(userId);
  if (row) {
    rateLimit(`login:${normalizeEmail(row.email)}`, config.auth.maxLoginAttempts, config.auth.lockoutMs, { reset: true });
  }
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
 * Sessions
 *
 * The cookie holds a random token; the database stores only its hash,
 * so a leaked database cannot be used to impersonate anyone.
 * ------------------------------------------------------------------ */
function hashToken(token) {
  return createHmac('sha256', config.secretKey).update(token).digest('hex');
}

export function createSession(userId, { ip = '', userAgent = '' } = {}) {
  const token = randomBytes(32).toString('base64url');
  const now = Date.now();
  db.prepare(
    `INSERT INTO sessions (id, user_id, expires_at, ip, user_agent, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(hashToken(token), userId, now + config.auth.sessionMs, ip, String(userAgent).slice(0, 250), now);

  db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(now);
  return token;
}

export function getSessionUser(token) {
  if (!token) return null;
  const row = db
    .prepare(
      `SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.id = ? AND s.expires_at > ?`,
    )
    .get(hashToken(token), Date.now());
  if (!row || row.is_blocked) return null;
  return syncRole(row);
}

export function destroySession(token) {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE id = ?').run(hashToken(token));
}

export function destroyAllSessions(userId) {
  db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

/* ------------------------------------------------------------------ *
 * Guards
 * ------------------------------------------------------------------ */
export function requireUser(ctx) {
  if (!ctx.user) throw unauthorized('Please sign in to continue.');
  return ctx.user;
}

export function requireAdmin(ctx) {
  const user = requireUser(ctx);
  if (user.role !== 'admin') throw forbidden('This area is for the store owner only.');
  return user;
}

export { HttpError };
