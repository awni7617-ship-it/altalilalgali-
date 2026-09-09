# تطبيق الطليل الغالي · The phone app

A real native iPhone and Android app, built with Expo. It is **not** a website in a
frame — native navigation, native lists, the phone camera for product photos, and the
device keychain for your session.

It talks to the same Cloudflare shop as the website, so products, orders and customers
are the same everywhere. Change a price in the app and the website shows it instantly.

---

## ١. جرّبيه · Try it, today, free

No Apple account needed for this part.

1. Install **Expo Go** from the App Store on your iPhone.
2. On your computer, **double-click** `START-SHOP` in the folder above this one
   (`.command` on a Mac, `.bat` on Windows). It starts the shop **and opens this
   app in a second window** — that second window is the one with the QR code.

   To run only the app, without a shop on this computer, double-click
   **`START-APP`** in this folder instead.

   *(On a Mac the first time, if it says a file can't be opened —
   right-click it, choose **Open**, then **Open** again.)*
3. **A browser page opens with the QR code.** Point the iPhone **Camera** at it
   and tap the banner.

   The QR code is drawn in the browser rather than only in the black window,
   because the Windows console draws Expo's terminal QR as blanks — the code is
   there, but a camera has nothing to read. The same page also shows an
   `exp://…` address: in Expo Go, **Enter URL manually** and that address do the
   same job as scanning.

Your phone and the computer must be on the same WiFi. The app opens on your
phone; edit a file and it reloads instantly.

Nothing in the folder shows the QR code on its own — it only appears once one
of those two files is running. Leave that window open while you use the app.

### Which shop the app talks to

An app with no shop behind it can only show a connection error, so before it
starts, `START-APP` looks for a shop running on this computer — the one
`START-SHOP` in the folder above starts — and uses that when it finds one. It
says which one it picked:

```
Shop:  http://192.168.1.14:3000   (running on this computer)
```

So the quickest way to see the whole thing working, with no Cloudflare account
and nothing published yet, is to double-click **`START-SHOP`** first and
**`START-APP`** second, then scan the code.

Once the shop is published, close the `START-SHOP` window and `START-APP` goes
back to the published address in `app.json`.

If you would rather type it yourself:

```bash
npm install
npm start
```

### Point it at your shop

Open `app.json` and set your real address:

```json
"extra": { "apiUrl": "https://altalil-shop.pages.dev" }
```

To test against a shop running on your own computer instead:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.14:3000 npm start
```

(Your computer's network address — not `localhost`, which on a phone means the phone.)

---

## ٢. على App Store · Getting it on the App Store

**This part costs $99 a year.** Apple charges that for a Developer account and there is
no free tier. Android's Play Store is a one-off $25.

### What you need

1. An **Apple Developer account** — [developer.apple.com](https://developer.apple.com), $99/year.
2. An **Expo account** — free, at [expo.dev](https://expo.dev).

No Mac required: Expo builds it on their machines.

### Build and submit

```bash
npm install -g eas-cli
eas login
eas build:configure
eas build --platform ios      # Expo builds the app for you
eas submit --platform ios     # sends it to App Store Connect
```

Then in [App Store Connect](https://appstoreconnect.apple.com) add the screenshots,
description and privacy answers, and press **Submit for review**. Review usually takes
one to three days.

### Before you submit — read this

Apple rejects apps that are just a website in a wrapper (**Guideline 4.2, Minimum
Functionality**). This app is built to pass that: real native screens, the camera, and
owner tools that a website tab does not have. To keep it that way:

- **Do not** replace screens with a web view.
- Fill the shop with real products and photos first — a reviewer opening an empty shop
  is a common rejection.
- Give them a **test account** in the review notes (an e-mail and password that works),
  or they cannot get past your sign-in screen. This one is very commonly missed.
- Apple asks whether the app uses encryption. It does not use any beyond standard
  HTTPS, which is why `ITSAppUsesNonExemptEncryption` is already set to `false`.

Because you sell physical goods delivered to a customer, Apple's 30% commission does
**not** apply — that is only for digital purchases. Cash on delivery is fine.

---

## ٣. ما بداخل التطبيق · What is in the app

| Screen | What it does |
|---|---|
| Sign in | Sign in or create an account; the session is kept in the device keychain |
| Shop | Product grid, categories, search, pull to refresh |
| Product | Photo carousel, description, stock, quantity picker |
| Basket | Kept on the device, survives closing the app |
| Checkout | Name, phone, city, address; the order is saved, then handed to WhatsApp |
| My account | Details and full order history |
| **Owner** | Live takings and profit, orders with one-tap status changes and WhatsApp, products with stock and visibility switches, add or edit a product **using the phone camera** |

The owner screens only appear when the owner signs in.

---

## ٤. تحديث التطبيق لاحقاً · Updating it later

Change a file, then:

```bash
eas build --platform ios && eas submit --platform ios
```

Small JavaScript changes can skip review entirely with `eas update`, which pushes the
change straight to phones that already have the app.

---

## ٥. البنية · Layout

```
app/
  _layout.js            navigation and shared providers
  login.js              sign in / create account
  index.js              the shop
  product/[id].js       one product
  cart.js               basket
  checkout.js           order and WhatsApp handoff
  account.js            customer details and orders
  owner/
    index.js            takings, profit, stock warnings
    orders.js           orders and status
    products.js         product list with quick switches
    product/[id].js     add or edit, with the camera
lib/
  api.js                the shop connection and who is signed in
  cart.js               the basket
  theme.js              colours and money formatting
  ui.js                 shared buttons, fields, cards
```
