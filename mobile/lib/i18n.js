/* ==================================================================
   Arabic and English, the same way the website does it.

   Direction is handled by choosing flexDirection and textAlign per
   language rather than by I18nManager.forceRTL, which only takes
   effect after the app is restarted — a language switch that needs a
   restart is not a language switch.

   The chosen language also lives in a module-level variable, so code
   outside React (the shop connection in api.js, which throws errors a
   screen later renders) can reach it through tr() without a hook.
   ================================================================== */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'altalil_lang';

const STRINGS = {
  ar: {
    other_language: 'English',
    app_name: 'الطليل الغالي',

    /* shared */
    back: 'رجوع',
    cancel: 'إلغاء',
    retry: 'إعادة المحاولة',
    delete: 'حذف',
    loading_shop: 'جارٍ تحميل المتجر…',
    language: 'اللغة',

    /* errors from the shop connection */
    err_network: 'تعذّر الاتصال بالمتجر. تحقّقي من الإنترنت.',
    err_network_at: 'تعذّر الوصول إلى المتجر على:\n{url}\n\nتأكّدي أنّ المتجر يعمل وأنّ الهاتف على نفس شبكة الواي فاي.',
    err_generic: 'حدث خطأ. حاولي مرة أخرى.',

    /* sign in */
    sign_in: 'تسجيل الدخول',
    sign_in_cta: 'دخول',
    sign_in_sub: 'سجّلي الدخول للمتابعة',
    register_tab: 'حساب جديد',
    register_sub: 'أنشئي حسابك للتسوق',
    create_account: 'إنشاء الحساب',
    full_name: 'الاسم الكامل',
    email: 'البريد الإلكتروني',
    password: 'كلمة المرور',
    confirm_password: 'تأكيد كلمة المرور',
    err_email: 'الرجاء إدخال بريد إلكتروني صحيح',
    err_password_required: 'الرجاء إدخال كلمة المرور',
    err_password_short: 'كلمة المرور يجب أن تكون ٨ أحرف على الأقل',
    err_password_match: 'كلمتا المرور غير متطابقتين',

    /* the shop */
    search_ph: 'ابحثي عن منتج…',
    cart_a11y: 'السلة، {n} منتج',
    account: 'حسابي',
    dashboard: 'لوحة التحكم',
    all: 'الكل',
    shop_load_failed: 'تعذّر تحميل المتجر',
    no_match: 'لا توجد منتجات مطابقة',
    no_match_note: 'جرّبي قسماً آخر أو كلمة بحث مختلفة.',
    sold_out: 'نفدت الكمية',
    discount_n: 'خصم {n}٪',
    only_left: 'باقي {n} فقط',
    add_to_cart: 'أضيفي إلى السلة',

    /* one product */
    product: 'المنتج',
    product_open_failed: 'تعذّر فتح المنتج',
    in_stock: 'متوفر',
    in_stock_n: 'متوفر — باقي {n}',
    less: 'أقل',
    more: 'أكثر',

    /* basket */
    cart: 'السلة',
    cart_empty: 'سلتكِ فارغة',
    cart_empty_note: 'أضيفي منتجاتكِ المفضلة وابدئي التسوق.',
    browse_shop: 'تصفّحي المتجر',
    remove: 'حذف',
    free_delivery_now: '🚚  التوصيل مجاني على هذا الطلب',
    add_more_free: 'أضيفي {amount} للحصول على توصيل مجاني',
    subtotal: 'المجموع',
    delivery: 'التوصيل',
    total: 'الإجمالي',
    free: 'مجاني',
    checkout: 'إتمام الطلب',

    /* checkout */
    phone: 'رقم الهاتف',
    city: 'المدينة',
    choose_city: 'اختاري المدينة',
    address: 'العنوان بالتفصيل',
    address_ph: 'الحي، الشارع، رقم البناية',
    notes: 'ملاحظات (اختياري)',
    err_name: 'الرجاء إدخال الاسم الكامل',
    err_phone: 'الرجاء إدخال رقم هاتف صحيح',
    err_city: 'الرجاء اختيار المدينة',
    err_address: 'الرجاء إدخال العنوان',
    cod_note: 'الدفع عند الاستلام. سنتواصل معك لتأكيد الطلب.',
    place_order: 'تأكيد الطلب',
    order_received: 'تم استلام طلبك!',
    order_thanks: 'سنتواصل معك قريباً لتأكيد الطلب والتوصيل.',
    order_no: 'رقم الطلب',
    send_whatsapp: 'إرسال الطلب على واتساب',
    continue_shopping: 'متابعة التسوق',
    wa_new_order: 'طلب جديد',

    /* my account */
    owner_badge: '👑 مالكة المتجر',
    my_orders: 'طلباتي',
    no_orders_yet: 'لم تقومي بأي طلب بعد',
    no_orders_yet_note: 'تصفّحي المتجر وابدئي التسوق.',
    sign_out: 'تسجيل الخروج',

    /* order status */
    status_new: 'جديد',
    status_new_customer: 'قيد المراجعة',
    status_confirmed: 'مؤكد',
    status_shipped: 'تم الشحن',
    status_delivered: 'تم التسليم',
    status_cancelled: 'ملغي',

    /* owner: dashboard */
    owner_only: 'هذه الصفحة للمالكة فقط',
    panel_load_failed: 'تعذّر تحميل اللوحة',
    sales: 'المبيعات',
    orders_n: '{n} طلب',
    profit: 'الربح',
    cost_is: 'التكلفة {amount}',
    new_orders: 'طلبات جديدة',
    products: 'المنتجات',
    shown_n: '{n} معروض',
    out_of_stock: 'نفد المخزون',
    low_n: 'منخفض: {n}',
    customers: 'الزبائن',
    orders: 'الطلبات',
    orders_with_new: 'الطلبات ({n} جديدة)',
    recent_orders: 'أحدث الطلبات',
    no_orders: 'لا توجد طلبات بعد.',
    top_products: 'الأكثر مبيعاً',
    no_sales: 'لا توجد مبيعات بعد.',

    /* owner: orders */
    update_failed: 'تعذّر التحديث',
    no_orders_here: 'لا توجد طلبات هنا',
    message_customer: 'مراسلة الزبونة على واتساب',

    /* owner: products */
    search_products_ph: 'ابحثي بالاسم أو الرمز…',
    add_product: 'إضافة منتج',
    no_products: 'لا توجد منتجات',
    no_products_note: 'أضيفي أول منتج للمتجر.',
    save_failed: 'تعذّر الحفظ',
    quantity: 'الكمية',
    shown: 'معروض',
    cost_usd_is: 'التكلفة ${amount}',

    /* owner: add or edit a product */
    new_product: 'منتج جديد',
    edit_product: 'تعديل منتج',
    product_name: 'اسم المنتج',
    name_other: 'الاسم بالإنجليزية',
    description: 'الوصف',
    brand: 'الماركة',
    category: 'القسم',
    sell_price: 'سعر البيع (₪)',
    before_discount: 'قبل الخصم',
    cost_dollars: 'التكلفة ($)',
    err_product_name: 'الرجاء إدخال اسم المنتج',
    err_product_price: 'الرجاء إدخال سعر بيع أكبر من صفر',
    below_cost: '⚠️  سعر البيع أقل من التكلفة',
    profit_each: '💰  ربح {amount} لكل قطعة ({n}٪)',
    shown_in_shop: 'معروض في المتجر',
    featured: '★ منتج مميز',
    photos: 'الصور',
    main_photo: 'رئيسية',
    remove_photo: 'حذف الصورة',
    take_photo: 'التقاط صورة',
    from_library: 'من الاستوديو',
    max_photos: 'الحد الأقصى',
    max_photos_note: 'يمكن إضافة {n} صور فقط.',
    permission_needed: 'الإذن مطلوب',
    permission_note: 'يحتاج التطبيق إذن الوصول للصور لإضافة صور المنتجات.',
    photo_read_failed: 'تعذّر قراءة الصورة',
    add_product_cta: 'إضافة المنتج',
    save_changes: 'حفظ التعديلات',
    delete_product: 'حذف المنتج',
    delete_product_ask: 'حذف "{name}" من المتجر؟',
    delete_failed: 'تعذّر الحذف',
  },

  en: {
    other_language: 'العربية',
    app_name: 'Al-Talil Al-Ghali',

    back: 'Back',
    cancel: 'Cancel',
    retry: 'Try again',
    delete: 'Delete',
    loading_shop: 'Loading the shop…',
    language: 'Language',

    err_network: 'Could not reach the shop. Check your connection.',
    err_network_at: 'Could not reach the shop at:\n{url}\n\nCheck that the shop is running and that the phone is on the same WiFi.',
    err_generic: 'Something went wrong. Please try again.',

    sign_in: 'Sign in',
    sign_in_cta: 'Sign in',
    sign_in_sub: 'Sign in to continue',
    register_tab: 'New account',
    register_sub: 'Create your account to shop',
    create_account: 'Create account',
    full_name: 'Full name',
    email: 'E-mail address',
    password: 'Password',
    confirm_password: 'Confirm password',
    err_email: 'Please enter a valid e-mail address',
    err_password_required: 'Please enter your password',
    err_password_short: 'Your password needs at least 8 characters',
    err_password_match: 'The two passwords do not match',

    search_ph: 'Search for a product…',
    cart_a11y: 'Basket, {n} items',
    account: 'My account',
    dashboard: 'Dashboard',
    all: 'All',
    shop_load_failed: 'Could not load the shop',
    no_match: 'No matching products',
    no_match_note: 'Try another category or a different search.',
    sold_out: 'Sold out',
    discount_n: '{n}% off',
    only_left: 'Only {n} left',
    add_to_cart: 'Add to basket',

    product: 'Product',
    product_open_failed: 'Could not open this product',
    in_stock: 'In stock',
    in_stock_n: 'In stock — {n} left',
    less: 'Fewer',
    more: 'More',

    cart: 'Basket',
    cart_empty: 'Your basket is empty',
    cart_empty_note: 'Add your favourites and start shopping.',
    browse_shop: 'Browse the shop',
    remove: 'Remove',
    free_delivery_now: '🚚  Delivery is free on this order',
    add_more_free: 'Add {amount} more for free delivery',
    subtotal: 'Subtotal',
    delivery: 'Delivery',
    total: 'Total',
    free: 'Free',
    checkout: 'Checkout',

    phone: 'Phone number',
    city: 'City',
    choose_city: 'Choose your city',
    address: 'Full address',
    address_ph: 'Area, street, building number',
    notes: 'Notes (optional)',
    err_name: 'Please enter your full name',
    err_phone: 'Please enter a valid phone number',
    err_city: 'Please choose your city',
    err_address: 'Please enter your address',
    cod_note: 'Cash on delivery. We will contact you to confirm the order.',
    place_order: 'Place order',
    order_received: 'Your order is in!',
    order_thanks: 'We will contact you shortly to confirm the order and delivery.',
    order_no: 'Order number',
    send_whatsapp: 'Send the order on WhatsApp',
    continue_shopping: 'Continue shopping',
    wa_new_order: 'New order',

    owner_badge: '👑 Shop owner',
    my_orders: 'My orders',
    no_orders_yet: 'You have not ordered anything yet',
    no_orders_yet_note: 'Browse the shop and start shopping.',
    sign_out: 'Sign out',

    status_new: 'New',
    status_new_customer: 'Being reviewed',
    status_confirmed: 'Confirmed',
    status_shipped: 'Shipped',
    status_delivered: 'Delivered',
    status_cancelled: 'Cancelled',

    owner_only: 'This page is for the shop owner only',
    panel_load_failed: 'Could not load the dashboard',
    sales: 'Sales',
    orders_n: '{n} orders',
    profit: 'Profit',
    cost_is: 'Cost {amount}',
    new_orders: 'New orders',
    products: 'Products',
    shown_n: '{n} shown',
    out_of_stock: 'Out of stock',
    low_n: 'Low: {n}',
    customers: 'Customers',
    orders: 'Orders',
    orders_with_new: 'Orders ({n} new)',
    recent_orders: 'Latest orders',
    no_orders: 'No orders yet.',
    top_products: 'Best sellers',
    no_sales: 'No sales yet.',

    update_failed: 'Could not update',
    no_orders_here: 'No orders here',
    message_customer: 'Message the customer on WhatsApp',

    search_products_ph: 'Search by name or code…',
    add_product: 'Add a product',
    no_products: 'No products',
    no_products_note: 'Add your first product to the shop.',
    save_failed: 'Could not save',
    quantity: 'Quantity',
    shown: 'Shown',
    cost_usd_is: 'Cost ${amount}',

    new_product: 'New product',
    edit_product: 'Edit product',
    product_name: 'Product name',
    name_other: 'Name in Arabic',
    description: 'Description',
    brand: 'Brand',
    category: 'Category',
    sell_price: 'Selling price (₪)',
    before_discount: 'Before discount',
    cost_dollars: 'Cost ($)',
    err_product_name: 'Please enter the product name',
    err_product_price: 'Please enter a selling price above zero',
    below_cost: '⚠️  The selling price is below the cost',
    profit_each: '💰  {amount} profit each ({n}%)',
    shown_in_shop: 'Shown in the shop',
    featured: '★ Featured product',
    photos: 'Photos',
    main_photo: 'Main',
    remove_photo: 'Remove photo',
    take_photo: 'Take a photo',
    from_library: 'From the library',
    max_photos: 'That is the limit',
    max_photos_note: 'Only {n} photos can be added.',
    permission_needed: 'Permission needed',
    permission_note: 'The app needs access to your photos to add product pictures.',
    photo_read_failed: 'Could not read that photo',
    add_product_cta: 'Add the product',
    save_changes: 'Save changes',
    delete_product: 'Delete product',
    delete_product_ask: 'Delete "{name}" from the shop?',
    delete_failed: 'Could not delete',
  },
};

