import {
  db,
  listProducts,
  getProduct,
  listCategories,
  getSettings,
  nextOrderNumber,
  getOrderWithItems,
} from '../db.js';
import { readJson, sendJson, notFound, badRequest, clientIp, rateLimit, tooMany } from '../http.js';

const PUBLIC_SETTING_KEYS = [
  'shop_name_ar', 'shop_name_en', 'tagline_ar', 'tagline_en',
  'currency', 'currency_symbol', 'whatsapp', 'instagram',
  'shipping_flat', 'free_shipping_over', 'announcement_ar', 'announcement_en',
];

function publicSettings() {
  const all = getSettings();
  const out = {};
  for (const key of PUBLIC_SETTING_KEYS) out[key] = all[key];
  out.shipping_flat = Number(out.shipping_flat) || 0;
  out.free_shipping_over = Number(out.free_shipping_over) || 0;
  return out;
}

/** Strip owner-only numbers (cost price, margin) from a product. */
function forShoppers(product) {
  const { cost_usd, views, sort_order, ...rest } = product;
  return rest;
}

export function registerShopRoutes(router) {
  router.get('/api/shop', async (req, res, ctx) => {
    sendJson(res, 200, {
      ok: true,
      settings: publicSettings(),
      categories: listCategories(),
      products: listProducts().map(forShoppers),
    });
  });

  router.get('/api/products', async (req, res, ctx) => {
    const products = listProducts({
      categorySlug: ctx.query.get('category') || '',
      search: (ctx.query.get('q') || '').slice(0, 60),
    });
    sendJson(res, 200, { ok: true, products: products.map(forShoppers) });
  });

  router.get('/api/products/:id', async (req, res, ctx) => {
    const product = getProduct(Number(ctx.params.id));
    if (!product) throw notFound('That product is no longer available.');
    db.prepare('UPDATE products SET views = views + 1 WHERE id = ?').run(product.id);
    sendJson(res, 200, { ok: true, product: forShoppers(product) });
  });

  router.get('/api/categories', async (req, res, ctx) => {
    sendJson(res, 200, { ok: true, categories: listCategories() });
  });

  /* ---------------------------------------------------------------- *
   * Checkout
   *
   * Prices and stock are re-read from the database — whatever the
   * browser says an item costs is ignored.
   * ---------------------------------------------------------------- */
  router.post('/api/orders', async (req, res, ctx) => {
    const ip = clientIp(req);
    const limited = rateLimit(`order:${ip}`, 10, 3_600_000);
    if (!limited.allowed) {
      throw tooMany('Too many orders from this device. Please contact us on WhatsApp.', limited.retryAfter);
    }

    const body = await readJson(req);
    const text = (v, max) => String(v ?? '').trim().slice(0, max);

    const customerName = text(body.name, 80);
    const phone = text(body.phone, 30);
    const city = text(body.city, 60);
    const address = text(body.address, 250);

    if (customerName.length < 2) throw badRequest('Please enter your full name.', 'name');
    if (phone.replace(/\D/g, '').length < 8) throw badRequest('Please enter a valid phone number.', 'phone');
    if (!city) throw badRequest('Please choose your city.', 'city');
    if (address.length < 4) throw badRequest('Please enter your delivery address.', 'address');

    const requested = Array.isArray(body.items) ? body.items.slice(0, 60) : [];
    if (requested.length === 0) throw badRequest('Your basket is empty.', 'empty_cart');

    const settings = getSettings();
    const lines = [];
    let subtotal = 0;
    let costTotalUsd = 0;

    for (const raw of requested) {
      const id = Number(raw?.id);
      const qty = Math.max(1, Math.min(99, Number.parseInt(raw?.qty, 10) || 1));
      const product = getProduct(id);
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

    const orderNo = nextOrderNumber();
    const info = db
      .prepare(
        `INSERT INTO orders
           (order_no, user_id, customer_name, email, phone, city, address, notes,
            subtotal, shipping, total, cost_total_usd, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'new')`,
      )
      .run(
        orderNo,
        ctx.user?.id ?? null,
        customerName,
        ctx.user?.email || text(body.email, 254),
        phone,
        city,
        address,
        text(body.notes, 500),
        subtotal,
        shipping,
        total,
        costTotalUsd,
      );

    const orderId = Number(info.lastInsertRowid);
    const insertItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, name, image, price, cost_usd, qty)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const reduceStock = db.prepare('UPDATE products SET stock = MAX(0, stock - ?) WHERE id = ?');
    for (const { product, qty } of lines) {
      insertItem.run(orderId, product.id, product.name_ar, product.image, product.price, product.cost_usd || 0, qty);
      reduceStock.run(qty, product.id);
    }

    sendJson(res, 201, { ok: true, order: getOrderWithItems(orderId) });
  });

  /* A shopper can look up their own order by number + phone. */
  router.get('/api/orders/lookup', async (req, res, ctx) => {
    const orderNo = (ctx.query.get('order_no') || '').trim();
    const phone = (ctx.query.get('phone') || '').replace(/\D/g, '');
    if (!orderNo || phone.length < 8) throw badRequest('Enter your order number and phone.');

    const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(orderNo);
    if (!order || order.phone.replace(/\D/g, '') !== phone) {
      throw notFound('No order found with those details.');
    }
    sendJson(res, 200, { ok: true, order: getOrderWithItems(order.id) });
  });
}
