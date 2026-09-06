/**
 * The JSON API.
 *
 * Two audiences share it. A customer's browser may read the shop and place an
 * order, and that is all — it never learns what a product cost to buy, and the
 * price it pays is the one the server looks up, never the one the basket
 * claims. Everything else needs the shopkeeper's session.
 */
import {
  ApiError, fail, nowIso, uid, str, money, whole, cleanEmail, cleanPhone,
  productPatch, settingsPatch, stocktake, basketTotal, orderRef, sku,
  PUBLIC_SETTINGS, OWNER_SETTINGS, ORDER_STATUSES, EMAIL,
} from './lib/model.js';
import {
  createSession, endSession, cookieHeader, currentUser, throttle, clearThrottle,
  hashPassword, verifyPassword,
} from './session.js';
import { DEFAULT_SETTINGS, FALLBACK_EMAIL, FALLBACK_PASSWORD } from './lib/seed.js';

/* ------------------------------------------------------------------ shape */

const PHOTO_LIMIT = 6;
// A 900px JPEG at quality .72 lands near 120KB; 400KB of base64 leaves room
// for a big one without letting a single row grow past what D1 likes.
const PHOTO_MAX_BASE64 = 400_000;

async function readSettings(env, keys = PUBLIC_SETTINGS) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const stored = Object.fromEntries((results || []).map((r) => [r.key, r.value]));
  const out = {};
  for (const key of keys) {
    const raw = key in stored ? stored[key] : DEFAULT_SETTINGS[key];
    out[key] = ['shipping', 'freeOver', 'usdRate'].includes(key) ? Number(raw) || 0 : (raw ?? '');
  }
  return out;
}

async function photosByProduct(env, ids) {
  if (!ids.length) return new Map();
  const marks = ids.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT id, product_id FROM photos WHERE product_id IN (${marks}) ORDER BY product_id, position, created_at`,
  ).bind(...ids).all();
  const map = new Map();
  for (const row of results || []) {
    if (!map.has(row.product_id)) map.set(row.product_id, []);
    map.get(row.product_id).push(row.id);
  }
  return map;
}

function shapeProduct(row, photos, { owner }) {
  const out = {
    id: row.id,
    sku: sku(row.id),
    cat: row.cat,
    house: row.house,
    name: row.name,
    blurb: row.blurb,
    price: row.price,
    was: row.was,
    stock: row.stock,
    live: Boolean(row.live),
    pick: Boolean(row.pick),
    photos: photos.get(row.id) || [],
  };
  if (owner) out.cost = row.cost;
  return out;
}

async function listProducts(env, { owner }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM products ${owner ? '' : 'WHERE live = 1'} ORDER BY id DESC`,
  ).all();
  const rows = results || [];
  const photos = await photosByProduct(env, rows.map((r) => r.id));
  return rows.map((r) => shapeProduct(r, photos, { owner }));
}

async function listCategories(env) {
  const { results } = await env.DB.prepare(
    'SELECT slug, name, icon FROM categories ORDER BY position, slug',
  ).all();
  return results || [];
}

async function loadOrder(env, id) {
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  if (!order) fail(404, 'لا يوجد طلب بهذا الرقم');
  const { results } = await env.DB.prepare(
    'SELECT product_id, name, price, qty FROM order_items WHERE order_id = ? ORDER BY rowid',
  ).bind(id).all();
  return { ...order, stock_taken: Boolean(order.stock_taken), items: results || [] };
}

/* ---------------------------------------------------------------- the shop */

async function getShop({ env, user }) {
  const owner = Boolean(user);
  const [settings, categories, products] = await Promise.all([
    readSettings(env, owner ? OWNER_SETTINGS : PUBLIC_SETTINGS),
    listCategories(env),
    listProducts(env, { owner }),
  ]);
  return { settings, categories, products, signedIn: owner };
}

/**
 * Everything the back office opens with, in one request: the same shop plus
 * the stocktake and the orders that still need doing.
 */
