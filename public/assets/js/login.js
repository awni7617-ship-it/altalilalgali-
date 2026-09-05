/* ==================================================================
   Sign in / create an account — e-mail and password.
   ================================================================== */
import { api, isArabic, esc, toast, $, applyLanguage } from './core.js';

const text = {
  ar: {
    sub: 'سجّلي الدخول للمتابعة',
    tab_login: 'تسجيل الدخول', tab_register: 'حساب جديد',
    email: 'البريد الإلكتروني', password: 'كلمة المرور',
    confirm: 'تأكيد كلمة المرور', name: 'الاسم الكامل',
    sign_in: 'دخول', create: 'إنشاء الحساب',
    bad_email: 'الرجاء إدخال بريد إلكتروني صحيح',
    need_password: 'الرجاء إدخال كلمة المرور',
    short_password: 'كلمة المرور يجب أن تكون ٨ أحرف على الأقل',
    mismatch: 'كلمتا المرور غير متطابقتين',
    hint: '٨ أحرف على الأقل',
    weak: 'ضعيفة', fair: 'متوسطة', good: 'جيدة', strong: 'قوية',
    welcome_admin: 'أهلاً بعودتك! جارٍ فتح لوحة التحكم…',
    welcome: 'تم تسجيل الدخول بنجاح',
    created: 'تم إنشاء حسابك',
    owner: '👑 <strong>حساب المدير:</strong> ادخلي ببريد المالك وكلمة مروره للوصول إلى لوحة التحكم. نسيتِ كلمة المرور؟ شغّلي <code>npm run password</code> في الطرفية.',
    back_shop: '← العودة للمتجر',
    show: 'إظهار كلمة المرور', hide: 'إخفاء كلمة المرور',
    with_google: 'المتابعة باستخدام Google', with_apple: 'المتابعة باستخدام Apple', or: 'أو',
    social_note: 'إذا سجّلتِ عبر Google أو Apple، استخدمي الزر نفسه في كل مرة.',
  },
  en: {
    sub: 'Sign in to continue',
    tab_login: 'Sign in', tab_register: 'Create account',
    email: 'E-mail address', password: 'Password',
    confirm: 'Confirm password', name: 'Full name',
    sign_in: 'Sign in', create: 'Create account',
    bad_email: 'Please enter a valid e-mail address',
    need_password: 'Please enter your password',
    short_password: 'Your password needs at least 8 characters',
    mismatch: 'Those two passwords are not the same',
    hint: 'At least 8 characters',
    weak: 'Weak', fair: 'Fair', good: 'Good', strong: 'Strong',
    welcome_admin: 'Welcome back! Opening your dashboard…',
    welcome: 'Signed in',
    created: 'Your account is ready',
    owner: '👑 <strong>Owner account:</strong> sign in with the owner e-mail and password to reach the dashboard. Forgotten it? Run <code>npm run password</code> in the terminal.',
    back_shop: '← Back to the shop',
    show: 'Show password', hide: 'Hide password',
    with_google: 'Continue with Google', with_apple: 'Continue with Apple', or: 'or',
    social_note: 'If you signed up with Google or Apple, use that same button each time.',
  },
};
const s = (key) => text[isArabic() ? 'ar' : 'en'][key] || key;

const params = new URLSearchParams(location.search);
const nextUrl = (() => {
  const raw = params.get('next') || '';
  /* Only ever redirect somewhere inside this site. */
  return /^\/[A-Za-z0-9._~\-/]*$/.test(raw) ? raw : '';
})();

const ERRORS = {
  ar: {
    cancelled: 'تم إلغاء تسجيل الدخول.',
    provider_off: 'طريقة الدخول هذه غير مفعّلة في المتجر.',
    bad_state: 'انتهت صلاحية رابط الدخول. حاولي مرة أخرى.',
    no_email: 'لم يشارك المزوّد بريدك الإلكتروني، لذلك تعذّر إنشاء الحساب.',
    unverified_email: 'هذا البريد غير مُوثّق لدى المزوّد.',
    provider_unreachable: 'تعذّر الاتصال بمزوّد الدخول. حاولي مرة أخرى.',
    provider_refused: 'رفض مزوّد الدخول الطلب. تحقّقي من إعدادات المتجر.',
    failed: 'تعذّر إتمام تسجيل الدخول. حاولي مرة أخرى.',
  },
  en: {
    cancelled: 'That sign-in was cancelled.',
    provider_off: 'That sign-in method is not switched on for this shop.',
    bad_state: 'That sign-in link expired. Please try again.',
    no_email: 'The provider did not share your e-mail, so no account could be made.',
    unverified_email: 'That e-mail is not verified with the provider.',
    provider_unreachable: 'Could not reach the sign-in provider. Please try again.',
    provider_refused: 'The sign-in provider refused the request. Check the shop settings.',
    failed: 'That sign-in could not be completed. Please try again.',
  },
};

