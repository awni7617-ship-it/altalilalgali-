/**
 * The JSON API.
 *
 * Three audiences share it. A stranger may look at the front door and sign in
 * or register. A customer may read the shop, keep favourites, redeem a code
 * and place an order — and never learns what a product cost to buy. Everything
 * else needs the shopkeeper.
 *
 * The price a customer pays is always the one the server looks up, never the
 * one the basket claims, and the same is true of a discount code.
 */
import {
  fail, failIn, nowIso, uid, str, money, whole, bool, round2, cleanEmail, cleanPhone,
  cleanSlug, cleanCode, cleanLang, productPatch, variantList, settingsPatch, couponPatch,
  couponValue, stocktake, basketTotal, dailyTakings, orderRef, sku,
  PUBLIC_SETTINGS, OWNER_SETTINGS, NUMERIC_SETTINGS, SETTING_FALLBACKS,
  ORDER_STATUSES, STOCK_TAKING_STATUSES, EMAIL,
} from './lib/model.js';
import {
  createSession, endSession, cookieHeader, throttle, clearThrottle,
  hashPassword, verifyPassword, publicUser,
} from './session.js';
import { DEFAULT_SETTINGS, FALLBACK_EMAIL, FALLBACK_PASSWORD } from './lib/seed.js';

const PHOTO_LIMIT = 6;
// A 900px JPEG at quality .72 lands near 120KB; 400KB of base64 leaves room
// for a big one without letting a single row grow past what D1 likes.
const PHOTO_MAX_BASE64 = 400_000;
const TAKINGS_DAYS = 14;

/* ------------------------------------------------------------------ shape */

export async function readSettings(env, keys = PUBLIC_SETTINGS) {
  const { results } = await env.DB.prepare('SELECT key, value FROM settings').all();
  const stored = Object.fromEntries((results || []).map((r) => [r.key, r.value]));
  const out = {};
  for (const key of keys) {
    const fallback = SETTING_FALLBACKS[key];
    const raw = key in stored ? stored[key]
      : (fallback && fallback in stored ? stored[fallback] : DEFAULT_SETTINGS[key]);
    out[key] = NUMERIC_SETTINGS.includes(key) ? Number(raw) || 0 : (raw ?? '');
  }
  return out;
}

const isPrivate = (settings) => String(settings.private) === '1';

async function photosByProduct(env, ids) {
  const map = new Map();
  if (!ids.length) return map;
  const marks = ids.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT id, product_id FROM photos WHERE product_id IN (${marks})
      ORDER BY product_id, position, created_at`,
  ).bind(...ids).all();
  for (const row of results || []) {
    if (!map.has(row.product_id)) map.set(row.product_id, []);
    map.get(row.product_id).push(row.id);
  }
  return map;
}

async function variantsByProduct(env, ids) {
  const map = new Map();
  if (!ids.length) return map;
  const marks = ids.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT id, product_id, name, name_en, swatch, stock, position
       FROM variants WHERE product_id IN (${marks}) ORDER BY product_id, position`,
  ).bind(...ids).all();
  for (const row of results || []) {
    if (!map.has(row.product_id)) map.set(row.product_id, []);
    map.get(row.product_id).push({
      id: row.id, name: row.name, name_en: row.name_en, swatch: row.swatch, stock: row.stock,
    });
  }
  return map;
}

async function favouriteIds(env, user) {
  if (!user) return new Set();
  const { results } = await env.DB.prepare('SELECT product_id FROM favourites WHERE user_id = ?')
    .bind(user.id).all();
  return new Set((results || []).map((r) => r.product_id));
}

function shapeProduct(row, { photos, variants, favourites, owner }) {
  const shades = variants.get(row.id) || [];
  const out = {
    id: row.id,
    sku: sku(row.id),
    cat: row.cat,
    house: row.house,
    name: row.name,
    name_en: row.name_en,
    blurb: row.blurb,
    blurb_en: row.blurb_en,
    price: row.price,
    was: row.was,
    // With shades, what is on the shelf is their sum — the product's own
    // column stops being the truth the moment the first shade exists.
    stock: shades.length ? shades.reduce((t, v) => t + Math.max(0, v.stock), 0) : row.stock,
    live: Boolean(row.live),
    pick: Boolean(row.pick),
    photos: photos.get(row.id) || [],
    variants: shades,
    loved: favourites.has(row.id),
  };
  if (owner) {
    out.cost = row.cost;
    out.ownStock = row.stock;
  }
  return out;
}

