/* ==================================================================
   Owner dashboard
   ================================================================== */
import {
  api, isArabic, localised, money, esc, safeImage, toast, formatDate,
  toggleLanguage, applyLanguage, $, openOverlay, closeOverlay, resizeImageFile,
} from './core.js';

const T = {
  ar: {
    dashboard: 'الرئيسية', products: 'المنتجات', categories: 'الأقسام', orders: 'الطلبات',
    customers: 'الزبائن', settings: 'الإعدادات', logout: 'خروج', view_shop: 'عرض المتجر',
    revenue: 'المبيعات', profit: 'الربح', cost: 'التكلفة', orders_count: 'عدد الطلبات',
    pending: 'طلبات جديدة', products_total: 'المنتجات', in_stock_c: 'متوفر',
    out_of_stock: 'نفد المخزون', low_stock: 'مخزون منخفض', customers_count: 'الزبائن',
    sales_14: 'المبيعات آخر ١٤ يوماً', top_products: 'الأكثر مبيعاً', recent_orders: 'أحدث الطلبات',
    add_product: 'إضافة منتج', edit: 'تعديل', delete: 'حذف', save: 'حفظ', cancel: 'إلغاء',
    saving: 'جارٍ الحفظ...', search_products: 'ابحث بالاسم أو الرمز...', all_categories: 'كل الأقسام',
    name_ar: 'الاسم بالعربية', name_en: 'الاسم بالإنجليزية', desc_ar: 'الوصف بالعربية',
    desc_en: 'الوصف بالإنجليزية', brand: 'الماركة', sku: 'رمز المنتج', category: 'القسم',
    price: 'سعر البيع (₪)', compare_price: 'السعر قبل الخصم (₪)', cost_usd: 'تكلفة الشراء ($)',
    stock: 'الكمية المتوفرة', available: 'معروض في المتجر', featured: 'منتج مميز',
    photos: 'الصور', drop_photos: 'اضغطي لاختيار الصور أو اسحبيها هنا',
    photos_hint: 'JPG أو PNG · الصورة الأولى هي الرئيسية · حتى ٨ صور',
    main_photo: 'رئيسية', product_saved: 'تم حفظ المنتج', product_deleted: 'تم حذف المنتج',
    confirm_delete: 'هل أنت متأكدة من حذف "{name}"؟ لا يمكن التراجع.',
    no_products: 'لا توجد منتجات بعد', add_first: 'أضيفي أول منتج للمتجر',
    profit_each: 'ربح {n} لكل قطعة ({p}%)', loss_warning: 'تنبيه: سعر البيع أقل من التكلفة',
    add_category: 'إضافة قسم', cat_name_ar: 'اسم القسم بالعربية', cat_name_en: 'بالإنجليزية',
    icon: 'أيقونة (إيموجي)', order: 'الترتيب', products_in: '{n} منتج',
    cat_deleted: 'تم حذف القسم', cat_saved: 'تم حفظ القسم',
    confirm_cat_delete: 'حذف القسم "{name}"؟ المنتجات لن تُحذف.',
    all_orders: 'كل الطلبات', status: 'الحالة', order_no: 'رقم الطلب', customer: 'الزبون',
    total: 'الإجمالي', date: 'التاريخ', items: 'المنتجات', no_orders: 'لا توجد طلبات بعد',
    st_new: 'جديد', st_confirmed: 'مؤكد', st_shipped: 'تم الشحن',
    st_delivered: 'تم التسليم', st_cancelled: 'ملغي',
    status_updated: 'تم تحديث حالة الطلب', order_deleted: 'تم حذف الطلب',
    confirm_order_delete: 'حذف الطلب #{name}؟',
    contact: 'تواصل', email: 'البريد', phone: 'الهاتف', city: 'المدينة',
    joined: 'تاريخ الانضمام', spent: 'إجمالي الشراء', order_count: 'الطلبات',
    block: 'حظر', unblock: 'إلغاء الحظر', blocked: 'محظور', owner: 'مدير',
    no_customers: 'لا يوجد زبائن بعد', customer_updated: 'تم تحديث الزبون',
    shop_identity: 'هوية المتجر', shop_name_ar: 'اسم المتجر بالعربية',
    shop_name_en: 'اسم المتجر بالإنجليزية', tagline_ar: 'الوصف بالعربية',
    tagline_en: 'الوصف بالإنجليزية', announcement: 'شريط الإعلان',
    contact_settings: 'التواصل', whatsapp: 'رقم واتساب (بمقدمة الدولة)',
    instagram: 'حساب إنستغرام', shipping_settings: 'التوصيل والأسعار',
    shipping_flat: 'سعر التوصيل (₪)', free_over: 'توصيل مجاني فوق (₪)',
    usd_rate: 'سعر صرف الدولار (₪ لكل $)',
    usd_hint: 'يُستخدم لحساب الربح من تكلفة الشراء بالدولار',
    settings_saved: 'تم حفظ الإعدادات', required_field: 'هذا الحقل مطلوب',
    uploading: 'جارٍ معالجة الصور...', too_many_photos: 'الحد الأقصى ٨ صور',
    signed_as: 'مسجّلة الدخول باسم',
  },
  en: {
    dashboard: 'Overview', products: 'Products', categories: 'Categories', orders: 'Orders',
    customers: 'Customers', settings: 'Settings', logout: 'Sign out', view_shop: 'View shop',
    revenue: 'Revenue', profit: 'Profit', cost: 'Cost', orders_count: 'Orders',
    pending: 'New orders', products_total: 'Products', in_stock_c: 'Live',
    out_of_stock: 'Out of stock', low_stock: 'Low stock', customers_count: 'Customers',
    sales_14: 'Sales — last 14 days', top_products: 'Best sellers', recent_orders: 'Recent orders',
    add_product: 'Add product', edit: 'Edit', delete: 'Delete', save: 'Save', cancel: 'Cancel',
    saving: 'Saving...', search_products: 'Search by name or code...', all_categories: 'All categories',
    name_ar: 'Name (Arabic)', name_en: 'Name (English)', desc_ar: 'Description (Arabic)',
    desc_en: 'Description (English)', brand: 'Brand', sku: 'Item code', category: 'Category',
    price: 'Selling price (₪)', compare_price: 'Was price (₪)', cost_usd: 'Your cost ($)',
    stock: 'Quantity in stock', available: 'Visible in shop', featured: 'Featured product',
    photos: 'Photos', drop_photos: 'Tap to choose photos, or drag them here',
    photos_hint: 'JPG or PNG · the first photo is the main one · up to 8',
    main_photo: 'Main', product_saved: 'Product saved', product_deleted: 'Product deleted',
    confirm_delete: 'Delete "{name}"? This cannot be undone.',
    no_products: 'No products yet', add_first: 'Add your first product',
    profit_each: '{n} profit per item ({p}%)', loss_warning: 'Warning: selling below cost',
    add_category: 'Add category', cat_name_ar: 'Category name (Arabic)', cat_name_en: 'English',
    icon: 'Icon (emoji)', order: 'Sort order', products_in: '{n} products',
    cat_deleted: 'Category deleted', cat_saved: 'Category saved',
    confirm_cat_delete: 'Delete category "{name}"? Products are kept.',
    all_orders: 'All orders', status: 'Status', order_no: 'Order', customer: 'Customer',
    total: 'Total', date: 'Date', items: 'Items', no_orders: 'No orders yet',
    st_new: 'New', st_confirmed: 'Confirmed', st_shipped: 'Shipped',
    st_delivered: 'Delivered', st_cancelled: 'Cancelled',
    status_updated: 'Order status updated', order_deleted: 'Order deleted',
    confirm_order_delete: 'Delete order #{name}?',
    contact: 'Contact', email: 'E-mail', phone: 'Phone', city: 'City',
    joined: 'Joined', spent: 'Total spent', order_count: 'Orders',
    block: 'Block', unblock: 'Unblock', blocked: 'Blocked', owner: 'Owner',
    no_customers: 'No customers yet', customer_updated: 'Customer updated',
    shop_identity: 'Shop identity', shop_name_ar: 'Shop name (Arabic)',
    shop_name_en: 'Shop name (English)', tagline_ar: 'Tagline (Arabic)',
    tagline_en: 'Tagline (English)', announcement: 'Announcement bar',
    contact_settings: 'Contact', whatsapp: 'WhatsApp number (with country code)',
    instagram: 'Instagram handle', shipping_settings: 'Delivery & pricing',
    shipping_flat: 'Delivery charge (₪)', free_over: 'Free delivery over (₪)',
    usd_rate: 'Dollar rate (₪ per $)',
    usd_hint: 'Used to turn your dollar costs into profit figures',
    settings_saved: 'Settings saved', required_field: 'This field is required',
    uploading: 'Processing photos...', too_many_photos: 'Maximum of 8 photos',
    signed_as: 'Signed in as',
  },
};

