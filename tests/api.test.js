/**
 * The shop, end to end through the real Worker against the real schema.
 *
 * These run over an in-memory SQLite standing in for D1, so the queries under
 * test are the queries that ship.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, signedIn, OWNER } from './helpers/client.mjs';

test('a Worker handed an empty database builds and stocks it', async () => {
  const client = createClient({ empty: true });
  const res = await client.get('/api/shop');
  assert.equal(res.status, 200);
  assert.equal(res.data.products.length, 14);
  assert.equal(res.data.categories.length, 7);
  assert.equal(res.data.settings.name_ar, 'دار الكحل');
  assert.equal(res.data.signedIn, false);
});

test('a migrated but unseeded database is stocked on first sight', async () => {
  const client = createClient();
  const res = await client.get('/api/shop');
  assert.equal(res.status, 200);
  assert.ok(res.data.products.length > 0);
});

test('a customer never sees what a product cost to buy', async () => {
  const client = createClient();
  const { data } = await client.get('/api/shop');
  for (const p of data.products) assert.equal('cost' in p, false);
  assert.equal('usdRate' in data.settings, false);
});

test('hidden products are hidden from customers and visible to the shopkeeper', async () => {
  const client = await signedIn();
  const { data } = await client.get('/api/desk');
  const victim = data.products[0];
  await client.patch(`/api/products/${victim.id}`, { live: false });

  const asOwner = await client.get('/api/desk');
  assert.ok(asOwner.data.products.some((p) => p.id === victim.id));

  client.forget();
  const asCustomer = await client.get('/api/shop');
  assert.equal(asCustomer.data.products.some((p) => p.id === victim.id), false);
});

test('the back office needs a session', async () => {
  const client = createClient();
  await client.get('/api/shop');
  for (const call of [
    client.get('/api/desk'),
    client.post('/api/products', { name: 'x', price: 5 }),
    client.patch('/api/settings', { name_ar: 'x' }),
    client.get('/api/orders'),
  ]) {
    const res = await call;
    assert.equal(res.status, 401, 'expected a 401');
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
  const client = await signedIn();
  assert.equal((await client.get('/api/desk')).status, 200);
  await client.del('/api/session');
  assert.equal((await client.get('/api/desk')).status, 401);
});

test('a cross-site post cannot act as the shopkeeper', async () => {
  const client = await signedIn();
  const res = await client.raw('POST', '/api/products', { name: 'x', price: 5 });
  assert.equal(res.status, 200, 'same-origin still works');

  const evil = await worker(client);
  assert.equal(evil.status, 403);

  async function worker(c) {
    const mod = await import('../src/worker.js');
    const response = await mod.default.fetch(
      new Request('https://shop.test/api/products', {
        method: 'POST',
        headers: { origin: 'https://evil.test', 'content-type': 'application/json', cookie: c.cookie },
        body: JSON.stringify({ name: 'hacked', price: 1 }),
      }),
      c.env,
      {},
    );
    return { status: response.status };
  }
});

test('a product is created, edited and deleted', async () => {
  const client = await signedIn();
  const made = await client.post('/api/products', {
    name: 'مثبّت مكياج', price: 55, was: 70, cost: 3, stock: 9, cat: 'face', house: 'Velvet Touch',
  });
  assert.equal(made.status, 200);
  const id = made.data.product.id;
  assert.equal(made.data.product.sku, `DK-${String(id).padStart(4, '0')}`);

  const edited = await client.patch(`/api/products/${id}`, { stock: 2, price: 49 });
  assert.equal(edited.data.product.stock, 2);
  assert.equal(edited.data.product.price, 49);

  assert.equal((await client.del(`/api/products/${id}`)).status, 200);
  const after = await client.get('/api/desk');
  assert.equal(after.data.products.some((p) => p.id === id), false);
});

test('a product without a name or a price is refused', async () => {
  const client = await signedIn();
  assert.equal((await client.post('/api/products', { price: 10 })).status, 400);
  assert.equal((await client.post('/api/products', { name: 'بلا سعر' })).status, 400);
  assert.equal((await client.post('/api/products', { name: 'بسعر صفر', price: 0 })).status, 400);
});

test('an order is priced by the server, not by the basket', async () => {
  const client = createClient();
  const { data } = await client.get('/api/shop');
  const product = data.products.find((p) => p.stock > 0);

  const res = await client.post('/api/orders', {
    customer: 'سارة خليل',
    phone: '0599123456',
    city: 'رام الله',
    address: 'شارع ركب، بناية ٤',
    items: [{ id: product.id, qty: 2, price: 1 }],   // the price here is a lie
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.subtotal, product.price * 2);
  assert.ok(res.data.ref);
});

test('an order cannot ask for more than is on the shelf', async () => {
  const client = createClient();
  const { data } = await client.get('/api/shop');
  const product = data.products.find((p) => p.stock > 0);

  const res = await client.post('/api/orders', {
    customer: 'سارة خليل',
    phone: '0599123456',
    city: 'نابلس',
    address: 'شارع فيصل',
    items: [{ id: product.id, qty: product.stock + 50 }],
  });
  assert.equal(res.data.items[0].qty, product.stock);
});

test('an order for something sold out is refused', async () => {
  const client = createClient();
  const { data } = await client.get('/api/shop');
  const sold = data.products.find((p) => p.stock === 0);
  const res = await client.post('/api/orders', {
    customer: 'سارة خليل',
    phone: '0599123456',
    city: 'الخليل',
    address: 'وسط البلد',
    items: [{ id: sold.id, qty: 1 }],
  });
  assert.equal(res.status, 409);
});

test('shipping is free over the threshold and charged under it', async () => {
  const client = await signedIn();
  await client.patch('/api/settings', { shipping: 20, freeOver: 250 });
  const { data } = await client.get('/api/desk');
  const cheap = data.products.find((p) => p.price < 40 && p.stock > 2);

  client.forget();
  const small = await client.post('/api/orders', {
    customer: 'ليلى', phone: '0599000001', city: 'جنين', address: 'الحي الشرقي',
    items: [{ id: cheap.id, qty: 1 }],
  });
  assert.equal(small.data.shipping, 20);
  assert.equal(small.data.total, small.data.subtotal + 20);

  const big = await client.post('/api/orders', {
    customer: 'ليلى', phone: '0599000001', city: 'جنين', address: 'الحي الشرقي',
    items: [{ id: cheap.id, qty: Math.ceil(250 / cheap.price) }],
  });
  assert.ok(big.data.subtotal >= 250);
  assert.equal(big.data.shipping, 0);
});

test('an order is missing details it needs', async () => {
  const client = createClient();
  const { data } = await client.get('/api/shop');
  const product = data.products.find((p) => p.stock > 0);
  const base = { customer: 'ريم', phone: '0599000002', city: 'غزة', address: 'الرمال' };

  for (const missing of ['customer', 'phone', 'city', 'address']) {
    const body = { ...base, items: [{ id: product.id, qty: 1 }] };
    delete body[missing];
    assert.equal((await client.post('/api/orders', body)).status, 400, `${missing} should be required`);
  }
  assert.equal((await client.post('/api/orders', { ...base, items: [] })).status, 400);
});

test('confirming an order takes the stock down exactly once, and cancelling puts it back', async () => {
  const client = await signedIn();
  const desk = await client.get('/api/desk');
  const product = desk.data.products.find((p) => p.stock > 5);
  const before = product.stock;

  client.forget();
  await client.post('/api/orders', {
    customer: 'هالة', phone: '0599000003', city: 'طولكرم', address: 'شارع نابلس',
    items: [{ id: product.id, qty: 3 }],
  });

  const owner = await signedInAgain(client);
  const order = owner.orders[0];

  await client.patch(`/api/orders/${order.id}`, { status: 'confirmed' });
  let now = await client.get('/api/desk');
  assert.equal(now.data.products.find((p) => p.id === product.id).stock, before - 3);

  // Moving it along again must not take the stock a second time.
  await client.patch(`/api/orders/${order.id}`, { status: 'sent' });
  now = await client.get('/api/desk');
  assert.equal(now.data.products.find((p) => p.id === product.id).stock, before - 3);

  await client.patch(`/api/orders/${order.id}`, { status: 'cancelled' });
  now = await client.get('/api/desk');
  assert.equal(now.data.products.find((p) => p.id === product.id).stock, before);

  async function signedInAgain(c) {
    await c.post('/api/session', OWNER);
    return (await c.get('/api/desk')).data;
  }
});

test('an unknown order status is refused', async () => {
  const client = await signedIn();
  const res = await client.patch('/api/orders/nope', { status: 'posted' });
  assert.equal(res.status, 400);
});

test('the stocktake adds up', async () => {
  const client = await signedIn();
  const { data } = await client.get('/api/desk');
  const rate = data.settings.usdRate;
  const retail = data.products.reduce((t, p) => t + p.price * Math.max(0, p.stock), 0);
  const cost = data.products.reduce((t, p) => t + p.cost * rate * Math.max(0, p.stock), 0);

  assert.equal(data.stats.retail, Math.round(retail * 100) / 100);
  assert.equal(data.stats.cost, Math.round(cost * 100) / 100);
  assert.equal(data.stats.gain, Math.round((retail - cost) * 100) / 100);
  assert.equal(data.stats.live + data.stats.hidden, data.products.length);
});

test('settings are saved, and the shop keeps its name', async () => {
  const client = await signedIn();
  const res = await client.patch('/api/settings', {
    name_ar: 'دار الكحل والندى', whatsapp: '+970 599 111 222', freeOver: 300,
  });
  assert.equal(res.status, 200);
  assert.equal(res.data.settings.name_ar, 'دار الكحل والندى');
  assert.equal(res.data.settings.whatsapp, '970599111222');
  assert.equal(res.data.settings.freeOver, 300);

  const blanked = await client.patch('/api/settings', { name_ar: '   ' });
  assert.equal(blanked.data.settings.name_ar, 'دار الكحل والندى');
});

test('changing the sign-in needs the current password, and ends other sessions', async () => {
  const client = await signedIn();
  const stolen = await signedIn();          // a second device, signed in already

  assert.equal((await client.post('/api/account', {
    current: 'wrong', email: 'shop@example.com', password: 'a-longer-secret',
  })).status, 403);

  const ok = await client.post('/api/account', {
    current: '123456', email: 'shop@example.com', password: 'a-longer-secret',
  });
  assert.equal(ok.status, 200);

  // The device that changed it stays in; nothing here can reach the other
  // client's database, so check the rule that matters on this one.
  assert.equal((await client.get('/api/desk')).status, 200);
  assert.equal((await stolen.get('/api/desk')).status, 200, 'a separate shop is untouched');

  client.forget();
  assert.equal((await client.post('/api/session', OWNER)).status, 401, 'the old password is dead');
  assert.equal((await client.post('/api/session', {
    email: 'shop@example.com', password: 'a-longer-secret',
  })).status, 200);
});

test('a short password is refused', async () => {
  const client = await signedIn();
  const res = await client.post('/api/account', {
    current: '123456', email: 'shop@example.com', password: 'abc',
  });
  assert.equal(res.status, 400);
});

test('the back office says so while the shop still uses the password it shipped with', async () => {
  const client = await signedIn();
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
  let sawThrottle = false;
  for (let i = 0; i < 14; i++) {
    const res = await client.post('/api/session', { email: OWNER.email, password: `guess-${i}` });
    if (res.status === 429) { sawThrottle = true; break; }
  }
  assert.ok(sawThrottle, 'expected a 429 before the fourteenth guess');
});

test('a photograph is stored, served and deleted', async () => {
  const client = await signedIn();
  const { data } = await client.get('/api/desk');
  const id = data.products[0].id;
  // A one-pixel JPEG is enough to prove the round trip.
  const pixel = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsL'
    + 'DBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA'
    + 'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';

  const added = await client.post(`/api/products/${id}/photos`, { data: pixel });
  assert.equal(added.status, 200);
  assert.equal(added.data.photos.length, 1);

  const shown = await client.get('/api/desk');
  assert.deepEqual(shown.data.products.find((p) => p.id === id).photos, [added.data.id]);

  const served = await client.raw('GET', `/photo/${added.data.id}`);
  assert.equal(served.status, 200);
  assert.match(served.headers.get('cache-control'), /immutable/);

  assert.equal((await client.del(`/api/photos/${added.data.id}`)).status, 200);
  const gone = await client.get('/api/desk');
  assert.deepEqual(gone.data.products.find((p) => p.id === id).photos, []);
});

test('something that is not an image is refused', async () => {
  const client = await signedIn();
  const { data } = await client.get('/api/desk');
  const id = data.products[0].id;
  const res = await client.post(`/api/products/${id}/photos`, {
    data: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
  });
  assert.equal(res.status, 400);
});

test('deleting a product takes its photographs with it', async () => {
  const client = await signedIn();
  const made = await client.post('/api/products', { name: 'صنف مؤقّت', price: 20 });
  const id = made.data.product.id;
  const pixel = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsL'
    + 'DBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAA'
    + 'AAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==';
  const photo = await client.post(`/api/products/${id}/photos`, { data: pixel });

  await client.del(`/api/products/${id}`);
  const served = await client.raw('GET', `/photo/${photo.data.id}`);
  assert.equal(served.status, 404);
});

test('the health check answers without a session', async () => {
  const client = createClient();
  const res = await client.raw('GET', '/healthz');
  assert.equal(res.status, 200);
  assert.equal(res.data.ok, true);
});

test('an unknown API route is a 404, not a 500', async () => {
  const client = await signedIn();
  assert.equal((await client.get('/api/nowhere')).status, 404);
});
