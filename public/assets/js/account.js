/* ==================================================================
   Customer account — details and order history.
   ================================================================== */
import {
  api, isArabic, localised, money, esc, toast, formatDate,
  toggleLanguage, applyLanguage, $, PALESTINE_CITIES,
} from './core.js';

const T = {
  ar: {
    title: 'حسابي', shop: 'المتجر', logout: 'خروج', details: 'بياناتي',
    name: 'الاسم الكامل', phone: 'رقم الهاتف', city: 'المدينة', choose_city: 'اختاري المدينة',
    address: 'العنوان', save: 'حفظ البيانات', saved: 'تم حفظ بياناتك',
    security: 'كلمة المرور', current_pw: 'كلمة المرور الحالية',
    new_pw: 'كلمة المرور الجديدة', repeat_pw: 'تأكيد كلمة المرور الجديدة',
    change_pw: 'تغيير كلمة المرور', pw_changed: 'تم تغيير كلمة المرور',
    pw_short: 'كلمة المرور يجب أن تكون ٨ أحرف على الأقل',
    pw_mismatch: 'كلمتا المرور غير متطابقتين',
    pw_note: 'عند التغيير سيتم تسجيل الخروج من باقي الأجهزة.',
    orders: 'طلباتي', no_orders: 'لم تقومي بأي طلب بعد',
    no_orders_sub: 'تصفّحي المتجر وابدئي التسوق', browse: 'تصفّحي المتجر',
    order_no: 'رقم الطلب', total: 'الإجمالي', items: 'المنتجات', admin_area: 'لوحة التحكم',
    st_new: 'قيد المراجعة', st_confirmed: 'مؤكد', st_shipped: 'تم الشحن',
    st_delivered: 'تم التسليم', st_cancelled: 'ملغي',
  },
  en: {
    title: 'My account', shop: 'Shop', logout: 'Sign out', details: 'My details',
    name: 'Full name', phone: 'Phone number', city: 'City', choose_city: 'Choose your city',
    address: 'Address', save: 'Save details', saved: 'Your details were saved',
    security: 'Password', current_pw: 'Current password',
    new_pw: 'New password', repeat_pw: 'Confirm new password',
    change_pw: 'Change password', pw_changed: 'Your password was changed',
    pw_short: 'Your password needs at least 8 characters',
    pw_mismatch: 'Those two passwords are not the same',
    pw_note: 'Changing it signs you out of your other devices.',
    orders: 'My orders', no_orders: 'You have not ordered yet',
    no_orders_sub: 'Browse the shop and start shopping', browse: 'Browse the shop',
    order_no: 'Order', total: 'Total', items: 'Items', admin_area: 'Dashboard',
    st_new: 'Being reviewed', st_confirmed: 'Confirmed', st_shipped: 'Shipped',
    st_delivered: 'Delivered', st_cancelled: 'Cancelled',
  },
};
const s = (key) => T[isArabic() ? 'ar' : 'en'][key] || key;

const STATUS_STYLE = {
  new: 'badge-info', confirmed: 'badge-plum', shipped: 'badge-warn',
  delivered: 'badge-ok', cancelled: 'badge-bad',
};

applyLanguage();
$('#langBtn').textContent = isArabic() ? 'English' : 'العربية';
$('#langBtn').addEventListener('click', toggleLanguage);
$('#shopBtn').textContent = s('shop');
$('#logoutBtn').textContent = s('logout');
$('#logoutBtn').addEventListener('click', async () => {
  try { await api.post('/api/auth/logout'); } catch { /* leave anyway */ }
  location.replace('/');
});

boot();