const s = (key, vars) => {
  let value = T[isArabic() ? 'ar' : 'en'][key] || key;
  if (vars) for (const [k, v] of Object.entries(vars)) value = value.replaceAll(`{${k}}`, v);
  return value;
};

const STATUSES = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const STATUS_STYLE = {
  new: 'badge-info', confirmed: 'badge-plum', shipped: 'badge-warn',
  delivered: 'badge-ok', cancelled: 'badge-bad',
};

const state = { user: null, section: 'dashboard', categories: [], settings: {}, pending: 0 };
const main = $('#adminMain');

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */
async function boot() {
  applyLanguage();
  $('#langBtn').textContent = isArabic() ? 'English' : 'العربية';
  $('#langBtn').addEventListener('click', toggleLanguage);
  $('#viewShopBtn').textContent = s('view_shop');
  $('#logoutBtn').textContent = s('logout');
  $('#logoutBtn').addEventListener('click', signOut);

  try {
    const { user } = await api.get('/api/auth/me');
    if (!user) return location.replace('/login.html?next=/admin.html');
    if (!user.is_admin) {
      toast(isArabic() ? 'هذه الصفحة للمدير فقط' : 'This page is for the owner only', 'bad');
      return setTimeout(() => location.replace('/'), 1200);
    }
    state.user = user;
    $('#whoAmI').textContent = `${s('signed_as')} ${user.email}`;
  } catch {
    return location.replace('/login.html?next=/admin.html');
  }

  const [{ categories }, { settings }] = await Promise.all([
    api.get('/api/categories'),
    api.get('/api/admin/settings'),
  ]);
  state.categories = categories;
  state.settings = settings;
  $('#topShopName').textContent = localised(settings, 'shop_name') || s('dashboard');

  const initial = (location.hash || '').replace('#', '');
  if (['dashboard', 'products', 'categories', 'orders', 'customers', 'settings'].includes(initial)) {
    state.section = initial;
  }
  paintNav();
  await go(state.section);
}

async function signOut() {
  try { await api.post('/api/auth/logout'); } catch { /* sign out locally anyway */ }
  location.replace('/');
}

function paintNav() {
  const items = [
    ['dashboard', '📊'], ['products', '🧴'], ['categories', '🗂'],
    ['orders', '🧾'], ['customers', '👥'], ['settings', '⚙️'],
  ];
  $('#adminNav').innerHTML = items
    .map(([key, icon]) =>
      `<button type="button" data-go="${key}" class="${key === state.section ? 'is-active' : ''}">
         <span aria-hidden="true">${icon}</span>${s(key)}
         ${key === 'orders' && state.pending > 0 ? `<span class="nav-badge">${state.pending}</span>` : ''}
       </button>`)
    .join('');
  $('#adminNav').querySelectorAll('[data-go]').forEach((b) =>
    b.addEventListener('click', () => go(b.dataset.go)));
}

