/**
 * The rules, on their own — and the one budget only production enforces.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  stocktake, basketTotal, settingsPatch, productPatch, cleanPhone, sku,
  couponValue, dailyTakings, cleanSlug, cleanCode, variantList,
} from '../src/lib/model.js';
import { hashPassword, verifyPassword } from '../src/lib/password.js';

test('the stocktake counts what is on the shelf', () => {
  const s = stocktake([
    { price: 100, cost: 10, stock: 2, live: true },
    { price: 50, cost: 5, stock: 0, live: true },
    { price: 30, cost: 2, stock: 1, live: false },
  ], 4);
  assert.equal(s.live, 2);
  assert.equal(s.hidden, 1);
  assert.equal(s.gone, 1);
  assert.equal(s.low, 2);
  assert.equal(s.units, 3);
  assert.equal(s.retail, 230);
  assert.equal(s.cost, 88);
  assert.equal(s.gain, 142);
});

test('shipping is free at the threshold, not just above it', () => {
  const settings = { shipping: 20, freeOver: 250 };
  assert.equal(basketTotal([{ price: 249, qty: 1 }], settings).shipping, 20);
  assert.equal(basketTotal([{ price: 250, qty: 1 }], settings).shipping, 0);
  assert.equal(basketTotal([], settings).shipping, 0, 'an empty basket is not charged postage');
});

test('a shop with no free-delivery threshold always charges it', () => {
  assert.equal(basketTotal([{ price: 9999, qty: 1 }], { shipping: 20, freeOver: 0 }).shipping, 20);
});

test('settings clean up what a person typed', () => {
  const patch = settingsPatch({
    whatsapp: '+970 (599) 12-34-56',
    instagram: '@dar.alkohl',
    freeOver: '300 shekels',
    usdRate: '0',
    name_ar: '  دار الندى  ',
  });
  assert.equal(patch.whatsapp, '970599123456');
  assert.equal(patch.instagram, 'dar.alkohl');
  assert.equal(patch.freeOver, '300');
  assert.equal('usdRate' in patch, false, 'a zero exchange rate would divide the profit by nothing');
  assert.equal(patch.name_ar, 'دار الندى');
  assert.equal(patch.mark, 'د', 'the monogram follows the name');
});

test('a price that is not a number is not a price', () => {
  assert.throws(() => productPatch({ name: 'x', price: 'اسألي' }, { partial: false }), /سعر/);
  assert.equal(productPatch({ price: '89.5' }).price, 89.5);
  assert.equal(productPatch({ stock: '7.6' }).stock, 8);
  assert.equal(productPatch({ stock: '-4' }).stock, 0);
});

test('phone numbers survive however they are written', () => {
  assert.equal(cleanPhone('0599 123 456'), '0599123456');
  assert.equal(cleanPhone('+972-59-912-3456'), '972599123456');
  assert.equal(cleanPhone('12345'), null);
});

test('a SKU is stable and padded', () => {
  assert.equal(sku(7), 'DK-0007');
  assert.equal(sku(1234), 'DK-1234');
});

test('a discount comes off before the free-delivery line is judged', () => {
  const settings = { shipping: 20, freeOver: 250 };
  // 260 in the basket, but 60 off — so the customer did not really spend 250.
  const t = basketTotal([{ price: 260, qty: 1 }], settings, 60);
  assert.equal(t.discount, 60);
  assert.equal(t.shipping, 20);
  assert.equal(t.total, 220);
});

test('a discount can never be worth more than the basket', () => {
  const t = basketTotal([{ price: 30, qty: 1 }], { shipping: 20, freeOver: 0 }, 500);
  assert.equal(t.discount, 30);
  assert.equal(t.total, 20, 'the delivery is still owed');
});

test('a coupon is worth what it says, and nothing when it should not be', () => {
  const base = {
    active: 1, kind: 'percent', value: 10, min_total: 0, max_uses: 0, used: 0, expires_at: null,
  };
  assert.equal(couponValue(base, 200).discount, 20);
  assert.equal(couponValue({ ...base, kind: 'amount', value: 15 }, 200).discount, 15);
  assert.equal(couponValue({ ...base, active: 0 }, 200).reason, 'unknownCode');
  assert.equal(couponValue(null, 200).reason, 'unknownCode');
  assert.equal(couponValue({ ...base, min_total: 300 }, 200).reason, 'codeMinimum');
  assert.equal(couponValue({ ...base, max_uses: 2, used: 2 }, 200).reason, 'codeSpent');
  assert.equal(couponValue({ ...base, expires_at: '2020-01-01' }, 200).reason, 'codeExpired');
  assert.equal(couponValue({ ...base, expires_at: '2999-01-01' }, 200).discount, 20);
});

test('the takings series has every day, including the empty ones', () => {
  const today = new Date('2026-03-10T09:00:00Z');
  const days = dailyTakings([
    { created_at: '2026-03-10T08:00:00Z', total: 100, status: 'new' },
    { created_at: '2026-03-10T09:30:00Z', total: 50, status: 'confirmed' },
    { created_at: '2026-03-08T10:00:00Z', total: 70, status: 'delivered' },
    { created_at: '2026-03-09T10:00:00Z', total: 999, status: 'cancelled' },
  ], 5, today);

  assert.equal(days.length, 5);
  assert.deepEqual(days.map((d) => d.day),
    ['2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10']);
  assert.equal(days[4].total, 150, 'two orders on the same day add up');
  assert.equal(days[2].total, 70);
  assert.equal(days[3].total, 0, 'a cancelled order is not takings');
  assert.equal(days[0].total, 0);
});

test('shades are numbered, de-duplicated and given ids', () => {
  const list = variantList({
    variants: [
      { name: '  وردي  ', name_en: 'Rose', swatch: '#C05A72', stock: '4' },
      { name: 'عنّابي', stock: -2, swatch: 'red' },
    ],
  });
  assert.equal(list.length, 2);
  assert.equal(list[0].name, 'وردي');
  assert.equal(list[0].swatch, '#c05a72');
  assert.equal(list[0].stock, 4);
  assert.equal(list[0].position, 0);
  assert.ok(list[0].id, 'a new shade is given an id');
  assert.equal(list[1].stock, 0, 'a negative count is no count');
  assert.equal(list[1].swatch, '', 'only a real hex colour is kept');

  assert.throws(() => variantList({ variants: [{ name: 'x' }, { name: 'X' }] }), /الدرجة/);
  assert.equal(variantList({}), null, 'no variants key means "leave the shades alone"');
});

test('a section key and a coupon code survive whatever was typed', () => {
  assert.equal(cleanSlug('  Lip Gloss  '), 'lip-gloss');
  assert.equal(cleanSlug('!!!'), null);
  assert.equal(cleanCode(' kohl-10 '), 'KOHL-10');
  assert.equal(cleanCode('$$'), null);
});

test('a password verifies against its own hash and nothing else', async () => {
  const stored = await hashPassword('correct horse');
  assert.equal(await verifyPassword('correct horse', stored), true);
  assert.equal(await verifyPassword('Correct horse', stored), false);
  assert.equal(await verifyPassword('', stored), false);
  assert.equal(await verifyPassword('correct horse', 'garbage'), false);
});

test('two hashes of the same password differ', async () => {
  assert.notEqual(await hashPassword('same'), await hashPassword('same'));
});

test('a hash made at another iteration count still verifies', async () => {
  const stored = await hashPassword('portable', 1000);
  assert.match(stored, /^pbkdf2\$1000\$/);
  assert.equal(await verifyPassword('portable', stored), true);
});

/**
 * The line that cost a day once: a Worker on the free plan gets 10ms of CPU
 * per request, and neither Node nor `wrangler dev` enforces it. Hashing has to
 * leave room for the rest of the request, so it is held under 8ms here.
 */
test('hashing fits inside the CPU a Worker actually gets', async () => {
  await hashPassword('warm the jit');           // first call pays for setup
  const runs = [];
  for (let i = 0; i < 5; i++) {
    const started = process.cpuUsage();
    await hashPassword('a-realistic-password');
    const spent = process.cpuUsage(started);
    runs.push((spent.user + spent.system) / 1000);
  }
  // The median, not the worst: a shared CI box stalls occasionally and that is
  // not the shop's fault.
  const median = runs.sort((a, b) => a - b)[Math.floor(runs.length / 2)];
  assert.ok(median < 8, `hashing took ${median.toFixed(1)}ms of CPU — the budget is 10ms for the whole request`);
});
