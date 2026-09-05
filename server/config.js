import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(fileURLToPath(new URL('../', import.meta.url)));

/* ------------------------------------------------------------------ *
 * .env loading — small and dependency free.
 * Real environment variables always win over the file.
 * ------------------------------------------------------------------ */
function loadEnvFile() {
  const file = path.join(ROOT, '.env');
  if (!existsSync(file)) return;
  const text = readFileSync(file, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile();

const env = process.env;
const bool = (v, fallback = false) => {
  if (v === undefined || v === '') return fallback;
  return /^(1|true|yes|on)$/i.test(String(v).trim());
};
const int = (v, fallback) => {
  const n = Number.parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
};

const isProduction = (env.NODE_ENV || 'production') === 'production';

/* A missing SECRET_KEY must not stop the shop from starting — it just
 * means sessions do not survive a restart. We warn loudly instead. */
let secretKey = (env.SECRET_KEY || '').trim();
let secretIsEphemeral = false;
if (secretKey.length < 32) {
  secretKey = randomBytes(48).toString('hex');
  secretIsEphemeral = true;
}

const dataDir = path.join(ROOT, 'data');
const uploadDir = path.join(ROOT, 'public', 'uploads');
for (const dir of [dataDir, uploadDir]) {
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export const config = {
  isProduction,
  port: int(env.PORT, 3000),
  publicUrl: (env.PUBLIC_URL || `http://localhost:${int(env.PORT, 3000)}`).replace(/\/+$/, ''),

  secretKey,
  secretIsEphemeral,

  dataDir,
  uploadDir,
  publicDir: path.join(ROOT, 'public'),
  dbFile: path.join(dataDir, 'shop.db'),

  /* The owner's address is baked in as the default so the shop is
   * usable out of the box, but ADMIN_EMAILS can override it. */
  adminEmails: (env.ADMIN_EMAILS || 'carsyardltd@icloud.com')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean),

  mail: {
    provider: (env.MAIL_PROVIDER || 'console').trim().toLowerCase(),
    fromName: env.MAIL_FROM_NAME || 'Al-Talil Al-Ghali',
    from: env.MAIL_FROM || 'no-reply@example.com',
    smtp: {
      host: env.SMTP_HOST || '',
      port: int(env.SMTP_PORT, 465),
      user: env.SMTP_USER || '',
      pass: env.SMTP_PASS || '',
      secure: bool(env.SMTP_SECURE, int(env.SMTP_PORT, 465) === 465),
    },
    resendKey: env.RESEND_API_KEY || '',
    brevoKey: env.BREVO_API_KEY || '',
    /* Overridable so the shop can post through a regional endpoint or a
     * corporate relay instead of the public API host. */
    resendUrl: env.RESEND_API_URL || 'https://api.resend.com/emails',
    brevoUrl: env.BREVO_API_URL || 'https://api.brevo.com/v3/smtp/email',
  },

  auth: {
    codeTtlMs: int(env.CODE_TTL_MINUTES, 10) * 60_000,
    codeMaxAttempts: int(env.CODE_MAX_ATTEMPTS, 5),
    codeRequestsPerHour: int(env.CODE_REQUESTS_PER_HOUR, 5),
    sessionMs: int(env.SESSION_DAYS, 30) * 24 * 60 * 60_000,
    codeLength: 6,
  },

  shop: {
    whatsapp: (env.SHOP_WHATSAPP || '970590000000').replace(/[^0-9]/g, ''),
  },
};

export function isAdminEmail(email) {
  return config.adminEmails.includes(String(email || '').trim().toLowerCase());
}