async function go(section) {
  state.section = section;
  history.replaceState(null, '', `#${section}`);
  paintNav();
  main.innerHTML = '<div style="padding:60px 0;"><div class="spinner"></div></div>';
  try {
    await ({
      dashboard: showDashboard, products: showProducts, categories: showCategories,
      orders: showOrders, customers: showCustomers, settings: showSettings,
    })[section]();
  } catch (err) {
    main.innerHTML = `<div class="empty"><div class="empty-icon">⚠️</div>
      <h3>${esc(err.message)}</h3></div>`;
  }
}

const pageHead = (title, subtitle, actions = '') => `
  <div class="page-head" style="display:flex;justify-content:space-between;align-items:flex-end;gap:16px;flex-wrap:wrap;">
    <div><h1>${esc(title)}</h1>${subtitle ? `<p>${esc(subtitle)}</p>` : ''}</div>
    <div class="toolbar">${actions}</div>
  </div>`;

/* ------------------------------------------------------------------ *
 * Dashboard
 * ------------------------------------------------------------------ */
async function showDashboard() {
  const data = await api.get('/api/admin/overview');
  const { stats, recent_orders: recent, top_products: top, sales_by_day: sales } = data;
  state.pending = stats.pending_orders;
  paintNav();

  const peak = Math.max(1, ...sales.map((d) => d.total));
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const key = date.toISOString().slice(0, 10);
    const found = sales.find((d) => d.day === key);
    days.push({ key, total: found ? found.total : 0, label: key.slice(8) });
  }

  main.innerHTML = `
    ${pageHead(s('dashboard'), new Date().toLocaleDateString(isArabic() ? 'ar-EG' : 'en-GB',
      { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))}
    <div class="stat-grid">
      <div class="stat is-ok">
        <div class="stat-label">${s('revenue')}</div>
        <div class="stat-value">${money(stats.revenue)}</div>
        <div class="stat-note">${stats.orders} ${s('orders_count')}</div>
      </div>
      <div class="stat ${stats.profit >= 0 ? 'is-ok' : 'is-bad'}">
        <div class="stat-label">${s('profit')}</div>
        <div class="stat-value">${money(stats.profit)}</div>
        <div class="stat-note">${s('cost')}: ${money(stats.cost)} · $1 = ${stats.usd_rate}₪</div>
      </div>
      <div class="stat ${stats.pending_orders ? 'is-warn' : ''}">
        <div class="stat-label">${s('pending')}</div>
        <div class="stat-value">${stats.pending_orders}</div>
        <div class="stat-note">${s('orders_count')}: ${stats.orders}</div>
      </div>
      <div class="stat">
        <div class="stat-label">${s('products_total')}</div>
        <div class="stat-value">${stats.products_total}</div>
        <div class="stat-note">${stats.products_active} ${s('in_stock_c')}</div>
      </div>
      <div class="stat ${stats.out_of_stock ? 'is-bad' : ''}">
        <div class="stat-label">${s('out_of_stock')}</div>
        <div class="stat-value">${stats.out_of_stock}</div>
        <div class="stat-note">${s('low_stock')}: ${stats.low_stock}</div>
      </div>
      <div class="stat">
        <div class="stat-label">${s('customers_count')}</div>
        <div class="stat-value">${stats.customers}</div>
      </div>
    </div>

    <div class="section-card">
      <h3>${s('sales_14')}</h3>
      <div class="chart">
        ${days.map((d) => `<div class="chart-col ${d.total === 0 ? 'is-empty' : ''}">
            <div class="chart-track">
              <div class="chart-bar" style="height:${d.total === 0 ? 2 : Math.max(4, Math.round((d.total / peak) * 100))}%"
                   title="${d.key}: ${money(d.total)}"></div>
            </div>
            <span class="chart-label">${d.label}</span>
          </div>`).join('')}
      </div>
    </div>

    <div class="grid-2" style="align-items:start;">
      <div class="section-card" style="margin:0;">
        <h3>${s('top_products')}</h3>
        <div style="margin-top:12px;">
          ${top.filter((p) => p.sold > 0).length === 0
            ? `<p class="hint">${s('no_orders')}</p>`
            : top.filter((p) => p.sold > 0).map((p) => `
              <div class="total-row"><span>${esc(p.name_ar)}</span>
              <span><strong>${p.sold}</strong> · ${money(p.revenue)}</span></div>`).join('')}
        </div>
      </div>
      <div class="section-card" style="margin:0;">
        <h3>${s('recent_orders')}</h3>
        <div style="margin-top:12px;">
          ${recent.length === 0
            ? `<p class="hint">${s('no_orders')}</p>`
            : recent.map((o) => `
              <div class="total-row">
                <span>#${esc(o.order_no)} · ${esc(o.customer_name)}</span>
                <span><span class="badge ${STATUS_STYLE[o.status]}">${s('st_' + o.status)}</span>
                  ${money(o.total)}</span>
              </div>`).join('')}
        </div>
      </div>
    </div>`;
}

/* ------------------------------------------------------------------ *
 * Products
 * ------------------------------------------------------------------ */
let productFilter = { q: '', category: '' };

