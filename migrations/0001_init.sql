-- دار الكحل — initial schema.
--
-- GENERATED FROM src/lib/schema.js — do not edit by hand.
-- Run `npm run build:migration` after changing the schema there.

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories (
  slug     TEXT PRIMARY KEY,
  name     TEXT NOT NULL,
  icon     TEXT NOT NULL DEFAULT '',
  position INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products (
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
);

CREATE INDEX IF NOT EXISTS products_cat_idx ON products (cat);

CREATE INDEX IF NOT EXISTS products_live_idx ON products (live);

CREATE TABLE IF NOT EXISTS photos (
  id         TEXT PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  position   INTEGER NOT NULL DEFAULT 0,
  mime       TEXT NOT NULL DEFAULT 'image/jpeg',
  bytes      INTEGER NOT NULL DEFAULT 0,
  data       TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS photos_product_idx ON photos (product_id, position);

CREATE TABLE IF NOT EXISTS users (
  id         TEXT PRIMARY KEY,
  email      TEXT NOT NULL,
  password   TEXT NOT NULL,
  created_at TEXT NOT NULL,
  last_seen_at TEXT
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS sessions_expiry_idx ON sessions (expires_at);

CREATE TABLE IF NOT EXISTS orders (
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
);

CREATE INDEX IF NOT EXISTS orders_created_idx ON orders (created_at);

CREATE INDEX IF NOT EXISTS orders_status_idx ON orders (status);

CREATE TABLE IF NOT EXISTS order_items (
  id         TEXT PRIMARY KEY,
  order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER,
  name       TEXT NOT NULL,
  price      REAL NOT NULL DEFAULT 0,
  qty        INTEGER NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS order_items_order_idx ON order_items (order_id);

CREATE TABLE IF NOT EXISTS login_attempts (
  ip         TEXT PRIMARY KEY,
  count      INTEGER NOT NULL DEFAULT 0,
  window_end TEXT NOT NULL
);
