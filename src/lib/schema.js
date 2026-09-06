/**
 * The schema, as statements the Worker itself can run.
 *
 * This is the single source of truth: `migrations/0001_init.sql` is generated
 * from it by `npm run build:migration`, and `npm run check` fails if the two
 * have drifted.
 *
 * Keeping it here as well as in a migration file earns its place because a
 * Worker can meet a database nobody has migrated — the Deploy to Cloudflare
 * flow provisions an empty D1 and never runs wrangler's migrations. Rather
 * than serve 500s until someone notices, the Worker creates what is missing
 * and carries on. Every statement is IF NOT EXISTS, so running it against a
 * database that is already set up changes nothing.
 *
 * Changing an existing table is still a migration: add a new numbered file.
 * This only ever brings an empty database up to the starting line.
 */

export const SCHEMA = [
  // Shop-wide settings, one row per key, so a new setting is never a migration.
  `CREATE TABLE IF NOT EXISTS settings (
     key   TEXT PRIMARY KEY,
     value TEXT NOT NULL
   )`,

  `CREATE TABLE IF NOT EXISTS categories (
     slug     TEXT PRIMARY KEY,
     name     TEXT NOT NULL,
     icon     TEXT NOT NULL DEFAULT '',
     position INTEGER NOT NULL DEFAULT 0
   )`,

  `CREATE TABLE IF NOT EXISTS products (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     cat        TEXT NOT NULL DEFAULT '',
     house      TEXT NOT NULL DEFAULT '',
     name       TEXT NOT NULL,
     blurb      TEXT NOT NULL DEFAULT '',
     price      REAL NOT NULL DEFAULT 0,
     was        REAL NOT NULL DEFAULT 0,
     cost       REAL NOT NULL DEFAULT 0,
     stock      INTEGER NOT NULL DEFAULT 0,
     live       INTEGER NOT NULL DEFAULT 1,
     pick       INTEGER NOT NULL DEFAULT 0,
     created_at TEXT NOT NULL,
     updated_at TEXT NOT NULL
   )`,
  'CREATE INDEX IF NOT EXISTS products_cat_idx ON products (cat)',
  'CREATE INDEX IF NOT EXISTS products_live_idx ON products (live)',

  // One photograph per row. Kept apart from the product so a single write is
  // never megabytes, and so /photo/<id> can be cached forever by the browser.
  `CREATE TABLE IF NOT EXISTS photos (
     id         TEXT PRIMARY KEY,
     product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
     position   INTEGER NOT NULL DEFAULT 0,
     mime       TEXT NOT NULL DEFAULT 'image/jpeg',
     bytes      INTEGER NOT NULL DEFAULT 0,
     data       TEXT NOT NULL,
     created_at TEXT NOT NULL
   )`,
  'CREATE INDEX IF NOT EXISTS photos_product_idx ON photos (product_id, position)',

  `CREATE TABLE IF NOT EXISTS users (
     id         TEXT PRIMARY KEY,
     email      TEXT NOT NULL,
     password   TEXT NOT NULL,
     created_at TEXT NOT NULL,
     last_seen_at TEXT
   )`,
  'CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email)',

  `CREATE TABLE IF NOT EXISTS sessions (
     id         TEXT PRIMARY KEY,
     user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     created_at TEXT NOT NULL,
     expires_at TEXT NOT NULL,
     user_agent TEXT
   )`,
  'CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at)',

  // Orders live here rather than only in a WhatsApp thread, so the shop can
  // still answer "what did she order in March" after the phone is wiped.
  `CREATE TABLE IF NOT EXISTS orders (
     id          TEXT PRIMARY KEY,
     ref         TEXT NOT NULL UNIQUE,
     customer    TEXT NOT NULL,
     phone       TEXT NOT NULL,
     city        TEXT NOT NULL,
     address     TEXT NOT NULL,
     note        TEXT NOT NULL DEFAULT '',
     subtotal    REAL NOT NULL DEFAULT 0,
     shipping    REAL NOT NULL DEFAULT 0,
     total       REAL NOT NULL DEFAULT 0,
     status      TEXT NOT NULL DEFAULT 'new',
     stock_taken INTEGER NOT NULL DEFAULT 0,
     created_at  TEXT NOT NULL,
     updated_at  TEXT NOT NULL
   )`,
  'CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at)',
  'CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status)',

  // The name and price are copied in, not joined: an order is a record of what
  // was agreed, and it must not change when the shop re-prices the product.
  `CREATE TABLE IF NOT EXISTS order_items (
     id         TEXT PRIMARY KEY,
     order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
     product_id INTEGER,
     name       TEXT NOT NULL,
     price      REAL NOT NULL DEFAULT 0,
     qty        INTEGER NOT NULL DEFAULT 1
   )`,
  'CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id)',

  // Sign-in throttling. In the database rather than KV so the one-click deploy
  // has one resource to create, not two.
  `CREATE TABLE IF NOT EXISTS login_attempts (
     ip         TEXT PRIMARY KEY,
     count      INTEGER NOT NULL DEFAULT 0,
     window_end TEXT NOT NULL
   )`,
];

export async function ensureSchema(env) {
  for (const sql of SCHEMA) await env.DB.prepare(sql).run();
}

/** D1 and SQLite word this differently; both mean "nobody has migrated yet". */
export function isMissingTable(err) {
  return /no such table|not a database|D1_ERROR.*no such table/i.test(String((err && err.message) || err));
}
