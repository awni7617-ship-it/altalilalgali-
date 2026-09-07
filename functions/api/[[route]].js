/* ==================================================================
   Every /api/* endpoint.
   ================================================================== */
import {
  Routes, json, errorResponse, readJson, badRequest, notFound, unauthorized,
  HttpError, assertSameOrigin, readCookie, cookieHeader, withCookie, clientIp,
  rateLimit, tooMany, SESSION_COOKIE,
} from '../lib/http.js';
import {
  SESSION_MS, normalizeEmail, assertValidEmail, createUser, authenticate, setPassword,
  verifyPassword, findUserByEmail, createSession, destroySession, destroyAllSessions,
  publicUser, requireUser, requireAdmin, getSessionUser, ensureOwner, isAdminEmail,
} from '../lib/auth.js';
import {
  DEFAULT_SETTINGS, getSettings, setSetting, listProducts, getProduct, listCategories,
  getOrderWithItems, nextOrderNumber, saveImage, deleteImage,
} from '../lib/shop.js';

const str = (v, max) => String(v ?? '').trim().slice(0, max);
const num = (v, fallback = 0) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : fallback;
};
const flag = (v) => (v === true || v === 1 || v === '1' || v === 'true' ? 1 : 0);

const ORDER_STATUSES = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];

const PUBLIC_ROUTES = new Set([
  'GET auth/providers', 'POST auth/login', 'POST auth/register',
  'GET auth/me', 'POST auth/logout',
]);

const requireLogin = (env) => String(env.REQUIRE_LOGIN ?? 'true').toLowerCase() !== 'false';

function enabledProviders(env) {
  const list = [];
  if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) list.push('google');
  if (env.APPLE_CLIENT_ID && env.APPLE_TEAM_ID && env.APPLE_KEY_ID && env.APPLE_PRIVATE_KEY) {
    list.push('apple');
  }
  return list;
}

/** Strip the owner's cost price before anything reaches a shopper. */
function forShoppers(product) {
  const { cost_usd, views, sort_order, ...rest } = product;
  return rest;
}

const routes = new Routes();

/* ================================================================== *
 * Sign in and accounts
 * ================================================================== */
routes.get('auth/providers', async ({ db, env }) => {
  const settings = await getSettings(db);
  return json({
    ok: true,
    providers: enabledProviders(env),
    require_login: requireLogin(env),
    shop_name_ar: settings.shop_name_ar,
    shop_name_en: settings.shop_name_en,
  });
});

routes.post('auth/register', async ({ db, env, request }) => {
  const limited = await rateLimit(db, `register:${clientIp(request)}`, 10, 3_600_000);
  if (!limited.allowed) {
    throw tooMany('Too many accounts created from this device. Please try again later.', limited.retryAfter);
  }

  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  assertValidEmail(email);

  const user = await createUser(db, env, {
    email, password: body.password, name: body.name, phone: body.phone,
  });
  const token = await createSession(db, env, user.id, {
    ip: clientIp(request), userAgent: request.headers.get('User-Agent') || '',
  });
  return withCookie(
    json({ ok: true, user: publicUser(user) }, 201),
    cookieHeader(request, SESSION_COOKIE, token, SESSION_MS),
  );
});

routes.post('auth/login', async ({ db, env, request }) => {
  const limited = await rateLimit(db, `loginip:${clientIp(request)}`, 40, 900_000);
  if (!limited.allowed) {
    throw tooMany('Too many sign-in attempts from this device. Please wait a few minutes.', limited.retryAfter);
  }

  const body = await readJson(request);
  const email = normalizeEmail(body.email);
  assertValidEmail(email);

  /* The owner account is created from ADMIN_PASSWORD on first use —
   * there is no terminal here to read a generated password from. */
  if (isAdminEmail(email, env)) await ensureOwner(db, env);

  const user = await authenticate(db, env, email, String(body.password ?? ''));
  const token = await createSession(db, env, user.id, {
    ip: clientIp(request), userAgent: request.headers.get('User-Agent') || '',
  });
  return withCookie(
    json({ ok: true, user: publicUser(user) }),
    cookieHeader(request, SESSION_COOKIE, token, SESSION_MS),
  );
});

