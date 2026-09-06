/**
 * دار الكحل — the shop front.
 *
 * Everything it knows comes from the API, and every change goes straight back
 * there. There is no "save" step and no local copy of the shop to keep in
 * step: a price edited on a phone is the price the next customer sees.
 */
(function () {
  'use strict';

  var app = document.getElementById('app');

  var shop = null;      // { settings, categories, products, signedIn }
  var desk = null;      // the back office extras: stats, orders, defaultPassword
  var owner = false;
  var basket = [];
  var filter = { cat: '', q: '', sort: 'new' };

  var BASKET_KEY = 'dk.basket';
  var SORTS = [
    ['new', 'الأحدث'],
    ['low', 'السعر: من الأقل'],
    ['high', 'السعر: من الأعلى'],
    ['sale', 'الأكثر خصماً'],
  ];
  var CITIES = ['القدس', 'رام الله', 'البيرة', 'نابلس', 'الخليل', 'بيت لحم', 'بيت جالا', 'بيت ساحور',
    'جنين', 'طولكرم', 'قلقيلية', 'أريحا', 'سلفيت', 'طوباس', 'غزة', 'خان يونس', 'رفح', 'دير البلح',
    'الناصرة', 'حيفا', 'يافا', 'عكا', 'أم الفحم', 'الطيبة'];
  var STATUS = {
    new: 'جديد', confirmed: 'مؤكّد', sent: 'في الطريق', delivered: 'وصل', cancelled: 'ملغى',
  };

  try { basket = JSON.parse(localStorage.getItem(BASKET_KEY) || '[]') || []; } catch (e) { basket = []; }
  function keepBasket() { try { localStorage.setItem(BASKET_KEY, JSON.stringify(basket)); } catch (e) {} }

  /* ================= talking to the shop ================= */

  function api(method, path, body) {
    return fetch('/api' + path, {
      method: method,
      headers: body ? { 'content-type': 'application/json' } : {},
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (res.ok) return data;
        var err = new Error(data.error || 'تعذّر الاتصال بالمتجر');
        err.status = res.status;
        throw err;
      });
    });
  }

  function load() {
    return api('GET', '/shop').then(function (data) {
      shop = data;
      owner = Boolean(data.signedIn);
      if (!owner) { desk = null; return null; }
      return api('GET', '/desk').then(function (full) {
        shop = full;
        desk = full;
      });
    }).then(function () {
      render();
    })['catch'](function (err) {
      app.innerHTML = '<div class="loading"><p>' + esc(err.message) + '</p>'
        + '<p style="margin-top:12px"><button class="btn" id="retry">إعادة المحاولة</button></p></div>';
      var retry = document.getElementById('retry');
      if (retry) retry.addEventListener('click', function () { load(); });
    });
  }

  /* ================= helpers ================= */

  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function ils(n) {
    var v = Number(n) || 0;
    return (Math.abs(v % 1) < 0.005 ? Math.round(v).toLocaleString('en-US') : v.toFixed(2)) + ' ₪';
  }
  function byId(id) {
    return shop.products.filter(function (p) { return p.id === id; })[0];
  }
  function cat(slug) {
    return shop.categories.filter(function (c) { return c.slug === slug; })[0];
  }
  function catName(slug) { var c = cat(slug); return c ? c.name : ''; }
  function catIcon(slug) { var c = cat(slug); return c ? c.icon : '◆'; }
  function tint(p) { return (p.id * 47) % 360; }
  function photoUrl(ref) {
    // An id from the server, or a data: URI still waiting to be uploaded.
    return /^data:image\//.test(ref) ? ref : '/photo/' + encodeURIComponent(ref);
  }

  function toast(msg, kind) {
    var host = document.getElementById('toasts');
    var el = document.createElement('div');
    el.className = 'toast' + (kind ? ' ' + kind : '');
    el.textContent = msg;
    host.appendChild(el);
    setTimeout(function () {
      el.style.transition = 'opacity .25s';
      el.style.opacity = '0';
      setTimeout(function () { el.remove(); }, 260);
    }, 3600);
  }

  /** A button that means it: disabled and labelled while the request is out. */
  function busy(button, label) {
    if (!button) return function () {};
    var was = button.textContent;
    button.disabled = true;
    button.textContent = label || 'لحظة…';
    return function () { button.disabled = false; button.textContent = was; };
  }

  function wash(p, glyph) {
    return '<div class="wash"><i class="wash-bg" style="filter:hue-rotate(' + tint(p) + 'deg)"></i>'
      + '<em>' + esc(glyph || catIcon(p.cat)) + '</em>'
      + (p.house ? '<span>' + esc(p.house) + '</span>' : '') + '</div>';
  }
  function facePhoto(p, big) {
    var first = (p.photos || [])[0];
    return first
      ? '<img src="' + esc(photoUrl(first)) + '" alt="' + esc(p.name) + '"' + (big ? '' : ' loading="lazy"') + '>'
      : wash(p);
  }

  /* ================= basket ================= */

  function lines() {
    return basket.map(function (b) {
      var p = byId(b.id);
      if (!p || !p.live || p.stock <= 0) return null;
      return { p: p, qty: Math.max(1, Math.min(b.qty, p.stock)) };
    }).filter(Boolean);
  }
  function totals(ls) {
    var sub = ls.reduce(function (s, l) { return s + l.p.price * l.qty; }, 0);
    var free = Number(shop.settings.freeOver) || 0;
    var flat = Number(shop.settings.shipping) || 0;
    var ship = ls.length === 0 ? 0 : (free > 0 && sub >= free ? 0 : flat);
    return { sub: sub, ship: ship, sum: sub + ship, free: free };
  }
  function count() { return lines().reduce(function (n, l) { return n + l.qty; }, 0); }

  function addToBasket(id, qty) {
    var p = byId(id);
    if (!p || p.stock <= 0) return;
    var found = basket.filter(function (b) { return b.id === id; })[0];
    if (found) found.qty = Math.min(p.stock, found.qty + (qty || 1));
    else basket.push({ id: id, qty: Math.min(p.stock, qty || 1) });
    keepBasket();
    refreshCart();
    toast('أُضيف إلى السلة', 'good');
  }
  function refreshCart() {
    var host = document.getElementById('cartCount');
    if (!host) return;
    var n = count();
    host.innerHTML = n ? '<b class="num">' + n + '</b>' : '';
  }

  /* ================= sheets ================= */

  function openSheet(html, cls) {
    var scrim = document.createElement('div');
    scrim.className = 'scrim';
    scrim.innerHTML = '<div class="sheet ' + (cls || '') + '" role="dialog" aria-modal="true">' + html + '</div>';
    document.body.appendChild(scrim);
    document.body.style.overflow = 'hidden';

    var sheet = scrim.firstElementChild;
    var came = document.activeElement;

    function reachable() {
      var sel = 'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),'
        + 'textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
      return Array.prototype.slice.call(sheet.querySelectorAll(sel))
        .filter(function (el) { return el.offsetParent !== null; });
    }
    function shut() {
      scrim.remove();
      document.removeEventListener('keydown', onKey);
      if (!document.querySelector('.scrim')) document.body.style.overflow = '';
      if (came && came.focus) { try { came.focus({ preventScroll: true }); } catch (e) {} }
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); shut(); return; }
      if (e.key !== 'Tab') return;
      var f = reachable();
      if (!f.length) return;
      var first = f[0];
      var last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKey);
    scrim.addEventListener('mousedown', function (e) { if (e.target === scrim) shut(); });
    scrim.querySelectorAll('[data-shut]').forEach(function (b) { b.addEventListener('click', shut); });
    setTimeout(function () {
      var wanted = sheet.querySelector('[data-focus]') || reachable()[0];
      // Not on a phone: focusing a field there throws the keyboard up over the
      // sheet before anyone has read it.
      if (wanted && window.innerWidth > 620) wanted.focus();
    }, 40);

    return { root: scrim, shut: shut, q: function (s) { return scrim.querySelector(s); } };
  }

  /* ---------- sign in ---------- */

  function showSignIn() {
    if (owner) return;
    var sheet = openSheet(
      '<div class="sheet-head"><h3>تسجيل الدخول</h3><button class="x" data-shut aria-label="إغلاق">✕</button></div>'
      + '<div class="sheet-body">'
        + '<div id="inErr"></div>'
        + '<div class="f"><label for="inMail">البريد الإلكتروني</label>'
          + '<input id="inMail" type="email" dir="ltr" autocomplete="username" data-focus></div>'
        + '<div class="f" style="margin-bottom:0"><label for="inPass">كلمة المرور</label>'
          + '<input id="inPass" type="password" dir="ltr" autocomplete="current-password"></div>'
      + '</div>'
      + '<div class="sheet-foot"><button class="btn btn-line" data-shut>إلغاء</button>'
      + '<button class="btn" id="inGo">دخول</button></div>', 'sheet-slim');

    function attempt() {
      var mail = sheet.q('#inMail').value;
      var pass = sheet.q('#inPass').value;
      if (!mail || !pass) {
        sheet.q('#inErr').innerHTML = '<div class="alert">أدخلي البريد الإلكتروني وكلمة المرور.</div>';
        return;
      }
      var done = busy(sheet.q('#inGo'), 'جارٍ التحقّق…');
      api('POST', '/session', { email: mail, password: pass }).then(function () {
        sheet.shut();
        return load();
      }).then(function () {
        window.scrollTo(0, 0);
        toast('أهلاً بكِ في لوحة التحكم', 'good');
      })['catch'](function (err) {
        done();
        sheet.q('#inErr').innerHTML = '<div class="alert">' + esc(err.message) + '</div>';
      });
    }
    sheet.q('#inGo').addEventListener('click', attempt);
    sheet.root.querySelectorAll('#inMail, #inPass').forEach(function (el) {
      el.addEventListener('keydown', function (e) {
        if (e.key === 'Enter') { e.preventDefault(); attempt(); }
      });
    });
  }

  function signOut() {
    api('DELETE', '/session').then(function () {
      owner = false;
      return load();
    }).then(function () {
      toast('تم تسجيل الخروج');
    })['catch'](function (err) { toast(err.message, 'bad'); });
  }

  /* ---------- product detail ---------- */

  function showProduct(id) {
    var p = byId(id);
    if (!p) return;
    var photos = (p.photos || []).map(photoUrl);
    var qty = 1;
    var sale = p.was > p.price;

    var sheet = openSheet(
      '<div class="sheet-head"><h3>' + esc(catName(p.cat) || 'المنتج') + '</h3>'
      + '<button class="x" data-shut aria-label="إغلاق">✕</button></div>'
      + '<div class="sheet-body"><div class="detail">'
        + '<div><div class="detail-shot">'
          + (photos.length
            ? '<img id="bigshot" src="' + esc(photos[0]) + '" alt="' + esc(p.name) + '">'
            : wash(p))
        + '</div>'
        + (photos.length > 1
          ? '<div class="thumbs">' + photos.map(function (u, i) {
            return '<button data-pick="' + esc(u) + '" aria-current="' + (i === 0) + '">'
              + '<img src="' + esc(u) + '" alt=""></button>';
          }).join('') + '</div>'
          : '')
        + '</div>'
        + '<div>'
          + (p.house ? '<div class="house">' + esc(p.house) + '</div>' : '')
          + '<h4>' + esc(p.name) + '</h4>'
          + '<div class="detail-cost"><b class="num">' + ils(p.price) + '</b>'
            + (sale
              ? '<s class="num">' + ils(p.was) + '</s>'
                + '<span class="badge">وفّري ' + Math.round((1 - p.price / p.was) * 100) + '٪</span>'
              : '') + '</div>'
          + '<dl class="spec">'
            + '<div><dt>التوفّر</dt><dd>' + (p.stock > 0
              ? '<span class="state ' + (p.stock <= 3 ? 's-low' : 's-ok') + '">'
                + (p.stock <= 3 ? 'باقٍ ' + p.stock + ' فقط' : 'متوفّر') + '</span>'
              : '<span class="state s-gone">نفدت الكمية</span>') + '</dd></div>'
            + '<div><dt>القسم</dt><dd>' + esc(catName(p.cat)) + '</dd></div>'
            + '<div><dt>التوصيل</dt><dd>' + esc(shop.settings.days || '2 – 4') + ' أيام</dd></div>'
          + '</dl>'
          + '<p class="blurb">' + esc(p.blurb || 'لا يوجد وصف لهذا المنتج بعد.') + '</p>'
          + (p.stock > 0
            ? '<div style="display:flex;gap:10px;align-items:center;margin-top:20px;flex-wrap:wrap">'
              + '<div class="stepper"><button data-step="-1" aria-label="إنقاص">−</button>'
              + '<span id="qty" class="num">1</span>'
              + '<button data-step="1" aria-label="زيادة">+</button></div>'
              + '<button class="btn" id="toBasket" style="flex:1;min-width:150px">أضيفي إلى السلة</button>'
              + '</div>'
            : '<p style="margin-top:20px" class="state s-gone">نفدت الكمية حالياً</p>')
        + '</div>'
      + '</div></div>', 'sheet-wide');

    sheet.root.querySelectorAll('[data-pick]').forEach(function (b) {
      b.addEventListener('click', function () {
        sheet.q('#bigshot').src = b.getAttribute('data-pick');
        sheet.root.querySelectorAll('[data-pick]').forEach(function (o) { o.setAttribute('aria-current', 'false'); });
        b.setAttribute('aria-current', 'true');
      });
    });
    sheet.root.querySelectorAll('[data-step]').forEach(function (b) {
      b.addEventListener('click', function () {
        qty = Math.max(1, Math.min(p.stock, qty + Number(b.getAttribute('data-step'))));
        sheet.q('#qty').textContent = qty;
      });
    });
    var add = sheet.q('#toBasket');
    if (add) add.addEventListener('click', function () { addToBasket(p.id, qty); sheet.shut(); });
  }

  /* ---------- basket ---------- */

  function showBasket() {
    var sheet = openSheet(
      '<div class="sheet-head"><h3>السلة</h3><button class="x" data-shut aria-label="إغلاق">✕</button></div>'
      + '<div class="sheet-body" id="cartBody"></div>'
      + '<div class="sheet-foot" id="cartFoot" style="justify-content:stretch"></div>');

    function paint() {
      var ls = lines();
      var body = sheet.q('#cartBody');
      var foot = sheet.q('#cartFoot');

      if (ls.length === 0) {
        body.innerHTML = '<div class="blank"><h4>السلة فارغة</h4>'
          + '<p>أضيفي ما يعجبكِ من المتجر وسنجهّز الطلب.</p></div>';
        foot.innerHTML = '<button class="btn btn-line btn-wide" id="keepOn">متابعة التسوق</button>';
        foot.querySelector('#keepOn').addEventListener('click', sheet.shut);
        return;
      }

      body.innerHTML = ls.map(function (l) {
        return '<div class="line">'
          + '<div class="line-shot">' + facePhoto(l.p) + '</div>'
          + '<div class="line-info"><div class="line-name">' + esc(l.p.name) + '</div>'
            + '<div class="line-sub">' + ils(l.p.price) + ' × ' + l.qty + ' = ' + ils(l.p.price * l.qty) + '</div>'
            + '<div class="line-act"><div class="stepper">'
              + '<button data-less="' + l.p.id + '"' + (l.qty <= 1 ? ' disabled' : '') + ' aria-label="إنقاص">−</button>'
              + '<span>' + l.qty + '</span>'
              + '<button data-more="' + l.p.id + '"' + (l.qty >= l.p.stock ? ' disabled' : '') + ' aria-label="زيادة">+</button>'
            + '</div><button class="pull" data-drop="' + l.p.id + '">حذف</button></div>'
          + '</div></div>';
      }).join('');

      var t = totals(ls);
      var gap = Math.max(0, t.free - t.sub);
      foot.innerHTML = '<div style="width:100%">'
        + (t.free > 0
          ? '<div class="meter">'
            + (t.ship === 0
              ? '<p class="done">التوصيل مجاني على هذا الطلب</p>'
              : '<p>أضيفي ' + ils(gap) + ' ليصبح التوصيل مجانياً</p>')
            + '<div><i style="width:' + Math.min(100, Math.round(t.sub / t.free * 100)) + '%"></i></div>'
          + '</div>'
          : '')
        + '<div class="tally"><span>المجموع</span><span>' + ils(t.sub) + '</span></div>'
        + '<div class="tally"><span>التوصيل</span><span>' + (t.ship === 0 ? 'مجاني' : ils(t.ship)) + '</span></div>'
        + '<div class="tally sum"><span>الإجمالي</span><span>' + ils(t.sum) + '</span></div>'
        + '<button class="btn btn-wide" id="toOrder" style="margin-top:13px">إتمام الطلب</button></div>';

      body.querySelectorAll('[data-more]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = Number(b.getAttribute('data-more'));
          var entry = basket.filter(function (x) { return x.id === id; })[0];
          var p = byId(id);
          if (entry && p) { entry.qty = Math.min(p.stock, entry.qty + 1); keepBasket(); paint(); refreshCart(); }
        });
      });
      body.querySelectorAll('[data-less]').forEach(function (b) {
        b.addEventListener('click', function () {
          var entry = basket.filter(function (x) { return x.id === Number(b.getAttribute('data-less')); })[0];
          if (entry) { entry.qty = Math.max(1, entry.qty - 1); keepBasket(); paint(); refreshCart(); }
        });
      });
      body.querySelectorAll('[data-drop]').forEach(function (b) {
        b.addEventListener('click', function () {
          basket = basket.filter(function (x) { return x.id !== Number(b.getAttribute('data-drop')); });
          keepBasket(); paint(); refreshCart();
        });
      });
      foot.querySelector('#toOrder').addEventListener('click', function () { sheet.shut(); showOrder(); });
    }
    paint();
  }

  /* ---------- checkout ---------- */

  function showOrder() {
    var ls = lines();
    if (ls.length === 0) { toast('السلة فارغة', 'bad'); return; }
    var t = totals(ls);
    var wa = String(shop.settings.whatsapp || '').replace(/\D/g, '');

    var sheet = openSheet(
      '<div class="sheet-head"><h3>إتمام الطلب</h3><button class="x" data-shut aria-label="إغلاق">✕</button></div>'
      + '<div class="sheet-body">'
        + '<div id="oErr"></div>'
        + '<div class="f"><label for="oName">الاسم الكامل</label>'
          + '<input id="oName" maxlength="80" autocomplete="name" data-focus></div>'
        + '<div class="two">'
          + '<div class="f"><label for="oPhone">رقم الهاتف</label>'
            + '<input id="oPhone" dir="ltr" inputmode="tel" placeholder="0599 000 000" autocomplete="tel"></div>'
          + '<div class="f"><label for="oCity">المدينة</label><select id="oCity">'
            + '<option value="">اختاري المدينة</option>'
            + CITIES.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select></div>'
        + '</div>'
        + '<div class="f"><label for="oAddr">العنوان بالتفصيل</label>'
          + '<input id="oAddr" maxlength="200" placeholder="الحي، الشارع، رقم البناية"></div>'
        + '<div class="f"><label for="oNote">ملاحظات (اختياري)</label>'
          + '<textarea id="oNote" maxlength="300" placeholder="مثلاً: التوصيل بعد الساعة ٤ عصراً"></textarea></div>'
        + '<div style="background:var(--sunken);border:1px solid var(--line);border-radius:var(--r-m);padding:15px">'
          + ls.map(function (l) {
            return '<div class="tally"><span>' + esc(l.p.name) + ' × ' + l.qty + '</span>'
              + '<span>' + ils(l.p.price * l.qty) + '</span></div>';
          }).join('')
          + '<div class="tally"><span>التوصيل</span><span>' + (t.ship === 0 ? 'مجاني' : ils(t.ship)) + '</span></div>'
          + '<div class="tally sum"><span>الإجمالي</span><span>' + ils(t.sum) + '</span></div>'
        + '</div>'
        + '<p style="margin-top:13px;color:var(--ink-mute);font-size:12.5px">'
          + 'الدفع عند الاستلام. الطلب يصل المتجر فور إرساله، ونتواصل معكِ لتأكيده.</p>'
      + '</div>'
      + '<div class="sheet-foot"><button class="btn btn-line" data-shut>رجوع</button>'
      + '<button class="btn" id="sendOrder">إرسال الطلب</button></div>');

    sheet.q('#sendOrder').addEventListener('click', function () {
      var who = {
        customer: sheet.q('#oName').value.trim(),
        phone: sheet.q('#oPhone').value.trim(),
        city: sheet.q('#oCity').value,
        address: sheet.q('#oAddr').value.trim(),
        note: sheet.q('#oNote').value.trim(),
        items: ls.map(function (l) { return { id: l.p.id, qty: l.qty }; }),
      };
      var done = busy(sheet.q('#sendOrder'), 'جارٍ الإرسال…');
      api('POST', '/orders', who).then(function (order) {
        basket = [];
        keepBasket();
        sheet.shut();
        // The order is already recorded; WhatsApp is the receipt, not the till.
        if (wa) {
          var msg = ['طلب ' + order.ref + ' — ' + shop.settings.name_ar, '',
            'الاسم: ' + who.customer, 'الهاتف: ' + who.phone,
            'المدينة: ' + who.city, 'العنوان: ' + who.address];
          if (who.note) msg.push('ملاحظات: ' + who.note);
          msg.push('');
          order.items.forEach(function (i) {
            msg.push('• ' + i.name + ' × ' + i.qty + ' — ' + ils(i.price * i.qty));
          });
          msg.push('');
          msg.push('التوصيل: ' + (order.shipping === 0 ? 'مجاني' : ils(order.shipping)));
          msg.push('الإجمالي: ' + ils(order.total));
          window.open('https://wa.me/' + wa + '?text=' + encodeURIComponent(msg.join('\n')), '_blank', 'noopener');
        }
        showThanks(order);
        return load();
      })['catch'](function (err) {
        done();
        sheet.q('#oErr').innerHTML = '<div class="alert">' + esc(err.message) + '</div>';
      });
    });
  }

  function showThanks(order) {
    openSheet(
      '<div class="sheet-head"><h3>وصلنا طلبكِ</h3><button class="x" data-shut aria-label="إغلاق">✕</button></div>'
      + '<div class="sheet-body"><div class="blank">'
        + '<h4>شكراً لكِ</h4>'
        + '<p>رقم الطلب <b class="num">' + esc(order.ref) + '</b></p>'
        + '<p style="margin-top:10px">الإجمالي ' + ils(order.total)
          + ' · الدفع عند الاستلام.<br>سنتواصل معكِ على الرقم الذي كتبتِه لتأكيد الموعد.</p>'
      + '</div></div>'
      + '<div class="sheet-foot"><button class="btn btn-wide" data-shut>تمام</button></div>', 'sheet-slim');
  }

  /* ---------- photographs ---------- */

  function shrink(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onerror = function () { reject(new Error('read')); };
      reader.onload = function () {
        var img = new Image();
        img.onerror = function () { reject(new Error('decode')); };
        img.onload = function () {
          var max = 900;
          var k = Math.min(1, max / Math.max(img.width, img.height));
          var c = document.createElement('canvas');
          c.width = Math.round(img.width * k);
          c.height = Math.round(img.height * k);
          var g = c.getContext('2d');
          g.fillStyle = '#ffffff';
          g.fillRect(0, 0, c.width, c.height);
          g.drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', 0.72));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  /* ---------- the product editor ---------- */

  function editProduct(id) {
    if (!owner) return;
    var existing = id ? byId(id) : null;
    var draft = existing
      ? JSON.parse(JSON.stringify(existing))
      : {
        id: 0, cat: shop.categories[0] ? shop.categories[0].slug : '', house: '', name: '', blurb: '',
        price: 0, was: 0, cost: 0, stock: 0, live: true, pick: false, photos: [],
      };
    var startedWith = (existing ? existing.photos : []).slice();

    var sheet = openSheet(
      '<div class="sheet-head"><h3>' + (existing ? 'تعديل منتج' : 'منتج جديد') + '</h3>'
      + (existing ? '<span class="house">' + esc(existing.sku) + '</span>' : '')
      + '<button class="x" data-shut aria-label="إغلاق">✕</button></div>'
      + '<div class="sheet-body">'
        + '<div id="eErr"></div>'
        + '<div class="f"><label for="eName">اسم المنتج</label>'
          + '<input id="eName" maxlength="120" value="' + esc(draft.name) + '" data-focus></div>'
        + '<div class="f"><label for="eBlurb">الوصف</label>'
          + '<textarea id="eBlurb" maxlength="1200">' + esc(draft.blurb) + '</textarea></div>'
        + '<div class="two">'
          + '<div class="f"><label for="eHouse">الماركة</label>'
            + '<input id="eHouse" maxlength="60" value="' + esc(draft.house) + '"></div>'
          + '<div class="f"><label for="eCat">القسم</label><select id="eCat">'
            + shop.categories.map(function (c) {
              return '<option value="' + esc(c.slug) + '"' + (c.slug === draft.cat ? ' selected' : '') + '>'
                + esc(c.name) + '</option>';
            }).join('') + '</select></div>'
        + '</div>'
        + '<div class="three">'
          + '<div class="f"><label for="ePrice">سعر البيع (₪)</label>'
            + '<input id="ePrice" type="number" min="0" step="0.5" dir="ltr" value="' + (draft.price || '') + '"></div>'
          + '<div class="f"><label for="eWas">السعر قبل الخصم</label>'
            + '<input id="eWas" type="number" min="0" step="0.5" dir="ltr" value="' + (draft.was || '') + '"></div>'
          + '<div class="f"><label for="eCost">تكلفة الشراء ($)</label>'
            + '<input id="eCost" type="number" min="0" step="0.1" dir="ltr" value="' + (draft.cost || '') + '"></div>'
        + '</div>'
        + '<div id="eMargin"></div>'
        + '<div class="two">'
          + '<div class="f"><label for="eStock">الكمية المتوفّرة</label>'
            + '<input id="eStock" type="number" min="0" dir="ltr" value="' + (draft.stock || 0) + '"></div>'
          + '<div class="f" style="display:flex;flex-direction:column;justify-content:center;gap:2px">'
            + '<label class="check"><input type="checkbox" id="eLive"' + (draft.live ? ' checked' : '') + '>'
              + '<span class="box"></span><span>معروض في المتجر</span></label>'
            + '<label class="check"><input type="checkbox" id="ePick"' + (draft.pick ? ' checked' : '') + '>'
              + '<span class="box"></span><span>منتج مميّز</span></label>'
          + '</div>'
        + '</div>'
        + '<div class="f"><span class="flabel">الصور</span>'
          + '<div class="drop" id="eDrop" tabindex="0" role="button"><p>اضغطي لاختيار الصور أو اسحبيها هنا</p>'
          + '<small>الصورة الأولى هي الرئيسية · حتى ٦ صور</small></div>'
          + '<input type="file" id="eFile" accept="image/*" multiple hidden>'
          + '<div class="shots" id="eShots"></div></div>'
      + '</div>'
      + '<div class="sheet-foot">'
        + (existing ? '<button class="btn btn-danger" id="eDelete" style="margin-inline-end:auto">حذف المنتج</button>' : '')
        + '<button class="btn btn-line" data-shut>إلغاء</button>'
        + '<button class="btn" id="eSave">' + (existing ? 'حفظ' : 'إضافة') + '</button>'
      + '</div>', 'sheet-wide');

    function paintMargin() {
      var price = Number(sheet.q('#ePrice').value) || 0;
      var rate = Number(shop.settings.usdRate) || 3.7;
      var cost = (Number(sheet.q('#eCost').value) || 0) * rate;
      var host = sheet.q('#eMargin');
      if (!price || !cost) { host.innerHTML = ''; return; }
      var gain = price - cost;
      host.innerHTML = '<div class="readout' + (gain <= 0 ? ' warn' : '') + '">'
        + (gain > 0
          ? 'ربح ' + ils(gain) + ' على القطعة · هامش ' + Math.round(gain / price * 100) + '٪'
          : 'سعر البيع أقل من التكلفة (' + ils(cost) + ')') + '</div>';
    }
    sheet.q('#ePrice').addEventListener('input', paintMargin);
    sheet.q('#eCost').addEventListener('input', paintMargin);
    paintMargin();

    function paintShots() {
      sheet.q('#eShots').innerHTML = draft.photos.map(function (ref, i) {
        return '<div class="mini"><img src="' + esc(photoUrl(ref)) + '" alt="">'
          + '<button data-x="' + i + '" aria-label="حذف الصورة">✕</button>'
          + (i === 0 ? '<em>رئيسية</em>' : '') + '</div>';
      }).join('');
      sheet.q('#eShots').querySelectorAll('[data-x]').forEach(function (b) {
        b.addEventListener('click', function () {
          draft.photos.splice(Number(b.getAttribute('data-x')), 1);
          paintShots();
        });
      });
    }
    paintShots();

    function takeFiles(list) {
      var files = Array.prototype.slice.call(list)
        .filter(function (f) { return f.type.indexOf('image/') === 0; });
      if (!files.length) return;
      if (draft.photos.length + files.length > 6) { toast('الحد الأقصى ٦ صور للمنتج', 'bad'); return; }
      var drop = sheet.q('#eDrop');
      var was = drop.innerHTML;
      drop.innerHTML = '<p>جارٍ معالجة الصور…</p>';
      Promise.all(files.map(function (f) {
        return shrink(f)['catch'](function () { return null; });
      })).then(function (urls) {
        urls.forEach(function (u) { if (u) draft.photos.push(u); });
        drop.innerHTML = was;
        paintShots();
      });
    }
    sheet.q('#eDrop').addEventListener('click', function () { sheet.q('#eFile').click(); });
    sheet.q('#eDrop').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sheet.q('#eFile').click(); }
    });
    sheet.q('#eFile').addEventListener('change', function (e) { takeFiles(e.target.files); e.target.value = ''; });
    ['dragenter', 'dragover'].forEach(function (t) {
      sheet.q('#eDrop').addEventListener(t, function (e) {
        e.preventDefault(); sheet.q('#eDrop').classList.add('over');
      });
    });
    ['dragleave', 'drop'].forEach(function (t) {
      sheet.q('#eDrop').addEventListener(t, function (e) {
        e.preventDefault();
        sheet.q('#eDrop').classList.remove('over');
        if (t === 'drop') takeFiles(e.dataTransfer.files);
      });
    });

    var del = sheet.q('#eDelete');
    if (del) del.addEventListener('click', function () {
      if (!confirm('حذف «' + draft.name + '» من المتجر؟')) return;
      var done = busy(del, 'جارٍ الحذف…');
      api('DELETE', '/products/' + existing.id).then(function () {
        basket = basket.filter(function (b) { return b.id !== existing.id; });
        keepBasket();
        sheet.shut();
        return load();
      }).then(function () { toast('حُذف المنتج', 'good'); })
      ['catch'](function (err) { done(); toast(err.message, 'bad'); });
    });

    sheet.q('#eSave').addEventListener('click', function () {
      var payload = {
        name: sheet.q('#eName').value.trim(),
        blurb: sheet.q('#eBlurb').value.trim(),
        house: sheet.q('#eHouse').value.trim(),
        cat: sheet.q('#eCat').value,
        price: sheet.q('#ePrice').value,
        was: sheet.q('#eWas').value,
        cost: sheet.q('#eCost').value,
        stock: sheet.q('#eStock').value,
        live: sheet.q('#eLive').checked,
        pick: sheet.q('#ePick').checked,
      };
      var done = busy(sheet.q('#eSave'), 'جارٍ الحفظ…');
      var save = existing
        ? api('PATCH', '/products/' + existing.id, payload)
        : api('POST', '/products', payload);

      save.then(function (res) {
        var pid = res.product.id;
        var dropped = startedWith.filter(function (ref) { return draft.photos.indexOf(ref) === -1; });
        var added = draft.photos.filter(function (ref) { return /^data:image\//.test(ref); });
        // One at a time: a photograph is a few hundred kilobytes, and six of
        // them in one request is a body no phone on a slow line will finish.
        return dropped.reduce(function (chain, ref) {
          return chain.then(function () { return api('DELETE', '/photos/' + ref); });
        }, Promise.resolve()).then(function () {
          return added.reduce(function (chain, data) {
            return chain.then(function () { return api('POST', '/products/' + pid + '/photos', { data: data }); });
          }, Promise.resolve());
        });
      }).then(function () {
        sheet.shut();
        return load();
      }).then(function () { toast('حُفظ المنتج', 'good'); })
      ['catch'](function (err) {
        done();
        sheet.q('#eErr').innerHTML = '<div class="alert">' + esc(err.message) + '</div>';
      });
    });
  }

  /* ---------- settings ---------- */

  function editSettings() {
    if (!owner) return;
    var s = shop.settings;
    var sheet = openSheet(
      '<div class="sheet-head"><h3>إعدادات المتجر</h3><button class="x" data-shut aria-label="إغلاق">✕</button></div>'
      + '<div class="sheet-body">'
        + '<div id="sErr"></div>'
        + '<div class="two">'
          + '<div class="f"><label for="sName">اسم المتجر</label>'
            + '<input id="sName" maxlength="60" value="' + esc(s.name_ar) + '" data-focus></div>'
          + '<div class="f"><label for="sNameEn">السطر الإنجليزي</label>'
            + '<input id="sNameEn" dir="ltr" maxlength="60" value="' + esc(s.name_en) + '"></div>'
        + '</div>'
        + '<div class="f"><label for="sTag">وصف المتجر</label>'
          + '<textarea id="sTag" maxlength="220">' + esc(s.tagline) + '</textarea></div>'
        + '<div class="f"><label for="sStrip">شريط الإعلان العلوي</label>'
          + '<input id="sStrip" maxlength="120" value="' + esc(s.strip) + '"></div>'
        + '<div class="two">'
          + '<div class="f"><label for="sWa">رقم واتساب</label>'
            + '<input id="sWa" dir="ltr" inputmode="tel" value="' + esc(s.whatsapp) + '">'
            + '<p class="note">بمقدّمة الدولة وبلا + أو مسافات، مثل 970590000000</p></div>'
          + '<div class="f"><label for="sIg">حساب إنستغرام</label>'
            + '<input id="sIg" dir="ltr" maxlength="40" value="' + esc(s.instagram) + '"></div>'
        + '</div>'
        + '<div class="three">'
          + '<div class="f"><label for="sShip">أجرة التوصيل (₪)</label>'
            + '<input id="sShip" type="number" min="0" dir="ltr" value="' + s.shipping + '"></div>'
          + '<div class="f"><label for="sFree">توصيل مجاني فوق (₪)</label>'
            + '<input id="sFree" type="number" min="0" dir="ltr" value="' + s.freeOver + '"></div>'
          + '<div class="f"><label for="sDays">مدة التوصيل</label>'
            + '<input id="sDays" maxlength="12" dir="ltr" value="' + esc(s.days || '2 – 4') + '">'
            + '<p class="note">بالأيام، مثل 2 – 4</p></div>'
        + '</div>'
        + '<div class="f"><label for="sRate">سعر صرف الدولار</label>'
          + '<input id="sRate" type="number" min="0.1" step="0.01" dir="ltr" value="' + s.usdRate + '">'
          + '<p class="note">يُستعمل لحساب تكلفة المخزون والربح</p></div>'
      + '</div>'
      + '<div class="sheet-foot"><button class="btn btn-line" data-shut>إلغاء</button>'
      + '<button class="btn" id="sSave">حفظ الإعدادات</button></div>', 'sheet-wide');

    sheet.q('#sSave').addEventListener('click', function () {
      var done = busy(sheet.q('#sSave'), 'جارٍ الحفظ…');
      api('PATCH', '/settings', {
        name_ar: sheet.q('#sName').value,
        name_en: sheet.q('#sNameEn').value,
        tagline: sheet.q('#sTag').value,
        strip: sheet.q('#sStrip').value,
        whatsapp: sheet.q('#sWa').value,
        instagram: sheet.q('#sIg').value,
        shipping: sheet.q('#sShip').value,
        freeOver: sheet.q('#sFree').value,
        days: sheet.q('#sDays').value,
        usdRate: sheet.q('#sRate').value,
      }).then(function () {
        sheet.shut();
        return load();
      }).then(function () { toast('حُفظت الإعدادات', 'good'); })
      ['catch'](function (err) {
        done();
        sheet.q('#sErr').innerHTML = '<div class="alert">' + esc(err.message) + '</div>';
      });
    });
  }

  /* ---------- the sign-in itself ---------- */

  function editAccount() {
    if (!owner) return;
    var sheet = openSheet(
      '<div class="sheet-head"><h3>بيانات الدخول</h3><button class="x" data-shut aria-label="إغلاق">✕</button></div>'
      + '<div class="sheet-body">'
        + '<div id="aErr"></div>'
        + '<div class="f"><label for="aCur">كلمة المرور الحالية</label>'
          + '<input id="aCur" type="password" dir="ltr" autocomplete="current-password" data-focus></div>'
        + '<div class="f"><label for="aMail">البريد الإلكتروني</label>'
          + '<input id="aMail" type="email" dir="ltr" autocomplete="username" value="'
          + esc(shop.email || '') + '"></div>'
        + '<div class="two">'
          + '<div class="f"><label for="aPass">كلمة المرور الجديدة</label>'
            + '<input id="aPass" type="password" dir="ltr" autocomplete="new-password"></div>'
          + '<div class="f"><label for="aPass2">تأكيدها</label>'
            + '<input id="aPass2" type="password" dir="ltr" autocomplete="new-password"></div>'
        + '</div>'
        + '<p class="note" style="color:var(--ink-mute);font-size:12.5px">'
          + 'المتجر على الإنترنت المفتوح، فاختاري كلمة مرور لا تُخمَّن.</p>'
      + '</div>'
      + '<div class="sheet-foot"><button class="btn btn-line" data-shut>إلغاء</button>'
      + '<button class="btn" id="aSave">حفظ</button></div>', 'sheet-slim');

    sheet.q('#aSave').addEventListener('click', function () {
      var pass = sheet.q('#aPass').value;
      if (pass !== sheet.q('#aPass2').value) {
        sheet.q('#aErr').innerHTML = '<div class="alert">كلمتا المرور غير متطابقتين.</div>';
        return;
      }
      var done = busy(sheet.q('#aSave'), 'جارٍ الحفظ…');
      api('POST', '/account', {
        current: sheet.q('#aCur').value,
        email: sheet.q('#aMail').value,
        password: pass,
      }).then(function () {
        sheet.shut();
        return load();
      }).then(function () { toast('حُدّثت بيانات الدخول', 'good'); })
      ['catch'](function (err) {
        done();
        sheet.q('#aErr').innerHTML = '<div class="alert">' + esc(err.message) + '</div>';
      });
    });
  }

  /* ================= browsing ================= */

  function shown() {
    var list = shop.products.slice();
    if (filter.cat) list = list.filter(function (p) { return p.cat === filter.cat; });
    var q = filter.q.trim().toLowerCase();
    if (q) {
      list = list.filter(function (p) {
        return ((p.name || '') + ' ' + (p.house || '') + ' ' + (p.blurb || '') + ' ' + (p.sku || ''))
          .toLowerCase().indexOf(q) !== -1;
      });
    }
    function off(p) { return p.stock > 0 ? 0 : 1; }
    function disc(p) { return p.was > p.price ? 1 - p.price / p.was : 0; }
    return list.sort(function (a, b) {
      var d = off(a) - off(b);
      if (d) return d;
      if (filter.sort === 'low') return a.price - b.price;
      if (filter.sort === 'high') return b.price - a.price;
      if (filter.sort === 'sale') return disc(b) - disc(a);
      return b.id - a.id;
    });
  }

  function card(p) {
    var sale = p.was > p.price;
    var badges = '';
    if (sale) badges += '<span class="badge">وفّري ' + Math.round((1 - p.price / p.was) * 100) + '٪</span>';
    if (p.pick) badges += '<span class="badge badge-pick">اختيار الدار</span>';
    if (owner && !p.live) badges += '<span class="badge badge-off">مخفي</span>';

    return '<article class="item' + (owner && !p.live ? ' dim' : '') + '">'
      + '<button class="shot" data-open="' + p.id + '" aria-label="' + esc(p.name) + '">'
        + facePhoto(p)
        + (badges ? '<span class="badges">' + badges + '</span>' : '')
        + (p.stock <= 0 ? '<span class="veil"><span>نفدت الكمية</span></span>' : '')
      + '</button>'
      + '<div class="item-body">'
        + (p.house ? '<div class="house">' + esc(p.house) + '</div>' : '')
        + '<h3 class="item-name">' + esc(p.name) + '</h3>'
        + (p.stock > 0 && p.stock <= 3 ? '<div class="state s-low">باقٍ ' + p.stock + ' فقط</div>' : '')
        + (owner && p.stock > 3 ? '<div class="state s-ok">' + p.stock + ' في المخزن</div>' : '')
        + '<div class="item-foot"><span class="cost"><b class="num">' + ils(p.price) + '</b>'
          + (sale ? '<s class="num">' + ils(p.was) + '</s>' : '') + '</span>'
          + (owner ? '' : '<button class="plus" data-add="' + p.id + '"'
            + (p.stock <= 0 ? ' disabled' : '') + ' aria-label="أضيفي إلى السلة">+</button>')
        + '</div>'
      + '</div>'
      + (owner ? '<div class="rowbar"><button class="btn btn-quiet btn-sm" data-edit="' + p.id + '">تعديل المنتج</button></div>' : '')
    + '</article>';
  }

  function renderGrid() {
    var host = document.getElementById('gridHost');
    if (!host) return;
    var list = shown();
    if (!list.length && !owner) {
      host.innerHTML = '<div class="blank"><h4>لا يوجد ما يطابق البحث</h4>'
        + '<p>جرّبي قسماً آخر أو كلمة مختلفة.</p></div>';
      return;
    }
    host.innerHTML = '<div class="grid">'
      + (owner ? '<button class="newcard" id="addProduct"><span>+</span><span>إضافة منتج</span></button>' : '')
      + list.map(card).join('') + '</div>';

    var add = host.querySelector('#addProduct');
    if (add) add.addEventListener('click', function () { editProduct(0); });
    host.querySelectorAll('[data-open]').forEach(function (b) {
      b.addEventListener('click', function () { showProduct(Number(b.getAttribute('data-open'))); });
    });
    host.querySelectorAll('[data-add]').forEach(function (b) {
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        addToBasket(Number(b.getAttribute('data-add')), 1);
      });
    });
    host.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { editProduct(Number(b.getAttribute('data-edit'))); });
    });
  }

  /* ================= the back office ================= */

  function orderCard(o) {
    var next = { new: 'confirmed', confirmed: 'sent', sent: 'delivered' }[o.status];
    var nextLabel = { confirmed: 'تأكيد الطلب', sent: 'أرسلته', delivered: 'وصل' }[next];
    var wa = String(o.phone || '').replace(/\D/g, '');
    return '<div class="order">'
      + '<div class="order-top">'
        + '<span class="pill pill-' + esc(o.status) + '">' + esc(STATUS[o.status] || o.status) + '</span>'
        + '<span class="order-who">' + esc(o.customer) + '</span>'
        + '<span class="order-ref">' + esc(o.ref) + '</span>'
        + '<span class="order-total">' + ils(o.total) + '</span>'
      + '</div>'
      + '<div class="order-lines">' + o.items.map(function (i) {
        return esc(i.name) + ' × ' + i.qty;
      }).join(' · ') + '</div>'
      + '<div class="order-where">' + esc(o.city) + ' — ' + esc(o.address)
        + (o.note ? ' · ' + esc(o.note) : '')
        + (wa ? ' · <a href="https://wa.me/' + esc(wa) + '" target="_blank" rel="noopener">'
          + esc(o.phone) + '</a>' : '') + '</div>'
      + '<div class="order-acts">'
        + (next ? '<button class="btn btn-sm" data-order="' + esc(o.id) + '" data-to="' + next + '">'
          + esc(nextLabel) + '</button>' : '')
        + (o.status !== 'cancelled' && o.status !== 'delivered'
          ? '<button class="btn btn-danger btn-sm" data-order="' + esc(o.id) + '" data-to="cancelled">إلغاء</button>'
          : '')
        + (o.status === 'new' ? '<span class="order-ref">تأكيد الطلب ينزّل الكمية من المخزن</span>' : '')
      + '</div>'
    + '</div>';
  }

  function deskPanel() {
    var s = desk.stats;
    var rate = Number(shop.settings.usdRate) || 3.7;
    var watch = shop.products.filter(function (p) { return (p.stock || 0) <= 3; })
      .sort(function (a, b) { return (a.stock || 0) - (b.stock || 0); });
    var open = desk.orders.filter(function (o) { return o.status !== 'delivered' && o.status !== 'cancelled'; });

    return '<section class="desk">'
      + (desk.defaultPassword
        ? '<div class="nag"><span>المتجر ما زال يعمل بكلمة المرور الأصلية، وأي شخص يعرفها يستطيع الدخول.</span>'
          + '<button class="btn btn-sm" id="fixPass">غيّريها الآن</button></div>'
        : '')
      + '<div class="desk-head"><h2>لوحة التحكم</h2>'
        + '<p>الأرقام محسوبة على سعر صرف ' + rate + ' ₪ للدولار.</p></div>'
      + '<div class="tiles">'
        + '<div class="tile"><span>منتج معروض</span><b>' + s.live + '</b><small>' + s.hidden + ' مخفي</small></div>'
        + '<div class="tile"><span>قطعة في المخزن</span><b>' + s.units + '</b><small>'
          + shop.products.length + ' صنفاً</small></div>'
        + '<div class="tile"><span>قيمة المخزون بالبيع</span><b>' + ils(s.retail) + '</b><small>سعر المتجر</small></div>'
        + '<div class="tile"><span>تكلفة المخزون</span><b>' + ils(s.cost) + '</b><small>ثمن الشراء</small></div>'
        + '<div class="tile gain"><span>الربح المتوقّع</span><b>' + ils(s.gain) + '</b><small>لو بِيع كله</small></div>'
        + '<div class="tile ' + (open.length ? 'warn' : '') + '"><span>طلبات مفتوحة</span><b>'
          + open.length + '</b><small>' + desk.orders.length + ' في المجمل</small></div>'
      + '</div>'
      + (desk.orders.length
        ? '<div class="orders"><h3><span class="grow">الطلبات</span>'
          + '<span class="order-ref">' + open.length + ' تحتاج متابعة</span></h3>'
          + desk.orders.slice(0, 25).map(orderCard).join('') + '</div>'
        : '<div class="orders"><h3>الطلبات</h3><div class="blank" style="padding:26px">'
          + '<p>لا توجد طلبات بعد. أول طلب سيظهر هنا فور إرساله.</p></div></div>')
      + (watch.length
        ? '<div class="watch"><h3>مخزون على وشك النفاد</h3><ul>'
          + watch.map(function (p) {
            return '<li><span class="state ' + (p.stock > 0 ? 's-low' : 's-gone') + '">'
              + (p.stock > 0 ? p.stock + ' قطع' : 'نفد') + '</span>'
              + '<span class="grow">' + esc(p.name) + '</span>'
              + '<span class="sku">' + esc(p.sku) + '</span>'
              + '<button class="btn btn-quiet btn-sm" data-edit="' + p.id + '">تعديل</button></li>';
          }).join('')
          + '</ul></div>'
        : '')
    + '</section>';
  }

  function bandPanel() {
    var s = shop.settings;
    return '<section class="band">'
      + '<div><h2>' + esc(s.tagline) + '</h2>'
        + '<p>نختار كل صنف بأنفسنا ونجرّبه قبل أن يدخل المتجر. اطلبي من الموقع وادفعي عند الاستلام.</p></div>'
      + '<div class="facts">'
        + '<div class="fact"><b>' + shop.products.length + '</b><span>صنفاً في المتجر</span></div>'
        + '<div class="fact"><b>' + esc(s.days || '2 – 4') + '</b><span>أيام حتى الباب</span></div>'
        + (Number(s.freeOver) > 0
          ? '<div class="fact"><b>' + ils(s.freeOver) + '</b><span>توصيل مجاني فوقها</span></div>'
          : '')
      + '</div>'
    + '</section>';
  }

  /* ================= render ================= */

  function render() {
    var s = shop.settings;
    var n = count();

    app.innerHTML =
      '<header>'
        + (s.strip && !owner ? '<div class="strip">' + esc(s.strip) + '</div>' : '')
        + '<div class="masthead' + (owner ? ' admin' : '') + '"><div class="shell masthead-row">'
          + '<button class="mark" id="mark" aria-label="' + esc(s.name_ar) + '">' + esc(s.mark || 'د') + '</button>'
          + '<div class="wordmark"><h1>' + esc(s.name_ar) + '</h1>'
            + '<span>' + esc(owner ? 'وضع الإدارة' : (s.name_en || '')) + '</span></div>'
          + '<div class="mast-actions">'
            + (owner
              ? '<button class="btn btn-line btn-sm" id="openSettings">الإعدادات</button>'
                + '<button class="btn btn-line btn-sm" id="signOut">خروج</button>'
              : '<button class="btn btn-line btn-sm cart" id="openCart">السلة'
                + '<span id="cartCount">' + (n ? '<b class="num">' + n + '</b>' : '') + '</span></button>')
          + '</div>'
        + '</div><div class="nacre"></div></div>'
      + '</header>'

      + '<main>'
        + '<div class="shell">' + (owner ? deskPanel() : bandPanel()) + '</div>'
        + '<div class="index"><div class="shell index-row">'
          + '<div class="find"><svg width="15" height="15" viewBox="0 0 16 16" fill="none" '
            + 'stroke="currentColor" stroke-width="1.7" aria-hidden="true">'
            + '<circle cx="7" cy="7" r="4.6"></circle><path d="M10.5 10.5L14 14"></path></svg>'
            + '<input id="q" type="search" placeholder="ابحثي باسم المنتج أو الماركة…" '
            + 'value="' + esc(filter.q) + '" aria-label="بحث"></div>'
          + '<div class="sortbox"><label class="sr" for="sort">الترتيب</label><select id="sort">'
            + SORTS.map(function (o) {
              return '<option value="' + o[0] + '"' + (filter.sort === o[0] ? ' selected' : '') + '>'
                + esc(o[1]) + '</option>';
            }).join('') + '</select></div>'
        + '</div>'
        + '<div class="shell"><nav class="rail" id="rail" aria-label="الأقسام">'
          + '<button class="chip" data-cat="" aria-pressed="' + (filter.cat === '') + '">الكل '
            + '<small>' + shop.products.length + '</small></button>'
          + shop.categories.map(function (c) {
            var k = shop.products.filter(function (p) { return p.cat === c.slug; }).length;
            if (!k && !owner) return '';
            return '<button class="chip" data-cat="' + esc(c.slug) + '" aria-pressed="'
              + (filter.cat === c.slug) + '">'
              + '<i aria-hidden="true">' + esc(c.icon) + '</i>' + esc(c.name)
              + ' <small>' + k + '</small></button>';
          }).join('')
        + '</nav></div></div>'
        + '<div class="shell" id="gridHost"></div>'
      + '</main>'

      + '<footer class="foot"><div class="shell">'
        + '<div class="foot-row">'
          + '<div style="max-width:46ch"><h4>' + esc(s.name_ar) + '</h4><p>' + esc(s.tagline) + '</p></div>'
          + '<div><h4>تواصلي معنا</h4>'
            + (s.whatsapp
              ? '<p><a href="https://wa.me/' + esc(String(s.whatsapp).replace(/\D/g, ''))
                + '" target="_blank" rel="noopener">واتساب ' + esc(s.whatsapp) + '</a></p>'
              : '<p>رقم واتساب المتجر غير مضبوط بعد.</p>')
            + (s.instagram
              ? '<p><a href="https://instagram.com/' + esc(s.instagram)
                + '" target="_blank" rel="noopener">@' + esc(s.instagram) + '</a></p>'
              : '')
            + '<p>الدفع عند الاستلام في كل مدن فلسطين.</p>'
          + '</div>'
        + '</div>'
        + '<div class="foot-end"><span>© ' + new Date().getFullYear() + ' ' + esc(s.name_ar) + '</span>'
          + '<span>صُنع بحب في فلسطين '
          + '<button class="keyhole" id="keyhole" aria-label="دخول">◆</button></span>'
        + '</div>'
      + '</div></footer>';

    renderGrid();
    wire();
  }

  function wire() {
    var settings = document.getElementById('openSettings');
    if (settings) settings.addEventListener('click', editSettings);

    var out = document.getElementById('signOut');
    if (out) out.addEventListener('click', signOut);

    var cart = document.getElementById('openCart');
    if (cart) cart.addEventListener('click', showBasket);

    var fix = document.getElementById('fixPass');
    if (fix) fix.addEventListener('click', editAccount);

    document.querySelectorAll('.watch [data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { editProduct(Number(b.getAttribute('data-edit'))); });
    });

    document.querySelectorAll('[data-order]').forEach(function (b) {
      b.addEventListener('click', function () {
        var done = busy(b, '…');
        api('PATCH', '/orders/' + b.getAttribute('data-order'), { status: b.getAttribute('data-to') })
          .then(function () { return load(); })
          .then(function () { toast('حُدّث الطلب', 'good'); })
          ['catch'](function (err) { done(); toast(err.message, 'bad'); });
      });
    });

    var q = document.getElementById('q');
    var pause;
    q.addEventListener('input', function () {
      filter.q = q.value;
      clearTimeout(pause);
      // The field itself is never rebuilt, so the caret stays where it was.
      pause = setTimeout(renderGrid, 130);
    });

    document.getElementById('sort').addEventListener('change', function (e) {
      filter.sort = e.target.value;
      renderGrid();
    });

    var chips = document.querySelectorAll('#rail [data-cat]');
    chips.forEach(function (b) {
      b.addEventListener('click', function () {
        filter.cat = b.getAttribute('data-cat');
        chips.forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
        renderGrid();
      });
    });

    // The way in: the mark tapped five times, or the small one in the footer.
    var taps = [];
    document.getElementById('mark').addEventListener('click', function () {
      var now = Date.now();
      taps = taps.filter(function (t) { return now - t < 2500; });
      taps.push(now);
      if (taps.length >= 5) { taps = []; showSignIn(); }
    });
    document.getElementById('keyhole').addEventListener('click', showSignIn);
  }

  load().then(function () {
    if (location.hash === '#in' && !owner) showSignIn();
  });
})();
