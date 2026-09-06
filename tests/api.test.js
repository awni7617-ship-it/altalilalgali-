/**
 * The shop, end to end through the real Worker against the real schema.
 *
 * These run over an in-memory SQLite standing in for D1, so the queries under
 * test are the queries that ship.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createClient, asOwner, asShopper, asStranger, stock, OWNER, SHOPPER, LIPSTICK,
} from './helpers/client.mjs';

/* ------------------------------------------------------- first run */

test('a Worker handed an empty database builds it and opens an empty shop', async () => {
  const client = createClient({ empty: true });
  const res = await client.get('/api/shop');
  assert.equal(res.status, 200);
  // Sections, yes. Somebody else's lipstick, no.
  assert.equal(res.data.products.length, 0);
  assert.equal(res.data.settings.name_ar, 'دار الكحل');
  assert.equal(res.data.locked, true, 'the shop ships private');
});

test('the shop ships with sections but no stock', async () => {
  const client = await asOwner();
  const { data } = await client.get('/api/desk');
  assert.equal(data.products.length, 0);
  assert.equal(data.categories.length, 7);
  assert.ok(data.categories.some((c) => c.slug === 'lips' && c.name_en === 'Lips'));
});

test('the first steps are all outstanding on a new shop, then tick off', async () => {
  const client = await asOwner();
  let desk = (await client.get('/api/desk')).data;
  assert.equal(desk.defaultPassword, true);
  assert.equal(desk.products.length, 0);
  assert.equal(desk.settings.whatsapp, '');

  await client.patch('/api/settings', { whatsapp: '970590001122' });
  await stock(client);
  desk = (await client.get('/api/desk')).data;
  assert.equal(desk.settings.whatsapp, '970590001122');
  assert.equal(desk.products.length, 1);
});

/* ------------------------------------------------------- the front door */

test('a private shop shows a stranger the name and nothing else', async () => {
  const owner = await asOwner();
  await stock(owner);

  const stranger = await asStranger({ db: owner.db });
  const res = { data: (await stranger.get('/api/shop')).data };
  assert.equal(res.data.locked, true);
  assert.equal(res.data.products.length, 0);
  assert.equal(res.data.categories.length, 0);
  assert.equal('shipping' in res.data.settings, false, 'not even the delivery terms');
  assert.ok(res.data.settings.name_ar);
});

test('opening the doors lets a stranger browse', async () => {
  const owner = await asOwner();
  await stock(owner);
  await owner.patch('/api/settings', { private: false });

  const stranger = await asStranger({ db: owner.db });
  const res = { data: (await stranger.get('/api/shop')).data };
  assert.equal(res.data.locked, false);
  assert.equal(res.data.products.length, 1);
});

test('a customer registers, and is signed in on the spot', async () => {
  const client = await asShopper();
  const res = await client.get('/api/session');
  assert.equal(res.data.user.email, SHOPPER.email);
  assert.equal(res.data.user.owner, false);
  assert.equal(res.data.user.role, 'customer');
});

test('the same email cannot register twice', async () => {
  const client = await asShopper();
  client.forget();
  const again = await client.post('/api/register', SHOPPER);
  assert.equal(again.status, 409);
  assert.equal(again.data.key, 'emailTaken');
});

test('registering needs a name, a real address and a password worth having', async () => {
  const client = createClient();
  await client.get('/api/shop');
  assert.equal((await client.post('/api/register', { ...SHOPPER, name: '' })).status, 400);
  assert.equal((await client.post('/api/register', { ...SHOPPER, email: 'nope' })).status, 400);
  assert.equal((await client.post('/api/register', { ...SHOPPER, password: 'abc' })).status, 400);
});

test('a customer cannot reach the back office', async () => {
  const owner = await asOwner();
  await stock(owner);
  const client = await asShopper({ db: owner.db });

  for (const call of [
    client.get('/api/desk'),
    client.post('/api/products', { name: 'x', price: 5 }),
    client.patch('/api/settings', { name_ar: 'mine now' }),
    client.get('/api/orders'),
    client.post('/api/coupons', { code: 'FREE', value: 90 }),
  ]) {
    const res = await call;
    assert.equal(res.status, 403, 'expected a 403');
    assert.equal(res.data.key, 'ownerOnly');
  }
});