routes.get('auth/me', async ({ user }) => json({ ok: true, user: publicUser(user) }));

routes.post('auth/logout', async ({ db, env, request, token }) => {
  await destroySession(db, env, token);
  return withCookie(json({ ok: true }), cookieHeader(request, SESSION_COOKIE, '', 0));
});

routes.post('auth/change-password', async ({ db, env, request, user }) => {
  requireUser(user);
  const body = await readJson(request);
  const current = String(body.current_password ?? '');
  const next = String(body.new_password ?? '');

  const fresh = await findUserByEmail(db, user.email);
  /* Someone who arrived through Google or Apple has no password to
   * confirm — they are setting their first one. */
  if (fresh.password_hash && !(await verifyPassword(current, fresh.password_hash))) {
    throw unauthorized('Your current password is not correct.');
  }
  if (current === next) throw badRequest('Please choose a different password.', 'same_password');

  await setPassword(db, env, user.id, next);
  await destroyAllSessions(db, user.id);

  const token = await createSession(db, env, user.id, {
    ip: clientIp(request), userAgent: request.headers.get('User-Agent') || '',
  });
  return withCookie(
    json({ ok: true, message: 'Your password was changed. Other devices were signed out.' }),
    cookieHeader(request, SESSION_COOKIE, token, SESSION_MS),
  );
});

routes.patch('auth/profile', async ({ db, request, user }) => {
  requireUser(user);
  const body = await readJson(request);
  await db
    .prepare('UPDATE users SET name = ?, phone = ?, city = ?, address = ? WHERE id = ?')
    .bind(
      str(body.name ?? user.name, 80), str(body.phone ?? user.phone, 30),
      str(body.city ?? user.city, 60), str(body.address ?? user.address, 250), user.id,
    )
    .run();
  const fresh = await db.prepare('SELECT * FROM users WHERE id = ?').bind(user.id).first();
  return json({ ok: true, user: publicUser(fresh) });
});

routes.get('auth/orders', async ({ db, user }) => {
  requireUser(user);
  const { results } = await db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT 50').bind(user.id).all();
  const orders = results || [];
  for (const order of orders) {
    const items = await db
      .prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').bind(order.id).all();
    order.items = items.results || [];
  }
  return json({ ok: true, orders });
});

/* ================================================================== *
 * The shop
 * ================================================================== */
const PUBLIC_SETTING_KEYS = [
  'shop_name_ar', 'shop_name_en', 'tagline_ar', 'tagline_en', 'currency', 'currency_symbol',
  'whatsapp', 'instagram', 'shipping_flat', 'free_shipping_over', 'announcement_ar', 'announcement_en',
];

async function publicSettings(db) {
  const all = await getSettings(db);
  const out = {};
  for (const key of PUBLIC_SETTING_KEYS) out[key] = all[key];
  out.shipping_flat = Number(out.shipping_flat) || 0;
  out.free_shipping_over = Number(out.free_shipping_over) || 0;
  return out;
}

routes.get('shop', async ({ db }) => json({
  ok: true,
  settings: await publicSettings(db),
  categories: await listCategories(db),
  products: (await listProducts(db)).map(forShoppers),
}));

routes.get('products', async ({ db, url }) => json({
  ok: true,
  products: (await listProducts(db, {
    categorySlug: url.searchParams.get('category') || '',
    search: (url.searchParams.get('q') || '').slice(0, 60),
  })).map(forShoppers),
}));

routes.get('products/:id', async ({ db, params }) => {
  const product = await getProduct(db, Number(params.id));
  if (!product) throw notFound('That product is no longer available.');
  await db.prepare('UPDATE products SET views = views + 1 WHERE id = ?').bind(product.id).run();
  return json({ ok: true, product: forShoppers(product) });
});