applyLanguage();
paintText();
wireTabs();
wireEyes();
wireMeter();
showCallbackError();
loadProviders();
redirectIfSignedIn();

/** Report anything the Google/Apple round-trip sent back. */
function showCallbackError() {
  const code = params.get('error');
  if (!code) return;
  const table = ERRORS[isArabic() ? 'ar' : 'en'];
  const box = $('#pageError');
  box.hidden = false;
  box.textContent = table[code] || table.failed;
  /* Keep it out of the address bar if they reload. */
  history.replaceState(null, '', location.pathname + (nextUrl ? `?next=${encodeURIComponent(nextUrl)}` : ''));
}

/** Only show the buttons the shop is actually set up for. */
async function loadProviders() {
  let providers = [];
  try {
    ({ providers } = await api.get('/api/auth/providers'));
  } catch {
    return;
  }
  if (!providers.length) return;

  const carry = nextUrl ? `?next=${encodeURIComponent(nextUrl)}` : '';
  if (providers.includes('google')) {
    const b = $('#googleBtn');
    b.hidden = false;
    b.href = `/auth/google${carry}`;
    $('#googleLabel').textContent = s('with_google');
  }
  if (providers.includes('apple')) {
    const b = $('#appleBtn');
    b.hidden = false;
    b.href = `/auth/apple${carry}`;
    $('#appleLabel').textContent = s('with_apple');
  }
  $('#orText').textContent = s('or');
  $('#providers').hidden = false;

  /* Someone who signed up with Google has no password, so a failed
   * password attempt would otherwise be baffling. */
  const note = $('#socialNote');
  note.textContent = s('social_note');
  note.hidden = false;
}

function paintText() {
  $('#authSub').textContent = s('sub');
  $('#tabLogin').textContent = s('tab_login');
  $('#tabRegister').textContent = s('tab_register');
  $('#loginBtn').textContent = s('sign_in');
  $('#registerBtn').textContent = s('create');
  $('#pwHint').textContent = s('hint');
  $('#ownerHint').innerHTML = s('owner');
  $('#backShop').textContent = s('back_shop');

  document.querySelector('label[for="loginEmail"]').textContent = s('email');
  document.querySelector('label[for="loginPassword"]').textContent = s('password');
  document.querySelector('label[for="regName"]').textContent = s('name');
  document.querySelector('label[for="regEmail"]').textContent = s('email');
  document.querySelector('label[for="regPassword"]').textContent = s('password');
  document.querySelector('label[for="regPassword2"]').textContent = s('confirm');
}

/**
 * Where to send someone once they are signed in.
 *
 * `next` is only honoured if they can actually go there. Sending a
 * customer on to /admin would bounce them straight back here, and the
 * two redirects would chase each other forever.
 */
function destinationFor(user) {
  const wantsAdmin = /^\/admin(\.html)?(\/|$|\?)/.test(nextUrl);
  if (nextUrl && !(wantsAdmin && !user.is_admin)) return nextUrl;
  return user.is_admin ? '/admin.html' : '/';
}

async function redirectIfSignedIn() {
  try {
    const { user } = await api.get('/api/auth/me');
    if (user) location.replace(destinationFor(user));
  } catch { /* not signed in — stay here */ }
}

/* ------------------------------------------------------------------ *
 * Tabs
 * ------------------------------------------------------------------ */
