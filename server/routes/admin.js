import {
  db,
  listProducts,
  getProduct,
  listCategories,
  getSettings,
  setSetting,
  DEFAULT_SETTINGS,
  getOrderWithItems,
} from '../db.js';
import { requireAdmin, publicUser } from '../auth.js';
import { saveImageDataUrl, deleteUpload } from '../storage.js';
import { readJson, sendJson, notFound, badRequest } from '../http.js';

const ORDER_STATUSES = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
const flag = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);

function slugify(value, fallback) {
  const slug = String(value ?? '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
  return slug || fallback;
}

/** Save the image list for a product, cleaning up files nobody uses. */
function replaceImages(productId, incoming) {
  const list = Array.isArray(incoming) ? incoming.slice(0, 8) : [];
  const previous = db
    .prepare('SELECT url FROM product_images WHERE product_id = ?')
    .all(productId)
    .map((r) => r.url);

  const saved = [];
  for (const entry of list) {
    const source = typeof entry === 'string' ? entry : entry?.url;
    if (!source) continue;
    saved.push(saveImageDataUrl(source));
  }

  db.prepare('DELETE FROM product_images WHERE product_id = ?').run(productId);
  const insert = db.prepare(
    'INSERT INTO product_images (product_id, url, sort_order) VALUES (?, ?, ?)',
  );
  saved.forEach((url, index) => insert.run(productId, url, index));

  /* Delete files that are no longer referenced anywhere. */
  for (const url of previous) {
    if (saved.includes(url)) continue;
    const stillUsed = db.prepare('SELECT 1 FROM product_images WHERE url = ? LIMIT 1').get(url);
    deleteUpload(url, !!stillUsed);
  }
  return saved;
}

function productFromBody(body) {
  const nameAr = str(body.name_ar, 140);
  const nameEn = str(body.name_en, 140);
  if (!nameAr && !nameEn) throw badRequest('The product needs a name.', 'name');

  const price = num(body.price);
  if (price <= 0) throw badRequest('Please enter a selling price greater than zero.', 'price');

  let categoryId = body.category_id === '' || body.category_id == null ? null : Number(body.category_id);
  if (categoryId !== null) {
    if (!Number.isInteger(categoryId) || !db.prepare('SELECT 1 FROM categories WHERE id = ?').get(categoryId)) {
      categoryId = null;
    }
  }

  return {
    sku: str(body.sku, 40),
    name_ar: nameAr || nameEn,
    name_en: nameEn,
    description_ar: str(body.description_ar, 4000),
    description_en: str(body.description_en, 4000),
    brand: str(body.brand, 60),
    category_id: categoryId,
    price,
    compare_price: num(body.compare_price),
    cost_usd: num(body.cost_usd),
    stock: Math.max(0, Math.min(99_999, Number.parseInt(body.stock, 10) || 0)),
    is_active: flag(body.is_active ?? true),
    is_featured: flag(body.is_featured),
    sort_order: Number.parseInt(body.sort_order, 10) || 0,
  };
}

export function registerAdminRoutes(router) {
  /* Every /api/admin route is owner-only. */
  const guard = (handler) => async (req, res, ctx) => {
    requireAdmin(ctx);
    return handler(req, res, ctx);
  };

  /* ---------------------------------------------------------------- *
   * Dashboard
   * ---------------------------------------------------------------- */
  router.get(
    '/api/admin/overview',
    guard(async (req, res) => {
      const one = (sql, ...args) => db.prepare(sql).get(...args) || {};

      const revenue = one(
        `SELECT COALESCE(SUM(total), 0) AS total, COALESCE(SUM(cost_total_usd), 0) AS cost_usd,
                COUNT(*) AS orders
         FROM orders WHERE status != 'cancelled'`,
      );
      const pending = one("SELECT COUNT(*) AS n FROM orders WHERE status = 'new'");
      const products = one(
        `SELECT COUNT(*) AS total,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active,
                SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) AS out_of_stock,
                SUM(CASE WHEN stock > 0 AND stock <= 3 THEN 1 ELSE 0 END) AS low_stock
         FROM products`,
      );
      const customers = one("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'");
      const usdRate = Number(getSettings().usd_rate) || 3.7;

      const recentOrders = db
        .prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 8')
        .all();
      const topProducts = db
        .prepare(
          `SELECT p.id, p.name_ar, p.stock,
                  COALESCE(SUM(oi.qty), 0) AS sold,
                  COALESCE(SUM(oi.qty * oi.price), 0) AS revenue
           FROM products p
           LEFT JOIN order_items oi ON oi.product_id = p.id
           LEFT JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
           GROUP BY p.id ORDER BY sold DESC, p.id DESC LIMIT 6`,
        )
        .all();
      const salesByDay = db
        .prepare(
          `SELECT date(created_at) AS day, COALESCE(SUM(total), 0) AS total, COUNT(*) AS orders
           FROM orders WHERE status != 'cancelled' AND created_at >= date('now', '-13 days')
           GROUP BY day ORDER BY day`,
        )
        .all();

      const revenueTotal = revenue.total || 0;
      const costTotal = (revenue.cost_usd || 0) * usdRate;

      sendJson(res, 200, {
        ok: true,
        stats: {
          revenue: revenueTotal,
          cost: costTotal,
          profit: revenueTotal - costTotal,
          orders: revenue.orders || 0,
          pending_orders: pending.n || 0,
          products_total: products.total || 0,
          products_active: products.active || 0,
          out_of_stock: products.out_of_stock || 0,
          low_stock: products.low_stock || 0,
          customers: customers.n || 0,
          usd_rate: usdRate,
        },
        recent_orders: recentOrders,
        top_products: topProducts,
        sales_by_day: salesByDay,
      });
    }),
  );

  /* ---------------------------------------------------------------- *
   * Products
   * ---------------------------------------------------------------- */
  router.get(
    '/api/admin/products',
    guard(async (req, res, ctx) => {
      sendJson(res, 200, {
        ok: true,
        products: listProducts({
          includeInactive: true,
          categorySlug: ctx.query.get('category') || '',
          search: (ctx.query.get('q') || '').slice(0, 60),
        }),
      });
    }),
  );

  router.post(
    '/api/admin/products',
    guard(async (req, res) => {
      const body = await readJson(req);
      const data = productFromBody(body);
      const info = db
        .prepare(
          `INSERT INTO products
             (sku, name_ar, name_en, description_ar, description_en, brand, category_id,
              price, compare_price, cost_usd, stock, is_active, is_featured, sort_order)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          data.sku, data.name_ar, data.name_en, data.description_ar, data.description_en,
          data.brand, data.category_id, data.price, data.compare_price, data.cost_usd,
          data.stock, data.is_active, data.is_featured, data.sort_order,
        );
      const id = Number(info.lastInsertRowid);
      replaceImages(id, body.images);
      sendJson(res, 201, { ok: true, product: getProduct(id, { includeInactive: true }) });
    }),
  );

  router.put(
    '/api/admin/products/:id',
    guard(async (req, res, ctx) => {
      const id = Number(ctx.params.id);
      if (!db.prepare('SELECT 1 FROM products WHERE id = ?').get(id)) {
        throw notFound('That product no longer exists.');
      }
      const body = await readJson(req);
      const data = productFromBody(body);
      db.prepare(
        `UPDATE products SET
           sku = ?, name_ar = ?, name_en = ?, description_ar = ?, description_en = ?,
           brand = ?, category_id = ?, price = ?, compare_price = ?, cost_usd = ?,
           stock = ?, is_active = ?, is_featured = ?, sort_order = ?,
           updated_at = datetime('now')
         WHERE id = ?`,
      ).run(
        data.sku, data.name_ar, data.name_en, data.description_ar, data.description_en,
        data.brand, data.category_id, data.price, data.compare_price, data.cost_usd,
        data.stock, data.is_active, data.is_featured, data.sort_order, id,
      );
      if (body.images !== undefined) replaceImages(id, body.images);
      sendJson(res, 200, { ok: true, product: getProduct(id, { includeInactive: true }) });
    }),
  );

  /* Quick toggles from the product list — availability, stock, feature. */
  router.patch(
    '/api/admin/products/:id',
    guard(async (req, res, ctx) => {
      const id = Number(ctx.params.id);
      const existing = db.prepare('SELECT * FROM products WHERE id = ?').get(id);
      if (!existing) throw notFound('That product no longer exists.');

      const body = await readJson(req);
      const updates = [];
      const values = [];
      if ('is_active' in body) { updates.push('is_active = ?'); values.push(flag(body.is_active)); }
      if ('is_featured' in body) { updates.push('is_featured = ?'); values.push(flag(body.is_featured)); }
      if ('stock' in body) {
        updates.push('stock = ?');
        values.push(Math.max(0, Math.min(99_999, Number.parseInt(body.stock, 10) || 0)));
      }
      if ('price' in body) {
        const price = num(body.price);
        if (price <= 0) throw badRequest('Price must be greater than zero.', 'price');
        updates.push('price = ?');
        values.push(price);
      }
      if (updates.length === 0) throw badRequest('Nothing to update.');

      updates.push("updated_at = datetime('now')");
      db.prepare(`UPDATE products SET ${updates.join(', ')} WHERE id = ?`).run(...values, id);
      sendJson(res, 200, { ok: true, product: getProduct(id, { includeInactive: true }) });
    }),
  );

  router.delete(
    '/api/admin/products/:id',
    guard(async (req, res, ctx) => {
      const id = Number(ctx.params.id);
      const images = db.prepare('SELECT url FROM product_images WHERE product_id = ?').all(id);
      const info = db.prepare('DELETE FROM products WHERE id = ?').run(id);
      if (info.changes === 0) throw notFound('That product no longer exists.');
      for (const { url } of images) {
        const stillUsed = db.prepare('SELECT 1 FROM product_images WHERE url = ? LIMIT 1').get(url);
        deleteUpload(url, !!stillUsed);
      }
      sendJson(res, 200, { ok: true });
    }),
  );

  /* ---------------------------------------------------------------- *
   * Categories
   * ---------------------------------------------------------------- */
  router.post(
    '/api/admin/categories',
    guard(async (req, res) => {
      const body = await readJson(req);
      const nameAr = str(body.name_ar, 60);
      const nameEn = str(body.name_en, 60);
      if (!nameAr && !nameEn) throw badRequest('The category needs a name.', 'name');

      let slug = slugify(body.slug || nameEn || nameAr, `cat-${Date.now().toString(36)}`);
      if (db.prepare('SELECT 1 FROM categories WHERE slug = ?').get(slug)) {
        slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
      }
      const info = db
        .prepare('INSERT INTO categories (slug, name_ar, name_en, icon, sort_order) VALUES (?, ?, ?, ?, ?)')
        .run(slug, nameAr || nameEn, nameEn, str(body.icon, 8), Number.parseInt(body.sort_order, 10) || 0);
      sendJson(res, 201, {
        ok: true,
        category: db.prepare('SELECT * FROM categories WHERE id = ?').get(Number(info.lastInsertRowid)),
      });
    }),
  );

  router.put(
    '/api/admin/categories/:id',
    guard(async (req, res, ctx) => {
      const id = Number(ctx.params.id);
      if (!db.prepare('SELECT 1 FROM categories WHERE id = ?').get(id)) {
        throw notFound('That category no longer exists.');
      }
      const body = await readJson(req);
      db.prepare('UPDATE categories SET name_ar = ?, name_en = ?, icon = ?, sort_order = ? WHERE id = ?').run(
        str(body.name_ar, 60),
        str(body.name_en, 60),
        str(body.icon, 8),
        Number.parseInt(body.sort_order, 10) || 0,
        id,
      );
      sendJson(res, 200, { ok: true, category: db.prepare('SELECT * FROM categories WHERE id = ?').get(id) });
    }),
  );

  router.delete(
    '/api/admin/categories/:id',
    guard(async (req, res, ctx) => {
      /* Products keep existing; they simply lose their category. */
      const info = db.prepare('DELETE FROM categories WHERE id = ?').run(Number(ctx.params.id));
      if (info.changes === 0) throw notFound('That category no longer exists.');
      sendJson(res, 200, { ok: true });
    }),
  );

  /* ---------------------------------------------------------------- *
   * Orders
   * ---------------------------------------------------------------- */
  router.get(
    '/api/admin/orders',
    guard(async (req, res, ctx) => {
      const status = ctx.query.get('status') || '';
      const rows = ORDER_STATUSES.includes(status)
        ? db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY id DESC LIMIT 200').all(status)
        : db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 200').all();
      const itemStmt = db.prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id');
      for (const order of rows) order.items = itemStmt.all(order.id);
      sendJson(res, 200, { ok: true, orders: rows });
    }),
  );

  router.patch(
    '/api/admin/orders/:id',
    guard(async (req, res, ctx) => {
      const id = Number(ctx.params.id);
      const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
      if (!order) throw notFound('That order no longer exists.');

      const body = await readJson(req);
      const status = str(body.status, 20);
      if (!ORDER_STATUSES.includes(status)) throw badRequest('Unknown order status.', 'status');

      /* Cancelling an order puts its items back on the shelf, once. */
      if (status === 'cancelled' && order.status !== 'cancelled') {
        const items = db.prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').all(id);
        const restore = db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?');
        for (const item of items) if (item.product_id) restore.run(item.qty, item.product_id);
      }

      db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?").run(status, id);
      sendJson(res, 200, { ok: true, order: getOrderWithItems(id) });
    }),
  );

  router.delete(
    '/api/admin/orders/:id',
    guard(async (req, res, ctx) => {
      const info = db.prepare('DELETE FROM orders WHERE id = ?').run(Number(ctx.params.id));
      if (info.changes === 0) throw notFound('That order no longer exists.');
      sendJson(res, 200, { ok: true });
    }),
  );

  /* ---------------------------------------------------------------- *
   * Customers
   * ---------------------------------------------------------------- */
  router.get(
    '/api/admin/customers',
    guard(async (req, res) => {
      const rows = db
        .prepare(
          `SELECT u.*, COUNT(o.id) AS order_count, COALESCE(SUM(o.total), 0) AS spent
           FROM users u
           LEFT JOIN orders o ON o.user_id = u.id AND o.status != 'cancelled'
           GROUP BY u.id ORDER BY u.id DESC LIMIT 300`,
        )
        .all();
      sendJson(res, 200, {
        ok: true,
        customers: rows.map((r) => ({
          ...publicUser(r),
          is_blocked: !!r.is_blocked,
          last_login_at: r.last_login_at,
          order_count: r.order_count,
          spent: r.spent,
        })),
      });
    }),
  );

  router.patch(
    '/api/admin/customers/:id',
    guard(async (req, res, ctx) => {
      const id = Number(ctx.params.id);
      const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
      if (!target) throw notFound('That customer no longer exists.');
      if (target.role === 'admin') throw badRequest('You cannot block an owner account.', 'is_admin');

      const body = await readJson(req);
      const blocked = flag(body.is_blocked);
      db.prepare('UPDATE users SET is_blocked = ? WHERE id = ?').run(blocked, id);
      if (blocked) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(id);
      sendJson(res, 200, { ok: true });
    }),
  );

  /* ---------------------------------------------------------------- *
   * Settings
   * ---------------------------------------------------------------- */
  router.get(
    '/api/admin/settings',
    guard(async (req, res) => {
      sendJson(res, 200, { ok: true, settings: getSettings() });
    }),
  );

  router.put(
    '/api/admin/settings',
    guard(async (req, res) => {
      const body = await readJson(req);
      for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (!(key in body)) continue;
        let value = str(body[key], 400);
        if (key === 'whatsapp') value = value.replace(/[^0-9]/g, '');
        setSetting(key, value);
      }
      sendJson(res, 200, { ok: true, settings: getSettings() });
    }),
  );
}