routes.get('categories', async ({ db }) => json({ ok: true, categories: await listCategories(db) }));

routes.post('orders', async ({ db, request, user }) => {
  const limited = await rateLimit(db, `order:${clientIp(request)}`, 10, 3_600_000);
  if (!limited.allowed) {
    throw tooMany('Too many orders from this device. Please contact us on WhatsApp.', limited.retryAfter);
  }

  const body = await readJson(request);
  const customerName = str(body.name, 80);
  const phone = str(body.phone, 30);
  const city = str(body.city, 60);
  const address = str(body.address, 250);

  if (customerName.length < 2) throw badRequest('Please enter your full name.', 'name');
  if (phone.replace(/\D/g, '').length < 8) throw badRequest('Please enter a valid phone number.', 'phone');
  if (!city) throw badRequest('Please choose your city.', 'city');
  if (address.length < 4) throw badRequest('Please enter your delivery address.', 'address');

  const requested = Array.isArray(body.items) ? body.items.slice(0, 60) : [];
  if (requested.length === 0) throw badRequest('Your basket is empty.', 'empty_cart');

  const settings = await getSettings(db);
  const lines = [];
  let subtotal = 0;
  let costTotalUsd = 0;

  /* Prices and stock come from the database, never from the browser. */
  for (const raw of requested) {
    const qty = Math.max(1, Math.min(99, Number.parseInt(raw?.qty, 10) || 1));
    const product = await getProduct(db, Number(raw?.id));
    if (!product) throw badRequest('One of the items is no longer available.', 'item_gone');
    if (product.stock < qty) {
      throw badRequest(
        `Only ${product.stock} left of "${product.name_ar}". Please adjust your basket.`,
        'out_of_stock',
      );
    }
    subtotal += product.price * qty;
    costTotalUsd += (product.cost_usd || 0) * qty;
    lines.push({ product, qty });
  }

  const freeOver = Number(settings.free_shipping_over) || 0;
  const flat = Number(settings.shipping_flat) || 0;
  const shipping = freeOver > 0 && subtotal >= freeOver ? 0 : flat;
  const total = subtotal + shipping;
  const orderNo = await nextOrderNumber(db);

  const info = await db
    .prepare(
      `INSERT INTO orders
         (order_no, user_id, customer_name, email, phone, city, address, notes,
          subtotal, shipping, total, cost_total_usd, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
    )
    .bind(
      orderNo, user?.id ?? null, customerName, user?.email || str(body.email, 254), phone,
      city, address, str(body.notes, 500), subtotal, shipping, total, costTotalUsd,
    )
    .run();

  const orderId = info.meta.last_row_id;
  const statements = [];
  for (const { product, qty } of lines) {
    statements.push(
      db.prepare(
        `INSERT INTO order_items (order_id, product_id, name, image, price, cost_usd, qty)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(orderId, product.id, product.name_ar, product.image, product.price, product.cost_usd || 0, qty),
      db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?').bind(qty, product.id),
    );
  }
  await db.batch(statements);

  return json({ ok: true, order: await getOrderWithItems(db, orderId) }, 201);
});

/* ================================================================== *
 * Owner dashboard
 * ================================================================== */
