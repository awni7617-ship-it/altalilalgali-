/**
 * The rules the shop obeys, in one place.
 *
 * Validation and the money maths live here rather than in the route handlers,
 * so what a price, a discount or a margin *means* is decided once and the
 * tests can reach it without standing up a Worker.
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

/**
 * Errors reach a page that may be reading in either language, so they travel
 * as a key the front end looks up, with the Arabic as the message a bare HTTP
 * client would see.
 */
export const failIn = (status, key, ar, extra) => fail(status, ar, { key, ...(extra || {}) });

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

export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const bool = (v) => v === true || v === 1 || v === '1' || v === 'true';

export const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const LANGS = ['ar', 'en'];

export const cleanEmail = (v) => {
  const s = str(v, 160);
  return s ? s.toLowerCase() : null;
};

export const cleanLang = (v) => (LANGS.includes(String(v)) ? String(v) : 'ar');

/** Palestinian numbers arrive as 0599…, 970599…, +972 59…; keep the digits. */
export const cleanPhone = (v) => {
  const digits = String(v || '').replace(/\D/g, '');
  return digits.length >= 9 ? digits.slice(0, 20) : null;
};

/** A slug a person typed, made safe for a URL and a primary key. */
export const cleanSlug = (v) => {
  const s = String(v || '').trim().toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return s ? s.slice(0, 40) : null;
};

export const ORDER_STATUSES = ['new', 'confirmed', 'sent', 'delivered', 'cancelled'];
export const STOCK_TAKING_STATUSES = ['confirmed', 'sent', 'delivered'];
export const COUPON_KINDS = ['percent', 'amount'];

/** The settings a customer's browser is allowed to see. */
export const PUBLIC_SETTINGS = [
  'name_ar', 'name_en', 'mark', 'tagline_ar', 'tagline_en', 'strip_ar', 'strip_en',
  'whatsapp', 'instagram', 'shipping', 'freeOver', 'days', 'private', 'defaultLang',
];
/** …plus these, once the shopkeeper is signed in. */
export const OWNER_SETTINGS = [...PUBLIC_SETTINGS, 'usdRate'];

export const NUMERIC_SETTINGS = ['shipping', 'freeOver', 'usdRate'];
const FLAG_SETTINGS = ['private'];

/** Older shops stored one-language keys; read those if the new ones are absent. */
export const SETTING_FALLBACKS = {
  tagline_ar: 'tagline',
  strip_ar: 'strip',
};

export function settingsPatch(body) {
  const patch = {};
  for (const key of OWNER_SETTINGS) {
    if (!(key in body)) continue;
    if (NUMERIC_SETTINGS.includes(key)) {
      const v = money(body[key]);
      if (v !== null) patch[key] = String(v);
      continue;
    }
    if (FLAG_SETTINGS.includes(key)) {
      patch[key] = bool(body[key]) ? '1' : '0';
      continue;
    }
    patch[key] = str(body[key], key.startsWith('tagline') ? 400 : 160) || '';
  }
  if (patch.whatsapp !== undefined) patch.whatsapp = String(patch.whatsapp).replace(/\D/g, '');
  if (patch.instagram !== undefined) patch.instagram = String(patch.instagram).replace(/^@/, '');
  if (patch.defaultLang !== undefined) patch.defaultLang = cleanLang(patch.defaultLang);
  if (patch.usdRate !== undefined && Number(patch.usdRate) <= 0) delete patch.usdRate;
  if (patch.name_ar === '') delete patch.name_ar;   // the shop must keep a name
  if (patch.name_ar) patch.mark = patch.name_ar.trim().slice(0, 1);
  return patch;
}

export function productPatch(body, { partial = true } = {}) {
  const patch = {};
  if ('name' in body) patch.name = str(body.name, 160);
  if ('name_en' in body) patch.name_en = str(body.name_en, 160) || '';
  if ('blurb' in body) patch.blurb = str(body.blurb, 2000) || '';
  if ('blurb_en' in body) patch.blurb_en = str(body.blurb_en, 2000) || '';
  if ('house' in body) patch.house = str(body.house, 80) || '';
  if ('cat' in body) patch.cat = str(body.cat, 40) || '';
  if ('price' in body) patch.price = money(body.price);
  if ('was' in body) patch.was = money(body.was) ?? 0;
  if ('cost' in body) patch.cost = money(body.cost) ?? 0;
  if ('stock' in body) patch.stock = whole(body.stock) ?? 0;
  if ('live' in body) patch.live = bool(body.live) ? 1 : 0;
  if ('pick' in body) patch.pick = bool(body.pick) ? 1 : 0;

  if (!partial || 'name' in body) {
    if (!patch.name) failIn(400, 'needName', 'المنتج يحتاج اسماً');
  }
  if (!partial || 'price' in body) {
    if (!patch.price || patch.price <= 0) failIn(400, 'needPrice', 'سعر البيع لا بد أن يكون أكبر من صفر');
  }
  if (partial && Object.keys(patch).length === 0) failIn(400, 'nothingToChange', 'لا يوجد شيء لتعديله');
  return patch;
}

