import { randomInt, randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import { db } from './db.js';
import { config, isAdminEmail } from './config.js';
import { HttpError, badRequest, unauthorized, forbidden, tooMany } from './http.js';

export const SESSION_COOKIE = 'shop_session';

/* ------------------------------------------------------------------ *
 * E-mail handling
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
 * Login codes
 * ------------------------------------------------------------------ */
function hashCode(email, code) {
  return createHmac('sha256', config.secretKey).update(`${email}:${code}`).digest('hex');
}

function safeEqualHex(a, b) {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

function generateCode() {
  const max = 10 ** config.auth.codeLength;
  return String(randomInt(0, max)).padStart(config.auth.codeLength, '0');
}

/**
 * Create a one-time login code for an address.
 * Throws a 429 if the address has asked too often in the last hour.
 */
export function issueLoginCode(email, ip) {
  const hourAgo = Date.now() - 3_600_000;
  const recent = db
    .prepare('SELECT COUNT(*) AS n FROM login_codes WHERE email = ? AND created_at > ?')
    .get(email, hourAgo);
  if ((recent?.n || 0) >= config.auth.codeRequestsPerHour) {
    throw tooMany(
      'Too many codes requested for this address. Please wait an hour and try again.',
      3600,
    );
  }

  /* Any earlier code for this address stops working immediately. */
  db.prepare('UPDATE login_codes SET consumed = 1 WHERE email = ? AND consumed = 0').run(email);

  const code = generateCode();
  const now = Date.now();
  db.prepare(
    `INSERT INTO login_codes (email, code_hash, expires_at, ip, created_at)
     VALUES (?, ?, ?, ?, ?)`,
  ).run(email, hashCode(email, code), now + config.auth.codeTtlMs, ip || '', now);

  /* Opportunistic cleanup of anything long expired. */
  db.prepare('DELETE FROM login_codes WHERE expires_at < ?').run(now - 86_400_000);

  return code;
}

/**
 * Check a submitted code. Returns the user row on success.
 * Every failure path costs the requester one of their attempts.
 */
export function verifyLoginCode(email, submitted) {
  const clean = String(submitted ?? '').replace(/\D/g, '');
  if (clean.length !== config.auth.codeLength) {
    throw badRequest(`Enter the ${config.auth.codeLength}-digit code from your e-mail.`, 'bad_code');
  }

  const row = db
    .prepare(
      `SELECT * FROM login_codes WHERE email = ? AND consumed = 0
       ORDER BY created_at DESC LIMIT 1`,
    )
    .get(email);

  if (!row) {
    throw badRequest('That code is not valid. Please request a new one.', 'bad_code');
  }
  if (row.expires_at < Date.now()) {
    db.prepare('UPDATE login_codes SET consumed = 1 WHERE id = ?').run(row.id);
    throw badRequest('That code has expired. Please request a new one.', 'expired');
  }
  if (row.attempts >= config.auth.codeMaxAttempts) {
    db.prepare('UPDATE login_codes SET consumed = 1 WHERE id = ?').run(row.id);
    throw tooMany('Too many wrong attempts. Please request a new code.', 60);
  }

  if (!safeEqualHex(row.code_hash, hashCode(email, clean))) {
    db.prepare('UPDATE login_codes SET attempts = attempts + 1 WHERE id = ?').run(row.id);
    const left = config.auth.codeMaxAttempts - (row.attempts + 1);
    throw badRequest(
      left > 0
        ? `That code is not correct. ${left} ${left === 1 ? 'try' : 'tries'} left.`
        : 'That code is not correct. Please request a new one.',
      'bad_code',
    );
  }

  db.prepare('UPDATE login_codes SET consumed = 1 WHERE id = ?').run(row.id);
  return upsertUser(email);
}

/* ------------------------------------------------------------------ *
 * Users
 * ------------------------------------------------------------------ */
export function upsertUser(email) {
  const role = isAdminEmail(email) ? 'admin' : 'customer';
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);

  if (!user) {
    db.prepare('INSERT INTO users (email, role) VALUES (?, ?)').run(email, role);
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  } else if (user.role !== role) {
    /* Keep the role in step with ADMIN_EMAILS, in both directions, so
     * granting or revoking ownership is just a config change. */
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, user.id);
    user.role = role;
  }

  if (user.is_blocked) throw forbidden('This account has been disabled.');

  db.prepare("UPDATE users SET last_login_at = datetime('now') WHERE id = ?").run(user.id);
  return user;
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
 * The cookie holds a random token; the database only ever stores its
 * hash, so a leaked database cannot be used to impersonate anyone.
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

  /* Ownership is decided by configuration, not by a stale row. */
  const role = isAdminEmail(row.email) ? 'admin' : 'customer';
  if (row.role !== role) {
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, row.id);
    row.role = role;
  }
  return row;
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