routes.get('admin/overview', async ({ db, user }) => {
  requireAdmin(user);

  const revenue = await db
    .prepare(
      `SELECT COALESCE(SUM(total), 0) AS total, COALESCE(SUM(cost_total_usd), 0) AS cost_usd,
              COUNT(*) AS orders FROM orders WHERE status != 'cancelled'`,
    ).first();
  const pending = await db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'new'").first();
  const products = await db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active,
              SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) AS out_of_stock,
              SUM(CASE WHEN stock > 0 AND stock <= 3 THEN 1 ELSE 0 END) AS low_stock
       FROM products`,
    ).first();
  const customers = await db.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'").first();
  const settings = await getSettings(db);
  const usdRate = Number(settings.usd_rate) || 3.7;

  const recent = await db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 8').all();
  const top = await db
    .prepare(
      `SELECT p.id, p.name_ar, p.stock,
              COALESCE(SUM(oi.qty), 0) AS sold,
              COALESCE(SUM(oi.qty * oi.price), 0) AS revenue
       FROM products p
       LEFT JOIN order_items oi ON oi.product_id = p.id
       LEFT JOIN orders o ON o.id = oi.order_id AND o.status != 'cancelled'
       GROUP BY p.id ORDER BY sold DESC, p.id DESC LIMIT 6`,
    ).all();
  const sales = await db
    .prepare(
      `SELECT date(created_at) AS day, COALESCE(SUM(total), 0) AS total, COUNT(*) AS orders
       FROM orders WHERE status != 'cancelled' AND created_at >= date('now', '-13 days')
       GROUP BY day ORDER BY day`,
    ).all();

  const revenueTotal = revenue?.total || 0;
  const costTotal = (revenue?.cost_usd || 0) * usdRate;

  return json({
    ok: true,
    stats: {
      revenue: revenueTotal,
      cost: costTotal,
      profit: revenueTotal - costTotal,
      orders: revenue?.orders || 0,
      pending_orders: pending?.n || 0,
      products_total: products?.total || 0,
      products_active: products?.active || 0,
      out_of_stock: products?.out_of_stock || 0,
      low_stock: products?.low_stock || 0,
      customers: customers?.n || 0,
      usd_rate: usdRate,
    },
    recent_orders: recent.results || [],
    top_products: top.results || [],
    sales_by_day: sales.results || [],
  });
});

/* ---- products ---- */
async function productFromBody(db, body) {
  const nameAr = str(body.name_ar, 140);
  const nameEn = str(body.name_en, 140);
  if (!nameAr && !nameEn) throw badRequest('The product needs a name.', 'name');

  const price = num(body.price);
  if (price <= 0) throw badRequest('Please enter a selling price greater than zero.', 'price');

  let categoryId = body.category_id === '' || body.category_id == null ? null : Number(body.category_id);
  if (categoryId !== null) {
    const exists = await db.prepare('SELECT 1 AS x FROM categories WHERE id = ?').bind(categoryId).first();
    if (!Number.isInteger(categoryId) || !exists) categoryId = null;
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

async function replaceImages(db, bucket, productId, incoming) {
  const list = Array.isArray(incoming) ? incoming.slice(0, 8) : [];
  const before = await db
    .prepare('SELECT url FROM product_images WHERE product_id = ?').bind(productId).all();
  const previous = (before.results || []).map((r) => r.url);

  const saved = [];
  for (const entry of list) {
    const source = typeof entry === 'string' ? entry : entry?.url;
    if (source) saved.push(await saveImage(bucket, source));
  }

  await db.prepare('DELETE FROM product_images WHERE product_id = ?').bind(productId).run();
  if (saved.length) {
    await db.batch(saved.map((url, i) =>
      db.prepare('INSERT INTO product_images (product_id, url, sort_order) VALUES (?, ?, ?)')
        .bind(productId, url, i)));
  }

  for (const url of previous) {
    if (saved.includes(url)) continue;
    const stillUsed = await db
      .prepare('SELECT 1 AS x FROM product_images WHERE url = ? LIMIT 1').bind(url).first();
    await deleteImage(bucket, url, !!stillUsed);
  }
}

routes.get('admin/products', async ({ db, user, url }) => {
  requireAdmin(user);
  return json({
    ok: true,
    products: await listProducts(db, {
      includeInactive: true,
      categorySlug: url.searchParams.get('category') || '',
      search: (url.searchParams.get('q') || '').slice(0, 60),
    }),
  });
});

routes.post('admin/products', async ({ db, env, request, user }) => {
  requireAdmin(user);
  const body = await readJson(request);
  const d = await productFromBody(db, body);
  const info = await db
    .prepare(
      `INSERT INTO products
         (sku, name_ar, name_en, description_ar, description_en, brand, category_id,
          price, compare_price, cost_usd, stock, is_active, is_featured, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(d.sku, d.name_ar, d.name_en, d.description_ar, d.description_en, d.brand, d.category_id,
      d.price, d.compare_price, d.cost_usd, d.stock, d.is_active, d.is_featured, d.sort_order)
    .run();

  const id = info.meta.last_row_id;
  await replaceImages(db, env.PHOTOS, id, body.images);
  return json({ ok: true, product: await getProduct(db, id, { includeInactive: true }) }, 201);
});

