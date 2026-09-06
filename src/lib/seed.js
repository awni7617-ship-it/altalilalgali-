/**
 * What a brand-new shop starts with — which is not products.
 *
 * The shelves are deliberately empty: a shop that arrives full of somebody
 * else's lipstick is a demo, not a shop, and the first job the owner has is
 * deleting fourteen things she never bought. What she gets instead is the
 * sections to hang her own stock on, the settings, and the account that can
 * change all of it.
 *
 * Seeding runs once and only into an empty categories table, so it can never
 * overwrite a shop that is already trading.
 */
import { hashPassword } from './password.js';
import { nowIso, uid } from './model.js';

export const DEFAULT_SETTINGS = {
  name_ar: 'دار الكحل',
  name_en: 'Dar al-Kohl',
  mark: 'د',
  tagline_ar: 'مستحضرات تجميل أصلية، مختارة قطعةً قطعة — وتصلكِ إلى باب البيت في كل مدن فلسطين.',
  tagline_en: 'Genuine cosmetics, chosen one piece at a time — delivered to your door across Palestine.',
  strip_ar: 'توصيل مجاني للطلبات فوق ٢٥٠ ₪ · الدفع عند الاستلام',
  strip_en: 'Free delivery over ₪250 · Pay when it arrives',
  whatsapp: '',
  instagram: '',
  shipping: '20',
  freeOver: '250',
  usdRate: '3.7',
  days: '2 – 4',
  // The shop opens closed: you sign in to see it. The owner can throw the
  // doors open from the settings sheet whenever she likes.
  private: '1',
  defaultLang: 'ar',
};

export const DEFAULT_CATEGORIES = [
  { slug: 'face', name: 'الوجه', name_en: 'Face', icon: '◐' },
  { slug: 'eyes', name: 'العيون', name_en: 'Eyes', icon: '◉' },
  { slug: 'lips', name: 'الشفاه', name_en: 'Lips', icon: '◆' },
  { slug: 'brows', name: 'الحواجب', name_en: 'Brows', icon: '✧' },
  { slug: 'nails', name: 'الأظافر', name_en: 'Nails', icon: '❖' },
  { slug: 'skin', name: 'العناية بالبشرة', name_en: 'Skincare', icon: '◇' },
  { slug: 'tools', name: 'أدوات وفرش', name_en: 'Tools & brushes', icon: '✦' },
];

export const FALLBACK_EMAIL = 'awni7617@gmail.com';
export const FALLBACK_PASSWORD = '123456';

/**
 * Fill an empty shop with everything except stock. Returns true if anything
 * was written, so the caller can say so in the log — a silent no-op and a
 * successful seed look identical otherwise, and that made a broken first
 * deploy hard to read.
 */
export async function seedShop(env) {
  const existing = await env.DB.prepare('SELECT COUNT(*) AS n FROM categories').first();
  if (existing && Number(existing.n) > 0) return false;

  const writes = [];
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    writes.push(env.DB.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').bind(key, value));
  }
  DEFAULT_CATEGORIES.forEach((c, i) => {
    writes.push(env.DB
      .prepare('INSERT OR IGNORE INTO categories (slug, name, name_en, icon, position) VALUES (?, ?, ?, ?, ?)')
      .bind(c.slug, c.name, c.name_en, c.icon, i));
  });
  await env.DB.batch(writes);
  return true;
}

/**
 * The shopkeeper's account, made once. The password comes from the deploy
 * page when it was filled in; otherwise it is the one the shop was asked to
 * start with, which is why the back office nags to change it.
 */
export async function seedOwner(env) {
  const already = await env.DB.prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'owner'").first();
  if (already && Number(already.n) > 0) return false;

  const email = String(env.OWNER_EMAIL || FALLBACK_EMAIL).trim().toLowerCase();
  const password = String(env.OWNER_PASSWORD || FALLBACK_PASSWORD);
  const hash = await hashPassword(password, env.PBKDF2_ITERATIONS);
  await env.DB.prepare(
    `INSERT OR IGNORE INTO users (id, role, name, email, password, created_at)
     VALUES (?, 'owner', ?, ?, ?, ?)`,
  ).bind(uid(), 'صاحبة المتجر', email, hash, nowIso()).run();
  return true;
}