async function getDesk({ env, user }) {
  const shop = await getShop({ env, user });
  const stats = stocktake(shop.products, shop.settings.usdRate);
  const { results } = await env.DB.prepare(
    'SELECT * FROM orders ORDER BY created_at DESC LIMIT 100',
  ).all();
  const orders = results || [];
  const ids = orders.map((o) => o.id);
  let items = [];
  if (ids.length) {
    const marks = ids.map(() => '?').join(',');
    const rows = await env.DB.prepare(
      `SELECT order_id, name, price, qty FROM order_items WHERE order_id IN (${marks}) ORDER BY rowid`,
    ).bind(...ids).all();
    items = rows.results || [];
  }
  const byOrder = new Map();
  for (const it of items) {
    if (!byOrder.has(it.order_id)) byOrder.set(it.order_id, []);
    byOrder.get(it.order_id).push(it);
  }
  return {
    ...shop,
    email: user.email,
    stats,
    orders: orders.map((o) => ({ ...o, stock_taken: Boolean(o.stock_taken), items: byOrder.get(o.id) || [] })),
    // The shop ships with a known password; say so until it is changed, rather
    // than leaving the only warning in a README nobody opens.
    defaultPassword: await stillDefault(env),
  };
}

async function stillDefault(env) {
  const row = await env.DB.prepare('SELECT email, password FROM users ORDER BY created_at LIMIT 1').first();
  if (!row) return false;
  if (row.email !== FALLBACK_EMAIL) return false;
  return verifyPassword(FALLBACK_PASSWORD, row.password);
}

/* ------------------------------------------------------------------- doors */

