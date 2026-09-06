/**
 * The rules the shop obeys, in one place.
 *
 * Validation and the money maths live here rather than in the route handlers,
 * so what a price or a margin *means* is decided once and the tests can reach
 * it without standing up a Worker.
 */

export const nowIso = () => new Date().toISOString();
export const uid = () => (crypto.randomUUID
  ? crypto.randomUUID()
  : `id-${Date.now()}-${Math.random().toString(16).slice(2)}`);

export class ApiError extends Error {
  constructor(status, message, extra) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

export const fail = (status, message, extra) => {
  throw new ApiError(status, message, extra);
};

export const str = (v, max = 500) => {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return s ? s.slice(0, max) : null;
};

export const num = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const cleaned = String(v).replace(/[^0-9.\-]/g, '');
  // Text with no digits in it cleans down to nothing, and Number('') is 0 —
  // which would quietly price a lipstick at zero.
  if (!/\d/.test(cleaned)) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

export const money = (v) => {
  const n = num(v);
  return n === null ? null : Math.max(0, Math.round(n * 100) / 100);
};

export const whole = (v) => {
  const n = num(v);
  return n === null ? null : Math.max(0, Math.round(n));
};

export const bool = (v) => v === true || v === 1 || v === '1' || v === 'true';

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const cleanEmail = (v) => {
  const s = str(v, 160);
  return s ? s.toLowerCase() : null;
};

/** Palestinian numbers arrive as 0599…, 970599…, +972 59…; keep the digits. */
export const cleanPhone = (v) => {
  const digits = String(v || '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(0, 20) : null;
};

export const ORDER_STATUSES = ['new', 'confirmed', 'sent', 'delivered', 'cancelled'];

/** The settings a customer's browser is allowed to see. */
export const PUBLIC_SETTINGS = [
  'name_ar', 'name_en', 'mark', 'tagline', 'strip',
  'whatsapp', 'instagram', 'shipping', 'freeOver', 'days',
];
/** …plus these, once the shopkeeper is signed in. */
export const OWNER_SETTINGS = [...PUBLIC_SETTINGS, 'usdRate'];

const NUMERIC_SETTINGS = { shipping: money, freeOver: money, usdRate: money };

export function settingsPatch(body) {
  const patch = {};
  for (const key of OWNER_SETTINGS) {
    if (!(key in body)) continue;
    if (NUMERIC_SETTINGS[key]) {
      const v = NUMERIC_SETTINGS[key](body[key]);
      if (v !== null) patch[key] = String(v);
      continue;
    }
    patch[key] = str(body[key], key === 'tagline' ? 400 : 160) || '';
  }
  if (patch.whatsapp !== undefined) patch.whatsapp = String(patch.whatsapp).replace(/\D/g, '');
  if (patch.instagram !== undefined) patch.instagram = String(patch.instagram).replace(/^@/, '');
  if (patch.usdRate !== undefined && Number(patch.usdRate) <= 0) delete patch.usdRate;
  if (patch.name_ar === '') delete patch.name_ar;   // the shop must keep a name
  if (patch.name_ar) patch.mark = patch.name_ar.trim().slice(0, 1);
  return patch;
}

export function productPatch(body, { partial = true } = {}) {
  const patch = {};
  if ('name' in body) patch.name = str(body.name, 160);
  if ('blurb' in body) patch.blurb = str(body.blurb, 2000) || '';
  if ('house' in body) patch.house = str(body.house, 80) || '';
  if ('cat' in body) patch.cat = str(body.cat, 40) || '';
  if ('price' in body) patch.price = money(body.price);
  if ('was' in body) patch.was = money(body.was) ?? 0;
  if ('cost' in body) patch.cost = money(body.cost) ?? 0;
  if ('stock' in body) patch.stock = whole(body.stock) ?? 0;
  if ('live' in body) patch.live = bool(body.live) ? 1 : 0;
  if ('pick' in body) patch.pick = bool(body.pick) ? 1 : 0;

  if (!partial || 'name' in body) {
    if (!patch.name) fail(400, 'المنتج يحتاج اسماً');
  }
  if (!partial || 'price' in body) {
    if (!patch.price || patch.price <= 0) fail(400, 'سعر البيع لا بد أن يكون أكبر من صفر');
  }
  if (partial && Object.keys(patch).length === 0) fail(400, 'لا يوجد شيء لتعديله');
  return patch;
}

export const sku = (id) => `DK-${String(id).padStart(4, '0')}`;

/** What the back office shows at a glance. Pure, so a test can check the sums. */
export function stocktake(products, usdRate) {
  const rate = Number(usdRate) > 0 ? Number(usdRate) : 3.7;
  const s = { live: 0, hidden: 0, gone: 0, low: 0, units: 0, retail: 0, cost: 0 };
  for (const p of products) {
    const q = Math.max(0, Number(p.stock) || 0);
    if (p.live) s.live += 1; else s.hidden += 1;
    if (q <= 0) s.gone += 1;
    else if (q <= 3) s.low += 1;
    s.units += q;
    s.retail += (Number(p.price) || 0) * q;
    s.cost += (Number(p.cost) || 0) * rate * q;
  }
  s.retail = Math.round(s.retail * 100) / 100;
  s.cost = Math.round(s.cost * 100) / 100;
  s.gain = Math.round((s.retail - s.cost) * 100) / 100;
  return s;
}

/**
 * What an order costs. The server works this out from its own prices — a
 * basket posted from a browser says what is wanted, never what it costs.
 */
export function basketTotal(items, settings) {
  const sub = items.reduce((t, i) => t + i.price * i.qty, 0);
  const flat = Number(settings.shipping) || 0;
  const free = Number(settings.freeOver) || 0;
  const shipping = items.length === 0 ? 0 : (free > 0 && sub >= free ? 0 : flat);
  const round = (n) => Math.round(n * 100) / 100;
  return { subtotal: round(sub), shipping: round(shipping), total: round(sub + shipping) };
}

/** A short human reference, so a customer and the shop can name the same order. */
export function orderRef(when = new Date()) {
  const stamp = when.toISOString().slice(2, 10).replace(/-/g, '');
  const tail = [...crypto.getRandomValues(new Uint8Array(2))]
    .map((b) => b.toString(36).toUpperCase().padStart(2, '0')).join('').slice(0, 3);
  return `${stamp}-${tail}`;
}
