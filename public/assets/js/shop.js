/* ==================================================================
   Storefront
   ================================================================== */
import {
  api, t, lang, isArabic, localised, money, esc, safeImage, toast, cart,
  toggleLanguage, applyLanguage, $, openOverlay, closeOverlay, PALESTINE_CITIES, formatDate,
} from './core.js';

const state = {
  settings: {},
  categories: [],
  products: [],
  category: '',
  search: '',
  sort: 'new',
  user: null,
};

const symbol = () => state.settings.currency_symbol || '₪';

/* ------------------------------------------------------------------ *
 * Boot
 * ------------------------------------------------------------------ */
async function boot() {
  applyLanguage();
  wireStaticText();

  try {
    const data = await api.get('/api/shop');
    state.settings = data.settings;
    state.categories = data.categories;
    state.products = data.products;
  } catch (err) {
    $('#productGrid').innerHTML = '';
    showEmpty(t('err_server'), err.message);
    return;
  }

  api.get('/api/auth/me').then(({ user }) => {
    state.user = user;
    paintAccountButton();
  }).catch(() => {});

  paintShopIdentity();
  paintCategories();
  paintFeatured();
  render();
  updateCartCount();
}

function wireStaticText() {
  $('#langBtn').textContent = t('other');
  $('#langBtn').addEventListener('click', toggleLanguage);
  $('#searchInput').placeholder = t('search');
  $('#searchLabel').textContent = t('search_label');
  $('#cartBtn').setAttribute('aria-label', t('cart'));
  $('#catalogueTitle').textContent = t('products');
  $('#featuredTitle').textContent = t('featured');
  $('#footLogin').textContent = t('login');
  $('#footOrders').textContent = t('my_orders');

  const sortSelect = $('#sortSelect');
  sortSelect.innerHTML = [
    ['new', t('sort_new')],
    ['low', t('sort_low')],
    ['high', t('sort_high')],
  ].map(([value, label]) => `<option value="${value}">${esc(label)}</option>`).join('');
  sortSelect.addEventListener('change', () => {
    state.sort = sortSelect.value;
    render();
  });

  let searchTimer;
  $('#searchInput').addEventListener('input', (e) => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      state.search = e.target.value.trim().toLowerCase();
      render();
    }, 200);
  });

  $('#cartBtn').addEventListener('click', openCart);
  $('#heroCta').addEventListener('click', () => {
    document.getElementById('catalogue').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
  window.addEventListener('cart:change', updateCartCount);
}

function paintShopIdentity() {
  const s = state.settings;
  const name = localised(s, 'shop_name') || 'Al-Talil Al-Ghali';
  const tagline = localised(s, 'tagline');
  const announcement = localised(s, 'announcement');

  document.title = `${name}`;
  $('#brandName').textContent = name;
  $('#footBrand').textContent = name;
  $('#heroTitle').textContent = isArabic() ? 'جمالكِ يستحق الأفضل' : 'Beauty you deserve';
  $('#heroText').textContent = tagline;
  $('#footAbout').textContent = tagline;
  $('#heroCta').textContent = isArabic() ? 'تسوّقي الآن' : 'Shop now';
  $('#featuredSub').textContent = isArabic() ? 'اختيارات عملائنا المفضلة' : 'Our customers’ favourites';

  const announce = $('#announce');
  if (announcement) announce.textContent = announcement;
  else announce.hidden = true;

  const freeOver = Number(s.free_shipping_over) || 0;
  $('#heroBadges').innerHTML = [
    ['🚚', freeOver > 0
      ? t('free_over', { n: money(freeOver, symbol()) })
      : (isArabic() ? 'توصيل لكل فلسطين' : 'Delivery across Palestine')],
    ['✅', isArabic() ? 'منتجات أصلية ١٠٠٪' : '100% authentic products'],
    ['💵', isArabic() ? 'الدفع عند الاستلام' : 'Cash on delivery'],
  ].map(([icon, text]) => `<span class="hero-badge">${icon} ${esc(text)}</span>`).join('');

  const whatsapp = String(s.whatsapp || '').replace(/\D/g, '');
  const contact = [];
  if (whatsapp) {
    contact.push(`<li><a href="https://wa.me/${esc(whatsapp)}" target="_blank" rel="noopener">
      💬 ${isArabic() ? 'واتساب' : 'WhatsApp'}: ${esc(whatsapp)}</a></li>`);
  }
  if (s.instagram) {
    const handle = String(s.instagram).replace(/^@/, '');
    contact.push(`<li><a href="https://instagram.com/${esc(handle)}" target="_blank" rel="noopener">
      📷 Instagram: @${esc(handle)}</a></li>`);
  }
  $('#footContact').innerHTML = contact.join('')
    || `<li>${esc(isArabic() ? 'سيتم إضافة بيانات التواصل قريباً' : 'Contact details coming soon')}</li>`;
  $('#footContactTitle').textContent = isArabic() ? 'تواصلي معنا' : 'Contact us';
  $('#footLinksTitle').textContent = isArabic() ? 'روابط' : 'Links';
  $('#footCopy').textContent = `© ${new Date().getFullYear()} ${name}`;
  $('#footTag').textContent = isArabic() ? 'صنع بحب في فلسطين 🇵🇸' : 'Made with love in Palestine 🇵🇸';
}

function paintAccountButton() {
  const button = $('#accountBtn');
  if (!state.user) return;
  if (state.user.is_admin) {
    button.href = '/admin.html';
    button.textContent = '👑';
    button.title = t('admin_panel');
  } else {
    button.href = '/account.html';
    button.title = t('account');
  }
}

/* ------------------------------------------------------------------ *
 * Categories
 * ------------------------------------------------------------------ */
function paintCategories() {
  const nav = $('#catNav');
  const chips = [{ slug: '', label: t('all'), icon: '✨' }].concat(
    state.categories
      .filter((c) => c.product_count > 0)
      .map((c) => ({ slug: c.slug, label: localised(c, 'name'), icon: c.icon || '' })),
  );

  nav.innerHTML = chips
    .map(
      (c) => `<button class="cat-chip ${c.slug === state.category ? 'is-active' : ''}"
        type="button" data-slug="${esc(c.slug)}">
        ${c.icon ? `<span aria-hidden="true">${esc(c.icon)}</span>` : ''}${esc(c.label)}
      </button>`,
    )
    .join('');

  nav.querySelectorAll('.cat-chip').forEach((chip) => {
    chip.addEventListener('click', () => {
      state.category = chip.dataset.slug;
      paintCategories();
      render();
      document.getElementById('catalogue').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
}

/* ------------------------------------------------------------------ *
 * Product rendering
 * ------------------------------------------------------------------ */
function productCard(product) {
  const name = localised(product, 'name');
  const image = safeImage(product.image);
  const onSale = product.compare_price > product.price;
  const soldOut = !product.in_stock;
  const lowStock = product.in_stock && product.stock <= 3;

  const flags = [];
  if (onSale) {
    const off = Math.round((1 - product.price / product.compare_price) * 100);
    flags.push(`<span class="badge badge-bad">${t('sale')} ${off}%</span>`);
  }
  if (product.is_featured) flags.push(`<span class="badge badge-gold">★ ${t('featured')}</span>`);

  return `
  <article class="product-card" data-id="${product.id}">
    <button class="product-media" type="button" data-open="${product.id}"
            aria-label="${esc(name)}">
      ${image
        ? `<img src="${esc(image)}" alt="${esc(name)}" loading="lazy">`
        : `<span class="product-placeholder" aria-hidden="true">${esc(name.slice(0, 1) || '💄')}</span>`}
      ${flags.length ? `<span class="product-flags">${flags.join('')}</span>` : ''}
      ${soldOut ? `<span class="sold-out-veil"><span>${t('sold_out')}</span></span>` : ''}
    </button>
    <div class="product-body">
      ${product.brand ? `<span class="product-brand">${esc(product.brand)}</span>` : ''}
      <h3 class="product-name">${esc(name)}</h3>
      ${lowStock ? `<span class="stock-note">${t('only_left', { n: product.stock })}</span>` : ''}
      <div class="product-foot">
        <span class="price">
          <span class="price-now">${money(product.price, symbol())}</span>
          ${onSale ? `<span class="price-was">${money(product.compare_price, symbol())}</span>` : ''}
        </span>
        <button class="add-btn" type="button" data-add="${product.id}"
                ${soldOut ? 'disabled' : ''}
                aria-label="${esc(soldOut ? t('sold_out') : t('add'))}">${soldOut ? '×' : '+'}</button>
      </div>
    </div>
  </article>`;
}

function bindCards(root) {
  root.querySelectorAll('[data-add]').forEach((btn) =>
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      cart.add(Number(btn.dataset.add));
      toast(t('added'), 'ok');
    }),
  );
  root.querySelectorAll('[data-open]').forEach((btn) =>
    btn.addEventListener('click', () => openProduct(Number(btn.dataset.open))),
  );
}

function paintFeatured() {
  const featured = state.products.filter((p) => p.is_featured && p.in_stock).slice(0, 5);
  if (featured.length < 3) return;
  const section = $('#featuredSection');
  section.hidden = false;
  const grid = $('#featuredGrid');
  grid.innerHTML = featured.map(productCard).join('');
  bindCards(grid);
}

function visibleProducts() {
  let list = state.products.slice();
  if (state.category) list = list.filter((p) => p.category_slug === state.category);
  if (state.search) {
    const q = state.search;
    list = list.filter((p) =>
      [p.name_ar, p.name_en, p.brand, p.sku, p.description_ar, p.description_en]
        .some((field) => String(field || '').toLowerCase().includes(q)),
    );
  }
  if (state.sort === 'low') list.sort((a, b) => a.price - b.price);
  else if (state.sort === 'high') list.sort((a, b) => b.price - a.price);
  /* In-stock items always come before sold-out ones. */
  return list.sort((a, b) => Number(b.in_stock) - Number(a.in_stock));
}

function showEmpty(title, sub) {
  const box = $('#gridEmpty');
  box.hidden = false;
  box.innerHTML = `<div class="empty">
    <div class="empty-icon">🔍</div>
    <h3>${esc(title)}</h3>
    <p>${esc(sub)}</p>
  </div>`;
}

function render() {
  const list = visibleProducts();
  const grid = $('#productGrid');
  const empty = $('#gridEmpty');

  $('#resultCount').textContent = list.length
    ? (isArabic() ? `${list.length} منتج` : `${list.length} product${list.length === 1 ? '' : 's'}`)
    : '';

  if (list.length === 0) {
    grid.innerHTML = '';
    showEmpty(t('no_products'), t('no_products_sub'));
    return;
  }
  empty.hidden = true;
  grid.innerHTML = list.map(productCard).join('');
  bindCards(grid);
}

function updateCartCount() {
  const count = cart.count();
  const badge = $('#cartCount');
  badge.textContent = count;
  badge.hidden = count === 0;
}

/* ------------------------------------------------------------------ *
 * Product detail
 * ------------------------------------------------------------------ */
async function openProduct(id) {
  let product = state.products.find((p) => p.id === id);
  try {
    const data = await api.get(`/api/products/${id}`);
    product = data.product;
  } catch {
    if (!product) return toast(t('err_server'), 'bad');
  }

  const name = localised(product, 'name');
  const description = localised(product, 'description') || t('no_description');
  const images = (product.images || []).map((i) => safeImage(i.url)).filter(Boolean);
  const onSale = product.compare_price > product.price;
  let qty = 1;

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${esc(name)}">
      <div class="modal-head">
        <h2>${esc(name)}</h2>
        <button class="icon-btn" data-close type="button" aria-label="${t('close')}">✕</button>
      </div>
      <div class="modal-body">
        <div class="detail">
          <div>
            <div class="detail-main">
              ${images.length
                ? `<img id="detailImage" src="${esc(images[0])}" alt="${esc(name)}">`
                : `<span class="product-placeholder">${esc(name.slice(0, 1) || '💄')}</span>`}
            </div>
            ${images.length > 1
              ? `<div class="detail-thumbs">${images.map((url, i) =>
                  `<button class="detail-thumb ${i === 0 ? 'is-active' : ''}" type="button" data-img="${esc(url)}">
                     <img src="${esc(url)}" alt=""></button>`).join('')}</div>`
              : ''}
          </div>
          <div>
            ${product.brand ? `<span class="product-brand">${esc(product.brand)}</span>` : ''}
            <h3 class="detail-title">${esc(name)}</h3>
            <div class="detail-price">
              <span class="price-now">${money(product.price, symbol())}</span>
              ${onSale ? `<span class="price-was">${money(product.compare_price, symbol())}</span>` : ''}
            </div>
            <dl class="detail-meta">
              <div class="detail-meta-row"><dt>${t('availability')}</dt>
                <dd>${product.in_stock
                  ? `<span class="badge badge-ok">${t('in_stock')}${product.stock <= 5 ? ` · ${product.stock}` : ''}</span>`
                  : `<span class="badge badge-bad">${t('out_stock')}</span>`}</dd></div>
              ${product.category_slug ? `<div class="detail-meta-row"><dt>${t('category')}</dt>
                <dd>${esc(localised({ name_ar: product.category_name_ar, name_en: product.category_name_en }, 'name'))}</dd></div>` : ''}
              ${product.sku ? `<div class="detail-meta-row"><dt>${t('sku')}</dt><dd>${esc(product.sku)}</dd></div>` : ''}
            </dl>
            <p class="detail-desc">${esc(description)}</p>
            ${product.in_stock ? `
              <div style="display:flex;gap:12px;align-items:center;margin-top:20px;flex-wrap:wrap;">
                <div class="qty-picker">
                  <button type="button" data-step="-1" aria-label="-">−</button>
                  <span id="qtyValue">1</span>
                  <button type="button" data-step="1" aria-label="+">+</button>
                </div>
                <button class="btn btn-lg" data-add-detail type="button" style="flex:1;min-width:150px;">
                  🛍️ ${t('add')}
                </button>
              </div>` : `<p class="badge badge-bad" style="margin-top:18px;">${t('sold_out')}</p>`}
          </div>
        </div>
      </div>
    </div>`;

  const close = openOverlay(overlay);
  overlay.querySelector('[data-close]').addEventListener('click', close);

  overlay.querySelectorAll('[data-img]').forEach((thumb) =>
    thumb.addEventListener('click', () => {
      overlay.querySelector('#detailImage').src = thumb.dataset.img;
      overlay.querySelectorAll('.detail-thumb').forEach((n) => n.classList.remove('is-active'));
      thumb.classList.add('is-active');
    }),
  );

  overlay.querySelectorAll('[data-step]').forEach((btn) =>
    btn.addEventListener('click', () => {
      qty = Math.max(1, Math.min(product.stock || 99, qty + Number(btn.dataset.step)));
      overlay.querySelector('#qtyValue').textContent = qty;
    }),
  );

  overlay.querySelector('[data-add-detail]')?.addEventListener('click', () => {
    cart.add(product.id, qty);
    toast(t('added'), 'ok');
    close();
  });
}

/* ------------------------------------------------------------------ *
 * Cart drawer
 * ------------------------------------------------------------------ */
function cartLines() {
  return cart
    .read()
    .map((entry) => {
      const product = state.products.find((p) => p.id === entry.id);
      return product ? { product, qty: Math.min(entry.qty, Math.max(1, product.stock)) } : null;
    })
    .filter(Boolean);
}

function cartTotals(lines) {
  const subtotal = lines.reduce((sum, l) => sum + l.product.price * l.qty, 0);
  const freeOver = Number(state.settings.free_shipping_over) || 0;
  const flat = Number(state.settings.shipping_flat) || 0;
  const shipping = lines.length === 0 ? 0 : freeOver > 0 && subtotal >= freeOver ? 0 : flat;
  return { subtotal, shipping, total: subtotal + shipping, freeOver };
}

function openCart() {
  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `<aside class="drawer" role="dialog" aria-modal="true" aria-label="${t('cart')}">
      <div class="cart-head">
        <h2>🛍️ ${t('cart')}</h2>
        <button class="icon-btn" data-close type="button" aria-label="${t('close')}">✕</button>
      </div>
      <div class="cart-items" id="cartItems"></div>
      <div class="cart-foot" id="cartFoot"></div>
    </aside>`;

  const close = openOverlay(overlay);
  overlay.querySelector('[data-close]').addEventListener('click', close);

  const paint = () => {
    const lines = cartLines();
    const items = overlay.querySelector('#cartItems');
    const foot = overlay.querySelector('#cartFoot');

    if (lines.length === 0) {
      items.innerHTML = `<div class="empty">
          <div class="empty-icon">🛍️</div>
          <h3>${t('cart_empty')}</h3>
          <p>${t('cart_empty_sub')}</p>
        </div>`;
      foot.innerHTML = `<button class="btn btn-ghost btn-block" data-close2 type="button">${t('continue_shopping')}</button>`;
      foot.querySelector('[data-close2]').addEventListener('click', close);
      return;
    }

    items.innerHTML = lines
      .map(({ product, qty }) => {
        const image = safeImage(product.image);
        const name = localised(product, 'name');
        return `<div class="cart-row">
          <div class="cart-thumb">${image
            ? `<img src="${esc(image)}" alt="">`
            : `<span class="product-placeholder" style="font-size:20px;">${esc(name.slice(0, 1))}</span>`}</div>
          <div class="cart-info">
            <div class="cart-name">${esc(name)}</div>
            <div class="cart-unit">${money(product.price, symbol())} × ${qty} = <strong>${money(product.price * qty, symbol())}</strong></div>
            <div class="cart-controls">
              <div class="qty-picker">
                <button type="button" data-dec="${product.id}" ${qty <= 1 ? 'disabled' : ''} aria-label="-">−</button>
                <span>${qty}</span>
                <button type="button" data-inc="${product.id}" ${qty >= product.stock ? 'disabled' : ''} aria-label="+">+</button>
              </div>
              <button class="cart-remove" type="button" data-del="${product.id}">🗑 ${t('remove')}</button>
            </div>
          </div>
        </div>`;
      })
      .join('');

    const { subtotal, shipping, total, freeOver } = cartTotals(lines);
    const missing = freeOver - subtotal;
    foot.innerHTML = `
      ${shipping === 0 && freeOver > 0 && subtotal >= freeOver
        ? `<div class="free-ship-note">🚚 ${t('free_over', { n: money(freeOver, symbol()) })}</div>`
        : missing > 0 && freeOver > 0
          ? `<div class="free-ship-note" style="background:var(--warn-bg);color:var(--warn);">
               ${t('add_more_free', { n: money(missing, symbol()) })}</div>`
          : ''}
      <div class="total-row"><span>${t('subtotal')}</span><span>${money(subtotal, symbol())}</span></div>
      <div class="total-row"><span>${t('shipping')}</span>
        <span>${shipping === 0 ? t('free') : money(shipping, symbol())}</span></div>
      <div class="total-row grand"><span>${t('total')}</span><span>${money(total, symbol())}</span></div>
      <button class="btn btn-lg btn-block" data-checkout type="button" style="margin-top:14px;">${t('checkout')}</button>`;

    items.querySelectorAll('[data-inc]').forEach((b) =>
      b.addEventListener('click', () => {
        const line = lines.find((l) => l.product.id === Number(b.dataset.inc));
        cart.setQty(line.product.id, line.qty + 1);
        paint();
      }));
    items.querySelectorAll('[data-dec]').forEach((b) =>
      b.addEventListener('click', () => {
        const line = lines.find((l) => l.product.id === Number(b.dataset.dec));
        cart.setQty(line.product.id, line.qty - 1);
        paint();
      }));
    items.querySelectorAll('[data-del]').forEach((b) =>
      b.addEventListener('click', () => {
        cart.remove(Number(b.dataset.del));
        paint();
      }));
    foot.querySelector('[data-checkout]').addEventListener('click', () => {
      close();
      openCheckout();
    });
  };

  paint();
}

/* ------------------------------------------------------------------ *
 * Checkout
 * ------------------------------------------------------------------ */
function openCheckout() {
  const lines = cartLines();
  if (lines.length === 0) return toast(t('cart_empty'), 'bad');
  const { subtotal, shipping, total } = cartTotals(lines);
  const user = state.user;

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="modal" role="dialog" aria-modal="true" aria-label="${t('checkout')}">
      <div class="modal-head">
        <h2>${t('checkout')}</h2>
        <button class="icon-btn" data-close type="button" aria-label="${t('close')}">✕</button>
      </div>
      <div class="modal-body">
        <form id="checkoutForm" novalidate>
          <div class="field">
            <label for="coName">${t('full_name')} *</label>
            <input class="input" id="coName" name="name" required maxlength="80"
                   autocomplete="name" value="${esc(user?.name || '')}">
          </div>
          <div class="grid-2">
            <div class="field">
              <label for="coPhone">${t('phone')} *</label>
              <input class="input" id="coPhone" name="phone" required inputmode="tel"
                     dir="ltr" placeholder="0599 000 000" autocomplete="tel"
                     value="${esc(user?.phone || '')}">
            </div>
            <div class="field">
              <label for="coCity">${t('city')} *</label>
              <select class="select" id="coCity" name="city" required>
                <option value="">${t('choose_city')}</option>
                ${PALESTINE_CITIES.map((c) =>
                  `<option ${user?.city === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
              </select>
            </div>
          </div>
          <div class="field">
            <label for="coAddress">${t('address')} *</label>
            <input class="input" id="coAddress" name="address" required maxlength="250"
                   placeholder="${esc(isArabic() ? 'الحي، الشارع، رقم البناية' : 'Neighbourhood, street, building')}"
                   value="${esc(user?.address || '')}">
          </div>
          <div class="field">
            <label for="coNotes">${t('notes')}</label>
            <textarea class="textarea" id="coNotes" name="notes" maxlength="500"
                      placeholder="${esc(t('notes_ph'))}"></textarea>
          </div>

          <div class="card card-pad" style="background:var(--surface-2);">
            ${lines.map(({ product, qty }) =>
              `<div class="total-row"><span>${esc(localised(product, 'name'))} × ${qty}</span>
               <span>${money(product.price * qty, symbol())}</span></div>`).join('')}
            <div class="total-row" style="margin-top:8px;"><span>${t('shipping')}</span>
              <span>${shipping === 0 ? t('free') : money(shipping, symbol())}</span></div>
            <div class="total-row grand"><span>${t('total')}</span><span>${money(total, symbol())}</span></div>
          </div>
          <p class="error-text" id="coError" hidden></p>
        </form>
      </div>
      <div class="modal-foot">
        <button class="btn btn-ghost" data-close type="button">${t('back')}</button>
        <button class="btn btn-lg" id="coSubmit" type="submit" form="checkoutForm">✓ ${t('place_order')}</button>
      </div>
    </div>`;

  const close = openOverlay(overlay);
  overlay.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', close));

  overlay.querySelector('#checkoutForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const form = event.target;
    const errorBox = overlay.querySelector('#coError');
    const submit = overlay.querySelector('#coSubmit');

    /* Highlight anything missing before troubling the server. */
    let firstBad = null;
    for (const field of ['coName', 'coPhone', 'coCity', 'coAddress']) {
      const input = overlay.querySelector(`#${field}`);
      const empty = !input.value.trim();
      input.classList.toggle('is-error', empty);
      if (empty && !firstBad) firstBad = input;
    }
    if (firstBad) {
      errorBox.hidden = false;
      errorBox.textContent = t('required');
      firstBad.focus();
      return;
    }

    submit.disabled = true;
    submit.innerHTML = '<span class="spinner"></span>';
    errorBox.hidden = true;

    try {
      const { order } = await api.post('/api/orders', {
        name: form.name.value,
        phone: form.phone.value,
        city: form.city.value,
        address: form.address.value,
        notes: form.notes.value,
        items: lines.map((l) => ({ id: l.product.id, qty: l.qty })),
      });
      cart.clear();
      close();
      showOrderConfirmation(order);
      /* Stock has changed — refresh the catalogue quietly. */
      api.get('/api/shop').then((d) => {
        state.products = d.products;
        render();
        paintFeatured();
      }).catch(() => {});
    } catch (err) {
      errorBox.hidden = false;
      errorBox.textContent = err.message;
      submit.disabled = false;
      submit.innerHTML = `✓ ${t('place_order')}`;
    }
  });
}

function showOrderConfirmation(order) {
  const whatsapp = String(state.settings.whatsapp || '').replace(/\D/g, '');
  const lines = order.items.map((i) => `• ${i.name} × ${i.qty} — ${money(i.price * i.qty, symbol())}`);
  const message = [
    `${isArabic() ? 'طلب جديد' : 'New order'} #${order.order_no}`,
    `${order.customer_name} — ${order.phone}`,
    `${order.city} — ${order.address}`,
    '',
    ...lines,
    '',
    `${t('shipping')}: ${order.shipping === 0 ? t('free') : money(order.shipping, symbol())}`,
    `${t('total')}: ${money(order.total, symbol())}`,
  ].join('\n');

  const overlay = document.createElement('div');
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="modal" style="max-width:460px;" role="dialog" aria-modal="true">
      <div class="modal-body" style="text-align:center;padding:34px 26px;">
        <div style="font-size:52px;line-height:1;margin-bottom:10px;">🎉</div>
        <h2 style="font-family:var(--font-display);font-size:23px;margin-bottom:8px;">${t('order_placed')}</h2>
        <p style="color:var(--ink-soft);">${t('order_thanks')}</p>
        <div class="sent-to" style="margin:18px 0;">
          ${t('order_no')}<strong style="font-size:19px;">#${esc(order.order_no)}</strong>
        </div>
        <div class="total-row grand" style="border:0;margin:0 0 18px;">
          <span>${t('total')}</span><span>${money(order.total, symbol())}</span>
        </div>
        ${whatsapp ? `<a class="btn btn-lg btn-block" style="background:#25D366;margin-bottom:10px;"
             href="https://wa.me/${esc(whatsapp)}?text=${encodeURIComponent(message)}"
             target="_blank" rel="noopener">💬 ${t('send_whatsapp')}</a>` : ''}
        <button class="btn btn-ghost btn-block" data-close type="button">${t('continue_shopping')}</button>
      </div>
    </div>`;

  const close = openOverlay(overlay);
  overlay.querySelector('[data-close]').addEventListener('click', close);
}

boot();