test('signing in with the wrong password says nothing useful', async () => {
  const client = createClient();
  await client.get('/api/shop');
  const wrongPass = await client.post('/api/session', { email: OWNER.email, password: 'nope' });
  const noSuchUser = await client.post('/api/session', { email: 'nobody@example.com', password: 'nope' });
  assert.equal(wrongPass.status, 401);
  assert.equal(noSuchUser.status, 401);
  assert.equal(wrongPass.data.error, noSuchUser.data.error);
});

test('signing out ends the session', async () => {
  const client = await asOwner();
  assert.equal((await client.get('/api/desk')).status, 200);
  await client.del('/api/session');
  assert.equal((await client.get('/api/desk')).status, 401);
});

test('a cross-site post cannot act as the shopkeeper', async () => {
  const client = await asOwner();
  assert.equal((await client.post('/api/products', LIPSTICK)).status, 200);

  const mod = await import('../src/worker.js');
  const response = await mod.default.fetch(
    new Request('https://shop.test/api/products', {
      method: 'POST',
      headers: { origin: 'https://evil.test', 'content-type': 'application/json', cookie: client.cookie },
      body: JSON.stringify({ name: 'hacked', price: 1 }),
    }),
    client.env,
    {},
  );
  assert.equal(response.status, 403);
});

/* ------------------------------------------------------- products */

test('a product is created, edited and deleted', async () => {
  const client = await asOwner();
  const made = await stock(client);
  assert.equal(made.sku, `DK-${String(made.id).padStart(4, '0')}`);
  assert.equal(made.name_en, 'Matte lipstick');

  const edited = await client.patch(`/api/products/${made.id}`, { stock: 2, price: 49 });
  assert.equal(edited.data.product.stock, 2);
  assert.equal(edited.data.product.price, 49);

  assert.equal((await client.del(`/api/products/${made.id}`)).status, 200);
  assert.equal((await client.get('/api/desk')).data.products.length, 0);
});

test('a product without a name or a price is refused', async () => {
  const client = await asOwner();
  assert.equal((await client.post('/api/products', { price: 10 })).data.key, 'needName');
  assert.equal((await client.post('/api/products', { name: 'بلا سعر' })).data.key, 'needPrice');
  assert.equal((await client.post('/api/products', { name: 'صفر', price: 0 })).data.key, 'needPrice');
});

test('a customer never sees what a product cost to buy', async () => {
  const owner = await asOwner();
  await stock(owner);
  const client = await asShopper({ db: owner.db });
  const { data } = await client.get('/api/shop');
  for (const p of data.products) assert.equal('cost' in p, false);
  assert.equal('usdRate' in data.settings, false);
});

test('hidden products are hidden from customers and visible to the shopkeeper', async () => {
  const owner = await asOwner();
  const victim = await stock(owner, { live: false });
  assert.ok((await owner.get('/api/desk')).data.products.some((p) => p.id === victim.id));

  const client = await asShopper({ db: owner.db });
  const seen = await client.get('/api/shop');
  assert.equal(seen.data.products.some((p) => p.id === victim.id), false);
});

/* ------------------------------------------------------- shades */

test('shades carry their own stock, and the product reports their sum', async () => {
  const client = await asOwner();
  const made = await stock(client, {
    stock: 0,
    variants: [
      { name: 'وردي', name_en: 'Rose', swatch: '#c05a72', stock: 4 },
      { name: 'عنّابي', name_en: 'Plum', swatch: '#6d2340', stock: 3 },
    ],
  });
  assert.equal(made.variants.length, 2);
  assert.equal(made.stock, 7);
  assert.ok(made.variants[0].id, 'each shade gets an id of its own');
});

test('two shades cannot share a name, and a shade needs one', async () => {
  const client = await asOwner();
  const twice = await client.post('/api/products', {
    ...LIPSTICK,
    variants: [{ name: 'وردي', stock: 1 }, { name: 'وردي', stock: 2 }],
  });
  assert.equal(twice.data.key, 'duplicateShade');

  const nameless = await client.post('/api/products', {
    ...LIPSTICK, variants: [{ name: '', stock: 1 }],
  });
  assert.equal(nameless.data.key, 'needShadeName');
});

test('a shade that is dropped from the editor is dropped from the shop', async () => {
  const client = await asOwner();
  const made = await stock(client, {
    variants: [{ name: 'وردي', stock: 2 }, { name: 'عنّابي', stock: 2 }],
  });
  const keep = made.variants[0];
  const after = await client.patch(`/api/products/${made.id}`, {
    variants: [{ id: keep.id, name: keep.name, stock: 5 }],
  });
  assert.equal(after.data.product.variants.length, 1);
  assert.equal(after.data.product.stock, 5);
});