routes.put('admin/products/:id', async ({ db, env, request, user, params }) => {
  requireAdmin(user);
  const id = Number(params.id);
  const exists = await db.prepare('SELECT 1 AS x FROM products WHERE id = ?').bind(id).first();
  if (!exists) throw notFound('That product no longer exists.');

  const body = await readJson(request);
  const d = await productFromBody(db, body);
  await db
    .prepare(
      `UPDATE products SET sku = ?, name_ar = ?, name_en = ?, description_ar = ?, description_en = ?,
         brand = ?, category_id = ?, price = ?, compare_price = ?, cost_usd = ?,
         stock = ?, is_active = ?, is_featured = ?, sort_order = ?, updated_at = datetime('now')
       WHERE id = ?`,
    )
    .bind(d.sku, d.name_ar, d.name_en, d.description_ar, d.description_en, d.brand, d.category_id,
      d.price, d.compare_price, d.cost_usd, d.stock, d.is_active, d.is_featured, d.sort_order, id)
    .run();

  if (body.images !== undefined) await replaceImages(db, env.PHOTOS, id, body.images);
  return json({ ok: true, product: await getProduct(db, id, { includeInactive: true }) });
});

routes.patch('admin/products/:id', async ({ db, request, user, params }) => {
  requireAdmin(user);
  const id = Number(params.id);
  const existing = await db.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  if (!existing) throw notFound('That product no longer exists.');

  const body = await readJson(request);
  const sets = [];
  const values = [];
  if ('is_active' in body) { sets.push('is_active = ?'); values.push(flag(body.is_active)); }
  if ('is_featured' in body) { sets.push('is_featured = ?'); values.push(flag(body.is_featured)); }
  if ('stock' in body) {
    sets.push('stock = ?');
    values.push(Math.max(0, Math.min(99_999, Number.parseInt(body.stock, 10) || 0)));
  }
  if ('price' in body) {
    const price = num(body.price);
    if (price <= 0) throw badRequest('Price must be greater than zero.', 'price');
    sets.push('price = ?');
    values.push(price);
  }
  if (sets.length === 0) throw badRequest('Nothing to update.');

  sets.push("updated_at = datetime('now')");
  await db.prepare(`UPDATE products SET ${sets.join(', ')} WHERE id = ?`).bind(...values, id).run();
  return json({ ok: true, product: await getProduct(db, id, { includeInactive: true }) });
});

routes.delete('admin/products/:id', async ({ db, env, user, params }) => {
  requireAdmin(user);
  const id = Number(params.id);
  const images = await db
    .prepare('SELECT url FROM product_images WHERE product_id = ?').bind(id).all();
  const info = await db.prepare('DELETE FROM products WHERE id = ?').bind(id).run();
  if (!info.meta.changes) throw notFound('That product no longer exists.');

  for (const { url } of images.results || []) {
    const stillUsed = await db
      .prepare('SELECT 1 AS x FROM product_images WHERE url = ? LIMIT 1').bind(url).first();
    await deleteImage(env.PHOTOS, url, !!stillUsed);
  }
  return json({ ok: true });
});

