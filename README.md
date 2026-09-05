# الطليل الغالي · Al-Talil Al-Ghali

متجر مكياج إلكتروني جاهز للعمل — واجهة عربية بالكامل، تسجيل دخول بالبريد وكلمة المرور،
ولوحة تحكم كاملة للمالك.

An online makeup shop built for Palestine: Arabic-first storefront, e-mail and password
sign-in, and a full owner dashboard.

**لا يحتاج أي مكتبات خارجية ولا بريد إلكتروني — `npm install` غير مطلوب.**
Zero npm dependencies, and no mail service to set up. Nothing to install.

---

## ١. التشغيل السريع · Quick start

You need **Node.js 22.5 or newer** ([nodejs.org](https://nodejs.org)). Then:

```bash
cp .env.example .env      # create your settings file
npm run seed              # fill the shop with categories + sample products
npm start                 # start the shop
```

The first time it starts, it prints your owner password:

```
  ┌────────────────────────────────────────────────────┐
  │  YOUR OWNER PASSWORD — shown this one time only    │
  │                                                    │
  │  carsyardltd@icloud.com                            │
  │  xxxx-xxxxxxxx        ← yours will be different    │
  │                                                    │
  │  Write it down, then change it from Settings.      │
  └────────────────────────────────────────────────────┘
```

**Write it down.** It is shown once and never again.

Then open <http://localhost:3000>, or go straight to the dashboard at
<http://localhost:3000/admin>.

---

## ٢. حساب المدير · The owner account

The owner e-mail is **`carsyardltd@icloud.com`**, already set as the default.

Sign in at `/login` with that address and the password printed at first start. You land
straight on the dashboard. Anyone else who creates an account is an ordinary customer
and cannot reach it.

### Changing the password

Three ways, use whichever suits you:

| Where | How |
|---|---|
| In the shop | Sign in → **حسابي / My account** → change your password |
| In `.env` | Set `ADMIN_PASSWORD=your-new-password` and restart |
| In the terminal | `npm run password` — asks for the new one without showing it |

### Forgot it?

```bash
npm run password
```

That resets the owner password and signs out every device. It works entirely offline —
there is no e-mail to wait for and no way to get locked out permanently.

To change or add owners, edit `ADMIN_EMAILS` in `.env` (comma-separated) and restart.
Roles re-sync on every request, so adding or removing an address takes effect at once.

### How sign-in is kept safe

| Protection | What it does |
|---|---|
| scrypt password hashing | Memory-hard, with a random salt per password; the real password is never stored |
| Parameters stored per hash | They can be raised later without invalidating anyone's password |
| Constant-time comparison | No timing side-channel on the check |
| Identical failures | A wrong address and a wrong password fail the same way, and take the same time, so nobody can discover who has an account |
| 8 wrong guesses | The address is locked for 15 minutes (`MAX_LOGIN_ATTEMPTS`, `LOCKOUT_MINUTES`) |
| Per-device limit | Caps attempts from one IP regardless of which address is tried |
| Session tokens hashed | A leaked database still cannot impersonate anyone |
| `HttpOnly` + `SameSite` + `Secure` cookies | Not readable by scripts, not sent cross-site |
| Origin checking on writes | Blocks cross-site request forgery |
| Password change ends other sessions | Signs out anyone else who had your account open |
| Owner-only API guard | Every `/api/admin/*` route re-checks the role server-side |

---

## ٣. لوحة التحكم · What the dashboard does

| Section | What you can do |
|---|---|
| **الرئيسية** Overview | Revenue, **profit** (from your dollar cost), pending orders, stock warnings, a 14-day sales chart, best sellers |
| **المنتجات** Products | Add, edit and delete products; names and descriptions in Arabic **and** English; brand; item code; price; was-price; **your purchase cost in dollars**; stock count; show/hide from the shop; mark as featured; up to 8 photos each |
| **الأقسام** Categories | Create your own sections with an emoji icon and custom ordering |
| **الطلبات** Orders | Every order with its items, customer, address and phone; change status (new → confirmed → shipped → delivered); message the customer on WhatsApp in one click; cancelling an order puts the stock back automatically |
| **الزبائن** Customers | Everyone who signed up, how many orders they placed and how much they spent; give a forgotten account a new password; block a customer if you need to |
| **الإعدادات** Settings | Shop name and tagline in both languages, announcement bar, WhatsApp number, Instagram, delivery charge, free-delivery threshold, and the dollar exchange rate |

### Photos

Add them in **Products → Edit → الصور**. Tap the box or drag pictures in.

Photos are shrunk in your browser before upload (max 1200px, JPEG), so a photo straight
from your phone becomes a small fast-loading file. The **first photo is the main one**
shown in the shop. Only real JPG/PNG/WEBP/GIF files are accepted — the server checks the
actual bytes, not the file name, so a disguised file is rejected.

### The profit figure

Enter what you **paid in dollars** in `تكلفة الشراء ($)` and set the dollar rate in
Settings. The dashboard then shows your real profit, and the product form shows your
margin per item live as you type — with a warning if you would be selling at a loss.

Customers never see your cost price. It is stripped from every public API response.

### When a customer forgets their password

**الزبائن → كلمة مرور جديدة**. You get a temporary password on screen to pass on to
them; they can change it from their own account page. Their old sessions are ended and
any lockout is lifted straight away.

---

## ٤. كيف يشتري الزبون · How customers order

1. Browse or search, filter by category, tap a product for the full details.
2. Add to basket, adjust quantities.
3. Checkout with name, phone, city (all Palestinian cities are listed) and address.
4. The order is saved, stock is reduced, and they get an order number.
5. They can then send the whole order to your WhatsApp with one tap.

Payment is cash on delivery — no card processing is involved, so there is nothing
sensitive to store.

**Prices and stock are always taken from the database, never from the browser.** If
someone edits the page to claim a product costs 1 ₪, the server ignores it and charges
the real price. Ordering more than you have in stock is refused.

**Customers do not need an account to order.** Signing up is optional — it just
pre-fills their details and lets them see past orders at `/account.html`.

---

## ٥. النشر على الإنترنت · Going live

```ini
NODE_ENV=production
PUBLIC_URL=https://yourdomain.com
SECRET_KEY=<paste the output of: npm run secret>
```

`SECRET_KEY` matters: without it a new random key is generated on every restart, which
signs everybody out each time the server restarts.

Run the server behind a reverse proxy (Nginx, Caddy) with **HTTPS**. Secure cookies
require it, and so does sending passwords safely. Any host that runs Node works — a small
VPS, Railway, Render, Fly.io.

Keep the process alive with `pm2`, `systemd`, or your host's own restart policy.

### Backups

Everything lives in two places:

- `data/shop.db` — products, orders, customers, settings
- `public/uploads/` — product photos

Copy both regularly. That is your whole shop.

---

## ٦. بنية المشروع · Project layout

```
server/
  index.js          HTTP server, routing, owner bootstrap
  config.js         .env loading and defaults
  db.js             SQLite schema, migrations, query helpers
  http.js           router, cookies, rate limiting, CSRF, static serving
  auth.js           password hashing, sessions, role guards
  storage.js        photo validation and saving
  seed.js           starter categories and products
  set-password.js   the "npm run password" tool
  routes/
    auth.js         sign up, sign in, password change, profile
    shop.js         public catalogue and checkout
    admin.js        owner-only management API
public/
  index.html        storefront
  login.html        sign in / create account
  admin.html        owner dashboard
  account.html      customer account, password, order history
  assets/css/main.css
  assets/js/        core.js · shop.js · login.js · admin.js · account.js
```

Both languages are served from one set of files — the layout flips between RTL and LTR
using CSS logical properties, so there is no second stylesheet to maintain.

---

## ٧. أسئلة شائعة · Troubleshooting

**I lost the owner password.** `npm run password`. It sets a new one straight away.

**"Too many sign-in attempts."** Eight wrong guesses locks that address for 15 minutes.
Wait it out, or run `npm run password` — setting a new password clears the lockout.

**I get signed out whenever I restart.** `SECRET_KEY` is empty. Run `npm run secret` and
paste the result into `.env`.

**The password prompt did not appear at first start.** It only prints when the owner
account has no password yet. If you set `ADMIN_PASSWORD` in `.env`, that one is used
instead and nothing is printed.

**Photos do not appear.** Make sure `public/uploads/` exists and the server can write
to it.

**I want to start the catalogue over.** `npm run reset` clears products and categories
and re-seeds. Orders and customers are untouched.