async function showProducts() {
  const query = new URLSearchParams();
  if (productFilter.q) query.set('q', productFilter.q);
  if (productFilter.category) query.set('category', productFilter.category);
  const { products } = await api.get(`/api/admin/products?${query}`);

  main.innerHTML = `
    ${pageHead(s('products'), `${products.length}`,
      `<button class="btn" id="addProduct" type="button">+ ${s('add_product')}</button>`)}
    <div class="filter-bar">
      <input class="input grow" id="pSearch" type="search"
             placeholder="${esc(s('search_products'))}" value="${esc(productFilter.q)}">
      <select class="select" id="pCat">
        <option value="">${s('all_categories')}</option>
        ${state.categories.map((c) =>
          `<option value="${esc(c.slug)}" ${c.slug === productFilter.category ? 'selected' : ''}
           >${esc(localised(c, 'name'))}</option>`).join('')}
      </select>
    </div>
    ${products.length === 0
      ? `<div class="empty"><div class="empty-icon">🧴</div>
           <h3>${s('no_products')}</h3><p>${s('add_first')}</p></div>`
      : `<div class="table-wrap"><table class="data">
          <thead><tr>
            <th>${s('products')}</th><th>${s('price')}</th><th>${s('cost_usd')}</th>
            <th>${s('stock')}</th><th>${s('available')}</th><th></th>
          </tr></thead>
          <tbody>${products.map(productRow).join('')}</tbody>
        </table></div>`}`;

  $('#addProduct').addEventListener('click', () => openProductEditor(null));

  let timer;
  $('#pSearch').addEventListener('input', (e) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      productFilter.q = e.target.value.trim();
      showProducts();
    }, 300);
  });
  $('#pCat').addEventListener('change', (e) => {
    productFilter.category = e.target.value;
    showProducts();
  });

  main.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => openProductEditor(products.find((p) => p.id === Number(b.dataset.edit)))));
  main.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', () => deleteProduct(products.find((p) => p.id === Number(b.dataset.del)))));
  main.querySelectorAll('[data-toggle]').forEach((box) =>
    box.addEventListener('change', async () => {
      try {
        await api.patch(`/api/admin/products/${box.dataset.toggle}`, { is_active: box.checked });
        toast(s('product_saved'), 'ok');
      } catch (err) {
        box.checked = !box.checked;
        toast(err.message, 'bad');
      }
    }));
  main.querySelectorAll('[data-stock]').forEach((input) =>
    input.addEventListener('change', async () => {
      try {
        await api.patch(`/api/admin/products/${input.dataset.stock}`, { stock: input.value });
        toast(s('product_saved'), 'ok');
      } catch (err) {
        toast(err.message, 'bad');
      }
    }));
}

function productRow(product) {
  const name = localised(product, 'name');
  const image = safeImage(product.image);
  const rate = Number(state.settings.usd_rate) || 3.7;
  const costIls = (product.cost_usd || 0) * rate;
  const margin = product.price > 0 && costIls > 0
    ? Math.round(((product.price - costIls) / product.price) * 100)
    : null;

  return `<tr>
    <td>
      <div class="row-product">
        ${image
          ? `<img class="row-thumb" src="${esc(image)}" alt="">`
          : `<span class="row-thumb-empty">${esc(name.slice(0, 1) || '?')}</span>`}
        <div>
          <div class="row-title">${esc(name)}</div>
          <div class="row-sub">
            ${product.brand ? esc(product.brand) + ' · ' : ''}
            ${product.category_slug ? esc(localised({
              name_ar: product.category_name_ar, name_en: product.category_name_en }, 'name')) : '—'}
            ${product.is_featured ? ' · ★' : ''}
          </div>
        </div>
      </div>
    </td>
    <td><strong>${money(product.price)}</strong>
      ${product.compare_price > product.price
        ? `<div class="row-sub" style="text-decoration:line-through;">${money(product.compare_price)}</div>` : ''}</td>
    <td>${product.cost_usd ? `$${product.cost_usd}` : '—'}
      ${margin !== null ? `<div class="row-sub" style="color:${margin >= 0 ? 'var(--ok)' : 'var(--bad)'}">${margin}%</div>` : ''}</td>
    <td><input class="input" type="number" min="0" max="99999" value="${product.stock}"
          data-stock="${product.id}"
          style="width:82px;padding:6px 10px;${product.stock === 0 ? 'border-color:var(--bad);color:var(--bad);' : ''}"></td>
    <td>
      <label class="switch">
        <input type="checkbox" data-toggle="${product.id}" ${product.is_active ? 'checked' : ''}>
        <span class="switch-track"></span>
      </label>
    </td>
    <td><div class="cell-actions">
      <button class="btn btn-soft btn-sm" type="button" data-edit="${product.id}">${s('edit')}</button>
      <button class="btn btn-ghost btn-sm" type="button" data-del="${product.id}"
              style="color:var(--bad);">🗑</button>
    </div></td>
  </tr>`;
}

async function deleteProduct(product) {
  if (!product) return;
  if (!confirm(s('confirm_delete', { name: localised(product, 'name') }))) return;
  try {
    await api.del(`/api/admin/products/${product.id}`);
    toast(s('product_deleted'), 'ok');
    showProducts();
  } catch (err) {
    toast(err.message, 'bad');
  }
}