test('an order for a product with shades must name one', async () => {
  const owner = await asOwner();
  const made = await stock(owner, {
    stock: 0, variants: [{ name: 'وردي', stock: 3 }],
  });
  const client = await asShopper({ db: owner.db });

  const blind = await client.post('/api/orders', {
    city: 'رام الله', address: 'شارع ركب', items: [{ id: made.id, qty: 1 }],
  });
  assert.equal(blind.status, 409, 'no shade named, nothing orderable');

  const picked = await client.post('/api/orders', {
    city: 'رام الله',
    address: 'شارع ركب',
    items: [{ id: made.id, variantId: made.variants[0].id, qty: 2 }],
  });
  assert.equal(picked.status, 200);
  assert.equal(picked.data.items[0].variant_name, 'وردي');
});

test('confirming an order with shades takes it off that shade', async () => {
  const owner = await asOwner();
  const made = await stock(owner, {
    stock: 0,
    variants: [{ name: 'وردي', stock: 5 }, { name: 'عنّابي', stock: 5 }],
  });
  const rose = made.variants[0];
  const client = await asShopper({ db: owner.db });
  await client.post('/api/orders', {
    city: 'نابلس', address: 'شارع فيصل', items: [{ id: made.id, variantId: rose.id, qty: 2 }],
  });

  const order = (await owner.get('/api/orders')).data.orders[0];
  await owner.patch(`/api/orders/${order.id}`, { status: 'confirmed' });

  const after = (await owner.get('/api/desk')).data.products.find((p) => p.id === made.id);
  assert.equal(after.variants.find((v) => v.id === rose.id).stock, 3);
  assert.equal(after.variants.find((v) => v.id !== rose.id).stock, 5, 'the other shade is untouched');
  assert.equal(after.stock, 8);
});

/* ------------------------------------------------------- ordering */

test('ordering needs a signed-in customer', async () => {
  const owner = await asOwner();
  const made = await stock(owner);
  await owner.patch('/api/settings', { private: false });

  const stranger = await asStranger({ db: owner.db });
  const res = await stranger.post('/api/orders', {
    customer: 'x', phone: '0599123456', city: 'غزة', address: 'الرمال',
    items: [{ id: made.id, qty: 1 }],
  });
  assert.equal(res.status, 401);
});

