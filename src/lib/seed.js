/**
 * What a brand-new shop starts with.
 *
 * A freshly deployed Worker meets an empty database, and an empty shop shows a
 * customer nothing and teaches the shopkeeper nothing. So the first request
 * fills it with the catalogue the shop already had, and with the account that
 * can change it.
 *
 * Seeding runs once and only into an empty products table, so it can never
 * overwrite a real shop.
 */
import { hashPassword } from './password.js';
import { nowIso, uid } from './model.js';

export const DEFAULT_SETTINGS = {
  name_ar: 'دار الكحل',
  name_en: 'DAR AL-KOHL · PALESTINE',
  mark: 'د',
  tagline: 'مستحضرات تجميل أصلية، مختارة قطعةً قطعة — وتصلكِ إلى باب البيت في كل مدن فلسطين.',
  strip: 'توصيل مجاني للطلبات فوق ٢٥٠ ₪ · الدفع عند الاستلام',
  whatsapp: '970590000000',
  instagram: '',
  shipping: '20',
  freeOver: '250',
  usdRate: '3.7',
  days: '2 – 4',
};

export const DEFAULT_CATEGORIES = [
  { slug: 'face', name: 'الوجه', icon: '◐' },
  { slug: 'eyes', name: 'العيون', icon: '◉' },
  { slug: 'lips', name: 'الشفاه', icon: '◆' },
  { slug: 'brows', name: 'الحواجب', icon: '✧' },
  { slug: 'nails', name: 'الأظافر', icon: '❖' },
  { slug: 'skin', name: 'العناية بالبشرة', icon: '◇' },
  { slug: 'tools', name: 'أدوات وفرش', icon: '✦' },
];

export const DEFAULT_PRODUCTS = [
  { cat: 'face', house: 'Velvet Touch', name: 'كريم أساس مطفي طويل الثبات', blurb: 'تغطية متوسطة إلى كاملة تدوم حتى ١٦ ساعة، مناسب للبشرة الدهنية والمختلطة. متوفر بدرجات تناسب البشرة الفلسطينية.', price: 89, was: 120, cost: 6.5, stock: 24, live: 1, pick: 1 },
  { cat: 'face', house: 'Velvet Touch', name: 'كونسيلر عالي التغطية', blurb: 'يخفي الهالات السوداء والبقع دون أن يتجمع في الخطوط الدقيقة. تركيبة كريمية خفيفة.', price: 45, was: 60, cost: 2.8, stock: 40, live: 1, pick: 1 },
  { cat: 'face', house: 'Rosé Bloom', name: 'بلاشر باودر وردي', blurb: 'ناعم الملمس يمنح إشراقة طبيعية، سهل الدمج ويدوم طوال اليوم.', price: 39, was: 0, cost: 2.1, stock: 30, live: 1, pick: 0 },
  { cat: 'eyes', house: 'Nude Story', name: 'باليت ظلال عيون ١٨ لون', blurb: 'ثمانية عشر لوناً بين المطفي واللامع بدرجات ترابية دافئة. تصبغ عالي وثبات ممتاز.', price: 115, was: 160, cost: 8.2, stock: 15, live: 1, pick: 1 },
  { cat: 'eyes', house: 'Lash Queen', name: 'ماسكارا تكثيف وتطويل', blurb: 'فرشاة مخروطية تصل لكل رمش، تمنح كثافة مضاعفة بدون تكتل. مقاومة للماء.', price: 52, was: 70, cost: 3.4, stock: 35, live: 1, pick: 0 },
  { cat: 'eyes', house: 'Lash Queen', name: 'آيلاينر سائل أسود', blurb: 'رأس رفيع ودقيق لرسم خط مثالي من أول مرة. لون أسود عميق يثبت ولا يسيل.', price: 34, was: 0, cost: 1.9, stock: 50, live: 1, pick: 0 },
  { cat: 'lips', house: 'Rosé Bloom', name: 'أحمر شفاه مطفي سائل', blurb: 'يدوم حتى ١٢ ساعة بلمسة مخملية مريحة لا تجفف الشفاه. متوفر بعدة درجات.', price: 42, was: 55, cost: 2.3, stock: 60, live: 1, pick: 1 },
  { cat: 'lips', house: 'Rosé Bloom', name: 'ملمع شفاه مرطب', blurb: 'غير لزج، بزيت جوز الهند، يمنح لمعاناً زجاجياً وترطيباً يدوم.', price: 29, was: 0, cost: 1.4, stock: 45, live: 1, pick: 0 },
  { cat: 'brows', house: 'Nude Story', name: 'قلم حواجب مزدوج', blurb: 'رأس رفيع لرسم الشعيرات وفرشاة لتنعيم اللون. يمنح حواجب طبيعية ممتلئة.', price: 31, was: 42, cost: 1.6, stock: 38, live: 1, pick: 0 },
  { cat: 'nails', house: 'Glossy Days', name: 'طقم مناكير ٦ ألوان', blurb: 'ستة ألوان موسمية بتركيبة سريعة الجفاف ولمعان يدوم أسبوعاً كاملاً.', price: 68, was: 95, cost: 4.5, stock: 20, live: 1, pick: 0 },
  { cat: 'skin', house: 'Pure Glow', name: 'سيروم فيتامين سي', blurb: 'يوحّد لون البشرة ويعالج البقع الداكنة تدريجياً. يستخدم صباحاً قبل واقي الشمس.', price: 78, was: 105, cost: 5.2, stock: 3, live: 1, pick: 1 },
  { cat: 'skin', house: 'Pure Glow', name: 'مزيل مكياج بالماء الميسيلار', blurb: 'يزيل المكياج الثقيل بلطف دون فرك، مناسب للبشرة الحساسة وحول العينين.', price: 36, was: 0, cost: 1.8, stock: 42, live: 1, pick: 0 },
  { cat: 'tools', house: 'Studio Pro', name: 'طقم فرش مكياج ١٢ قطعة', blurb: 'شعيرات صناعية ناعمة لا تتساقط، مع حقيبة جلد للحفظ والسفر.', price: 95, was: 140, cost: 6.8, stock: 12, live: 1, pick: 0 },
  { cat: 'tools', house: 'Studio Pro', name: 'إسفنجة بلندر للمكياج', blurb: 'تتضاعف عند البلل لتوزيع كريم الأساس بلمسة نهائية طبيعية خالية من الخطوط.', price: 18, was: 25, cost: 0.7, stock: 0, live: 1, pick: 0 },
];