/* Stored as Arabic whatever the customer is reading, so one order does
 * not name its city differently from the next. */
export const CITIES = [
  { ar: 'القدس', en: 'Jerusalem' },
  { ar: 'رام الله', en: 'Ramallah' },
  { ar: 'البيرة', en: 'Al-Bireh' },
  { ar: 'نابلس', en: 'Nablus' },
  { ar: 'الخليل', en: 'Hebron' },
  { ar: 'بيت لحم', en: 'Bethlehem' },
  { ar: 'جنين', en: 'Jenin' },
  { ar: 'طولكرم', en: 'Tulkarm' },
  { ar: 'قلقيلية', en: 'Qalqilya' },
  { ar: 'أريحا', en: 'Jericho' },
  { ar: 'سلفيت', en: 'Salfit' },
  { ar: 'طوباس', en: 'Tubas' },
  { ar: 'غزة', en: 'Gaza' },
  { ar: 'خان يونس', en: 'Khan Younis' },
  { ar: 'رفح', en: 'Rafah' },
  { ar: 'دير البلح', en: 'Deir al-Balah' },
  { ar: 'الناصرة', en: 'Nazareth' },
  { ar: 'حيفا', en: 'Haifa' },
  { ar: 'يافا', en: 'Jaffa' },
  { ar: 'عكا', en: 'Acre' },
];

