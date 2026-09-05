/**
 * Fills an empty shop with sensible categories and a starter catalogue
 * so the storefront and dashboard are never blank.
 *
 *   node server/seed.js           add anything missing
 *   node server/seed.js --reset   wipe products/categories first
 */
import { db } from './db.js';

const reset = process.argv.includes('--reset');

if (reset) {
  db.exec('DELETE FROM product_images; DELETE FROM products; DELETE FROM categories;');
  console.log('Cleared existing products and categories.');
}

const CATEGORIES = [
  { slug: 'face',   name_ar: 'الوجه',        name_en: 'Face',      icon: '🧴', sort_order: 1 },
  { slug: 'eyes',   name_ar: 'العيون',       name_en: 'Eyes',      icon: '👁️', sort_order: 2 },
  { slug: 'lips',   name_ar: 'الشفاه',       name_en: 'Lips',      icon: '💄', sort_order: 3 },
  { slug: 'brows',  name_ar: 'الحواجب',      name_en: 'Brows',     icon: '✏️', sort_order: 4 },
  { slug: 'nails',  name_ar: 'الأظافر',      name_en: 'Nails',     icon: '💅', sort_order: 5 },
  { slug: 'skin',   name_ar: 'العناية بالبشرة', name_en: 'Skincare', icon: '✨', sort_order: 6 },
  { slug: 'tools',  name_ar: 'أدوات وفرش',   name_en: 'Tools',     icon: '🖌️', sort_order: 7 },
];

const insertCategory = db.prepare(
  'INSERT INTO categories (slug, name_ar, name_en, icon, sort_order) VALUES (?, ?, ?, ?, ?)',
);
const findCategory = db.prepare('SELECT id FROM categories WHERE slug = ?');

const categoryIds = {};
for (const c of CATEGORIES) {
  const existing = findCategory.get(c.slug);
  if (existing) {
    categoryIds[c.slug] = existing.id;
    continue;
  }
  const info = insertCategory.run(c.slug, c.name_ar, c.name_en, c.icon, c.sort_order);
  categoryIds[c.slug] = Number(info.lastInsertRowid);
}

/* Prices in shekels, cost in dollars — the margin the dashboard shows
 * is computed from these two numbers. */
