import { DatabaseSync } from 'node:sqlite';
import { config } from './config.js';

export const db = new DatabaseSync(config.dbFile);

db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');
db.exec('PRAGMA busy_timeout = 5000');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL DEFAULT '',
  name          TEXT    NOT NULL DEFAULT '',
  phone         TEXT    NOT NULL DEFAULT '',
  city          TEXT    NOT NULL DEFAULT '',
  address       TEXT    NOT NULL DEFAULT '',
  role          TEXT    NOT NULL DEFAULT 'customer',
  is_blocked    INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS sessions (
  id         TEXT    PRIMARY KEY,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL,
  ip         TEXT    NOT NULL DEFAULT '',
  user_agent TEXT    NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS categories (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slug       TEXT    NOT NULL UNIQUE,
  name_ar    TEXT    NOT NULL,
  name_en    TEXT    NOT NULL DEFAULT '',
  icon       TEXT    NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS products (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  sku            TEXT    NOT NULL DEFAULT '',
  name_ar        TEXT    NOT NULL,
  name_en        TEXT    NOT NULL DEFAULT '',
  description_ar TEXT    NOT NULL DEFAULT '',
  description_en TEXT    NOT NULL DEFAULT '',
  brand          TEXT    NOT NULL DEFAULT '',
  category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  price          REAL    NOT NULL DEFAULT 0,
  compare_price  REAL    NOT NULL DEFAULT 0,
  cost_usd       REAL    NOT NULL DEFAULT 0,
  stock          INTEGER NOT NULL DEFAULT 0,
  is_active      INTEGER NOT NULL DEFAULT 1,
  is_featured    INTEGER NOT NULL DEFAULT 0,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  views          INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);

CREATE TABLE IF NOT EXISTS product_images (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url        TEXT    NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_images_product ON product_images(product_id);

CREATE TABLE IF NOT EXISTS orders (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no       TEXT    NOT NULL UNIQUE,
  user_id        INTEGER REFERENCES users(id) ON DELETE SET NULL,
  customer_name  TEXT    NOT NULL,
  email          TEXT    NOT NULL DEFAULT '',
  phone          TEXT    NOT NULL,
  city           TEXT    NOT NULL DEFAULT '',
  address        TEXT    NOT NULL DEFAULT '',
  notes          TEXT    NOT NULL DEFAULT '',
  subtotal       REAL    NOT NULL DEFAULT 0,
  shipping       REAL    NOT NULL DEFAULT 0,
  total          REAL    NOT NULL DEFAULT 0,
  cost_total_usd REAL    NOT NULL DEFAULT 0,
  status         TEXT    NOT NULL DEFAULT 'new',
  created_at     TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);

CREATE TABLE IF NOT EXISTS order_items (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  name       TEXT    NOT NULL,
  image      TEXT    NOT NULL DEFAULT '',
  price      REAL    NOT NULL DEFAULT 0,
  cost_usd   REAL    NOT NULL DEFAULT 0,
  qty        INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

/* ------------------------------------------------------------------ *
 * Migrations for shops created before a column existed.
 * ------------------------------------------------------------------ */
function addColumnIfMissing(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
addColumnIfMissing('users', 'password_hash', "TEXT NOT NULL DEFAULT ''");

/* The shop used to sign people in with e-mailed codes. Nothing reads
 * this table any more, so retire it rather than leave it lying about. */
db.exec('DROP TABLE IF EXISTS login_codes');

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */
export const DEFAULT_SETTINGS = {
  shop_name_ar: 'الطليل الغالي',
  shop_name_en: 'Al-Talil Al-Ghali',
  tagline_ar: 'مكياج أصلي بأسعار تنافسية — توصيل لكل فلسطين',
  tagline_en: 'Authentic makeup at fair prices — delivered across Palestine',
  currency: 'ILS',
  currency_symbol: '₪',
  usd_rate: '3.7',
  whatsapp: config.shop.whatsapp,
  instagram: '',
  shipping_flat: '20',
  free_shipping_over: '250',
  announcement_ar: 'توصيل مجاني للطلبات فوق ٢٥٠ ₪',
  announcement_en: 'Free delivery on orders over 250 ₪',
};

const getSettingStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
const setSettingStmt = db.prepare(
  'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
);

export function getSetting(key) {
  const row = getSettingStmt.get(key);
  return row ? row.value : DEFAULT_SETTINGS[key] ?? '';
}

export function setSetting(key, value) {
  setSettingStmt.run(key, String(value ?? ''));
}

export function getSettings() {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  const out = { ...DEFAULT_SETTINGS };
  for (const r of rows) out[r.key] = r.value;
  return out;
}

/* Fill in any setting that has never been written. */
for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
  if (!getSettingStmt.get(key)) setSettingStmt.run(key, value);
}

/* ------------------------------------------------------------------ *
 * Product helpers — every query returns products with their images.
 * ------------------------------------------------------------------ */
const PRODUCT_COLUMNS = `
  p.id, p.sku, p.name_ar, p.name_en, p.description_ar, p.description_en,
  p.brand, p.category_id, p.price, p.compare_price, p.cost_usd, p.stock,
  p.is_active, p.is_featured, p.sort_order, p.views, p.created_at, p.updated_at,
  c.slug AS category_slug, c.name_ar AS category_name_ar, c.name_en AS category_name_en
`;

function attachImages(products) {
  if (products.length === 0) return products;
  const ids = products.map((p) => p.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = db
    .prepare(
      `SELECT id, product_id, url, sort_order FROM product_images
       WHERE product_id IN (${placeholders}) ORDER BY sort_order, id`,
    )
    .all(...ids);
  const byProduct = new Map();
  for (const row of rows) {
    if (!byProduct.has(row.product_id)) byProduct.set(row.product_id, []);
    byProduct.get(row.product_id).push({ id: row.id, url: row.url });
  }
  for (const p of products) {
    p.images = byProduct.get(p.id) || [];
    p.image = p.images[0]?.url || '';
    p.is_active = !!p.is_active;
    p.is_featured = !!p.is_featured;
    p.in_stock = p.stock > 0;
  }
  return products;
}

export function listProducts({ includeInactive = false, categorySlug = '', search = '' } = {}) {
  const where = [];
  const params = [];
  if (!includeInactive) where.push('p.is_active = 1');
  if (categorySlug) {
    where.push('c.slug = ?');
    params.push(categorySlug);
  }
  if (search) {
    where.push('(p.name_ar LIKE ? OR p.name_en LIKE ? OR p.brand LIKE ? OR p.sku LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  const sql = `SELECT ${PRODUCT_COLUMNS} FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY p.sort_order, p.id DESC`;
  return attachImages(db.prepare(sql).all(...params));
}

export function getProduct(id, { includeInactive = false } = {}) {
  const sql = `SELECT ${PRODUCT_COLUMNS} FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.id = ? ${includeInactive ? '' : 'AND p.is_active = 1'}`;
  const row = db.prepare(sql).get(id);
  if (!row) return null;
  return attachImages([row])[0];
}

export function listCategories() {
  return db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1)
         AS product_count
       FROM categories c ORDER BY c.sort_order, c.id`,
    )
    .all();
}

export function nextOrderNumber() {
  const year = new Date().getFullYear();
  const row = db
    .prepare("SELECT COUNT(*) AS n FROM orders WHERE order_no LIKE ?")
    .get(`${year}-%`);
  return `${year}-${String((row?.n || 0) + 1).padStart(4, '0')}`;
}

export function getOrderWithItems(id) {
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!order) return null;
  order.items = db
    .prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id')
    .all(id);
  return order;
}
