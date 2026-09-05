/* ==================================================================
   Shared helpers: API access, language, money, cart, toasts.
   ================================================================== */

/* ---------------- API ---------------- */
export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(method, path, body) {
  let response;
  try {
    response = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        /* Marks the call as coming from our own pages. */
        'X-Shop-Request': '1',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError(t('err_network'), 0, 'network');
  }

  let data = {};
  try {
    data = await response.json();
  } catch {
    if (!response.ok) throw new ApiError(t('err_server'), response.status, 'bad_response');
  }

  if (!response.ok || data.ok === false) {
    throw new ApiError(data.error || t('err_server'), response.status, data.code || '');
  }
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body ?? {}),
  put: (path, body) => request('PUT', path, body ?? {}),
  patch: (path, body) => request('PATCH', path, body ?? {}),
  del: (path) => request('DELETE', path),
};

/* ---------------- Language ---------------- */
const STRINGS = {
  ar: {
    dir: 'rtl', lang: 'ar', other: 'English',
    shop: 'المتجر', all: 'الكل', search: 'ابحث عن منتج...', search_label: 'بحث',
    cart: 'السلة', cart_empty: 'سلتك فارغة', cart_empty_sub: 'أضيفي منتجاتك المفضلة وابدئي التسوق',
    add: 'أضف للسلة', added: 'تمت الإضافة للسلة', sold_out: 'نفدت الكمية',
    only_left: 'باقي {n} فقط', in_stock: 'متوفر', out_stock: 'غير متوفر',
    subtotal: 'المجموع', shipping: 'التوصيل', total: 'الإجمالي', free: 'مجاني',
    checkout: 'إتمام الطلب', continue_shopping: 'متابعة التسوق', remove: 'حذف',
    quantity: 'الكمية', brand: 'الماركة', category: 'القسم', sku: 'رمز المنتج',
    availability: 'التوفر', description: 'الوصف', no_description: 'لا يوجد وصف لهذا المنتج.',
    featured: 'الأكثر طلباً', new_badge: 'جديد', sale: 'خصم',
    products: 'المنتجات', no_products: 'لا توجد منتجات هنا بعد',
    no_products_sub: 'جرّبي قسماً آخر أو ابحثي بكلمة مختلفة',
    sort: 'ترتيب', sort_new: 'الأحدث', sort_low: 'السعر: من الأقل', sort_high: 'السعر: من الأعلى',
    free_over: 'توصيل مجاني للطلبات فوق {n}', add_more_free: 'أضيفي {n} للحصول على توصيل مجاني',
    your_details: 'بيانات التوصيل', full_name: 'الاسم الكامل', phone: 'رقم الهاتف',
    city: 'المدينة', choose_city: 'اختاري المدينة', address: 'العنوان بالتفصيل',
    notes: 'ملاحظات (اختياري)', notes_ph: 'مثلاً: التوصيل بعد الساعة ٤ عصراً',
    place_order: 'تأكيد الطلب', order_placed: 'تم استلام طلبك بنجاح!',
    order_no: 'رقم الطلب', order_thanks: 'سنتواصل معك قريباً لتأكيد الطلب والتوصيل.',
    send_whatsapp: 'إرسال الطلب على واتساب', close: 'إغلاق', back: 'رجوع',
    login: 'تسجيل الدخول', logout: 'تسجيل الخروج', account: 'حسابي',
    admin_panel: 'لوحة التحكم', my_orders: 'طلباتي',
    err_network: 'تعذّر الاتصال بالخادم. تحقّقي من الإنترنت وحاولي مجدداً.',
    err_server: 'حدث خطأ. حاولي مرة أخرى.',
    required: 'هذا الحقل مطلوب',
    currency: '₪',
  },
  en: {
    dir: 'ltr', lang: 'en', other: 'العربية',
    shop: 'Shop', all: 'All', search: 'Search products...', search_label: 'Search',
    cart: 'Cart', cart_empty: 'Your basket is empty', cart_empty_sub: 'Add your favourites and start shopping',
    add: 'Add to basket', added: 'Added to your basket', sold_out: 'Sold out',
    only_left: 'Only {n} left', in_stock: 'In stock', out_stock: 'Out of stock',
    subtotal: 'Subtotal', shipping: 'Delivery', total: 'Total', free: 'Free',
    checkout: 'Checkout', continue_shopping: 'Continue shopping', remove: 'Remove',
    quantity: 'Quantity', brand: 'Brand', category: 'Category', sku: 'Item code',
    availability: 'Availability', description: 'Description', no_description: 'No description for this product yet.',
    featured: 'Best sellers', new_badge: 'New', sale: 'Sale',
    products: 'Products', no_products: 'No products here yet',
    no_products_sub: 'Try another category or a different search',
    sort: 'Sort', sort_new: 'Newest', sort_low: 'Price: low to high', sort_high: 'Price: high to low',
    free_over: 'Free delivery over {n}', add_more_free: 'Add {n} more for free delivery',
    your_details: 'Delivery details', full_name: 'Full name', phone: 'Phone number',
    city: 'City', choose_city: 'Choose your city', address: 'Full address',
    notes: 'Notes (optional)', notes_ph: 'e.g. deliver after 4pm',
    place_order: 'Place order', order_placed: 'Your order is confirmed!',
    order_no: 'Order number', order_thanks: 'We will contact you shortly to confirm delivery.',
    send_whatsapp: 'Send order on WhatsApp', close: 'Close', back: 'Back',
    login: 'Sign in', logout: 'Sign out', account: 'My account',
    admin_panel: 'Dashboard', my_orders: 'My orders',
    err_network: 'Could not reach the server. Check your connection and try again.',
    err_server: 'Something went wrong. Please try again.',
    required: 'This field is required',
    currency: '₪',
  },
};