/* ---------- Product editor ---------- */
function openProductEditor(product) {
  const isNew = !product;
  let images = (product?.images || []).map((i) => i.url);

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:760px;" role="dialog" aria-modal="true">
      <div class="modal-head">
        <h2>${isNew ? s('add_product') : s('edit')}</h2>
        <button class="icon-btn" data-close type="button" aria-label="✕">✕</button>
      </div>
      <div class="modal-body">
        <form id="productForm" novalidate>
          <div class="grid-2">
            <div class="field"><label for="fNameAr">${s('name_ar')} *</label>
              <input class="input" id="fNameAr" value="${esc(product?.name_ar || '')}" maxlength="140"></div>
            <div class="field"><label for="fNameEn">${s('name_en')}</label>
              <input class="input" id="fNameEn" dir="ltr" value="${esc(product?.name_en || '')}" maxlength="140"></div>
          </div>
          <div class="field"><label for="fDescAr">${s('desc_ar')}</label>
            <textarea class="textarea" id="fDescAr" maxlength="4000">${esc(product?.description_ar || '')}</textarea></div>
          <div class="field"><label for="fDescEn">${s('desc_en')}</label>
            <textarea class="textarea" id="fDescEn" dir="ltr" maxlength="4000">${esc(product?.description_en || '')}</textarea></div>

          <div class="grid-3">
            <div class="field"><label for="fBrand">${s('brand')}</label>
              <input class="input" id="fBrand" value="${esc(product?.brand || '')}" maxlength="60"></div>
            <div class="field"><label for="fSku">${s('sku')}</label>
              <input class="input" id="fSku" dir="ltr" value="${esc(product?.sku || '')}" maxlength="40"></div>
            <div class="field"><label for="fCat">${s('category')}</label>
              <select class="select" id="fCat">
                <option value="">—</option>
                ${state.categories.map((c) =>
                  `<option value="${c.id}" ${product?.category_id === c.id ? 'selected' : ''}
                   >${esc(localised(c, 'name'))}</option>`).join('')}
              </select></div>
          </div>

          <div class="grid-3">
            <div class="field"><label for="fPrice">${s('price')} *</label>
              <input class="input" id="fPrice" type="number" min="0" step="0.5" dir="ltr"
                     value="${product?.price ?? ''}"></div>
            <div class="field"><label for="fCompare">${s('compare_price')}</label>
              <input class="input" id="fCompare" type="number" min="0" step="0.5" dir="ltr"
                     value="${product?.compare_price || ''}"></div>
            <div class="field"><label for="fCost">${s('cost_usd')}</label>
              <input class="input" id="fCost" type="number" min="0" step="0.1" dir="ltr"
                     value="${product?.cost_usd || ''}"></div>
          </div>

          <div id="marginPreview" style="margin-bottom:16px;"></div>

          <div class="grid-2">
            <div class="field"><label for="fStock">${s('stock')} *</label>
              <input class="input" id="fStock" type="number" min="0" max="99999" dir="ltr"
                     value="${product?.stock ?? 0}"></div>
            <div class="field" style="display:flex;flex-direction:column;gap:12px;justify-content:center;">
              <label class="switch">
                <input type="checkbox" id="fActive" ${product?.is_active !== false ? 'checked' : ''}>
                <span class="switch-track"></span><span>${s('available')}</span>
              </label>
              <label class="switch">
                <input type="checkbox" id="fFeatured" ${product?.is_featured ? 'checked' : ''}>
                <span class="switch-track"></span><span>★ ${s('featured')}</span>
              </label>
            </div>
          </div>

          <div class="field">
            <span class="label">${s('photos')}</span>
            <div class="uploader" id="uploader" tabindex="0" role="button">
              <div class="uploader-icon">📷</div>
              <p>${s('drop_photos')}</p>
              <small>${s('photos_hint')}</small>
            </div>
            <input type="file" id="fileInput" accept="image/*" multiple hidden>
            <div class="thumbs" id="thumbs"></div>
          </div>
          <p class="error-text" id="formError" hidden></p>
        </form>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" data-close type="button">${s('cancel')}</button>
        <button class="btn" id="saveProduct" type="submit" form="productForm">${s('save')}</button>
      </div>
    </div>`;

  const close = openOverlay(overlay);
  overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));

  const q = (sel) => overlay.querySelector(sel);

  /* Live profit preview as the numbers are typed. */
  const paintMargin = () => {
    const price = Number(q('#fPrice').value) || 0;
    const costUsd = Number(q('#fCost').value) || 0;
    const rate = Number(state.settings.usd_rate) || 3.7;
    const cost = costUsd * rate;
    const box = q('#marginPreview');
    if (!price || !cost) return (box.innerHTML = '');
    const profit = price - cost;
    const percent = Math.round((profit / price) * 100);
    box.innerHTML = `<div class="margin-box ${profit < 0 ? 'is-loss' : ''}">
      ${profit < 0 ? '⚠️ ' + s('loss_warning') : '💰 ' + s('profit_each', { n: money(profit), p: percent })}
    </div>`;
  };
  ['#fPrice', '#fCost'].forEach((sel) => q(sel).addEventListener('input', paintMargin));
  paintMargin();

  /* ---- photos ---- */
  const paintThumbs = () => {
    q('#thumbs').innerHTML = images
      .map((url, i) => `<div class="thumb-item">
          <img src="${esc(safeImage(url))}" alt="">
          <button class="thumb-x" type="button" data-rm="${i}" aria-label="✕">✕</button>
          ${i === 0 ? `<span class="thumb-main">${s('main_photo')}</span>` : ''}
        </div>`)
      .join('');
    q('#thumbs').querySelectorAll('[data-rm]').forEach((b) =>
      b.addEventListener('click', () => {
        images.splice(Number(b.dataset.rm), 1);
        paintThumbs();
      }));
  };
  paintThumbs();

  const addFiles = async (fileList) => {
    const files = Array.from(fileList).filter((f) => f.type.startsWith('image/'));
    if (files.length === 0) return;
    if (images.length + files.length > 8) return toast(s('too_many_photos'), 'bad');

    const uploader = q('#uploader');
    const original = uploader.innerHTML;
    uploader.innerHTML = `<div class="spinner"></div><p style="margin-top:8px;">${s('uploading')}</p>`;
    for (const file of files) {
      try {
        images.push(await resizeImageFile(file));
      } catch {
        toast(`${file.name}: ✕`, 'bad');
      }
    }
    uploader.innerHTML = original;
    paintThumbs();
  };

  q('#uploader').addEventListener('click', () => q('#fileInput').click());
  q('#uploader').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); q('#fileInput').click(); }
  });
  q('#fileInput').addEventListener('change', (e) => {
    addFiles(e.target.files);
    e.target.value = '';
  });
  ['dragenter', 'dragover'].forEach((type) =>
    q('#uploader').addEventListener(type, (e) => {
      e.preventDefault();
      q('#uploader').classList.add('is-drag');
    }));
  ['dragleave', 'drop'].forEach((type) =>
    q('#uploader').addEventListener(type, (e) => {
      e.preventDefault();
      q('#uploader').classList.remove('is-drag');
      if (type === 'drop') addFiles(e.dataTransfer.files);
    }));

  /* ---- save ---- */
  q('#productForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const errorBox = q('#formError');
    const button = q('#saveProduct');

    const nameAr = q('#fNameAr').value.trim();
    const nameEn = q('#fNameEn').value.trim();
    const price = Number(q('#fPrice').value);

    if (!nameAr && !nameEn) {
      errorBox.hidden = false;
      errorBox.textContent = s('required_field') + ': ' + s('name_ar');
      q('#fNameAr').classList.add('is-error');
      return;
    }
    if (!(price > 0)) {
      errorBox.hidden = false;
      errorBox.textContent = s('required_field') + ': ' + s('price');
      q('#fPrice').classList.add('is-error');
      return;
    }

    const payload = {
      name_ar: nameAr, name_en: nameEn,
      description_ar: q('#fDescAr').value, description_en: q('#fDescEn').value,
      brand: q('#fBrand').value, sku: q('#fSku').value,
      category_id: q('#fCat').value || null,
      price, compare_price: q('#fCompare').value || 0, cost_usd: q('#fCost').value || 0,
      stock: q('#fStock').value || 0,
      is_active: q('#fActive').checked, is_featured: q('#fFeatured').checked,
      images,
    };

    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span>';
    errorBox.hidden = true;

    try {
      if (isNew) await api.post('/api/admin/products', payload);
      else await api.put(`/api/admin/products/${product.id}`, payload);
      toast(s('product_saved'), 'ok');
      close();
      showProducts();
    } catch (err) {
      errorBox.hidden = false;
      errorBox.textContent = err.message;
      button.disabled = false;
      button.textContent = s('save');
    }
  });
}

/* ------------------------------------------------------------------ *
 * Categories
 * ------------------------------------------------------------------ */
async function showCategories() {
  const { categories } = await api.get('/api/categories');
  state.categories = categories;

  main.innerHTML = `
    ${pageHead(s('categories'), '', `<button class="btn" id="addCat" type="button">+ ${s('add_category')}</button>`)}
    ${categories.length === 0
      ? `<div class="empty"><div class="empty-icon">🗂</div><h3>${s('no_products')}</h3></div>`
      : `<div class="table-wrap"><table class="data">
          <thead><tr><th>${s('categories')}</th><th>${s('products')}</th><th>${s('order')}</th><th></th></tr></thead>
          <tbody>${categories.map((c) => `<tr>
            <td><div class="row-product">
              <span class="row-thumb-empty">${esc(c.icon || '🗂')}</span>
              <div><div class="row-title">${esc(c.name_ar)}</div>
                <div class="row-sub">${esc(c.name_en || '—')} · ${esc(c.slug)}</div></div>
            </div></td>
            <td>${s('products_in', { n: c.product_count })}</td>
            <td>${c.sort_order}</td>
            <td><div class="cell-actions">
              <button class="btn btn-soft btn-sm" type="button" data-edit="${c.id}">${s('edit')}</button>
              <button class="btn btn-ghost btn-sm" type="button" data-del="${c.id}" style="color:var(--bad)">🗑</button>
            </div></td></tr>`).join('')}</tbody>
        </table></div>`}`;

  $('#addCat').addEventListener('click', () => openCategoryEditor(null));
  main.querySelectorAll('[data-edit]').forEach((b) =>
    b.addEventListener('click', () => openCategoryEditor(categories.find((c) => c.id === Number(b.dataset.edit)))));
  main.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', async () => {
      const category = categories.find((c) => c.id === Number(b.dataset.del));
      if (!confirm(s('confirm_cat_delete', { name: category.name_ar }))) return;
      try {
        await api.del(`/api/admin/categories/${category.id}`);
        toast(s('cat_deleted'), 'ok');
        showCategories();
      } catch (err) { toast(err.message, 'bad'); }
    }));
}

function openCategoryEditor(category) {
  const isNew = !category;
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:460px;" role="dialog" aria-modal="true">
      <div class="modal-head"><h2>${isNew ? s('add_category') : s('edit')}</h2>
        <button class="icon-btn" data-close type="button">✕</button></div>
      <div class="modal-body">
        <form id="catForm" novalidate>
          <div class="field"><label for="cNameAr">${s('cat_name_ar')} *</label>
            <input class="input" id="cNameAr" value="${esc(category?.name_ar || '')}" maxlength="60"></div>
          <div class="field"><label for="cNameEn">${s('cat_name_en')}</label>
            <input class="input" id="cNameEn" dir="ltr" value="${esc(category?.name_en || '')}" maxlength="60"></div>
          <div class="grid-2">
            <div class="field"><label for="cIcon">${s('icon')}</label>
              <input class="input" id="cIcon" value="${esc(category?.icon || '')}" maxlength="8" placeholder="💄"></div>
            <div class="field"><label for="cOrder">${s('order')}</label>
              <input class="input" id="cOrder" type="number" dir="ltr" value="${category?.sort_order || 0}"></div>
          </div>
          <p class="error-text" id="catError" hidden></p>
        </form>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" data-close type="button">${s('cancel')}</button>
        <button class="btn" id="saveCat" type="submit" form="catForm">${s('save')}</button>
      </div>
    </div>`;

  const close = openOverlay(overlay);
  overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));

  overlay.querySelector('#catForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const q = (sel) => overlay.querySelector(sel);
    const errorBox = q('#catError');
    if (!q('#cNameAr').value.trim() && !q('#cNameEn').value.trim()) {
      errorBox.hidden = false;
      errorBox.textContent = s('required_field');
      return;
    }
    const payload = {
      name_ar: q('#cNameAr').value, name_en: q('#cNameEn').value,
      icon: q('#cIcon').value, sort_order: q('#cOrder').value,
    };
    const button = q('#saveCat');
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span>';
    try {
      if (isNew) await api.post('/api/admin/categories', payload);
      else await api.put(`/api/admin/categories/${category.id}`, payload);
      toast(s('cat_saved'), 'ok');
      close();
      showCategories();
    } catch (err) {
      errorBox.hidden = false;
      errorBox.textContent = err.message;
      button.disabled = false;
      button.textContent = s('save');
    }
  });
}