/* ---- categories ---- */
function slugify(value, fallback) {
  const slug = String(value ?? '').toLowerCase().trim()
    .replace(/[^a-z0-9؀-ۿ]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  return slug || fallback;
}

routes.post('admin/categories', async ({ db, request, user }) => {
  requireAdmin(user);
  const body = await readJson(request);
  const nameAr = str(body.name_ar, 60);
  const nameEn = str(body.name_en, 60);
  if (!nameAr && !nameEn) throw badRequest('The category needs a name.', 'name');

  let slug = slugify(body.slug || nameEn || nameAr, `cat-${Date.now().toString(36)}`);
  if (await db.prepare('SELECT 1 AS x FROM categories WHERE slug = ?').bind(slug).first()) {
    slug = `${slug}-${Math.random().toString(36).slice(2, 6)}`;
  }
  const info = await db
    .prepare('INSERT INTO categories (slug, name_ar, name_en, icon, sort_order) VALUES (?, ?, ?, ?, ?)')
    .bind(slug, nameAr || nameEn, nameEn, str(body.icon, 8), Number.parseInt(body.sort_order, 10) || 0)
    .run();

  const category = await db
    .prepare('SELECT * FROM categories WHERE id = ?').bind(info.meta.last_row_id).first();
  return json({ ok: true, category }, 201);
});

routes.put('admin/categories/:id', async ({ db, request, user, params }) => {
  requireAdmin(user);
  const id = Number(params.id);
  if (!(await db.prepare('SELECT 1 AS x FROM categories WHERE id = ?').bind(id).first())) {
    throw notFound('That category no longer exists.');
  }
  const body = await readJson(request);
  await db
    .prepare('UPDATE categories SET name_ar = ?, name_en = ?, icon = ?, sort_order = ? WHERE id = ?')
    .bind(str(body.name_ar, 60), str(body.name_en, 60), str(body.icon, 8),
      Number.parseInt(body.sort_order, 10) || 0, id)
    .run();
  const category = await db.prepare('SELECT * FROM categories WHERE id = ?').bind(id).first();
  return json({ ok: true, category });
});

routes.delete('admin/categories/:id', async ({ db, user, params }) => {
  requireAdmin(user);
  const info = await db.prepare('DELETE FROM categories WHERE id = ?').bind(Number(params.id)).run();
  if (!info.meta.changes) throw notFound('That category no longer exists.');
  return json({ ok: true });
});

/* ---- orders ---- */
routes.get('admin/orders', async ({ db, user, url }) => {
  requireAdmin(user);
  const status = url.searchParams.get('status') || '';
  const query = ORDER_STATUSES.includes(status)
    ? db.prepare('SELECT * FROM orders WHERE status = ? ORDER BY id DESC LIMIT 200').bind(status)
    : db.prepare('SELECT * FROM orders ORDER BY id DESC LIMIT 200');

  const { results } = await query.all();
  const orders = results || [];
  for (const order of orders) {
    const items = await db
      .prepare('SELECT * FROM order_items WHERE order_id = ? ORDER BY id').bind(order.id).all();
    order.items = items.results || [];
  }
  return json({ ok: true, orders });
});

routes.patch('admin/orders/:id', async ({ db, request, user, params }) => {
  requireAdmin(user);
  const id = Number(params.id);
  const order = await db.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  if (!order) throw notFound('That order no longer exists.');

  const body = await readJson(request);
  const status = str(body.status, 20);
  if (!ORDER_STATUSES.includes(status)) throw badRequest('Unknown order status.', 'status');

  /* Cancelling puts the items back on the shelf, once. */
  if (status === 'cancelled' && order.status !== 'cancelled') {
    const items = await db
      .prepare('SELECT product_id, qty FROM order_items WHERE order_id = ?').bind(id).all();
    const restores = (items.results || [])
      .filter((i) => i.product_id)
      .map((i) => db.prepare('UPDATE products SET stock = stock + ? WHERE id = ?').bind(i.qty, i.product_id));
    if (restores.length) await db.batch(restores);
  }

  await db.prepare("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?")
    .bind(status, id).run();
  return json({ ok: true, order: await getOrderWithItems(db, id) });
});

routes.delete('admin/orders/:id', async ({ db, user, params }) => {
  requireAdmin(user);
  const info = await db.prepare('DELETE FROM orders WHERE id = ?').bind(Number(params.id)).run();
  if (!info.meta.changes) throw notFound('That order no longer exists.');
  return json({ ok: true });
});

/* ---- customers ---- */
routes.get('admin/customers', async ({ db, user }) => {
  requireAdmin(user);
  const { results } = await db
    .prepare(
      `SELECT u.*, COUNT(o.id) AS order_count, COALESCE(SUM(o.total), 0) AS spent
       FROM users u
       LEFT JOIN orders o ON o.user_id = u.id AND o.status != 'cancelled'
       GROUP BY u.id ORDER BY u.id DESC LIMIT 300`,
    ).all();

  return json({
    ok: true,
    customers: (results || []).map((r) => ({
      ...publicUser(r),
      is_blocked: !!r.is_blocked,
      last_login_at: r.last_login_at,
      order_count: r.order_count,
      spent: r.spent,
    })),
  });
});

routes.patch('admin/customers/:id', async ({ db, request, user, params }) => {
  requireAdmin(user);
  const id = Number(params.id);
  const target = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!target) throw notFound('That customer no longer exists.');
  if (target.role === 'admin') throw badRequest('You cannot block an owner account.', 'is_admin');

  const body = await readJson(request);
  const blocked = flag(body.is_blocked);
  await db.prepare('UPDATE users SET is_blocked = ? WHERE id = ?').bind(blocked, id).run();
  if (blocked) await destroyAllSessions(db, id);
  return json({ ok: true });
});