function wireTabs() {
  const show = (which) => {
    const login = which === 'login';
    $('#loginForm').hidden = !login;
    $('#registerForm').hidden = login;
    $('#tabLogin').classList.toggle('is-active', login);
    $('#tabRegister').classList.toggle('is-active', !login);
    $('#tabLogin').setAttribute('aria-selected', String(login));
    $('#tabRegister').setAttribute('aria-selected', String(!login));
    $('#loginError').hidden = true;
    $('#registerError').hidden = true;
    (login ? $('#loginEmail') : $('#regName')).focus();
  };
  $('#tabLogin').addEventListener('click', () => show('login'));
  $('#tabRegister').addEventListener('click', () => show('register'));
  if (params.get('new') === '1') show('register');
}

/* ------------------------------------------------------------------ *
 * Show / hide password
 * ------------------------------------------------------------------ */
function wireEyes() {
  document.querySelectorAll('[data-eye]').forEach((button) => {
    button.addEventListener('click', () => {
      const input = document.getElementById(button.dataset.eye);
      const revealed = input.type === 'text';
      input.type = revealed ? 'password' : 'text';
      button.textContent = revealed ? '👁' : '🙈';
      button.setAttribute('aria-label', revealed ? s('show') : s('hide'));
      input.focus();
    });
  });
}

/* ------------------------------------------------------------------ *
 * Strength meter — guidance only; the server sets the real rule.
 * ------------------------------------------------------------------ */
function wireMeter() {
  const input = $('#regPassword');
  const meter = $('#pwMeter');
  const bar = meter.querySelector('span');
  const hint = $('#pwHint');

  input.addEventListener('input', () => {
    const value = input.value;
    if (!value) {
      meter.hidden = true;
      hint.textContent = s('hint');
      return;
    }
    meter.hidden = false;

    let score = 0;
    if (value.length >= 8) score += 1;
    if (value.length >= 12) score += 1;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score += 1;
    if (/\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    const level = Math.min(4, Math.max(1, score));

    meter.dataset.level = String(level);
    bar.style.width = `${level * 25}%`;
    hint.textContent = [s('weak'), s('fair'), s('good'), s('strong')][level - 1];
  });
}

/* ------------------------------------------------------------------ *
 * Submitting
 * ------------------------------------------------------------------ */
const emailLooksValid = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

function fail(box, input, message) {
  box.hidden = false;
  box.textContent = message;
  if (input) {
    input.classList.add('is-error');
    input.focus();
  }
  return false;
}

async function submitting(button, run) {
  const label = button.textContent;
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span>';
  try {
    await run();
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

function land(user) {
  toast(user.is_admin ? s('welcome_admin') : s('welcome'), 'ok');
  setTimeout(() => location.replace(destinationFor(user)), 450);
}

$('#loginForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = $('#loginEmail');
  const password = $('#loginPassword');
  const box = $('#loginError');
  box.hidden = true;
  email.classList.remove('is-error');
  password.classList.remove('is-error');

  if (!emailLooksValid(email.value.trim())) return fail(box, email, s('bad_email'));
  if (!password.value) return fail(box, password, s('need_password'));

  await submitting($('#loginBtn'), async () => {
    try {
      const { user } = await api.post('/api/auth/login', {
        email: email.value.trim(),
        password: password.value,
      });
      land(user);
    } catch (err) {
      fail(box, password, err.message);
      password.value = '';
    }
  });
});

$('#registerForm').addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = $('#regEmail');
  const password = $('#regPassword');
  const repeat = $('#regPassword2');
  const box = $('#registerError');
  box.hidden = true;
  [email, password, repeat].forEach((i) => i.classList.remove('is-error'));

  if (!emailLooksValid(email.value.trim())) return fail(box, email, s('bad_email'));
  if (password.value.length < 8) return fail(box, password, s('short_password'));
  if (password.value !== repeat.value) return fail(box, repeat, s('mismatch'));

  await submitting($('#registerBtn'), async () => {
    try {
      const { user } = await api.post('/api/auth/register', {
        email: email.value.trim(),
        password: password.value,
        name: $('#regName').value.trim(),
      });
      toast(s('created'), 'ok');
      land(user);
    } catch (err) {
      fail(box, email, err.message);
    }
  });
});

/* The shop name rides along with the providers call, which works
   before anyone has signed in. */
api.get('/api/auth/providers').then(({ shop_name_ar, shop_name_en }) => {
  const name = isArabic() ? shop_name_ar : (shop_name_en || shop_name_ar);
  if (name) $('#shopName').textContent = name;
}).catch(() => {});