export let lang = localStorage.getItem('shop_lang') || 'ar';
if (!STRINGS[lang]) lang = 'ar';

export function t(key, vars) {
  let value = STRINGS[lang][key] ?? STRINGS.ar[key] ?? key;
  if (vars) for (const [k, v] of Object.entries(vars)) value = value.replaceAll(`{${k}}`, v);
  return value;
}

export function applyLanguage() {
  const meta = STRINGS[lang];
  document.documentElement.lang = meta.lang;
  document.documentElement.dir = meta.dir;
}

export function toggleLanguage() {
  lang = lang === 'ar' ? 'en' : 'ar';
  localStorage.setItem('shop_lang', lang);
  location.reload();
}

export const isArabic = () => lang === 'ar';

/** Pick the Arabic or English field, falling back to whichever exists. */
export function localised(record, field) {
  if (!record) return '';
  const primary = record[`${field}_${lang}`];
  const secondary = record[`${field}_${lang === 'ar' ? 'en' : 'ar'}`];
  return (primary && String(primary).trim()) || (secondary && String(secondary).trim()) || '';
}

/* ---------------- Formatting ---------------- */
export function money(amount, symbol = '₪') {
  const n = Number(amount) || 0;
  const formatted = n % 1 === 0 ? n.toLocaleString('en-US') : n.toFixed(2);
  return `${formatted} ${symbol}`;
}

export function formatDate(value) {
  if (!value) return '';
  const date = new Date(String(value).replace(' ', 'T') + (String(value).includes('Z') ? '' : 'Z'));
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

/** Escape anything that came from the database before it meets innerHTML. */
export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

/** Only allow image URLs we produced or a plain http(s) link. */
export function safeImage(url) {
  const value = String(url ?? '').trim();
  if (value.startsWith('/uploads/') || /^https?:\/\//i.test(value) || value.startsWith('data:image/')) {
    return value;
  }
  return '';
}

export const PALESTINE_CITIES = [
  'القدس', 'رام الله', 'البيرة', 'نابلس', 'الخليل', 'بيت لحم', 'جنين',
  'طولكرم', 'قلقيلية', 'أريحا', 'سلفيت', 'طوباس', 'غزة', 'خان يونس',
  'رفح', 'دير البلح', 'بيت حانون', 'الناصرة', 'حيفا', 'يافا', 'عكا',
];

/* ---------------- Toasts ---------------- */
let toastHost = null;
export function toast(message, kind = '') {
  if (!toastHost) {
    toastHost = document.createElement('div');
    toastHost.className = 'toasts';
    toastHost.setAttribute('role', 'status');
    toastHost.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastHost);
  }
  const node = document.createElement('div');
  node.className = `toast ${kind ? `toast-${kind}` : ''}`;
  node.textContent = message;
  toastHost.appendChild(node);
  setTimeout(() => {
    node.style.transition = 'opacity .25s, transform .25s';
    node.style.opacity = '0';
    node.style.transform = 'translateY(8px)';
    setTimeout(() => node.remove(), 250);
  }, 3600);
}

/* ---------------- Cart ---------------- */
const CART_KEY = 'shop_cart_v1';

export const cart = {
  read() {
    try {
      const parsed = JSON.parse(localStorage.getItem(CART_KEY) || '[]');
      return Array.isArray(parsed)
        ? parsed
            .filter((i) => i && Number.isFinite(Number(i.id)))
            .map((i) => ({ id: Number(i.id), qty: Math.max(1, Math.min(99, Number(i.qty) || 1)) }))
        : [];
    } catch {
      return [];
    }
  },
  write(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    window.dispatchEvent(new CustomEvent('cart:change'));
  },
  add(id, qty = 1) {
    const items = this.read();
    const found = items.find((i) => i.id === Number(id));
    if (found) found.qty = Math.min(99, found.qty + qty);
    else items.push({ id: Number(id), qty });
    this.write(items);
  },
  setQty(id, qty) {
    const items = this.read().map((i) => (i.id === Number(id) ? { ...i, qty: Math.max(1, Math.min(99, qty)) } : i));
    this.write(items);
  },
  remove(id) {
    this.write(this.read().filter((i) => i.id !== Number(id)));
  },
  clear() {
    this.write([]);
  },
  count() {
    return this.read().reduce((sum, i) => sum + i.qty, 0);
  },
};

/* ---------------- Small DOM helpers ---------------- */
export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function openOverlay(node) {
  document.body.classList.add('no-scroll');
  document.body.appendChild(node);
  const close = () => closeOverlay(node);
  node.addEventListener('click', (e) => {
    if (e.target === node) close();
  });
  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };
  document.addEventListener('keydown', onKey);
  node._cleanup = () => document.removeEventListener('keydown', onKey);
  const focusable = node.querySelector('input, select, textarea, button');
  if (focusable) setTimeout(() => focusable.focus(), 60);
  return close;
}

export function closeOverlay(node) {
  node._cleanup?.();
  node.remove();
  if (!document.querySelector('.overlay')) document.body.classList.remove('no-scroll');
}

/**
 * Shrink a picture in the browser before it is uploaded, so product
 * photos straight from a phone camera stay small and load fast.
 */
export function resizeImageFile(file, maxSize = 1200, quality = 0.85) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Not an image'));
      return;
    }
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not read the image'));
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const width = Math.round(img.width * scale);
        const height = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        /* White backdrop so transparent PNGs do not turn black as JPEG. */
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

applyLanguage();