async function listProducts(env, { owner, user }) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM products ${owner ? '' : 'WHERE live = 1'} ORDER BY id DESC`,
  ).all();
  const rows = results || [];
  const ids = rows.map((r) => r.id);
  const [photos, variants, favourites] = await Promise.all([
    photosByProduct(env, ids), variantsByProduct(env, ids), favouriteIds(env, user),
  ]);
  return rows.map((r) => shapeProduct(r, { photos, variants, favourites, owner }));
}

async function listCategories(env) {
  const { results } = await env.DB.prepare(
    'SELECT slug, name, name_en, icon, position FROM categories ORDER BY position, slug',
  ).all();
  return results || [];
}

async function itemsFor(env, orderIds) {
  const byOrder = new Map();
  if (!orderIds.length) return byOrder;
  const marks = orderIds.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT order_id, product_id, variant_id, name, name_en, variant_name, price, qty
       FROM order_items WHERE order_id IN (${marks}) ORDER BY rowid`,
  ).bind(...orderIds).all();
  for (const it of results || []) {
    if (!byOrder.has(it.order_id)) byOrder.set(it.order_id, []);
    byOrder.get(it.order_id).push(it);
  }
  return byOrder;
}

async function loadOrder(env, id) {
  const order = await env.DB.prepare('SELECT * FROM orders WHERE id = ?').bind(id).first();
  if (!order) failIn(404, 'noSuchOrder', 'لا يوجد طلب بهذا الرقم');
  const items = (await itemsFor(env, [id])).get(id) || [];
  return { ...order, stock_taken: Boolean(order.stock_taken), items };
}

/* ---------------------------------------------------------------- the shop */

async function getShop({ env, user }) {
  const owner = Boolean(user && user.owner);
  const settings = await readSettings(env, owner ? OWNER_SETTINGS : PUBLIC_SETTINGS);

  // A private shop shows a stranger its name and nothing else — not the
  // catalogue, not the count, not the delivery terms.
  if (isPrivate(settings) && !user) {
    return {
      locked: true,
      user: null,
      settings: {
        name_ar: settings.name_ar,
        name_en: settings.name_en,
        mark: settings.mark,
        tagline_ar: settings.tagline_ar,
        tagline_en: settings.tagline_en,
        defaultLang: settings.defaultLang,
        private: settings.private,
      },
      categories: [],
      products: [],
    };
  }

  const [categories, products] = await Promise.all([
    listCategories(env),
    listProducts(env, { owner, user }),
  ]);
  return { locked: false, user: publicUser(user), settings, categories, products };
}

/** Everything the back office opens with, in one request. */
async function getDesk({ env, user }) {
  const shop = await getShop({ env, user });
  const stats = stocktake(shop.products, shop.settings.usdRate);

  const since = new Date(Date.now() - (TAKINGS_DAYS - 1) * 86400000).toISOString().slice(0, 10);
  const [recent, forChart, customers, coupons] = await Promise.all([
    env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 40').all(),
    env.DB.prepare('SELECT created_at, total, status FROM orders WHERE created_at >= ?').bind(since).all(),
    env.DB.prepare(
      `SELECT u.id, u.name, u.email, u.phone, u.city, u.created_at, u.last_seen_at,
              COUNT(o.id) AS orders, COALESCE(SUM(CASE WHEN o.status <> 'cancelled' THEN o.total END), 0) AS spent
         FROM users u LEFT JOIN orders o ON o.user_id = u.id
        WHERE u.role = 'customer'
        GROUP BY u.id ORDER BY u.created_at DESC LIMIT 100`,
    ).all(),
    env.DB.prepare('SELECT * FROM coupons ORDER BY created_at DESC LIMIT 50').all(),
  ]);

  const orders = recent.results || [];
  const byOrder = await itemsFor(env, orders.map((o) => o.id));

  return {
    ...shop,
    stats,
    takings: dailyTakings(forChart.results || [], TAKINGS_DAYS),
    orders: orders.map((o) => ({
      ...o, stock_taken: Boolean(o.stock_taken), items: byOrder.get(o.id) || [],
    })),
    customers: customers.results || [],
    coupons: (coupons.results || []).map((c) => ({ ...c, active: Boolean(c.active) })),
    defaultPassword: await stillDefault(env),
  };
}