/** The shades sent with a product. An empty list means "sold as one thing". */
export function variantList(body) {
  if (!Array.isArray(body.variants)) return null;
  const seen = new Set();
  return body.variants.slice(0, 30).map((v, i) => {
    const name = str(v && v.name, 60);
    if (!name) failIn(400, 'needShadeName', 'كل درجة تحتاج اسماً');
    const key = name.toLowerCase();
    if (seen.has(key)) failIn(400, 'duplicateShade', 'لا يمكن تكرار اسم الدرجة');
    seen.add(key);
    return {
      id: str(v.id, 40) || uid().replace(/-/g, '').slice(0, 20),
      name,
      name_en: str(v.name_en, 60) || '',
      // A CSS colour the shopkeeper picked, shown as a dot beside the name.
      swatch: /^#[0-9a-f]{6}$/i.test(String(v.swatch || '')) ? String(v.swatch).toLowerCase() : '',
      stock: whole(v.stock) ?? 0,
      position: i,
    };
  });
}

export function couponPatch(body, { partial = true } = {}) {
  const patch = {};
  if ('kind' in body) {
    patch.kind = COUPON_KINDS.includes(body.kind) ? body.kind : 'percent';
  }
  if ('value' in body) patch.value = money(body.value) ?? 0;
  if ('min_total' in body) patch.min_total = money(body.min_total) ?? 0;
  if ('max_uses' in body) patch.max_uses = whole(body.max_uses) ?? 0;
  if ('active' in body) patch.active = bool(body.active) ? 1 : 0;
  if ('expires_at' in body) {
    const day = str(body.expires_at, 20);
    patch.expires_at = day && /^\d{4}-\d{2}-\d{2}$/.test(day) ? day : null;
  }
  if (!partial || 'value' in body) {
    if (!patch.value || patch.value <= 0) failIn(400, 'needValue', 'قيمة الخصم لا بد أن تكون أكبر من صفر');
  }
  if ((patch.kind || 'percent') === 'percent' && patch.value > 90) {
    failIn(400, 'percentTooBig', 'أكبر نسبة خصم ممكنة ٩٠٪');
  }
  return patch;
}

export const cleanCode = (v) => {
  const s = String(v || '').trim().toUpperCase().replace(/[^A-Z0-9-]/g, '');
  return s ? s.slice(0, 24) : null;
};

/**
 * What a coupon is worth against a subtotal, and why it is worth nothing.
 * Returns { discount, reason } — reason is a key the page turns into words.
 */
export function couponValue(coupon, subtotal, today = new Date()) {
  if (!coupon || !coupon.active) return { discount: 0, reason: 'unknownCode' };
  if (coupon.expires_at && coupon.expires_at < today.toISOString().slice(0, 10)) {
    return { discount: 0, reason: 'codeExpired' };
  }
  if (coupon.max_uses > 0 && coupon.used >= coupon.max_uses) {
    return { discount: 0, reason: 'codeSpent' };
  }
  if (coupon.min_total > 0 && subtotal < coupon.min_total) {
    return { discount: 0, reason: 'codeMinimum', min: coupon.min_total };
  }
  const raw = coupon.kind === 'amount' ? coupon.value : subtotal * (coupon.value / 100);
  // Never worth more than the basket: a discount cannot pay for the delivery.
  return { discount: round2(Math.min(raw, subtotal)), reason: null };
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
  s.retail = round2(s.retail);
  s.cost = round2(s.cost);
  s.gain = round2(s.retail - s.cost);
  return s;
}

/**
 * What an order costs. The server works this out from its own prices — a
 * basket posted from a browser says what is wanted, never what it costs.
 */
export function basketTotal(items, settings, discount = 0) {
  const sub = items.reduce((t, i) => t + i.price * i.qty, 0);
  const off = Math.min(round2(discount), round2(sub));
  const flat = Number(settings.shipping) || 0;
  const free = Number(settings.freeOver) || 0;
  // The threshold is judged on what was actually spent, after the code.
  const payable = sub - off;
  const shipping = items.length === 0 ? 0 : (free > 0 && payable >= free ? 0 : flat);
  return {
    subtotal: round2(sub),
    discount: off,
    shipping: round2(shipping),
    total: round2(payable + shipping),
  };
}

/** A short human reference, so a customer and the shop can name the same order. */
export function orderRef(when = new Date()) {
  const stamp = when.toISOString().slice(2, 10).replace(/-/g, '');
  const tail = [...crypto.getRandomValues(new Uint8Array(2))]
    .map((b) => b.toString(36).toUpperCase().padStart(2, '0')).join('').slice(0, 3);
  return `${stamp}-${tail}`;
}

/**
 * Takings per day for the last `days` days, oldest first, with every day
 * present — including the ones nobody bought anything, which are the whole
 * point of drawing it.
 */
export function dailyTakings(orders, days = 14, today = new Date()) {
  const out = [];
  const byDay = new Map();
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    const day = String(o.created_at || '').slice(0, 10);
    byDay.set(day, round2((byDay.get(day) || 0) + (Number(o.total) || 0)));
  }
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today.getTime() - i * 86400000).toISOString().slice(0, 10);
    out.push({ day: d, total: byDay.get(d) || 0 });
  }
  return out;
}
