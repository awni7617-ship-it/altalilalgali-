/* ==================================================================
   Passwordless sign-in: e-mail → 6-digit code → session.
   ================================================================== */
import { api, isArabic, esc, toast, $, applyLanguage } from './core.js';

const CODE_LENGTH = 6;
const text = {
  ar: {
    sub: 'سجّلي الدخول برمز يُرسل إلى بريدك — بدون كلمة مرور',
    email: 'البريد الإلكتروني', send: 'إرسال الرمز', sending: 'جارٍ الإرسال...',
    verify: 'تأكيد وتسجيل الدخول', verifying: 'جارٍ التحقق...',
    back: '← تغيير البريد', resend: 'إعادة الإرسال', resend_in: 'إعادة الإرسال بعد {n} ثانية',
    sent: 'أرسلنا رمزاً مكوناً من ٦ أرقام إلى',
    enter_email: 'الرجاء إدخال بريد إلكتروني صحيح',
    enter_code: 'الرجاء إدخال الرمز كاملاً',
    welcome_admin: 'أهلاً بعودتك! جارٍ فتح لوحة التحكم...',
    welcome: 'تم تسجيل الدخول بنجاح',
    owner: '👑 <strong>حساب المدير:</strong> عند إدخال بريد المالك سيصلك رمز الدخول إلى لوحة التحكم مباشرة.',
    no_mail: 'البريد غير مُفعّل بعد — هذا هو رمزك:',
    back_shop: '← العودة للمتجر',
    check_spam: 'لم يصلك الرمز؟ تحقّقي من مجلد الرسائل غير المرغوبة.',
  },
  en: {
    sub: 'Sign in with a code sent to your e-mail — no password needed',
    email: 'E-mail address', send: 'Send my code', sending: 'Sending...',
    verify: 'Verify and sign in', verifying: 'Checking...',
    back: '← Change e-mail', resend: 'Resend code', resend_in: 'Resend in {n}s',
    sent: 'We sent a 6-digit code to',
    enter_email: 'Please enter a valid e-mail address',
    enter_code: 'Please enter the whole code',
    welcome_admin: 'Welcome back! Opening your dashboard...',
    welcome: 'Signed in successfully',
    owner: '👑 <strong>Owner account:</strong> sign in with the owner e-mail to go straight to the dashboard.',
    no_mail: 'Mail is not configured yet — here is your code:',
    back_shop: '← Back to the shop',
    check_spam: 'No code yet? Check your spam folder.',
  },
};

const s = (key, vars) => {
  let value = text[isArabic() ? 'ar' : 'en'][key] || key;
  if (vars) for (const [k, v] of Object.entries(vars)) value = value.replaceAll(`{${k}}`, v);
  return value;
};

const params = new URLSearchParams(location.search);
const nextUrl = (() => {
  const raw = params.get('next') || '';
  /* Only ever redirect somewhere inside this site. */
  return /^\/[A-Za-z0-9._~\-/]*$/.test(raw) ? raw : '';
})();

let email = '';
let resendTimer = null;

applyLanguage();
paintStaticText();
buildOtpBoxes();
redirectIfAlreadySignedIn();

function paintStaticText() {
  $('#authSub').textContent = s('sub');
  $('#emailLabel').textContent = s('email');
  $('#sendBtn').textContent = s('send');
  $('#verifyBtn').textContent = s('verify');
  $('#backBtn').textContent = s('back');
  $('#resendBtn').textContent = s('resend');
  $('#ownerHint').innerHTML = s('owner');
  $('#backShop').textContent = s('back_shop');
}

async function redirectIfAlreadySignedIn() {
  try {
    const { user } = await api.get('/api/auth/me');
    if (user) location.replace(nextUrl || (user.is_admin ? '/admin.html' : '/account.html'));
  } catch { /* not signed in — stay here */ }
}

/* ------------------------------------------------------------------ *
 * Step 1 — request the code
 * ------------------------------------------------------------------ */
$('#emailStep').addEventListener('submit', async (event) => {
  event.preventDefault();
  const input = $('#email');
  const errorBox = $('#emailError');
  const value = input.value.trim().toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
    input.classList.add('is-error');
    errorBox.hidden = false;
    errorBox.textContent = s('enter_email');
    input.focus();
    return;
  }
  input.classList.remove('is-error');
  errorBox.hidden = true;
  await requestCode(value, $('#sendBtn'));
});

async function requestCode(value, button) {
  const original = button.textContent;
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span>';

  try {
    const result = await api.post('/api/auth/request-code', { email: value });
    email = result.email;

    $('#emailStep').hidden = true;
    $('#codeStep').hidden = false;
    $('#sentTo').innerHTML = `${esc(s('sent'))}<strong>${esc(email)}</strong>`;

    /* Shown only while no mail provider is configured, so the shop is
     * usable during setup. */
    $('#devCodeBox').innerHTML = result.dev_code
      ? `<div class="dev-code">${esc(s('no_mail'))}<b>${esc(result.dev_code)}</b></div>`
      : `<p class="hint" style="text-align:center;margin-top:12px;">${esc(s('check_spam'))}</p>`;

    if (result.dev_code) fillCode(result.dev_code);
    else $('#otpInputs').querySelector('input')?.focus();

    startResendCountdown();
  } catch (err) {
    toast(err.message, 'bad');
    const errorBox = $('#emailError');
    errorBox.hidden = false;
    errorBox.textContent = err.message;
  } finally {
    button.disabled = false;
    button.textContent = original;
  }
}