async function stillDefault(env) {
  const row = await env.DB.prepare("SELECT email, password FROM users WHERE role = 'owner' LIMIT 1").first();
  if (!row || row.email !== FALLBACK_EMAIL) return false;
  return verifyPassword(FALLBACK_PASSWORD, row.password);
}

/* ------------------------------------------------------------------- doors */

async function signIn({ env, request, body, setCookie, url }) {
  await throttle(env, request);
  const email = cleanEmail(body.email);
  const password = String(body.password || '');
  if (!email || !password) failIn(400, 'needBoth', 'أدخلي البريد الإلكتروني وكلمة المرور');

  const row = await env.DB.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  // The same answer either way: naming which half was wrong would tell a
  // stranger whether an address has an account here.
  const wrong = () => failIn(401, 'badSignIn', 'البريد الإلكتروني أو كلمة المرور غير صحيحة');
  if (!row) {
    // Spend the time hashing anyway, so a missing account is not visibly faster.
    await verifyPassword(password, 'pbkdf2$12000$00$00');
    wrong();
  }
  if (!(await verifyPassword(password, row.password))) wrong();

  await clearThrottle(env, request);
  await env.DB.prepare('UPDATE users SET last_seen_at = ? WHERE id = ?').bind(nowIso(), row.id).run();
  setCookie(cookieHeader(await createSession(env, row, request), url));
  return { user: publicUser({ ...row, owner: row.role === 'owner' }) };
}