/* ------------------------------------------------------------------ *
 * The current language, also reachable from outside React
 * ------------------------------------------------------------------ */
let active = 'ar';

export const getLang = () => active;

function fill(value, vars) {
  if (!vars) return value;
  let out = value;
  for (const [k, v] of Object.entries(vars)) out = out.split(`{${k}}`).join(String(v));
  return out;
}

/** Translate without a hook. Screens should prefer t() from useLang. */
export function tr(key, vars) {
  const value = STRINGS[active]?.[key] ?? STRINGS.ar[key] ?? key;
  return fill(value, vars);
}

/** The Arabic or English side of a record, falling back to the other. */
export function localised(record, field, lang = active) {
  if (!record) return '';
  const first = record[`${field}_${lang}`];
  const second = record[`${field}_${lang === 'ar' ? 'en' : 'ar'}`];
  return (first && String(first).trim()) || (second && String(second).trim()) || '';
}

export function cityLabel(stored, lang = active) {
  const found = CITIES.find((c) => c.ar === stored || c.en === stored);
  return found ? found[lang] : String(stored || '');
}

export function formatDate(value, lang = active) {
  if (!value) return '';
  const text = String(value);
  const date = new Date(text.replace(' ', 'T') + (text.includes('Z') ? '' : 'Z'));
  if (Number.isNaN(date.getTime())) return text;
  return date.toLocaleDateString(lang === 'ar' ? 'ar-EG' : 'en-GB', {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

/* ------------------------------------------------------------------ *
 * The provider
 * ------------------------------------------------------------------ */
function build(lang, setLang) {
  const isAr = lang === 'ar';
  return {
    lang,
    isAr,
    dir: isAr ? 'rtl' : 'ltr',
    /* Reading order, for anything laid out in a line. */
    row: isAr ? 'row-reverse' : 'row',
    /* The opposite, for the few places that must mirror it. */
    rowBack: isAr ? 'row' : 'row-reverse',
    align: isAr ? 'right' : 'left',
    alignEnd: isAr ? 'left' : 'right',
    other: STRINGS[lang].other_language,
    t: (key, vars) => fill(STRINGS[lang]?.[key] ?? STRINGS.ar[key] ?? key, vars),
    tx: (record, field) => localised(record, field, lang),
    city: (stored) => cityLabel(stored, lang),
    date: (value) => formatDate(value, lang),
    setLang,
    toggle: () => setLang(isAr ? 'en' : 'ar'),
  };
}

const LanguageContext = createContext(null);
const standalone = build('ar', () => {});

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(active);

  useEffect(() => {
    (async () => {
      try {
        const saved = await AsyncStorage.getItem(KEY);
        if (saved && STRINGS[saved]) {
          active = saved;
          setLangState(saved);
        }
      } catch {
        /* No stored choice is not a problem; Arabic is the default. */
      }
    })();
  }, []);

  const setLang = useCallback((next) => {
    if (!STRINGS[next]) return;
    /* Set the module-level copy first: an error thrown by api.js during
     * this same render should already be in the new language. */
    active = next;
    setLangState(next);
    AsyncStorage.setItem(KEY, next).catch(() => {});
  }, []);

  const value = useMemo(() => build(lang, setLang), [lang, setLang]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

/** Falls back to Arabic rather than throwing, so a stray Text outside
 *  the provider still renders instead of taking the screen down. */
export function useLang() {
  return useContext(LanguageContext) ?? standalone;
}
