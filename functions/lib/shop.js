/* ==================================================================
   Catalogue, settings and photo storage.
   ================================================================== */
import { badRequest } from './http.js';

export const DEFAULT_SETTINGS = {
  shop_name_ar: 'الطليل الغالي',
  shop_name_en: 'Al-Talil Al-Ghali',
  tagline_ar: 'مكياج أصلي بأسعار تنافسية — توصيل لكل فلسطين',
  tagline_en: 'Authentic makeup at fair prices — delivered across Palestine',
  currency: 'ILS',
  currency_symbol: '₪',
  usd_rate: '3.7',
  whatsapp: '970590000000',
  instagram: '',
  shipping_flat: '20',
  free_shipping_over: '250',
  announcement_ar: 'توصيل مجاني للطلبات فوق ٢٥٠ ₪',
  announcement_en: 'Free delivery on orders over 250 ₪',
};

export async function getSettings(db) {
  const { results } = await db.prepare('SELECT key, value FROM settings').all();
  const out = { ...DEFAULT_SETTINGS };
  for (const row of results || []) out[row.key] = row.value;
  return out;
}

export async function setSetting(db, key, value) {
  await db
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .bind(key, String(value ?? ''))
    .run();
}

/* ------------------------------------------------------------------ *
 * Products
 * ------------------------------------------------------------------ */
const PRODUCT_COLUMNS = `
  p.id, p.sku, p.name_ar, p.name_en, p.description_ar, p.description_en,
  p.brand, p.category_id, p.price, p.compare_price, p.cost_usd, p.stock,
  p.is_active, p.is_featured, p.sort_order, p.views, p.created_at, p.updated_at,
  c.slug AS category_slug, c.name_ar AS category_name_ar, c.name_en AS category_name_en
`;

async function attachImages(db, products) {
  if (products.length === 0) return products;
  const ids = products.map((p) => p.id);
  const placeholders = ids.map(() => '?').join(',');
  const { results } = await db
    .prepare(
      `SELECT id, product_id, url FROM product_images
       WHERE product_id IN (${placeholders}) ORDER BY sort_order, id`,
    )
    .bind(...ids)
    .all();

  const byProduct = new Map();
  for (const row of results || []) {
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

export async function listProducts(db, { includeInactive = false, categorySlug = '', search = '' } = {}) {
  const where = [];
  const params = [];
  if (!includeInactive) where.push('p.is_active = 1');
  if (categorySlug) { where.push('c.slug = ?'); params.push(categorySlug); }
  if (search) {
    where.push('(p.name_ar LIKE ? OR p.name_en LIKE ? OR p.brand LIKE ? OR p.sku LIKE ?)');
    const like = `%${search}%`;
    params.push(like, like, like, like);
  }
  const sql = `SELECT ${PRODUCT_COLUMNS} FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY p.sort_order, p.id DESC`;

  const { results } = await db.prepare(sql).bind(...params).all();
  return attachImages(db, results || []);
}

export async function getProduct(db, id, { includeInactive = false } = {}) {
  const sql = `SELECT ${PRODUCT_COLUMNS} FROM products p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.id = ? ${includeInactive ? '' : 'AND p.is_active = 1'}`;
  const row = await db.prepare(sql).bind(id).first();
  if (!row) return null;
  return (await attachImages(db, [row]))[0];
}

export async function listCategories(db) {
  const { results } = await db
    .prepare(
      `SELECT c.*, (SELECT COUNT(*) FROM products p WHERE p.category_id = c.id AND p.is_active = 1)
         AS product_count
       FROM categories c ORDER BY c.sort_order, c.id`,
    )
    .all();
  return results || [];
}

export async function getOrderWithItems(db, id) {
  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  if (!order) return null;
  const { results } = await db
    .prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').bind(id).all();
  order.items = results || [];
  return order;
}

export async function nextOrderNumber(db) {
  const year = new Date().getFullYear();
  const row = await db
    .prepare('SELECT COUNT(*) AS n FROM orders WHERE order_no LIKE ?').bind(`${year}-%`).first();
  return `${year}-${String((row?.n || 0) + 1).padStart(4, '0')}`;
}

/* ------------------------------------------------------------------ *
 * Photos live in R2, not on a disk.
 * ------------------------------------------------------------------ */
const SIGNATURES = [
  { ext: 'jpg', type: 'image/jpeg', test: (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
  {
    ext: 'png', type: 'image/png',
    test: (b) => b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47,
  },
  {
    ext: 'gif', type: 'image/gif',
    test: (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46,
  },
  {
    ext: 'webp', type: 'image/webp',
    test: (b) => b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 &&
                 b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50,
  },
];

const MAX_IMAGE_BYTES = 4 * 1024 * 1024;

async function sha256Hex(bytes) {
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Store a `data:image/...;base64,...` string in R2 and return its URL.
 * Identical photos reuse the same object.
 */
export async function saveImage(bucket, dataUrl) {
  const value = String(dataUrl ?? '').trim();

  /* Already-stored photos and pasted links pass straight through. */
  if (/^https?:\/\//i.test(value) || value.startsWith('/uploads/')) {
    if (value.length > 2000) throw badRequest('That image link is too long.');
    return value;
  }

  const match = /^data:image\/[a-z+]+;base64,([A-Za-z0-9+/=\s]+)$/i.exec(value);
  if (!match) throw badRequest('That is not a valid image.', 'bad_image');

  let bytes;
  try {
    bytes = Uint8Array.from(atob(match[1].replace(/\s+/g, '')), (c) => c.charCodeAt(0));
  } catch {
    throw badRequest('That image could not be read.', 'bad_image');
  }
  if (bytes.length === 0) throw badRequest('That image is empty.', 'bad_image');
  if (bytes.length > MAX_IMAGE_BYTES) {
    throw badRequest('That image is larger than 4 MB. Please use a smaller photo.', 'image_too_big');
  }

  /* Trust the bytes, never a declared type. */
  const signature = SIGNATURES.find((s) => s.test(bytes));
  if (!signature) {
    throw badRequest('Only JPG, PNG, WEBP and GIF photos are supported.', 'bad_image');
  }

  const name = `${(await sha256Hex(bytes)).slice(0, 32)}.${signature.ext}`;
  const existing = await bucket.head(name);
  if (!existing) {
    await bucket.put(name, bytes, { httpMetadata: { contentType: signature.type } });
  }
  return `/uploads/${name}`;
}

export async function deleteImage(bucket, url, stillUsed) {
  if (!url || !url.startsWith('/uploads/') || stillUsed) return;
  const name = url.slice('/uploads/'.length);
  if (!/^[0-9a-f]{32}\.(jpg|png|gif|webp)$/.test(name)) return;
  try {
    await bucket.delete(name);
  } catch {
    /* A photo we cannot delete is not worth failing a request over. */
  }
}