/* ------------------------------------------------------------------ *
 * Orders
 * ------------------------------------------------------------------ */
let orderFilter = '';

async function showOrders() {
  const { orders } = await api.get(`/api/admin/orders${orderFilter ? `?status=${orderFilter}` : ''}`);
  state.pending = orders.filter((o) => o.status === 'new').length;
  paintNav();

  main.innerHTML = `
    ${pageHead(s('orders'), `${orders.length}`)}
    <div class="filter-bar">
      <select class="select" id="oStatus">
        <option value="">${s('all_orders')}</option>
        ${STATUSES.map((st) =>
          `<option value="${st}" ${st === orderFilter ? 'selected' : ''}>${s('st_' + st)}</option>`).join('')}
      </select>
    </div>
    ${orders.length === 0
      ? `<div class="empty"><div class="empty-icon">🧾</div><h3>${s('no_orders')}</h3></div>`
      : `<div class="table-wrap"><table class="data">
          <thead><tr>
            <th>${s('order_no')}</th><th>${s('customer')}</th><th>${s('items')}</th>
            <th>${s('total')}</th><th>${s('status')}</th><th>${s('date')}</th><th></th>
          </tr></thead>
          <tbody>${orders.map(orderRow).join('')}</tbody>
        </table></div>`}`;

  $('#oStatus').addEventListener('change', (e) => {
    orderFilter = e.target.value;
    showOrders();
  });

  main.querySelectorAll('[data-status]').forEach((select) =>
    select.addEventListener('change', async () => {
      try {
        await api.patch(`/api/admin/orders/${select.dataset.status}`, { status: select.value });
        toast(s('status_updated'), 'ok');
        showOrders();
      } catch (err) { toast(err.message, 'bad'); }
    }));

  main.querySelectorAll('[data-view]').forEach((b) =>
    b.addEventListener('click', () => openOrder(orders.find((o) => o.id === Number(b.dataset.view)))));

  main.querySelectorAll('[data-del]').forEach((b) =>
    b.addEventListener('click', async () => {
      const order = orders.find((o) => o.id === Number(b.dataset.del));
      if (!confirm(s('confirm_order_delete', { name: order.order_no }))) return;
      try {
        await api.del(`/api/admin/orders/${order.id}`);
        toast(s('order_deleted'), 'ok');
        showOrders();
      } catch (err) { toast(err.message, 'bad'); }
    }));
}