async function signIn({ env, request, body, setCookie, url }) {
  await throttle(env, request);
  const email = cleanEmail(body.email);
  const password = String(body.password || '');
  if (!email || !password) fail(400, 'أدخلي البريد الإلكتروني وكلمة المرور');

  const row = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  // The same message either way: naming which half was wrong tells a stranger
  // whether an address is a real account here.
  const wrong = () => fail(401, 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
  if (!row) {
    // Still spend the time hashing, so a missing account is not visibly faster.
    await verifyPassword(password, 'pbkdf2$25000$00$00');
    wrong();
  }
  if (!(await verifyPassword(password, row.password))) wrong();

  await clearThrottle(env, request);
  await env.DB.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(nowIso(), row.id).run();
  setCookie(cookieHeader(await createSession(env, row, request), url));
  return { signedIn: true, email: row.email };
}

async function signOut({ env, request, setCookie, url }) {
  await endSession(env, request);
  setCookie(cookieHeader('', url));
  return { signedIn: false };
}

async function changeAccount({ env, user, body }) {
  const email = cleanEmail(body.email);
  const password = String(body.password || '');
  const current = String(body.current || '');
  if (!email || !EMAIL.test(email)) fail(400, 'اكتبي بريداً إلكترونياً صحيحاً');
  if (password.length < 6) fail(400, 'كلمة المرور قصيرة — ستة أحرف على الأقل');
  // Knowing the old password is what stops a borrowed phone, still signed in,
  // from locking the shopkeeper out of her own shop.
  if (!(await verifyPassword(current, user.password))) fail(403, 'كلمة المرور الحالية غير صحيحة');

  const clash = await env.DB.prepare('SELECT id FROM users WHERE email = ? AND id <> ?')
    .bind(email, user.id).first();
  if (clash) fail(409, 'هذا البريد مستعمل لحساب آخر');

  const hash = await hashPassword(password, env.PBKDF2_ITERATIONS);
  await env.DB.prepare('UPDATE users SET email = ?, password = ? WHERE id = ?')
    .bind(email, hash, user.id).run();
  // Every other session keeps the old password's cookie; drop them all.
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?')
    .bind(user.id, user.session_id).run();
  return { email };
}

/* ---------------------------------------------------------------- products */

async function createProduct({ env, body }) {
  const patch = productPatch(body, { partial: false });
  const now = nowIso();
  const row = {
    cat: patch.cat ?? '', house: patch.house ?? '', name: patch.name, blurb: patch.blurb ?? '',
    price: patch.price, was: patch.was ?? 0, cost: patch.cost ?? 0, stock: patch.stock ?? 0,
    live: patch.live ?? 1, pick: patch.pick ?? 0,
  };
  const res = await env.DB.prepare(
    `INSERT INTO products (cat, house, name, blurb, price, was, cost, stock, live, pick, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(row.cat, row.house, row.name, row.blurb, row.price, row.was, row.cost, row.stock,
    row.live, row.pick, now, now).run();

  const id = Number(res.meta && res.meta.last_row_id);
  const saved = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  return { product: shapeProduct(saved, new Map(), { owner: true }) };
}

async function updateProduct({ env, params, body }) {
  const id = Number(params[0]);
  const existing = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first();
  if (!existing) fail(404, 'لا يوجد منتج بهذا الرقم');

  const patch = productPatch(body);
  const columns = Object.keys(patch);
  await env.DB.prepare(
    `UPDATE products SET ${columns.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
  ).bind(...columns.map((c) => patch[c]), nowIso(), id).run();

  const saved = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  const photos = await photosByProduct(env, [id]);
  return { product: shapeProduct(saved, photos, { owner: true }) };
}

async function deleteProduct({ env, params }) {
  const id = Number(params[0]);
  // Photos go with it. D1 does not enforce ON DELETE CASCADE unless foreign
  // keys are on, so the rows are removed here rather than assumed.
  await env.DB.batch([
    env.DB.prepare('DELETE FROM photos WHERE product_id = ?').bind(id),
    env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id),
  ]);
  return { deleted: id };
}

async function addPhoto({ env, params, body }) {
  const productId = Number(params[0]);
  const product = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(productId).first();
  if (!product) fail(404, 'لا يوجد منتج بهذا الرقم');

  const match = String(body.data || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) fail(400, 'الصورة غير مقروءة — اختاري صورة JPEG أو PNG');
  const [, mime, payload] = match;
  if (payload.length > PHOTO_MAX_BASE64) fail(413, 'الصورة كبيرة جداً — اختاري صورة أصغر');

  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM photos WHERE product_id = ?')
    .bind(productId).first();
  if (Number(count.n) >= PHOTO_LIMIT) fail(409, `الحد الأقصى ${PHOTO_LIMIT} صور للمنتج`);

  const id = uid().replace(/-/g, '').slice(0, 24);
  await env.DB.prepare(
    'INSERT INTO photos (id, product_id, position, mime, bytes, data, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
  ).bind(id, productId, Number(count.n), mime, Math.floor(payload.length * 0.75), payload, nowIso()).run();

  const photos = await photosByProduct(env, [productId]);
  return { id, photos: photos.get(productId) || [] };
}

async function deletePhoto({ env, params }) {
  await env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(String(params[0])).run();
  return { ok: true };
}

async function patchSettings({ env, body }) {
  const patch = settingsPatch(body);
  // Nothing to change is not a mistake — blanking the shop's name is the usual
  // way to get here, and the answer to that is the name it still has.
  if (Object.keys(patch).length) {
    await env.DB.batch(Object.entries(patch).map(([key, value]) => env.DB.prepare(
      `INSERT INTO settings (key, value) VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    ).bind(key, String(value))));
  }
  return { settings: await readSettings(env, OWNER_SETTINGS) };
}

/* ------------------------------------------------------------------ orders */

async function placeOrder({ env, body }) {
  const customer = str(body.customer, 120);
  const phone = cleanPhone(body.phone);
  const city = str(body.city, 80);
  const address = str(body.address, 300);
  const note = str(body.note, 400) || '';
  if (!customer || customer.length < 2) fail(400, 'اكتبي الاسم الكامل');
  if (!phone) fail(400, 'اكتبي رقم هاتف صحيحاً');
  if (!city) fail(400, 'اختاري المدينة');
  if (!address || address.length < 4) fail(400, 'اكتبي العنوان بالتفصيل');

  const wanted = Array.isArray(body.items) ? body.items.slice(0, 40) : [];
  if (!wanted.length) fail(400, 'السلة فارغة');

  const ids = [...new Set(wanted.map((i) => Number(i.id)).filter(Number.isFinite))];
  if (!ids.length) fail(400, 'السلة فارغة');
  const marks = ids.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT id, name, price, stock FROM products WHERE id IN (${marks}) AND live = 1`,
  ).bind(...ids).all();
  const byId = new Map((results || []).map((r) => [r.id, r]));

  // Priced from the database, quantities capped at what is on the shelf: the
  // basket says what is wanted, never what it costs or whether it exists.
  const items = [];
  for (const line of wanted) {
    const product = byId.get(Number(line.id));
    if (!product || product.stock <= 0) continue;
    const qty = Math.min(product.stock, Math.max(1, whole(line.qty) ?? 1));
    items.push({ product_id: product.id, name: product.name, price: product.price, qty });
  }
  if (!items.length) fail(409, 'لم يعد أيٌّ من هذه المنتجات متوفراً');

  const settings = await readSettings(env, PUBLIC_SETTINGS);
  const totals = basketTotal(items, settings);
  const id = uid();
  const ref = orderRef();
  const now = nowIso();

  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO orders (id, ref, customer, phone, city, address, note, subtotal, shipping, total, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
    ).bind(id, ref, customer, phone, city, address, note,
      totals.subtotal, totals.shipping, totals.total, now, now),
    ...items.map((i) => env.DB.prepare(
      'INSERT INTO order_items (id, order_id, product_id, name, price, qty) VALUES (?, ?, ?, ?, ?, ?)',
    ).bind(uid(), id, i.product_id, i.name, i.price, i.qty)),
  ]);

  return { ref, items, ...totals };
}

async function listOrders({ env, query }) {
  const status = str(query.get('status'), 20);
  const rows = status && ORDER_STATUSES.includes(status)
    ? await env.DB.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT 200').bind(status).all()
    : await env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200').all();
  return { orders: (rows.results || []).map((o) => ({ ...o, stock_taken: Boolean(o.stock_taken) })) };
}

/**
 * Moving an order along is also what moves the stock. Confirming takes the
 * pieces off the shelf once — the flag is what makes it once and not once per
 * tap — and cancelling a confirmed order puts them back.
 */
async function updateOrder({ env, params, body }) {
  const status = str(body.status, 20);
  if (!ORDER_STATUSES.includes(status)) fail(400, 'حالة غير معروفة');
  const order = await loadOrder(env, String(params[0]));

  const takesStock = ['confirmed', 'sent', 'delivered'].includes(status);
  const writes = [env.DB.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?')
    .bind(status, nowIso(), order.id)];

  if (takesStock && !order.stock_taken) {
    for (const item of order.items) {
      if (!item.product_id) continue;
      writes.push(env.DB.prepare(
        'UPDATE products SET stock = MAX(0, stock - ?), updated_at = ? WHERE id = ?',
      ).bind(item.qty, nowIso(), item.product_id));
    }
    writes.push(env.DB.prepare('UPDATE orders SET stock_taken = 1 WHERE id = ?').bind(order.id));
  } else if (status === 'cancelled' && order.stock_taken) {
    for (const item of order.items) {
      if (!item.product_id) continue;
      writes.push(env.DB.prepare(
        'UPDATE products SET stock = stock + ?, updated_at = ? WHERE id = ?',
      ).bind(item.qty, nowIso(), item.product_id));
    }
    writes.push(env.DB.prepare('UPDATE orders SET stock_taken = 0 WHERE id = ?').bind(order.id));
  }

  await env.DB.batch(writes);
  return { order: await loadOrder(env, order.id) };
}

/* ------------------------------------------------------------------ routes */

/** Reachable with no session. Everything else needs the shopkeeper. */
export const OPEN = new Set(['GET /shop', 'GET /session', 'POST /session', 'DELETE /session', 'POST /orders']);

export const ROUTES = [
  ['GET', /^\/shop$/, getShop],
  ['GET', /^\/session$/, async ({ user }) => ({ signedIn: Boolean(user), email: user ? user.email : null })],
  ['POST', /^\/session$/, signIn],
  ['DELETE', /^\/session$/, signOut],
  ['POST', /^\/orders$/, placeOrder],

  ['GET', /^\/desk$/, getDesk],
  ['POST', /^\/account$/, changeAccount],
  ['PATCH', /^\/settings$/, patchSettings],
  ['POST', /^\/products$/, createProduct],
  ['PATCH', /^\/products\/(\d+)$/, updateProduct],
  ['DELETE', /^\/products\/(\d+)$/, deleteProduct],
  ['POST', /^\/products\/(\d+)\/photos$/, addPhoto],
  ['DELETE', /^\/photos\/([A-Za-z0-9]+)$/, deletePhoto],
  ['GET', /^\/orders$/, listOrders],
  ['PATCH', /^\/orders\/([A-Za-z0-9-]+)$/, updateOrder],
];

export { ApiError, currentUser, readSettings };
