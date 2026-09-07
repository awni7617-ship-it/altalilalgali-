-- ==================================================================
--  Al-Talil Al-Ghali — Cloudflare D1 schema
--  Applied with:  npm run db:setup
-- ==================================================================

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT    NOT NULL DEFAULT '',
  name          TEXT    NOT NULL DEFAULT '',
  phone         TEXT    NOT NULL DEFAULT '',
  city          TEXT    NOT NULL DEFAULT '',
  address       TEXT    NOT NULL DEFAULT '',
  role          TEXT    NOT NULL DEFAULT 'customer',
  provider      TEXT    NOT NULL DEFAULT '',
  provider_id   TEXT    NOT NULL DEFAULT '',
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

-- Workers run in short-lived isolates all over the world, so anything
-- that has to be remembered between requests lives in the database
-- rather than in memory.
CREATE TABLE IF NOT EXISTS login_attempts (
  bucket   TEXT    NOT NULL,
  at       INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_attempts ON login_attempts(bucket, at);

CREATE TABLE IF NOT EXISTS oauth_states (
  state      TEXT    PRIMARY KEY,
  provider   TEXT    NOT NULL,
  next_url   TEXT    NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL
);

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

-- ---- Shop defaults -----------------------------------------------
INSERT OR IGNORE INTO settings (key, value) VALUES
  ('shop_name_ar',      'الطليل الغالي'),
  ('shop_name_en',      'Al-Talil Al-Ghali'),
  ('tagline_ar',        'مكياج أصلي بأسعار تنافسية — توصيل لكل فلسطين'),
  ('tagline_en',        'Authentic makeup at fair prices — delivered across Palestine'),
  ('currency',          'ILS'),
  ('currency_symbol',   '₪'),
  ('usd_rate',          '3.7'),
  ('whatsapp',          '970590000000'),
  ('instagram',         ''),
  ('shipping_flat',     '20'),
  ('free_shipping_over','250'),
  ('announcement_ar',   'توصيل مجاني للطلبات فوق ٢٥٠ ₪'),
  ('announcement_en',   'Free delivery on orders over 250 ₪');

-- ---- Starter categories ------------------------------------------
INSERT OR IGNORE INTO categories (slug, name_ar, name_en, icon, sort_order) VALUES
  ('face',  'الوجه',            'Face',     '🧴', 1),
  ('eyes',  'العيون',           'Eyes',     '👁️', 2),
  ('lips',  'الشفاه',           'Lips',     '💄', 3),
  ('brows', 'الحواجب',          'Brows',    '✏️', 4),
  ('nails', 'الأظافر',          'Nails',    '💅', 5),
  ('skin',  'العناية بالبشرة',  'Skincare', '✨', 6),
  ('tools', 'أدوات وفرش',       'Tools',    '🖌️', 7);

-- A product code is unique when it is set, so re-running this
-- file never duplicates the starter catalogue.
CREATE UNIQUE INDEX IF NOT EXISTS idx_products_sku ON products(sku) WHERE sku != '';

-- ---- Starter products --------------------------------------------
INSERT OR IGNORE INTO products (sku, name_ar, name_en, description_ar, description_en, brand, category_id, price, compare_price, cost_usd, stock, is_featured, sort_order) VALUES ('FND-001', 'كريم أساس مطفي طويل الثبات', 'Matte Long-Wear Foundation', 'كريم أساس بتغطية متوسطة إلى كاملة يدوم حتى ١٦ ساعة، مناسب للبشرة الدهنية والمختلطة.', 'Medium-to-full coverage foundation that lasts up to 16 hours.', 'Velvet Touch', (SELECT id FROM categories WHERE slug='face'), 89, 120, 6.5, 24, 1, 0);
INSERT OR IGNORE INTO products (sku, name_ar, name_en, description_ar, description_en, brand, category_id, price, compare_price, cost_usd, stock, is_featured, sort_order) VALUES ('CNC-002', 'كونسيلر عالي التغطية', 'High-Coverage Concealer', 'يخفي الهالات السوداء والبقع دون أن يتجمع في الخطوط الدقيقة.', 'Covers dark circles and blemishes without creasing.', 'Velvet Touch', (SELECT id FROM categories WHERE slug='face'), 45, 60, 2.8, 40, 1, 1);
INSERT OR IGNORE INTO products (sku, name_ar, name_en, description_ar, description_en, brand, category_id, price, compare_price, cost_usd, stock, is_featured, sort_order) VALUES ('BLS-003', 'بلاشر باودر وردي', 'Powder Blush — Rose', 'بلاشر ناعم الملمس يمنح إشراقة طبيعية، سهل الدمج ويدوم طوال اليوم.', 'Silky powder blush for a natural flush.', 'Rosé Bloom', (SELECT id FROM categories WHERE slug='face'), 39, 0, 2.1, 30, 0, 2);
INSERT OR IGNORE INTO products (sku, name_ar, name_en, description_ar, description_en, brand, category_id, price, compare_price, cost_usd, stock, is_featured, sort_order) VALUES ('PLT-004', 'باليت ظلال عيون ١٨ لون', '18-Shade Eyeshadow Palette', 'ثمانية عشر لوناً بين المطفي واللامع بدرجات ترابية دافئة.', 'Eighteen warm neutral shades, matte and shimmer.', 'Nude Story', (SELECT id FROM categories WHERE slug='eyes'), 115, 160, 8.2, 15, 1, 3);
INSERT OR IGNORE INTO products (sku, name_ar, name_en, description_ar, description_en, brand, category_id, price, compare_price, cost_usd, stock, is_featured, sort_order) VALUES ('MSC-005', 'ماسكارا تكثيف وتطويل', 'Volume & Length Mascara', 'فرشاة مخروطية تصل لكل رمش، تمنح كثافة مضاعفة بدون تكتل.', 'Double volume with no clumps. Water resistant.', 'Lash Queen', (SELECT id FROM categories WHERE slug='eyes'), 52, 70, 3.4, 35, 0, 4);
INSERT OR IGNORE INTO products (sku, name_ar, name_en, description_ar, description_en, brand, category_id, price, compare_price, cost_usd, stock, is_featured, sort_order) VALUES ('EYE-006', 'آيلاينر سائل أسود', 'Liquid Eyeliner — Black', 'رأس رفيع ودقيق لرسم خط مثالي من أول مرة.', 'Ultra-fine tip for a perfect line first time.', 'Lash Queen', (SELECT id FROM categories WHERE slug='eyes'), 34, 0, 1.9, 50, 0, 5);
INSERT OR IGNORE INTO products (sku, name_ar, name_en, description_ar, description_en, brand, category_id, price, compare_price, cost_usd, stock, is_featured, sort_order) VALUES ('LIP-007', 'أحمر شفاه مطفي سائل', 'Liquid Matte Lipstick', 'يدوم حتى ١٢ ساعة بلمسة مخملية مريحة لا تجفف الشفاه.', 'Up to 12 hours of comfortable velvet colour.', 'Rosé Bloom', (SELECT id FROM categories WHERE slug='lips'), 42, 55, 2.3, 60, 1, 6);
INSERT OR IGNORE INTO products (sku, name_ar, name_en, description_ar, description_en, brand, category_id, price, compare_price, cost_usd, stock, is_featured, sort_order) VALUES ('LIP-008', 'ملمع شفاه مرطب', 'Hydrating Lip Gloss', 'ملمع غير لزق بزيت جوز الهند، يمنح لمعاناً زجاجياً وترطيباً يدوم.', 'Non-sticky gloss with coconut oil.', 'Rosé Bloom', (SELECT id FROM categories WHERE slug='lips'), 29, 0, 1.4, 45, 0, 7);
INSERT OR IGNORE INTO products (sku, name_ar, name_en, description_ar, description_en, brand, category_id, price, compare_price, cost_usd, stock, is_featured, sort_order) VALUES ('BRW-009', 'قلم حواجب مزدوج', 'Dual-Ended Brow Pencil', 'رأس رفيع لرسم الشعيرات وفرشاة لتنعيم اللون.', 'Fine tip for hair strokes with a spoolie.', 'Nude Story', (SELECT id FROM categories WHERE slug='brows'), 31, 42, 1.6, 38, 0, 8);
INSERT OR IGNORE INTO products (sku, name_ar, name_en, description_ar, description_en, brand, category_id, price, compare_price, cost_usd, stock, is_featured, sort_order) VALUES ('NAL-010', 'طقم مناكير ٦ ألوان', 'Nail Polish Set — 6 Colours', 'ستة ألوان موسمية بتركيبة سريعة الجفاف ولمعان يدوم أسبوعاً.', 'Six seasonal shades, quick-drying.', 'Glossy Days', (SELECT id FROM categories WHERE slug='nails'), 68, 95, 4.5, 20, 0, 9);
INSERT OR IGNORE INTO products (sku, name_ar, name_en, description_ar, description_en, brand, category_id, price, compare_price, cost_usd, stock, is_featured, sort_order) VALUES ('SKN-011', 'سيروم فيتامين سي', 'Vitamin C Serum', 'يوحّد لون البشرة ويعالج البقع الداكنة تدريجياً.', 'Evens skin tone and fades dark spots over time.', 'Pure Glow', (SELECT id FROM categories WHERE slug='skin'), 78, 105, 5.2, 18, 1, 10);
INSERT OR IGNORE INTO products (sku, name_ar, name_en, description_ar, description_en, brand, category_id, price, compare_price, cost_usd, stock, is_featured, sort_order) VALUES ('SKN-012', 'مزيل مكياج بالماء الميسيلار', 'Micellar Cleansing Water', 'يزيل المكياج الثقيل بلطف دون فرك، مناسب للبشرة الحساسة.', 'Removes heavy makeup gently, safe for sensitive skin.', 'Pure Glow', (SELECT id FROM categories WHERE slug='skin'), 36, 0, 1.8, 42, 0, 11);
INSERT OR IGNORE INTO products (sku, name_ar, name_en, description_ar, description_en, brand, category_id, price, compare_price, cost_usd, stock, is_featured, sort_order) VALUES ('TLS-013', 'طقم فرش مكياج ١٢ قطعة', '12-Piece Brush Set', 'شعيرات صناعية ناعمة لا تتساقط، مع حقيبة للحفظ والسفر.', 'Soft synthetic bristles with a travel pouch.', 'Studio Pro', (SELECT id FROM categories WHERE slug='tools'), 95, 140, 6.8, 12, 0, 12);
INSERT OR IGNORE INTO products (sku, name_ar, name_en, description_ar, description_en, brand, category_id, price, compare_price, cost_usd, stock, is_featured, sort_order) VALUES ('TLS-014', 'إسفنجة بلندر للمكياج', 'Makeup Blender Sponge', 'تتضاعف عند البلل لتوزيع كريم الأساس بلمسة نهائية طبيعية.', 'Doubles in size when damp for a flawless finish.', 'Studio Pro', (SELECT id FROM categories WHERE slug='tools'), 18, 25, 0.7, 80, 0, 13);