async function register({ env, request, body, setCookie, url }) {
  await throttle(env, request, { limit: 6, windowSeconds: 900 });
  const name = str(body.name, 120);
  const email = cleanEmail(body.email);
  const password = String(body.password || '');
  if (!name || name.length < 2) failIn(400, 'needName2', 'اكتبي اسمكِ');
  if (!email || !EMAIL.test(email)) failIn(400, 'needEmail', 'اكتبي بريداً إلكترونياً صحيحاً');
  if (password.length < 6) failIn(400, 'shortPassword', 'كلمة المرور قصيرة — ستة أحرف على الأقل');

  const clash = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(email).first();
  if (clash) failIn(409, 'emailTaken', 'هذا البريد مسجَّل بالفعل — سجّلي الدخول');

  const row = {
    id: uid(),
    role: 'customer',
    name,
    email,
    password: await hashPassword(password, env.PBKDF2_ITERATIONS),
    phone: cleanPhone(body.phone) || '',
    city: str(body.city, 80) || '',
    address: str(body.address, 300) || '',
    lang: cleanLang(body.lang),
  };
  await env.DB.prepare(
    `INSERT INTO users (id, role, name, email, password, phone, city, address, lang, created_at, last_seen_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(row.id, row.role, row.name, row.email, row.password, row.phone, row.city, row.address,
    row.lang, nowIso(), nowIso()).run();

  setCookie(cookieHeader(await createSession(env, row, request), url));
  return { user: publicUser({ ...row, owner: false }) };
}

async function signOut({ env, request, setCookie, url }) {
  await endSession(env, request);
  setCookie(cookieHeader('', url));
  return { user: null };
}

async function updateProfile({ env, user, body }) {
  const patch = {};
  if ('name' in body) patch.name = str(body.name, 120) || user.name;
  if ('phone' in body) patch.phone = cleanPhone(body.phone) || '';
  if ('city' in body) patch.city = str(body.city, 80) || '';
  if ('address' in body) patch.address = str(body.address, 300) || '';
  if ('lang' in body) patch.lang = cleanLang(body.lang);
  if (!Object.keys(patch).length) return { user: publicUser(user) };

  const cols = Object.keys(patch);
  await env.DB.prepare(`UPDATE users SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`)
    .bind(...cols.map((c) => patch[c]), user.id).run();
  return { user: publicUser({ ...user, ...patch }) };
}

async function changeAccount({ env, user, body }) {
  const email = cleanEmail(body.email) || user.email;
  const password = String(body.password || '');
  const current = String(body.current || '');
  if (!EMAIL.test(email)) failIn(400, 'needEmail', 'اكتبي بريداً إلكترونياً صحيحاً');
  if (password.length < 6) failIn(400, 'shortPassword', 'كلمة المرور قصيرة — ستة أحرف على الأقل');
  // Knowing the old password is what stops a borrowed phone, still signed in,
  // from locking someone out of their own account.
  if (!(await verifyPassword(current, user.password))) {
    failIn(403, 'wrongCurrent', 'كلمة المرور الحالية غير صحيحة');
  }

  const clash = await env.DB.prepare('SELECT id FROM users WHERE email = ? AND id <> ?')
    .bind(email, user.id).first();
  if (clash) failIn(409, 'emailTaken', 'هذا البريد مستعمل لحساب آخر');

  const hash = await hashPassword(password, env.PBKDF2_ITERATIONS);
  await env.DB.prepare('UPDATE users SET email = ?, password = ? WHERE id = ?')
    .bind(email, hash, user.id).run();
  // Every other device still holds a cookie minted under the old password.
  await env.DB.prepare('DELETE FROM sessions WHERE user_id = ? AND id <> ?')
    .bind(user.id, user.session_id).run();
  return { email };
}

/* --------------------------------------------------------------- favourites */

async function addFavourite({ env, user, params }) {
  const id = Number(params[0]);
  const product = await env.DB.prepare('SELECT id FROM products WHERE id = ? AND live = 1').bind(id).first();
  if (!product) failIn(404, 'noSuchProduct', 'لا يوجد منتج بهذا الرقم');
  await env.DB.prepare(
    'INSERT OR IGNORE INTO favourites (user_id, product_id, created_at) VALUES (?, ?, ?)',
  ).bind(user.id, id, nowIso()).run();
  return { loved: true, id };
}

async function dropFavourite({ env, user, params }) {
  const id = Number(params[0]);
  await env.DB.prepare('DELETE FROM favourites WHERE user_id = ? AND product_id = ?')
    .bind(user.id, id).run();
  return { loved: false, id };
}

/* ---------------------------------------------------------------- products */

async function saveVariants(env, productId, variants) {
  if (!variants) return;
  const keep = new Set(variants.map((v) => v.id));
  const { results } = await env.DB.prepare('SELECT id FROM variants WHERE product_id = ?')
    .bind(productId).all();
  const writes = [];
  for (const row of results || []) {
    if (!keep.has(row.id)) writes.push(env.DB.prepare('DELETE FROM variants WHERE id = ?').bind(row.id));
  }
  for (const v of variants) {
    writes.push(env.DB.prepare(
      `INSERT INTO variants (id, product_id, name, name_en, swatch, stock, position)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name, name_en = excluded.name_en, swatch = excluded.swatch,
         stock = excluded.stock, position = excluded.position`,
    ).bind(v.id, productId, v.name, v.name_en, v.swatch, v.stock, v.position));
  }
  if (writes.length) await env.DB.batch(writes);
}

async function oneProduct(env, id) {
  const row = await env.DB.prepare('SELECT * FROM products WHERE id = ?').bind(id).first();
  if (!row) failIn(404, 'noSuchProduct', 'لا يوجد منتج بهذا الرقم');
  const [photos, variants] = await Promise.all([
    photosByProduct(env, [id]), variantsByProduct(env, [id]),
  ]);
  return shapeProduct(row, { photos, variants, favourites: new Set(), owner: true });
}

async function createProduct({ env, body }) {
  const patch = productPatch(body, { partial: false });
  const variants = variantList(body);
  const now = nowIso();
  const res = await env.DB.prepare(
    `INSERT INTO products (cat, house, name, name_en, blurb, blurb_en, price, was, cost, stock, live, pick, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(patch.cat ?? '', patch.house ?? '', patch.name, patch.name_en ?? '',
    patch.blurb ?? '', patch.blurb_en ?? '', patch.price, patch.was ?? 0, patch.cost ?? 0,
    patch.stock ?? 0, patch.live ?? 1, patch.pick ?? 0, now, now).run();

  const id = Number(res.meta && res.meta.last_row_id);
  await saveVariants(env, id, variants);
  return { product: await oneProduct(env, id) };
}

async function updateProduct({ env, params, body }) {
  const id = Number(params[0]);
  const existing = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(id).first();
  if (!existing) failIn(404, 'noSuchProduct', 'لا يوجد منتج بهذا الرقم');

  const variants = variantList(body);
  let patch = {};
  try {
    patch = productPatch(body);
  } catch (err) {
    // Editing only the shades is a legitimate change with no product columns.
    if (!variants || String(err.message).indexOf('لا يوجد') === -1) throw err;
  }
  if (Object.keys(patch).length) {
    const cols = Object.keys(patch);
    await env.DB.prepare(
      `UPDATE products SET ${cols.map((c) => `${c} = ?`).join(', ')}, updated_at = ? WHERE id = ?`,
    ).bind(...cols.map((c) => patch[c]), nowIso(), id).run();
  }
  await saveVariants(env, id, variants);
  return { product: await oneProduct(env, id) };
}

async function deleteProduct({ env, params }) {
  const id = Number(params[0]);
  // D1 does not enforce ON DELETE CASCADE unless foreign keys are on, so the
  // children go explicitly rather than on trust.
  await env.DB.batch([
    env.DB.prepare('DELETE FROM photos WHERE product_id = ?').bind(id),
    env.DB.prepare('DELETE FROM variants WHERE product_id = ?').bind(id),
    env.DB.prepare('DELETE FROM favourites WHERE product_id = ?').bind(id),
    env.DB.prepare('DELETE FROM products WHERE id = ?').bind(id),
  ]);
  return { deleted: id };
}

async function addPhoto({ env, params, body }) {
  const productId = Number(params[0]);
  const product = await env.DB.prepare('SELECT id FROM products WHERE id = ?').bind(productId).first();
  if (!product) failIn(404, 'noSuchProduct', 'لا يوجد منتج بهذا الرقم');

  const match = String(body.data || '').match(/^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) failIn(400, 'notAnImage', 'الصورة غير مقروءة — اختاري صورة JPEG أو PNG');
  const [, mime, payload] = match;
  if (payload.length > PHOTO_MAX_BASE64) failIn(413, 'imageTooBig', 'الصورة كبيرة جداً — اختاري صورة أصغر');

  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM photos WHERE product_id = ?')
    .bind(productId).first();
  if (Number(count.n) >= PHOTO_LIMIT) failIn(409, 'tooManyPhotos', 'الحد الأقصى ٦ صور للمنتج');

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

/* -------------------------------------------------------------- categories */

async function saveCategory({ env, body }) {
  const slug = cleanSlug(body.slug || body.name_en || body.name);
  const name = str(body.name, 80);
  if (!slug) failIn(400, 'needSlug', 'القسم يحتاج رمزاً');
  if (!name) failIn(400, 'needCatName', 'القسم يحتاج اسماً');
  const count = await env.DB.prepare('SELECT COUNT(*) AS n FROM categories').first();
  await env.DB.prepare(
    `INSERT INTO categories (slug, name, name_en, icon, position) VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(slug) DO UPDATE SET name = excluded.name, name_en = excluded.name_en, icon = excluded.icon`,
  ).bind(slug, name, str(body.name_en, 80) || '', str(body.icon, 4) || '◆', Number(count.n)).run();
  return { categories: await listCategories(env) };
}

async function deleteCategory({ env, params }) {
  const slug = String(params[0]);
  const used = await env.DB.prepare('SELECT COUNT(*) AS n FROM products WHERE cat = ?').bind(slug).first();
  if (Number(used.n) > 0) {
    failIn(409, 'categoryInUse', 'لا يمكن حذف قسم فيه منتجات', { count: Number(used.n) });
  }
  await env.DB.prepare('DELETE FROM categories WHERE slug = ?').bind(slug).run();
  return { categories: await listCategories(env) };
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

/* ----------------------------------------------------------------- coupons */

async function saveCoupon({ env, body }) {
  const code = cleanCode(body.code);
  if (!code) failIn(400, 'needCode', 'اكتبي رمز الخصم');
  const patch = couponPatch(body, { partial: false });
  const existing = await env.DB.prepare('SELECT code FROM coupons WHERE code = ?').bind(code).first();
  await env.DB.prepare(
    `INSERT INTO coupons (code, kind, value, min_total, max_uses, expires_at, active, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET
       kind = excluded.kind, value = excluded.value, min_total = excluded.min_total,
       max_uses = excluded.max_uses, expires_at = excluded.expires_at, active = excluded.active`,
  ).bind(code, patch.kind ?? 'percent', patch.value, patch.min_total ?? 0, patch.max_uses ?? 0,
    patch.expires_at ?? null, patch.active ?? 1, existing ? existing.created_at || nowIso() : nowIso()).run();
  const { results } = await env.DB.prepare('SELECT * FROM coupons ORDER BY created_at DESC LIMIT 50').all();
  return { coupons: (results || []).map((c) => ({ ...c, active: Boolean(c.active) })) };
}

async function deleteCoupon({ env, params }) {
  await env.DB.prepare('DELETE FROM coupons WHERE code = ?').bind(cleanCode(params[0])).run();
  const { results } = await env.DB.prepare('SELECT * FROM coupons ORDER BY created_at DESC LIMIT 50').all();
  return { coupons: (results || []).map((c) => ({ ...c, active: Boolean(c.active) })) };
}

/** What a code is worth, before the customer commits to the order. */
async function checkCoupon({ env, body }) {
  const code = cleanCode(body.code);
  const subtotal = money(body.subtotal) ?? 0;
  if (!code) failIn(400, 'needCode', 'اكتبي رمز الخصم');
  const coupon = await env.DB.prepare('SELECT * FROM coupons WHERE code = ?').bind(code).first();
  const { discount, reason } = couponValue(coupon, subtotal);
  if (reason) failIn(400, reason, 'رمز الخصم غير صالح', { min: coupon ? coupon.min_total : 0 });
  return { code, discount, kind: coupon.kind, value: coupon.value };
}

/* ------------------------------------------------------------------ orders */

async function placeOrder({ env, user, body }) {
  const customer = str(body.customer, 120) || user.name;
  const phone = cleanPhone(body.phone) || user.phone;
  const city = str(body.city, 80) || user.city;
  const address = str(body.address, 300) || user.address;
  const note = str(body.note, 400) || '';
  if (!customer || customer.length < 2) failIn(400, 'needName2', 'اكتبي الاسم الكامل');
  if (!phone) failIn(400, 'needPhone', 'اكتبي رقم هاتف صحيحاً');
  if (!city) failIn(400, 'needCity', 'اختاري المدينة');
  if (!address || address.length < 4) failIn(400, 'needAddress', 'اكتبي العنوان بالتفصيل');

  const wanted = Array.isArray(body.items) ? body.items.slice(0, 40) : [];
  if (!wanted.length) failIn(400, 'emptyBasket', 'السلة فارغة');

  const ids = [...new Set(wanted.map((i) => Number(i.id)).filter(Number.isFinite))];
  if (!ids.length) failIn(400, 'emptyBasket', 'السلة فارغة');
  const marks = ids.map(() => '?').join(',');
  const { results } = await env.DB.prepare(
    `SELECT id, name, name_en, price, stock FROM products WHERE id IN (${marks}) AND live = 1`,
  ).bind(...ids).all();
  const byId = new Map((results || []).map((r) => [r.id, r]));
  const variants = await variantsByProduct(env, ids);

  // Priced from the database, quantities capped at what is on the shelf: the
  // basket says what is wanted, never what it costs or whether it exists.
  const items = [];
  for (const line of wanted) {
    const product = byId.get(Number(line.id));
    if (!product) continue;
    const shades = variants.get(product.id) || [];
    let shade = null;
    if (shades.length) {
      shade = shades.filter((v) => v.id === String(line.variantId))[0];
      if (!shade || shade.stock <= 0) continue;
    } else if (product.stock <= 0) {
      continue;
    }
    const ceiling = shade ? shade.stock : product.stock;
    const qty = Math.min(ceiling, Math.max(1, whole(line.qty) ?? 1));
    items.push({
      product_id: product.id,
      variant_id: shade ? shade.id : null,
      name: product.name,
      name_en: product.name_en,
      variant_name: shade ? shade.name : '',
      price: product.price,
      qty,
    });
  }
  if (!items.length) failIn(409, 'nothingAvailable', 'لم يعد أيٌّ من هذه المنتجات متوفراً');

  const settings = await readSettings(env, PUBLIC_SETTINGS);
  const sub = items.reduce((t, i) => t + i.price * i.qty, 0);

  let discount = 0;
  let couponCode = '';
  const code = cleanCode(body.coupon);
  if (code) {
    const coupon = await env.DB.prepare('SELECT * FROM coupons WHERE code = ?').bind(code).first();
    const verdict = couponValue(coupon, sub);
    // A code that went stale between the basket and the button is not a
    // failed order — it is an order at full price, and the page says so.
    if (!verdict.reason) { discount = verdict.discount; couponCode = code; }
  }

  const totals = basketTotal(items, settings, discount);
  const id = uid();
  const ref = orderRef();
  const now = nowIso();

  const writes = [
    env.DB.prepare(
      `INSERT INTO orders (id, ref, user_id, customer, phone, city, address, note,
                           subtotal, discount, coupon_code, shipping, total, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new', ?, ?)`,
    ).bind(id, ref, user.id, customer, phone, city, address, note,
      totals.subtotal, totals.discount, couponCode, totals.shipping, totals.total, now, now),
    ...items.map((i) => env.DB.prepare(
      `INSERT INTO order_items (id, order_id, product_id, variant_id, name, name_en, variant_name, price, qty)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(uid(), id, i.product_id, i.variant_id, i.name, i.name_en, i.variant_name, i.price, i.qty)),
  ];
  if (couponCode) {
    writes.push(env.DB.prepare('UPDATE coupons SET used = used + 1 WHERE code = ?').bind(couponCode));
  }
  // Keep the address book current, so the next order is three taps.
  writes.push(env.DB.prepare('UPDATE users SET phone = ?, city = ?, address = ? WHERE id = ?')
    .bind(phone, city, address, user.id));

  await env.DB.batch(writes);
  return { ref, items, coupon: couponCode, ...totals };
}

async function myOrders({ env, user }) {
  const { results } = await env.DB.prepare(
    'SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
  ).bind(user.id).all();
  const orders = results || [];
  const byOrder = await itemsFor(env, orders.map((o) => o.id));
  return { orders: orders.map((o) => ({ ...o, items: byOrder.get(o.id) || [] })) };
}

async function listOrders({ env, query }) {
  const status = str(query.get('status'), 20);
  const rows = status && ORDER_STATUSES.includes(status)
    ? await env.DB.prepare('SELECT * FROM orders WHERE status = ? ORDER BY created_at DESC LIMIT 200')
      .bind(status).all()
    : await env.DB.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 200').all();
  const orders = rows.results || [];
  const byOrder = await itemsFor(env, orders.map((o) => o.id));
  return {
    orders: orders.map((o) => ({
      ...o, stock_taken: Boolean(o.stock_taken), items: byOrder.get(o.id) || [],
    })),
  };
}

/**
 * Moving an order along is also what moves the stock. Confirming takes the
 * pieces off the shelf once — the flag is what makes it once and not once per
 * tap — and cancelling a confirmed order puts them back.
 */
async function updateOrder({ env, params, body }) {
  const status = str(body.status, 20);
  if (!ORDER_STATUSES.includes(status)) failIn(400, 'badStatus', 'حالة غير معروفة');
  const order = await loadOrder(env, String(params[0]));

  const writes = [env.DB.prepare('UPDATE orders SET status = ?, updated_at = ? WHERE id = ?')
    .bind(status, nowIso(), order.id)];
  const move = (sign) => {
    for (const item of order.items) {
      if (item.variant_id) {
        writes.push(env.DB.prepare(
          `UPDATE variants SET stock = MAX(0, stock ${sign} ?) WHERE id = ?`,
        ).bind(item.qty, item.variant_id));
      } else if (item.product_id) {
        writes.push(env.DB.prepare(
          `UPDATE products SET stock = MAX(0, stock ${sign} ?), updated_at = ? WHERE id = ?`,
        ).bind(item.qty, nowIso(), item.product_id));
      }
    }
  };

  if (STOCK_TAKING_STATUSES.includes(status) && !order.stock_taken) {
    move('-');
    writes.push(env.DB.prepare('UPDATE orders SET stock_taken = 1 WHERE id = ?').bind(order.id));
  } else if (status === 'cancelled' && order.stock_taken) {
    move('+');
    writes.push(env.DB.prepare('UPDATE orders SET stock_taken = 0 WHERE id = ?').bind(order.id));
  }

  await env.DB.batch(writes);
  return { order: await loadOrder(env, order.id) };
}

/* ------------------------------------------------------------------ routes */

/** Reachable with no session at all. */
export const OPEN = new Set([
  'GET /shop', 'GET /session', 'POST /session', 'DELETE /session', 'POST /register',
]);

/** Only the shopkeeper. Everything else a signed-in customer may reach. */
const ownerOnly = (handler) => (ctx) => {
  if (!ctx.user || !ctx.user.owner) failIn(403, 'ownerOnly', 'هذه الصفحة للإدارة وحدها');
  return handler(ctx);
};

export const ROUTES = [
  ['GET', /^\/shop$/, getShop],
  ['GET', /^\/session$/, async ({ user }) => ({ user: publicUser(user) })],
  ['POST', /^\/session$/, signIn],
  ['DELETE', /^\/session$/, signOut],
  ['POST', /^\/register$/, register],

  ['PATCH', /^\/profile$/, updateProfile],
  ['POST', /^\/account$/, changeAccount],
  ['POST', /^\/orders$/, placeOrder],
  ['GET', /^\/orders\/mine$/, myOrders],
  ['POST', /^\/coupon$/, checkCoupon],
  ['POST', /^\/favourites\/(\d+)$/, addFavourite],
  ['DELETE', /^\/favourites\/(\d+)$/, dropFavourite],

  ['GET', /^\/desk$/, ownerOnly(getDesk)],
  ['PATCH', /^\/settings$/, ownerOnly(patchSettings)],
  ['POST', /^\/products$/, ownerOnly(createProduct)],
  ['PATCH', /^\/products\/(\d+)$/, ownerOnly(updateProduct)],
  ['DELETE', /^\/products\/(\d+)$/, ownerOnly(deleteProduct)],
  ['POST', /^\/products\/(\d+)\/photos$/, ownerOnly(addPhoto)],
  ['DELETE', /^\/photos\/([A-Za-z0-9]+)$/, ownerOnly(deletePhoto)],
  ['POST', /^\/categories$/, ownerOnly(saveCategory)],
  ['DELETE', /^\/categories\/([^/]+)$/, ownerOnly(deleteCategory)],
  ['POST', /^\/coupons$/, ownerOnly(saveCoupon)],
  ['DELETE', /^\/coupons\/([A-Za-z0-9-]+)$/, ownerOnly(deleteCoupon)],
  ['GET', /^\/orders$/, ownerOnly(listOrders)],
  ['PATCH', /^\/orders\/([A-Za-z0-9-]+)$/, ownerOnly(updateOrder)],
];