test('an order is priced by the server, not by the basket', async () => {
  const owner = await asOwner();
  const made = await stock(owner);
  const client = await asShopper({ db: owner.db });

  const res = await client.post('/api/orders', {
    city: 'رام الله',
    address: 'شارع ركب، بناية ٤',
    items: [{ id: made.id, qty: 2, price: 1 }],   // the price here is a lie
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.subtotal, made.price * 2);
  assert.ok(res.data.ref);
});

test('an order cannot ask for more than is on the shelf', async () => {
  const owner = await asOwner();
  const made = await stock(owner, { stock: 4 });
  const client = await asShopper({ db: owner.db });
  const res = await client.post('/api/orders', {
    city: 'نابلس', address: 'شارع فيصل', items: [{ id: made.id, qty: 99 }],
  });
  assert.equal(res.data.items[0].qty, 4);
});

test('an order for something sold out is refused', async () => {
  const owner = await asOwner();
  const made = await stock(owner, { stock: 0 });
  const client = await asShopper({ db: owner.db });
  const res = await client.post('/api/orders', {
    city: 'الخليل', address: 'وسط البلد', items: [{ id: made.id, qty: 1 }],
  });
  assert.equal(res.status, 409);
});

test('the checkout falls back to the address already on the account', async () => {
  const owner = await asOwner();
  const made = await stock(owner);
  const client = await asShopper({ db: owner.db });
  await client.patch('/api/profile', { phone: '0599777888', city: 'جنين', address: 'الحي الشرقي' });

  const res = await client.post('/api/orders', { items: [{ id: made.id, qty: 1 }] });
  assert.equal(res.status, 200);
  const order = (await owner.get('/api/orders')).data.orders[0];
  assert.equal(order.city, 'جنين');
  assert.equal(order.phone, '0599777888');
});

test('an order is missing details it needs', async () => {
  const owner = await asOwner();
  const made = await stock(owner);
  // A customer with nothing on file, so a blank field really is blank rather
  // than quietly filled in from the account.
  const client = await asShopper({ db: owner.db }, {
    name: 'ريم', email: 'reem@example.com', password: 'a-good-secret',
  });
  const base = { customer: 'ريم', phone: '0599000002', city: 'غزة', address: 'الرمال' };

  for (const [missing, key] of [['phone', 'needPhone'], ['city', 'needCity'], ['address', 'needAddress']]) {
    const body = { ...base, [missing]: '', items: [{ id: made.id, qty: 1 }] };
    const res = await client.post('/api/orders', body);
    assert.equal(res.status, 400, `${missing} should be required`);
    assert.equal(res.data.key, key);
  }
  assert.equal((await client.post('/api/orders', { ...base, items: [] })).data.key, 'emptyBasket');
});

test('a customer sees their own orders and nobody else’s', async () => {
  const owner = await asOwner();
  const made = await stock(owner, { stock: 40 });

  const sara = await asShopper({ db: owner.db });
  await sara.post('/api/orders', { city: 'رام الله', address: 'شارع ركب', items: [{ id: made.id, qty: 1 }] });

  const leila = await asStranger({ db: owner.db });
  await leila.post('/api/register', {
    name: 'ليلى', email: 'leila@example.com', password: 'another-secret', phone: '0599000009',
  });
  await leila.post('/api/orders', { city: 'جنين', address: 'الحي الشرقي', items: [{ id: made.id, qty: 3 }] });

  // Separate databases per client, so check the rule on one that has both.
  const mine = await sara.get('/api/orders/mine');
  assert.equal(mine.data.orders.length, 1);
  assert.equal(mine.data.orders[0].items[0].qty, 1);
});

test('confirming an order takes the stock down exactly once, and cancelling puts it back', async () => {
  const owner = await asOwner();
  const made = await stock(owner, { stock: 10 });
  const client = await asShopper({ db: owner.db });
  await client.post('/api/orders', {
    city: 'طولكرم', address: 'شارع نابلس', items: [{ id: made.id, qty: 3 }],
  });

  const order = (await owner.get('/api/orders')).data.orders[0];
  const stockNow = async () => (await owner.get('/api/desk')).data.products.find((p) => p.id === made.id).stock;

  await owner.patch(`/api/orders/${order.id}`, { status: 'confirmed' });
  assert.equal(await stockNow(), 7);

  await owner.patch(`/api/orders/${order.id}`, { status: 'sent' });
  assert.equal(await stockNow(), 7, 'moving it along must not take the stock twice');

  await owner.patch(`/api/orders/${order.id}`, { status: 'cancelled' });
  assert.equal(await stockNow(), 10);
});

test('an unknown order status is refused', async () => {
  const client = await asOwner();
  assert.equal((await client.patch('/api/orders/nope', { status: 'posted' })).data.key, 'badStatus');
});

/* ------------------------------------------------------- discount codes */

test('a percentage code comes off the subtotal', async () => {
  const owner = await asOwner();
  const made = await stock(owner, { price: 100, stock: 10 });
  await owner.post('/api/coupons', { code: 'kohl10', kind: 'percent', value: 10 });

  const client = await asShopper({ db: owner.db });
  const check = await client.post('/api/coupon', { code: 'KOHL10', subtotal: 200 });
  assert.equal(check.data.discount, 20);

  const order = await client.post('/api/orders', {
    city: 'رام الله', address: 'شارع ركب', coupon: 'KOHL10', items: [{ id: made.id, qty: 2 }],
  });
  assert.equal(order.data.subtotal, 200);
  assert.equal(order.data.discount, 20);
});

test('a code below its minimum is refused, and says the minimum', async () => {
  const owner = await asOwner();
  await owner.post('/api/coupons', { code: 'BIG', kind: 'amount', value: 30, min_total: 300 });
  const client = await asShopper({ db: owner.db });
  const res = await client.post('/api/coupon', { code: 'BIG', subtotal: 100 });
  assert.equal(res.data.key, 'codeMinimum');
  assert.equal(res.data.min, 300);
});

test('a spent code stops working', async () => {
  const owner = await asOwner();
  const made = await stock(owner, { price: 50, stock: 10 });
  await owner.post('/api/coupons', { code: 'ONCE', kind: 'percent', value: 20, max_uses: 1 });

  const client = await asShopper({ db: owner.db });
  const first = await client.post('/api/orders', {
    city: 'غزة', address: 'الرمال', coupon: 'ONCE', items: [{ id: made.id, qty: 1 }],
  });
  assert.equal(first.data.discount, 10);

  const again = await client.post('/api/coupon', { code: 'ONCE', subtotal: 50 });
  assert.equal(again.data.key, 'codeSpent');
});

test('a discount never exceeds the basket, and an unknown code is just full price', async () => {
  const owner = await asOwner();
  const made = await stock(owner, { price: 20, stock: 5 });
  await owner.post('/api/coupons', { code: 'HUGE', kind: 'amount', value: 500 });

  const client = await asShopper({ db: owner.db });
  const res = await client.post('/api/orders', {
    city: 'حيفا', address: 'الشارع', coupon: 'HUGE', items: [{ id: made.id, qty: 1 }],
  });
  assert.equal(res.data.discount, 20);
  assert.equal(res.data.total, res.data.shipping);

  const nonsense = await client.post('/api/orders', {
    city: 'حيفا', address: 'الشارع', coupon: 'NOPE', items: [{ id: made.id, qty: 1 }],
  });
  assert.equal(nonsense.status, 200);
  assert.equal(nonsense.data.discount, 0);
});

test('a percentage over ninety is refused', async () => {
  const client = await asOwner();
  assert.equal((await client.post('/api/coupons', { code: 'FREE', value: 95 })).data.key, 'percentTooBig');
});

/* ------------------------------------------------------- favourites */

test('a favourite is kept, listed and dropped', async () => {
  const owner = await asOwner();
  const made = await stock(owner);
  const client = await asShopper({ db: owner.db });

  assert.equal((await client.get('/api/shop')).data.products[0].loved, false);
  await client.post(`/api/favourites/${made.id}`);
  assert.equal((await client.get('/api/shop')).data.products[0].loved, true);
  await client.del(`/api/favourites/${made.id}`);
  assert.equal((await client.get('/api/shop')).data.products[0].loved, false);
});

/* ------------------------------------------------------- sections */

test('a section is added and cannot be deleted while it holds stock', async () => {
  const client = await asOwner();
  const made = await client.post('/api/categories', { name: 'عطور', name_en: 'Perfume', slug: 'perfume', icon: '✿' });
  assert.ok(made.data.categories.some((c) => c.slug === 'perfume'));

  await stock(client, { cat: 'perfume' });
  const blocked = await client.del('/api/categories/perfume');
  assert.equal(blocked.status, 409);
  assert.equal(blocked.data.key, 'categoryInUse');

  const empty = await client.del('/api/categories/nails');
  assert.equal(empty.status, 200);
  assert.equal(empty.data.categories.some((c) => c.slug === 'nails'), false);
});

/* ------------------------------------------------------- the desk */

test('the stocktake and the takings add up', async () => {
  const owner = await asOwner();
  await stock(owner, { price: 100, cost: 10, stock: 3 });
  const made = await stock(owner, { price: 50, cost: 5, stock: 2 });

  const client = await asShopper({ db: owner.db });
  await client.post('/api/orders', { city: 'غزة', address: 'الرمال', items: [{ id: made.id, qty: 1 }] });

  const { data } = await owner.get('/api/desk');
  const rate = data.settings.usdRate;
  assert.equal(data.stats.retail, 100 * 3 + 50 * 2);
  assert.equal(data.stats.cost, Math.round((10 * rate * 3 + 5 * rate * 2) * 100) / 100);
  assert.equal(data.takings.length, 14);
  assert.equal(data.takings[13].total, data.orders[0].total, 'today carries today’s order');
  assert.equal(data.customers.length, 1);
  assert.equal(data.customers[0].orders, 1);
});

test('settings are saved in both languages, and the shop keeps its name', async () => {
  const client = await asOwner();
  const res = await client.patch('/api/settings', {
    name_ar: 'دار الندى', name_en: 'Dar al-Nada',
    tagline_en: 'Kohl, and everything after it',
    whatsapp: '+970 599 111 222', freeOver: 300, private: false,
  });
  assert.equal(res.data.settings.name_ar, 'دار الندى');
  assert.equal(res.data.settings.name_en, 'Dar al-Nada');
  assert.equal(res.data.settings.tagline_en, 'Kohl, and everything after it');
  assert.equal(res.data.settings.whatsapp, '970599111222');
  assert.equal(res.data.settings.private, '0');

  const blanked = await client.patch('/api/settings', { name_ar: '   ' });
  assert.equal(blanked.data.settings.name_ar, 'دار الندى');
});

test('changing the sign-in needs the current password, and ends other sessions', async () => {
  const client = await asOwner();
  assert.equal((await client.post('/api/account', {
    current: 'wrong', email: 'shop@example.com', password: 'a-longer-secret',
  })).data.key, 'wrongCurrent');

  assert.equal((await client.post('/api/account', {
    current: '123456', email: 'shop@example.com', password: 'a-longer-secret',
  })).status, 200);

  assert.equal((await client.get('/api/desk')).status, 200, 'this device stays in');
  client.forget();
  assert.equal((await client.post('/api/session', OWNER)).status, 401, 'the old password is dead');
  assert.equal((await client.post('/api/session', {
    email: 'shop@example.com', password: 'a-longer-secret',
  })).status, 200);
});

test('the back office says so while the shop still uses the password it shipped with', async () => {
  const client = await asOwner();
  assert.equal((await client.get('/api/desk')).data.defaultPassword, true);
  await client.post('/api/account', {
    current: '123456', email: 'awni7617@gmail.com', password: 'something-better',
  });
  assert.equal((await client.get('/api/desk')).data.defaultPassword, false);
});

test('the deploy page can set the first sign-in instead', async () => {
  const client = createClient({ env: { OWNER_EMAIL: 'boss@shop.ps', OWNER_PASSWORD: 'opening-day' } });
  await client.get('/api/shop');
  assert.equal((await client.post('/api/session', OWNER)).status, 401);
  assert.equal((await client.post('/api/session', {
    email: 'boss@shop.ps', password: 'opening-day',
  })).status, 200);
  assert.equal((await client.get('/api/desk')).data.defaultPassword, false);
});

test('too many wrong guesses are throttled', async () => {
  const client = createClient();
  await client.get('/api/shop');
  let throttled = false;
  for (let i = 0; i < 14; i++) {
    const res = await client.post('/api/session', { email: OWNER.email, password: `guess-${i}` });
    if (res.status === 429) { throttled = true; break; }
  }
  assert.ok(throttled, 'expected a 429 before the fourteenth guess');
});

/* ------------------------------------------------------- photographs */

const PIXEL = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsL'
  + 'DBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA'
  + 'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

test('a photograph is stored, served and deleted', async () => {
  const client = await asOwner();
  const made = await stock(client);

  const added = await client.post(`/api/products/${made.id}/photos`, { data: PIXEL });
  assert.equal(added.status, 200);
  assert.equal(added.data.photos.length, 1);

  const served = await client.raw('GET', `/photo/${added.data.id}`);
  assert.equal(served.status, 200);
  assert.match(served.headers.get('cache-control'), /immutable/);

  assert.equal((await client.del(`/api/photos/${added.data.id}`)).status, 200);
  assert.deepEqual((await client.get('/api/desk')).data.products[0].photos, []);
});

test('something that is not an image is refused', async () => {
  const client = await asOwner();
  const made = await stock(client);
  const res = await client.post(`/api/products/${made.id}/photos`, {
    data: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  });
  assert.equal(res.data.key, 'notAnImage');
});

test('deleting a product takes its photographs and shades with it', async () => {
  const client = await asOwner();
  const made = await stock(client, { variants: [{ name: 'وردي', stock: 1 }] });
  const photo = await client.post(`/api/products/${made.id}/photos`, { data: PIXEL });

  await client.del(`/api/products/${made.id}`);
  assert.equal((await client.raw('GET', `/photo/${photo.data.id}`)).status, 404);
  const left = await client.db.prepare('SELECT COUNT(*) AS n FROM variants').first();
  assert.equal(Number(left.n), 0);
});

/* ------------------------------------------------------- the edges */

test('the health check answers without a session', async () => {
  const client = createClient();
  const res = await client.raw('GET', '/healthz');
  assert.equal(res.status, 200);
  assert.equal(res.data.ok, true);
});

test('an unknown API route is a 404, not a 500', async () => {
  const client = await asOwner();
  assert.equal((await client.get('/api/nowhere')).status, 404);
});

test('a static file is served rather than swallowed by the shell', async () => {
  const client = createClient();
  const res = await client.raw('GET', '/app.css');
  assert.equal(res.status, 200);
});