routes.post('admin/customers/:id/password', async ({ db, env, user, params }) => {
  requireAdmin(user);
  const id = Number(params.id);
  const target = await db.prepare('SELECT * FROM users WHERE id = ?').bind(id).first();
  if (!target) throw notFound('That customer no longer exists.');
  if (target.role === 'admin') {
    throw badRequest('Change an owner password from your account page.', 'is_admin');
  }

  const bytes = crypto.getRandomValues(new Uint8Array(4));
  const temporary = 'talil-' + [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  await setPassword(db, env, id, temporary);
  await destroyAllSessions(db, id);

  return json({ ok: true, email: target.email, temporary_password: temporary });
});

/* ---- settings ---- */
routes.get('admin/settings', async ({ db, user }) => {
  requireAdmin(user);
  return json({ ok: true, settings: await getSettings(db) });
});

routes.put('admin/settings', async ({ db, request, user }) => {
  requireAdmin(user);
  const body = await readJson(request);
  for (const key of Object.keys(DEFAULT_SETTINGS)) {
    if (!(key in body)) continue;
    let value = str(body[key], 400);
    if (key === 'whatsapp') value = value.replace(/[^0-9]/g, '');
    await setSetting(db, key, value);
  }
  return json({ ok: true, settings: await getSettings(db) });
});

/* ================================================================== *
 * Dispatch
 * ================================================================== */
export async function onRequest(context) {
  const { request, env, params } = context;
  try {
    if (!env.DB) {
      throw new HttpError(500, 'The database is not connected. Check the D1 binding named DB.', 'no_db');
    }
    assertSameOrigin(request);

    const db = env.DB;
    const segments = Array.isArray(params.route) ? params.route : (params.route ? [params.route] : []);
    const key = `${request.method} ${segments.join('/')}`;

    const token = readCookie(request, SESSION_COOKIE);
    let user = null;
    try {
      user = await getSessionUser(db, env, token);
    } catch {
      user = null;
    }

    /* With the gate on, the catalogue is not public either. */
    if (requireLogin(env) && !user && !PUBLIC_ROUTES.has(key)) {
      throw unauthorized('Please sign in to continue.');
    }

    const match = routes.match(request.method, segments);
    if (!match) throw notFound('That endpoint does not exist.');
    if (match.methodNotAllowed) {
      throw new HttpError(405, 'That method is not allowed here.', 'method_not_allowed');
    }

    return await match.handler({
      request, env, db, user, token, params: match.params, url: new URL(request.url),
    });
  } catch (err) {
    return errorResponse(err);
  }
}