async function boot() {
  let user;
  try {
    const result = await api.get('/api/auth/me');
    user = result.user;
    if (!user) return location.replace('/login.html?next=/account.html');
  } catch {
    return location.replace('/login.html?next=/account.html');
  }

  api.get('/api/shop').then(({ settings }) => {
    const name = localised(settings, 'shop_name');
    if (name) $('#brandName').textContent = name;
  }).catch(() => {});

  const { orders } = await api.get('/api/auth/orders');

  $('#accountRoot').innerHTML = `
    <div class="page-head">
      <h1>${s('title')}</h1>
      <p dir="ltr">${esc(user.email)}</p>
    </div>

    ${user.is_admin
      ? `<a class="btn" href="/admin.html" style="margin-bottom:18px;">👑 ${s('admin_area')}</a>`
      : ''}

    <div class="section-card">
      <h3>${s('details')}</h3>
      <form id="profileForm" style="margin-top:14px;">
        <div class="grid-2">
          <div class="field"><label for="pName">${s('name')}</label>
            <input class="input" id="pName" value="${esc(user.name)}" maxlength="80" autocomplete="name"></div>
          <div class="field"><label for="pPhone">${s('phone')}</label>
            <input class="input" id="pPhone" dir="ltr" value="${esc(user.phone)}" maxlength="30" autocomplete="tel"></div>
        </div>
        <div class="grid-2">
          <div class="field"><label for="pCity">${s('city')}</label>
            <select class="select" id="pCity">
              <option value="">${s('choose_city')}</option>
              ${PALESTINE_CITIES.map((c) =>
                `<option ${user.city === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
            </select></div>
          <div class="field"><label for="pAddress">${s('address')}</label>
            <input class="input" id="pAddress" value="${esc(user.address)}" maxlength="250"></div>
        </div>
        <button class="btn" id="saveProfile" type="submit">${s('save')}</button>
      </form>
    </div>

    <div class="section-card">
      <h3>${s('security')}</h3>
      <form id="passwordForm" style="margin-top:14px;max-width:420px;">
        <div class="field"><label for="cpCurrent">${s('current_pw')}</label>
          <input class="input" type="password" id="cpCurrent" dir="ltr" autocomplete="current-password"></div>
        <div class="field"><label for="cpNew">${s('new_pw')}</label>
          <input class="input" type="password" id="cpNew" dir="ltr" autocomplete="new-password"></div>
        <div class="field"><label for="cpRepeat">${s('repeat_pw')}</label>
          <input class="input" type="password" id="cpRepeat" dir="ltr" autocomplete="new-password"></div>
        <p class="error-text" id="cpError" hidden></p>
        <p class="hint">${s('pw_note')}</p>
        <button class="btn" id="cpSubmit" type="submit" style="margin-top:10px;">${s('change_pw')}</button>
      </form>
    </div>

    <div class="section-card">
      <h3>${s('orders')} ${orders.length ? `(${orders.length})` : ''}</h3>
      <div style="margin-top:14px;">
        ${orders.length === 0
          ? `<div class="empty"><div class="empty-icon">🧾</div>
               <h3>${s('no_orders')}</h3><p>${s('no_orders_sub')}</p>
               <a class="btn btn-soft" href="/">${s('browse')}</a></div>`
          : orders.map(orderCard).join('')}
      </div>
    </div>`;

  $('#passwordForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const box = $('#cpError');
    const current = $('#cpCurrent');
    const next = $('#cpNew');
    const repeat = $('#cpRepeat');
    box.hidden = true;
    [current, next, repeat].forEach((i) => i.classList.remove('is-error'));

    const bad = (input, message) => {
      box.hidden = false;
      box.textContent = message;
      input.classList.add('is-error');
      input.focus();
    };
    if (!current.value) return bad(current, s('current_pw'));
    if (next.value.length < 8) return bad(next, s('pw_short'));
    if (next.value !== repeat.value) return bad(repeat, s('pw_mismatch'));

    const button = $('#cpSubmit');
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span>';
    try {
      await api.post('/api/auth/change-password', {
        current_password: current.value,
        new_password: next.value,
      });
      toast(s('pw_changed'), 'ok');
      $('#passwordForm').reset();
    } catch (err) {
      bad(current, err.message);
    } finally {
      button.disabled = false;
      button.textContent = s('change_pw');
    }
  });

  $('#profileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = $('#saveProfile');
    button.disabled = true;
    button.innerHTML = '<span class="spinner"></span>';
    try {
      await api.patch('/api/auth/profile', {
        name: $('#pName').value, phone: $('#pPhone').value,
        city: $('#pCity').value, address: $('#pAddress').value,
      });
      toast(s('saved'), 'ok');
    } catch (err) {
      toast(err.message, 'bad');
    } finally {
      button.disabled = false;
      button.textContent = s('save');
    }
  });
}

function orderCard(order) {
  return `<div class="card card-pad" style="margin-bottom:12px;">
    <div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center;">
      <div>
        <strong>#${esc(order.order_no)}</strong>
        <span class="badge ${STATUS_STYLE[order.status]}">${s('st_' + order.status)}</span>
        <div class="row-sub">${esc(formatDate(order.created_at))}</div>
      </div>
      <strong style="font-size:17px;color:var(--plum-700);">${money(order.total)}</strong>
    </div>
    <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--line-soft);">
      ${order.items.map((i) => `<div class="total-row">
        <span>${esc(i.name)} × ${i.qty}</span><span>${money(i.price * i.qty)}</span></div>`).join('')}
    </div>
  </div>`;
}