const PRODUCTS = [
  {
    sku: 'FND-001', category: 'face', brand: 'Velvet Touch',
    name_ar: 'كريم أساس مطفي طويل الثبات', name_en: 'Matte Long-Wear Foundation',
    description_ar: 'كريم أساس بتغطية متوسطة إلى كاملة يدوم حتى ١٦ ساعة، مناسب للبشرة الدهنية والمختلطة. متوفر بدرجات تناسب البشرة الفلسطينية.',
    description_en: 'Medium-to-full coverage foundation that lasts up to 16 hours. Suited to oily and combination skin.',
    price: 89, compare_price: 120, cost_usd: 6.5, stock: 24, is_featured: 1,
  },
  {
    sku: 'CNC-002', category: 'face', brand: 'Velvet Touch',
    name_ar: 'كونسيلر عالي التغطية', name_en: 'High-Coverage Concealer',
    description_ar: 'يخفي الهالات السوداء والبقع دون أن يتجمع في الخطوط الدقيقة. تركيبة كريمية خفيفة.',
    description_en: 'Covers dark circles and blemishes without creasing. Lightweight creamy formula.',
    price: 45, compare_price: 60, cost_usd: 2.8, stock: 40, is_featured: 1,
  },
  {
    sku: 'BLS-003', category: 'face', brand: 'Rosé Bloom',
    name_ar: 'بلاشر باودر وردي', name_en: 'Powder Blush — Rose',
    description_ar: 'بلاشر ناعم الملمس يمنح إشراقة طبيعية، سهل الدمج ويدوم طوال اليوم.',
    description_en: 'Silky powder blush for a natural flush. Blends easily and wears all day.',
    price: 39, compare_price: 0, cost_usd: 2.1, stock: 30,
  },
  {
    sku: 'PLT-004', category: 'eyes', brand: 'Nude Story',
    name_ar: 'باليت ظلال عيون ١٨ لون', name_en: '18-Shade Eyeshadow Palette',
    description_ar: 'ثمانية عشر لوناً بين المطفي واللامع بدرجات ترابية دافئة. تصبغ عالي وثبات ممتاز.',
    description_en: 'Eighteen warm neutral shades in matte and shimmer. Highly pigmented, long lasting.',
    price: 115, compare_price: 160, cost_usd: 8.2, stock: 15, is_featured: 1,
  },
  {
    sku: 'MSC-005', category: 'eyes', brand: 'Lash Queen',
    name_ar: 'ماسكارا تكثيف وتطويل', name_en: 'Volume & Length Mascara',
    description_ar: 'فرشاة مخروطية تصل لكل رمش، تمنح كثافة مضاعفة بدون تكتل. مقاومة للماء.',
    description_en: 'Tapered brush reaches every lash for double volume with no clumps. Water resistant.',
    price: 52, compare_price: 70, cost_usd: 3.4, stock: 35,
  },
  {
    sku: 'EYE-006', category: 'eyes', brand: 'Lash Queen',
    name_ar: 'آيلاينر سائل أسود', name_en: 'Liquid Eyeliner — Black',
    description_ar: 'رأس رفيع ودقيق لرسم خط مثالي من أول مرة. لون أسود عميق يثبت ولا يسيل.',
    description_en: 'Ultra-fine tip for a perfect line first time. Deep black that will not smudge.',
    price: 34, compare_price: 0, cost_usd: 1.9, stock: 50,
  },
  {
    sku: 'LIP-007', category: 'lips', brand: 'Rosé Bloom',
    name_ar: 'أحمر شفاه مطفي سائل', name_en: 'Liquid Matte Lipstick',
    description_ar: 'يدوم حتى ١٢ ساعة بلمسة مخملية مريحة لا تجفف الشفاه. متوفر بعدة درجات.',
    description_en: 'Up to 12 hours of comfortable velvet colour that will not dry out lips.',
    price: 42, compare_price: 55, cost_usd: 2.3, stock: 60, is_featured: 1,
  },
  {
    sku: 'LIP-008', category: 'lips', brand: 'Rosé Bloom',
    name_ar: 'ملمع شفاه مرطب', name_en: 'Hydrating Lip Gloss',
    description_ar: 'ملمع غير لزق بزيت جوز الهند، يمنح لمعاناً زجاجياً وترطيباً يدوم.',
    description_en: 'Non-sticky gloss with coconut oil for glassy shine and lasting moisture.',
    price: 29, compare_price: 0, cost_usd: 1.4, stock: 45,
  },
  {
    sku: 'BRW-009', category: 'brows', brand: 'Nude Story',
    name_ar: 'قلم حواجب مزدوج', name_en: 'Dual-Ended Brow Pencil',
    description_ar: 'رأس رفيع لرسم الشعيرات وفرشاة لتنعيم اللون. يمنح حواجب طبيعية ممتلئة.',
    description_en: 'Fine tip for hair strokes with a spoolie to soften. Natural, fuller brows.',
    price: 31, compare_price: 42, cost_usd: 1.6, stock: 38,
  },
  {
    sku: 'NAL-010', category: 'nails', brand: 'Glossy Days',
    name_ar: 'طقم مناكير ٦ ألوان', name_en: 'Nail Polish Set — 6 Colours',
    description_ar: 'ستة ألوان موسمية بتركيبة سريعة الجفاف ولمعان يدوم أسبوعاً كاملاً.',
    description_en: 'Six seasonal shades, quick-drying with a full week of shine.',
    price: 68, compare_price: 95, cost_usd: 4.5, stock: 20,
  },
  {
    sku: 'SKN-011', category: 'skin', brand: 'Pure Glow',
    name_ar: 'سيروم فيتامين سي', name_en: 'Vitamin C Serum',
    description_ar: 'يوحّد لون البشرة ويعالج البقع الداكنة تدريجياً. يستخدم صباحاً قبل واقي الشمس.',
    description_en: 'Evens skin tone and fades dark spots over time. Use in the morning before SPF.',
    price: 78, compare_price: 105, cost_usd: 5.2, stock: 18, is_featured: 1,
  },
  {
    sku: 'SKN-012', category: 'skin', brand: 'Pure Glow',
    name_ar: 'مزيل مكياج بالماء الميسيلار', name_en: 'Micellar Cleansing Water',
    description_ar: 'يزيل المكياج الثقيل بلطف دون فرك، مناسب للبشرة الحساسة وحول العينين.',
    description_en: 'Removes heavy makeup gently with no rubbing. Safe for sensitive skin and eyes.',
    price: 36, compare_price: 0, cost_usd: 1.8, stock: 42,
  },
  {
    sku: 'TLS-013', category: 'tools', brand: 'Studio Pro',
    name_ar: 'طقم فرش مكياج ١٢ قطعة', name_en: '12-Piece Brush Set',
    description_ar: 'شعيرات صناعية ناعمة لا تتساقط، مع حقيبة جلد للحفظ والسفر.',
    description_en: 'Soft synthetic bristles that do not shed, with a leather travel pouch.',
    price: 95, compare_price: 140, cost_usd: 6.8, stock: 12,
  },
  {
    sku: 'TLS-014', category: 'tools', brand: 'Studio Pro',
    name_ar: 'إسفنجة بلندر للمكياج', name_en: 'Makeup Blender Sponge',
    description_ar: 'تتضاعف عند البلل لتوزيع كريم الأساس بلمسة نهائية طبيعية خالية من الخطوط.',
    description_en: 'Doubles in size when damp for a flawless, streak-free foundation finish.',
    price: 18, compare_price: 25, cost_usd: 0.7, stock: 80,
  },
];

const exists = db.prepare("SELECT 1 FROM products WHERE sku = ? AND sku != ''");
const insertProduct = db.prepare(
  `INSERT INTO products
     (sku, name_ar, name_en, description_ar, description_en, brand, category_id,
      price, compare_price, cost_usd, stock, is_active, is_featured, sort_order)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
);

let added = 0;
PRODUCTS.forEach((p, index) => {
  if (exists.get(p.sku)) return;
  insertProduct.run(
    p.sku, p.name_ar, p.name_en, p.description_ar, p.description_en, p.brand,
    categoryIds[p.category] ?? null, p.price, p.compare_price ?? 0, p.cost_usd ?? 0,
    p.stock ?? 0, p.is_featured ?? 0, index,
  );
  added += 1;
});

console.log(
  `Seed complete — ${CATEGORIES.length} categories ready, ${added} product${added === 1 ? '' : 's'} added.\n` +
    'Photos are added from the admin panel: Products → Edit → Photos.',
);