/* ------------------------------------------------------------------ *
 * The six code boxes
 * ------------------------------------------------------------------ */
function buildOtpBoxes() {
  const host = $('#otpInputs');
  host.innerHTML = Array.from({ length: CODE_LENGTH })
    .map(
      (_, i) => `<input class="otp-input" type="text" inputmode="numeric" pattern="[0-9]*"
        maxlength="1" autocomplete="${i === 0 ? 'one-time-code' : 'off'}"
        aria-label="Digit ${i + 1}" data-index="${i}">`,
    )
    .join('');

  const boxes = Array.from(host.querySelectorAll('.otp-input'));

  boxes.forEach((box, index) => {
    box.addEventListener('input', () => {
      box.value = box.value.replace(/\D/g, '').slice(0, 1);
      box.classList.toggle('is-filled', box.value !== '');
      if (box.value && index < CODE_LENGTH - 1) boxes[index + 1].focus();
      if (boxes.every((b) => b.value)) $('#codeStep').requestSubmit();
    });

    box.addEventListener('keydown', (event) => {
      if (event.key === 'Backspace' && !box.value && index > 0) {
        boxes[index - 1].focus();
        boxes[index - 1].value = '';
        boxes[index - 1].classList.remove('is-filled');
        event.preventDefault();
      }
      /* The boxes read left-to-right in both languages. */
      if (event.key === 'ArrowLeft' && index > 0) boxes[index - 1].focus();
      if (event.key === 'ArrowRight' && index < CODE_LENGTH - 1) boxes[index + 1].focus();
    });

    box.addEventListener('paste', (event) => {
      event.preventDefault();
      const digits = (event.clipboardData.getData('text') || '').replace(/\D/g, '');
      if (digits) fillCode(digits);
    });

    box.addEventListener('focus', () => box.select());
  });
}

function fillCode(digits) {
  const boxes = Array.from($('#otpInputs').querySelectorAll('.otp-input'));
  boxes.forEach((box, i) => {
    box.value = digits[i] || '';
    box.classList.toggle('is-filled', !!digits[i]);
  });
  if (digits.length >= CODE_LENGTH) {
    boxes[CODE_LENGTH - 1].focus();
    $('#codeStep').requestSubmit();
  } else {
    boxes[Math.min(digits.length, CODE_LENGTH - 1)].focus();
  }
}

function readCode() {
  return Array.from($('#otpInputs').querySelectorAll('.otp-input'))
    .map((b) => b.value)
    .join('');
}

/* ------------------------------------------------------------------ *
 * Step 2 — verify
 * ------------------------------------------------------------------ */
let verifying = false;

$('#codeStep').addEventListener('submit', async (event) => {
  event.preventDefault();
  if (verifying) return;

  const code = readCode();
  const errorBox = $('#codeError');
  const button = $('#verifyBtn');

  if (code.length !== CODE_LENGTH) {
    errorBox.hidden = false;
    errorBox.textContent = s('enter_code');
    return;
  }

  verifying = true;
  errorBox.hidden = true;
  button.disabled = true;
  button.innerHTML = '<span class="spinner"></span>';

  try {
    const { user } = await api.post('/api/auth/verify', { email, code });
    toast(user.is_admin ? s('welcome_admin') : s('welcome'), 'ok');
    setTimeout(() => {
      location.replace(nextUrl || (user.is_admin ? '/admin.html' : '/account.html'));
    }, 500);
  } catch (err) {
    errorBox.hidden = false;
    errorBox.textContent = err.message;
    fillCode('');
    $('#otpInputs').querySelector('input').focus();
    verifying = false;
    button.disabled = false;
    button.textContent = s('verify');
  }
});

/* ------------------------------------------------------------------ *
 * Resend / go back
 * ------------------------------------------------------------------ */
function startResendCountdown(seconds = 45) {
  const button = $('#resendBtn');
  clearInterval(resendTimer);
  let left = seconds;
  button.disabled = true;
  button.textContent = s('resend_in', { n: left });

  resendTimer = setInterval(() => {
    left -= 1;
    if (left <= 0) {
      clearInterval(resendTimer);
      button.disabled = false;
      button.textContent = s('resend');
    } else {
      button.textContent = s('resend_in', { n: left });
    }
  }, 1000);
}

$('#resendBtn').addEventListener('click', () => {
  if (email) requestCode(email, $('#resendBtn'));
});

$('#backBtn').addEventListener('click', () => {
  clearInterval(resendTimer);
  $('#codeStep').hidden = true;
  $('#emailStep').hidden = false;
  $('#codeError').hidden = true;
  fillCode('');
  $('#email').focus();
});

/* Show the shop's real name once it is known. */
api.get('/api/shop').then(({ settings }) => {
  const name = isArabic() ? settings.shop_name_ar : settings.shop_name_en || settings.shop_name_ar;
  if (name) $('#shopName').textContent = name;
}).catch(() => {});
