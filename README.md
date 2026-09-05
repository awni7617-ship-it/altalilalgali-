# الطليل الغالي · Al-Talil Al-Ghali

متجر مكياج إلكتروني جاهز للعمل — واجهة عربية بالكامل، تسجيل دخول برمز يصل على البريد
بدون كلمة مرور، ولوحة تحكم كاملة للمالك.

An online makeup shop built for Palestine: Arabic-first storefront, passwordless
e-mail-code sign-in, and a full owner dashboard.

**لا يحتاج أي مكتبات خارجية — `npm install` غير مطلوب إطلاقاً.**
Zero npm dependencies. Nothing to install.

---

## ١. التشغيل السريع · Quick start

You need **Node.js 22.5 or newer** ([nodejs.org](https://nodejs.org)). Then:

```bash
cp .env.example .env      # create your settings file
npm run seed              # fill the shop with categories + sample products
npm start                 # start the shop
```

Open <http://localhost:3000>. The dashboard is at <http://localhost:3000/admin>.

At this point mail is set to `console`, which means **login codes are printed in the
terminal instead of being e-mailed** — and also shown on the login screen. That is
deliberate so you can get in and set the shop up before configuring e-mail.

---

## ٢. حساب المدير · The owner account

The owner e-mail is **`carsyardltd@icloud.com`**, already set as the default.

There is **no password anywhere in this system**. Signing in works like this:

1. Go to `/login.html` and type the e-mail address.
2. A 6-digit code is sent to that inbox.
3. Type the code — you are in.

When the address is the owner's, the account is given admin rights automatically and
you land straight on the dashboard. Everyone else becomes a normal customer.

To change or add owners, edit `ADMIN_EMAILS` in `.env` (comma-separated) and restart.
Roles re-sync on every sign-in, so adding or removing an address takes effect
immediately — no database editing.

### How the sign-in is kept safe

| Protection | What it does |
|---|---|
| Codes are hashed | Only an HMAC of the code is stored, never the code itself |
| 10-minute expiry | `CODE_TTL_MINUTES` |
| 5 wrong tries | The code is destroyed and a new one must be requested |
| 5 codes per hour per address | Blocks someone hammering your inbox |
| One live code at a time | Requesting a new code kills the previous one |
| Constant-time comparison | No timing side-channel on the code check |
| Session tokens hashed in the database | A stolen database still cannot impersonate anyone |
| `HttpOnly` + `SameSite` + `Secure` cookies | Not readable by scripts, not sent cross-site |
| Origin checking on every write | Blocks cross-site request forgery |
| Owner-only API guard | Every `/api/admin/*` route re-checks the role server-side |

---

## ٣. تفعيل البريد الإلكتروني · Turning on real e-mail

Until you do this, codes only appear in the terminal. Pick **one** option in `.env`.

### Option A — Resend (easiest, recommended)

Free for 3,000 e-mails a month, no SMTP ports to worry about.

1. Sign up at [resend.com](https://resend.com) and verify your domain (or use their
   test sender while trying it out).
2. Create an API key.
3. In `.env`:

```ini
MAIL_PROVIDER=resend
RESEND_API_KEY=re_xxxxxxxxxxxx
MAIL_FROM=no-reply@yourdomain.com
MAIL_FROM_NAME=الطليل الغالي
```

### Option B — Brevo

Free for 300 e-mails a day.

```ini
MAIL_PROVIDER=brevo
BREVO_API_KEY=xkeysib-xxxxxxxx
MAIL_FROM=no-reply@yourdomain.com
```

### Option C — Your own mailbox over SMTP

Works with Gmail, iCloud, Zoho, Outlook and the rest.

```ini
MAIL_PROVIDER=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=you@gmail.com
SMTP_PASS=your-app-password
MAIL_FROM=you@gmail.com
```

> **Important:** Gmail and iCloud will not accept your normal password here. Turn on
> two-factor authentication, then generate an **app-specific password** and use that.
> - Gmail: Account → Security → 2-Step Verification → App passwords
> - iCloud: appleid.apple.com → Sign-In and Security → App-Specific Passwords
>
> For iCloud use `smtp.mail.me.com`, port `587`, and `SMTP_SECURE=false`.

Restart the server after editing `.env`. Send yourself a code to confirm it arrives.

---

## ٤. لوحة التحكم · What the dashboard does

| Section | What you can do |
|---|---|
| **الرئيسية** Overview | Revenue, **profit** (from your dollar cost), pending orders, stock warnings, a 14-day sales chart, best sellers |
| **المنتجات** Products | Add, edit and delete products; names and descriptions in Arabic **and** English; brand; item code; price; was-price; **your purchase cost in dollars**; stock count; show/hide from the shop; mark as featured; up to 8 photos each |
| **الأقسام** Categories | Create your own sections with an emoji icon and custom ordering |
| **الطلبات** Orders | Every order with its items, customer, address and phone; change status (new → confirmed → shipped → delivered); message the customer on WhatsApp in one click; cancelling an order puts the stock back automatically |
| **الزبائن** Customers | Everyone who signed in, how many orders they placed and how much they spent; block a customer if you need to |
| **الإعدادات** Settings | Shop name and tagline in both languages, announcement bar, WhatsApp number, Instagram, delivery charge, free-delivery threshold, and the dollar exchange rate |

### Photos

Add them in **Products → Edit → الصور**. Tap the box or drag pictures in.

Photos are shrunk in your browser before upload (max 1200px, JPEG), so a photo
straight from your phone becomes a small fast-loading file. The **first photo is the
main one** shown in the shop. Only real JPG/PNG/WEBP/GIF files are accepted — the
server checks the actual bytes, not the file name, so a disguised file is rejected.

### The profit figure

Enter what you **paid in dollars** in `تكلفة الشراء ($)` and set the dollar rate in
Settings. The dashboard then shows your real profit, and the product form shows your
margin per item live as you type — with a warning if you would be selling at a loss.

Customers never see your cost price. It is stripped from every public API response.

---

## ٥. كيف يشتري الزبون · How customers order

1. Browse or search, filter by category, tap a product for the full details.
2. Add to basket, adjust quantities.
3. Checkout with name, phone, city (all Palestinian cities are listed) and address.
4. The order is saved, stock is reduced, and they get an order number.
5. They can then send the whole order to your WhatsApp with one tap.

Payment is cash on delivery — no card processing is involved, so there is nothing
sensitive to store.

**Prices and stock are always taken from the database, never from the browser.** If
someone edits the page to claim a product costs 1 ₪, the server ignores it and
charges the real price. Ordering more than you have in stock is refused.

Customers do not need an account to order. If they do sign in, their details are
pre-filled and they can see their order history at `/account.html`.

---

## ٦. النشر على الإنترنت · Going live

```ini
NODE_ENV=production
PUBLIC_URL=https://yourdomain.com
SECRET_KEY=<paste the output of: npm run secret>
```

`SECRET_KEY` matters: without it a new random key is generated on every restart,
which signs everybody out each time the server restarts.

Run the server behind a reverse proxy (Nginx, Caddy) with **HTTPS**. Secure cookies
require it. Any host that runs Node works — a small VPS, Railway, Render, Fly.io.

Keep the process alive with `pm2`, `systemd`, or your host's own restart policy.

### Backups

Everything lives in two places:

- `data/shop.db` — products, orders, customers, settings
- `public/uploads/` — product photos

Copy both regularly. That is your whole shop.

---

## ٧. بنية المشروع · Project layout

```
server/
  index.js        HTTP server, routing, static files
  config.js       .env loading and defaults
  db.js           SQLite schema and query helpers
  http.js         router, cookies, rate limiting, CSRF, static serving
  auth.js         login codes, sessions, role guards
  mailer.js       SMTP client (written from scratch) + Resend/Brevo
  storage.js      photo validation and saving
  seed.js         starter categories and products
  routes/
    auth.js       sign-in, session, profile
    shop.js       public catalogue and checkout
    admin.js      owner-only management API
public/
  index.html      storefront
  login.html      sign-in
  admin.html      owner dashboard
  account.html    customer account and order history
  assets/css/main.css
  assets/js/      core.js · shop.js · login.js · admin.js · account.js
```

Both languages are served from one set of files — the layout flips between RTL and
LTR using CSS logical properties, so there is no second stylesheet to maintain.

---

## ٨. أسئلة شائعة · Troubleshooting

**The code never arrives.** Check the spam folder first. Then check the terminal —
if it prints the e-mail body, `MAIL_PROVIDER` is still `console`. If it prints an
SMTP error, the host, port or app password is wrong.

**"Too many codes requested."** The five-per-hour limit for that address. Wait, or
raise `CODE_REQUESTS_PER_HOUR` in `.env`.

**I get signed out whenever I restart.** `SECRET_KEY` is empty. Run `npm run secret`
and paste the result into `.env`.

**Photos do not appear.** Make sure `public/uploads/` exists and the server can write
to it.

**I want to start the catalogue over.** `npm run reset` clears products and
categories and re-seeds. Orders and customers are untouched.