export const FALLBACK_EMAIL = 'awni7617@gmail.com';
export const FALLBACK_PASSWORD = '123456';

/**
 * Fill an empty shop. Returns true if anything was written, so the caller can
 * say so in the log — a silent no-op and a successful seed look identical
 * otherwise, and that made a broken first deploy hard to read.
 */
export async function seedShop(env) {
  const existing = await env.DB.prepare('SELECT COUNT(*) AS n FROM products').first();
  if (existing && Number(existing.n) > 0) return false;

  const now = nowIso();
  const writes = [];

  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    writes.push(env.DB.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').bind(key, value));
  }
  DEFAULT_CATEGORIES.forEach((c, i) => {
    writes.push(env.DB
      .prepare('INSERT OR IGNORE INTO categories (slug, name, icon, position) VALUES (?, ?, ?, ?)')
      .bind(c.slug, c.name, c.icon, i));
  });
  for (const p of DEFAULT_PRODUCTS) {
    writes.push(env.DB.prepare(
      `INSERT INTO products (cat, house, name, blurb, price, was, cost, stock, live, pick, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(p.cat, p.house, p.name, p.blurb, p.price, p.was, p.cost, p.stock, p.live, p.pick, now, now));
  }
  await env.DB.batch(writes);
  return true;
}

/**
 * The shopkeeper's account, made once. The password comes from the deploy
 * page when it was filled in; otherwise it is the one the shop was asked to
 * start with, which is why the back office nags to change it.
 */
export async function seedOwner(env) {
  const already = await env.DB.prepare('SELECT COUNT(*) AS n FROM users').first();
  if (already && Number(already.n) > 0) return false;

  const email = String(env.OWNER_EMAIL || FALLBACK_EMAIL).trim().toLowerCase();
  const password = String(env.OWNER_PASSWORD || FALLBACK_PASSWORD);
  const hash = await hashPassword(password, env.PBKDF2_ITERATIONS);
  await env.DB.prepare(
    'INSERT OR IGNORE INTO users (id, email, password, created_at) VALUES (?, ?, ?, ?)',
  ).bind(uid(), email, hash, nowIso()).run();
  return true;
}