function orderRow(order) {
  return `<tr>
    <td><strong>#${esc(order.order_no)}</strong></td>
    <td><div class="row-title">${esc(order.customer_name)}</div>
      <div class="row-sub" dir="ltr">${esc(order.phone)} · ${esc(order.city)}</div></td>
    <td>${order.items.length}</td>
    <td><strong>${money(order.total)}</strong></td>
    <td><select class="select order-status-select" data-status="${order.id}">
        ${STATUSES.map((st) =>
          `<option value="${st}" ${st === order.status ? 'selected' : ''}>${s('st_' + st)}</option>`).join('')}
      </select></td>
    <td class="row-sub">${esc(formatDate(order.created_at))}</td>
    <td><div class="cell-actions">
      <button class="btn btn-soft btn-sm" type="button" data-view="${order.id}">👁</button>
      <button class="btn btn-ghost btn-sm" type="button" data-del="${order.id}" style="color:var(--bad)">🗑</button>
    </div></td>
  </tr>`;
}

function openOrder(order) {
  const phone = String(order.phone).replace(/\D/g, '');
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true">
      <div class="modal-head">
        <h2>#${esc(order.order_no)}
          <span class="badge ${STATUS_STYLE[order.status]}">${s('st_' + order.status)}</span></h2>
        <button class="icon-btn" data-close type="button">✕</button>
      </div>
      <div class="modal-body">
        <div class="section-card" style="margin-bottom:14px;">
          <h3>${s('customer')}</h3>
          <dl class="detail-meta" style="border:0;padding:0;margin:10px 0 0;">
            <div class="detail-meta-row"><dt>${s('customer')}</dt><dd>${esc(order.customer_name)}</dd></div>
            <div class="detail-meta-row"><dt>${s('phone')}</dt><dd dir="ltr">${esc(order.phone)}</dd></div>
            ${order.email ? `<div class="detail-meta-row"><dt>${s('email')}</dt>
              <dd dir="ltr">${esc(order.email)}</dd></div>` : ''}
            <div class="detail-meta-row"><dt>${s('city')}</dt><dd>${esc(order.city)}</dd></div>
            <div class="detail-meta-row"><dt>${isArabic() ? 'العنوان' : 'Address'}</dt>
              <dd style="text-align:end;max-width:60%;">${esc(order.address)}</dd></div>
            <div class="detail-meta-row"><dt>${s('date')}</dt><dd>${esc(formatDate(order.created_at))}</dd></div>
          </dl>
          ${order.notes ? `<p class="hint" style="margin-top:10px;">📝 ${esc(order.notes)}</p>` : ''}
        </div>

        <div class="section-card" style="margin:0;">
          <h3>${s('items')}</h3>
          <div style="margin-top:10px;">
            ${order.items.map((i) => `<div class="total-row">
              <span>${esc(i.name)} × ${i.qty}</span>
              <span>${money(i.price * i.qty)}</span></div>`).join('')}
            <div class="total-row"><span>${isArabic() ? 'التوصيل' : 'Delivery'}</span>
              <span>${order.shipping === 0 ? (isArabic() ? 'مجاني' : 'Free') : money(order.shipping)}</span></div>
            <div class="total-row grand"><span>${s('total')}</span><span>${money(order.total)}</span></div>
            ${order.cost_total_usd
              ? `<p class="hint" style="margin-top:8px;">${s('cost')}: $${order.cost_total_usd.toFixed(2)}</p>` : ''}
          </div>
        </div>
      </div>
      <div class="modal-foot">
        ${phone ? `<a class="btn" style="background:#25D366;"
           href="https://wa.me/${esc(phone.startsWith('0') ? '970' + phone.slice(1) : phone)}"
           target="_blank" rel="noopener">💬 ${s('contact')}</a>` : ''}
        <button class="btn btn-ghost" data-close type="button">${s('cancel')}</button>
      </div>
    </div>`;

  const close = openOverlay(overlay);
  overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));
}

/* ------------------------------------------------------------------ *
 * Customers
 * ------------------------------------------------------------------ */
async function showCustomers() {
  const { customers } = await api.get('/api/admin/customers');

  main.innerHTML = `
    ${pageHead(s('customers'), `${customers.length}`)}
    ${customers.length === 0
      ? `<div class="empty"><div class="empty-icon">👥</div><h3>${s('no_customers')}</h3></div>`
      : `<div class="table-wrap"><table class="data">
          <thead><tr>
            <th>${s('email')}</th><th>${s('phone')}</th><th>${s('order_count')}</th>
            <th>${s('spent')}</th><th>${s('joined')}</th><th></th>
          </tr></thead>
          <tbody>${customers.map((c) => `<tr>
            <td><div class="row-title" dir="ltr">${esc(c.email)}</div>
              <div class="row-sub">${esc(c.name || '—')}
                ${c.is_admin ? `<span class="badge badge-gold">👑 ${s('owner')}</span>` : ''}
                ${c.is_blocked ? `<span class="badge badge-bad">${s('blocked')}</span>` : ''}</div></td>
            <td dir="ltr">${esc(c.phone || '—')}</td>
            <td>${c.order_count}</td>
            <td>${money(c.spent)}</td>
            <td class="row-sub">${esc(formatDate(c.created_at))}</td>
            <td><div class="cell-actions">
              ${c.is_admin ? '' : `<button class="btn btn-ghost btn-sm" type="button"
                 data-block="${c.id}" data-blocked="${c.is_blocked ? '1' : '0'}"
                 style="color:${c.is_blocked ? 'var(--ok)' : 'var(--bad)'}">
                 ${c.is_blocked ? s('unblock') : s('block')}</button>`}
            </div></td></tr>`).join('')}</tbody>
        </table></div>`}`;

  main.querySelectorAll('[data-block]').forEach((b) =>
    b.addEventListener('click', async () => {
      try {
        await api.patch(`/api/admin/customers/${b.dataset.block}`, {
          is_blocked: b.dataset.blocked !== '1',
        });
        toast(s('customer_updated'), 'ok');
        showCustomers();
      } catch (err) { toast(err.message, 'bad'); }
    }));
}

/* ------------------------------------------------------------------ *
 * Settings
 * ------------------------------------------------------------------ */
async function showSettings() {
  const { settings } = await api.get('/api/admin/settings');
  state.settings = settings;
  const value = (key) => esc(settings[key] ?? '');

  main.innerHTML = `
    ${pageHead(s('settings'), '')}
    <form id="settingsForm">
      <div class="section-card">
        <h3>${s('shop_identity')}</h3>
        <div class="grid-2">
          <div class="field"><label for="sNameAr">${s('shop_name_ar')}</label>
            <input class="input" id="sNameAr" value="${value('shop_name_ar')}" maxlength="80"></div>
          <div class="field"><label for="sNameEn">${s('shop_name_en')}</label>
            <input class="input" id="sNameEn" dir="ltr" value="${value('shop_name_en')}" maxlength="80"></div>
        </div>
        <div class="field"><label for="sTagAr">${s('tagline_ar')}</label>
          <input class="input" id="sTagAr" value="${value('tagline_ar')}" maxlength="160"></div>
        <div class="field"><label for="sTagEn">${s('tagline_en')}</label>
          <input class="input" id="sTagEn" dir="ltr" value="${value('tagline_en')}" maxlength="160"></div>
        <div class="grid-2">
          <div class="field"><label for="sAnnAr">${s('announcement')} (AR)</label>
            <input class="input" id="sAnnAr" value="${value('announcement_ar')}" maxlength="120"></div>
          <div class="field"><label for="sAnnEn">${s('announcement')} (EN)</label>
            <input class="input" id="sAnnEn" dir="ltr" value="${value('announcement_en')}" maxlength="120"></div>
        </div>
      </div>

      <div class="section-card">
        <h3>${s('contact_settings')}</h3>
        <div class="grid-2">
          <div class="field"><label for="sWhats">${s('whatsapp')}</label>
            <input class="input" id="sWhats" dir="ltr" inputmode="tel"
                   placeholder="970590000000" value="${value('whatsapp')}" maxlength="20">
            <p class="hint">${isArabic() ? 'مثال: 970590000000 بدون + أو مسافات' : 'e.g. 970590000000, no + or spaces'}</p></div>
          <div class="field"><label for="sInsta">${s('instagram')}</label>
            <input class="input" id="sInsta" dir="ltr" placeholder="mystore" value="${value('instagram')}" maxlength="60"></div>
        </div>
      </div>

      <div class="section-card">
        <h3>${s('shipping_settings')}</h3>
        <div class="grid-3">
          <div class="field"><label for="sShip">${s('shipping_flat')}</label>
            <input class="input" id="sShip" type="number" min="0" step="1" dir="ltr" value="${value('shipping_flat')}"></div>
          <div class="field"><label for="sFree">${s('free_over')}</label>
            <input class="input" id="sFree" type="number" min="0" step="1" dir="ltr" value="${value('free_shipping_over')}"></div>
          <div class="field"><label for="sRate">${s('usd_rate')}</label>
            <input class="input" id="sRate" type="number" min="0.1" step="0.01" dir="ltr" value="${value('usd_rate')}">
            <p class="hint">${s('usd_hint')}</p></div>
        </div>
      </div>

      <button class="btn btn-lg" id="saveSettings" type="submit">${s('save')}</button>
    </form>`;

  $('#settingsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#saveSettings');
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span>';
    try {
      const { settings: fresh } = await api.put('/api/admin/settings', {
        shop_name_ar: $('#sNameAr').value, shop_name_en: $('#sNameEn').value,
        tagline_ar: $('#sTagAr').value, tagline_en: $('#sTagEn').value,
        announcement_ar: $('#sAnnAr').value, announcement_en: $('#sAnnEn').value,
        whatsapp: $('#sWhats').value, instagram: $('#sInsta').value,
        shipping_flat: $('#sShip').value, free_shipping_over: $('#sFree').value,
        usd_rate: $('#sRate').value,
      });
      state.settings = fresh;
      $('#topShopName').textContent = localised(fresh, 'shop_name');
      toast(s('settings_saved'), 'ok');
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      button.disabled = false;
      button.textContent = s('save');
    }
  });
}

boot();
