# الطليل الغالي · Al-Talil Al-Ghali

متجر مكياج إلكتروني كامل يعمل بالكامل على Cloudflare — واجهة عربية، تسجيل دخول
بكلمة مرور، ولوحة تحكم للمالك.

A complete makeup shop for Palestine that runs entirely on Cloudflare. Nothing else to
sign up for: the pages, the server, the database and the photos all live in one
Cloudflare account.

| What | Where it runs |
|---|---|
| The shop and dashboard pages | Cloudflare Pages |
| Logins, orders, the API | Cloudflare Functions |
| Products, customers, orders | Cloudflare D1 (a database) |
| Product photos | Cloudflare R2 (file storage) |

---

## ١. جرّبيه على جهازك · Try it on your computer first

You need **Node.js** installed once ([nodejs.org](https://nodejs.org), the green LTS
button). Then **double-click** the file in this folder:

- **`START-SHOP.command`** on a Mac
- **`START-SHOP.bat`** on Windows

*(On a Mac the first time, if it says the file can't be opened — right-click it,
choose **Open**, then **Open** again.)*

The first run asks you to choose the owner password, then downloads what it needs
and starts the shop. Open **http://localhost:3000** and sign in with
**`carsyardltd@icloud.com`** and that password. Nothing here touches the internet;
it is all running on your own machine.

It also opens a **second window** for the phone app, which is where the QR code
comes from. Two windows, two jobs:

| Window | What it is | Shows a QR code? |
|---|---|---|
| `START-SHOP` | the shop itself — Cloudflare's tools, "Compiled Worker successfully" | no |
| `START-APP` | the phone app — opens the QR code in your browser | **yes** |

Press `Ctrl+C` in either window to stop it.

### If you would rather type it

```bash
npm install         # downloads the Cloudflare tool
npm run db:local    # builds a test database on your computer
npm run dev         # starts the shop
```

Then create a file called **`.dev.vars`** next to this README:

```ini
ADMIN_PASSWORD=choose-something-here
SECRET_KEY=any-long-random-text-for-testing
```

---

## ٢. انشريه على Cloudflare · Publish it

Everything below happens once. You need a free Cloudflare account.

### Step 1 — sign in to Cloudflare

```bash
npx wrangler login
```

A browser window opens; approve it and come back.

### Step 2 — make the database and the photo store

```bash
npx wrangler d1 create altalil-shop-db
npx wrangler r2 bucket create altalil-shop-photos
```

The first command prints a **database_id**. Open `wrangler.toml` and paste it in place
of `PUT_YOUR_DATABASE_ID_HERE`.

### Step 3 — build the tables

```bash
npm run db:remote
```

### Step 4 — publish

```bash
npm run deploy
```

It gives you an address like `altalil-shop.pages.dev`. **The shop is live.**

### Step 5 — set your passwords

In the Cloudflare dashboard: **Workers & Pages → altalil-shop → Settings → Variables and
Secrets**. Add these two as **Secret** (not plain text):

| Name | Value |
|---|---|
| `ADMIN_PASSWORD` | the owner password you want |
| `SECRET_KEY` | run `npm run secret` and paste the result |

Also add `PUBLIC_URL` as a plain variable, set to your real address
(`https://altalil-shop.pages.dev`, or your own domain).

Then **Deployments → Retry deployment** so the new settings take effect. Sign in at
`/login` with the owner e-mail and the password you chose.

### Step 6 — your own domain (optional)

If your domain is already on Cloudflare: **Workers & Pages → altalil-shop → Custom
domains → Set up a custom domain**. Cloudflare does the DNS and the certificate itself.
Update `PUBLIC_URL` to match, and redeploy.

---

## ٣. تغيير المتجر لاحقاً · Changing things later

Edit the files, then run `npm run deploy` again. That is the whole update process.

Your products, orders and customers live in the database, so deploying **never** touches
them.

---

## ٤. حساب المدير · The owner account

The owner e-mail is **`carsyardltd@icloud.com`** (change it with `ADMIN_EMAILS` in
`wrangler.toml`). Whoever signs in with that address gets the dashboard; everyone else
is an ordinary customer.

**The owner password is whatever `ADMIN_PASSWORD` is set to.** To change it, edit that
secret in the Cloudflare dashboard and redeploy — or change it from your account page
inside the shop. If you ever forget it, set a new `ADMIN_PASSWORD` and redeploy; you
cannot be locked out.

### How sign-in is kept safe

| Protection | What it does |
|---|---|
| PBKDF2-SHA256 hashing | 100,000 rounds with a random salt per password; the real password is never stored |
| Constant-time comparison | No timing side-channel on the check |
| Identical failures | A wrong address and a wrong password fail the same way and take the same time, so nobody can discover who has an account |
| 8 wrong guesses | That address is locked for 15 minutes |
| Per-device limit | Caps attempts from one address regardless of which account is tried |
| Session tokens hashed | A leaked database still cannot impersonate anyone |
| `HttpOnly` + `SameSite` + `Secure` cookies | Not readable by scripts, not sent cross-site |
| Origin checking on writes | Blocks cross-site request forgery |
| One-time sign-in state | A Google or Apple callback cannot be replayed or forged |

> `PBKDF2_ITERATIONS` can lower the hashing cost if Cloudflare's free CPU allowance
> becomes a problem on sign-in. Lower is faster but weaker; 100,000 is a good default.

---

## ٥. من يرى المتجر · Who can see the shop

Out of the box **nobody sees the shop until they sign in**. To let people browse
without an account, set `REQUIRE_LOGIN` to `"false"` in `wrangler.toml` and redeploy.

> Requiring sign-in keeps your prices private, but every new customer has to register
> before they can buy, which does cost some sales. Your call.

---

## ٦. الدخول بحساب Google أو Apple · Google and Apple sign-in

Optional. A button only appears once its settings are filled in, so the shop works on
passwords alone until then. Add these as **Secrets** in the Cloudflare dashboard.

**Google** — free. At [console.cloud.google.com](https://console.cloud.google.com):
create a project, then **Credentials → OAuth client ID → Web application**, and add
`https://yourdomain.com/auth/google/callback` as an authorised redirect URI.

```
GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET
```

**Apple** — needs a paid Apple Developer account, **$99 a year**. There is no free
tier. Create a Services ID and a Sign-in key (.p8) at developer.apple.com, with
`https://yourdomain.com/auth/apple/callback` as the Return URL.

```
APPLE_CLIENT_ID, APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY
```

`PUBLIC_URL` must match your real address exactly, or both providers reject the sign-in.

---

## ٧. لوحة التحكم · What the dashboard does

| Section | What you can do |
|---|---|
| **الرئيسية** Overview | Revenue, **profit** from your dollar cost, pending orders, stock warnings, a 14-day chart, best sellers |
| **المنتجات** Products | Add, edit, delete; Arabic **and** English names and descriptions; price, was-price, **your cost in dollars**; stock; show/hide; featured; up to 8 photos |
| **الأقسام** Categories | Your own sections with an emoji icon and ordering |
| **الطلبات** Orders | Every order with items, customer and address; status flow; one-tap WhatsApp; cancelling restores the stock |
| **الزبائن** Customers | Who signed up, what they spent, give a forgotten account a new password, block someone |
| **الإعدادات** Settings | Shop name, tagline, announcement bar, WhatsApp, Instagram, delivery charge, free-delivery threshold, dollar rate |

Photos are shrunk in your browser before upload, then stored in R2. Only real
JPG/PNG/WEBP/GIF files are accepted — the server checks the actual bytes, so a
disguised file is rejected. Customers never see your cost price; it is stripped from
every public response.

---

## ٨. كيف يشتري الزبون · How customers order

Browse or search → add to basket → checkout with name, phone, city and address → the
order is saved and the stock drops → they send it to your WhatsApp in one tap. Payment
is cash on delivery, so there is nothing sensitive to store.

**Prices and stock always come from the database, never the browser.** Editing the page
to claim a product costs 1 ₪ changes nothing.

---

## ٩. على الآيفون · On your phone

It is a website, so it works on iPhone and Android with no app to install. In Safari,
tap **Share → Add to Home Screen** and it gets its own icon and opens full-screen, like
an app.

---

## ١٠. بنية المشروع · Project layout

```
wrangler.toml         Cloudflare settings (database id, shop options)
schema.sql            the database tables and starter catalogue
functions/
  _middleware.js      the sign-in wall and security headers
  api/[[route]].js    every /api endpoint
  auth/[[route]].js   Google and Apple sign-in
  uploads/[[file]].js serves product photos from R2
  lib/                http.js · auth.js · shop.js
public/
  index.html          storefront
  login.html          sign in / create account
  admin.html          owner dashboard
  account.html        customer account and orders
  assets/             css, js, app icons
```

---

## ١١. أسئلة شائعة · Troubleshooting

**"The database is not connected."** The `database_id` in `wrangler.toml` is still the
placeholder, or you have not run `npm run db:remote` yet.

**I cannot sign in after deploying.** `ADMIN_PASSWORD` is probably not set as a secret,
or the deployment has not been retried since you added it.

**Everyone gets signed out at random.** `SECRET_KEY` is missing. Add it as a secret and
redeploy.

**Google sign-in fails immediately.** `PUBLIC_URL` does not match the redirect URI you
registered, character for character.

**Photos do not appear.** The R2 bucket name in `wrangler.toml` does not match the one
you created.
