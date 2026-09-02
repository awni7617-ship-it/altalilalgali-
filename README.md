# Rescue

A surplus-food marketplace in the shape of Too Good To Go: shops list the food
they have left at the end of the day as a discounted **Surprise Bag**, and
shoppers nearby reserve one and collect it inside a pick-up window.

The catalogue starts **empty on purpose**. Shops only exist once the admin adds
them.

- Mobile-first React app, no UI framework — the whole design system is in
  `src/app.css`
- Discover feed, Nearby map, Favourites, orders with a collection code
- Admin-only "+" button that opens the add-shop form (photos, location, price,
  bags, collection window)
- Light and dark themes, safe-area insets, keyboard focus states, reduced-motion
  support

---

## Running it

```bash
npm install
npm run dev          # http://localhost:5173
```

Open it on your phone by visiting your machine's LAN address on the same
Wi-Fi, or use the hosted build (see "Testing on your phone" below).

| Script | What it does |
| --- | --- |
| `npm run dev` | Dev server with hot reload |
| `npm run build` | Normal build to `dist/` — this is what Capacitor wraps |
| `npm run build:single` | Everything inlined into one file, plus `dist/artifact.html` |
| `npm run typecheck` | TypeScript, no emit |

## Admin access

Admin is what reveals the "+" button and every add / edit / delete control.

1. Open the app, go to **You → Admin access**.
2. Enter the admin address (`awni7617@gmail.com`, set in `src/config.ts`) and
   choose a passcode. That claims admin on the device.
3. From then on the same address plus passcode unlocks the admin tools, and
   **Add shop** appears on Discover and Nearby.

The passcode is stored as a salted SHA-256 digest, so it is not sitting in plain
text. Setting it up needs a secure origin (`https://`, or `localhost`), because
that is where browsers expose Web Crypto.

### Changing who the admin is

Edit `ADMIN_EMAIL` in `src/config.ts`. An existing claim lives in the device's
IndexedDB, so clear site data to re-claim.

## Where the data lives

The catalogue sits behind one interface in `src/lib/repo.ts` with two backends,
picked automatically:

| Backend | When | Behaviour |
| --- | --- | --- |
| **cloud** | Running inside claude.ai | Shops sync across your devices |
| **device** | `npm run dev`, and the packaged iOS app | Shops stay on that device |

Orders, favourites, your profile and the admin credential are **always** on the
device and never shared.

Photos are re-encoded to fit roughly 150 KB before they are stored, because the
cloud backend caps a document at 256 KiB. Photos larger than that are split
across documents automatically.

Inventory is modelled the way it should be: `store.quantity` is what the shop
put out and only an admin writes it, while reservations are their own
collection. "Bags left" is the difference. That is what lets catalogue writes
stay admin-only while shoppers can still reserve.

## Renaming the app

Everything user-facing comes from `APP` in `src/config.ts` — name, tagline, the
word for a bag, currency and locale. Also update `public/manifest.webmanifest`
and `appName` in `capacitor.config.ts`.

## Swapping in a street map

The Nearby tab draws a proximity map: you at the centre, each shop at its true
bearing and scaled distance. It is deliberately not a street map — street tiles
have to be fetched from a tile server, which the claude.ai preview blocks, so a
tile map would render as a grey rectangle while you are testing.

The packaged iOS build has no such restriction. Replace
`src/components/ProximityMap.tsx` with MapLibre or Google Maps; the props it
takes (`stores`, `center`, `selectedId`, `onSelect`) are the ones a tile map
needs too.

## Testing on your phone

`npm run build:single` produces `dist/artifact.html` — the whole app in one
file, no server needed. Host it anywhere, or open it directly.

On iOS, Safari → Share → **Add to Home Screen** installs it as a standalone app
with its own icon and no browser chrome. That is the fastest way to see how it
will feel before any App Store work.

## Getting it into the App Store

Capacitor is already configured. The `cap add ios` step needs macOS with Xcode,
so run these on a Mac:

```bash
npm install
npm run build
npx cap add ios
npx cap sync
npx cap open ios      # opens Xcode
```

In Xcode: set your team and bundle identifier, add app icons and a launch
screen, then Product → Archive → Distribute App.

`Info.plist` needs a location permission string, or the app is rejected:

```xml
<key>NSLocationWhenInUseUsageDescription</key>
<string>Rescue uses your location to show the closest shops and how far away they are.</string>
<key>NSCameraUsageDescription</key>
<string>Rescue uses the camera so you can photograph a shop when adding it.</string>
```

## Before you ship

This is a working test build, not a production system. What is missing is
deliberate, not overlooked:

1. **Real authentication.** Admin is a client-side gate. It keeps the tools out
   of the way on a device; it does not stop anyone who reads the bundle. Move
   store writes behind a server that verifies a signed-in admin.
2. **Payments.** Shoppers reserve and pay at the counter. Taking money in-app
   means Stripe (or Apple's in-app purchase rules, which do not apply to
   physical goods — but read the guidelines).
3. **Address lookup.** Locations are entered as coordinates or captured with
   "use my current location". A real build wants a geocoding search field.
4. **Accounts and receipts.** Profiles are local and there is no sign-in, so
   orders do not follow a person between devices.
5. **App Review needs** a privacy policy URL, a support URL, and a demo account
   if any part of the app is behind a login.

## Layout

```
src/
├── config.ts              App name, admin address, categories
├── app.css                The whole design system — tokens, both themes
├── App.tsx                Navigation stack and tab bar
├── state/app.tsx          One context: catalogue, orders, favourites, admin
├── lib/
│   ├── repo.ts            Catalogue, two backends behind one interface
│   ├── idb.ts             IndexedDB key/value store
│   ├── auth.ts            Admin claim, passcode digest
│   ├── image.ts           Photo resize and re-encode
│   ├── geo.ts             Distance, bearing, geolocation
│   └── format.ts          Money, times, collection codes
├── components/            Cards, photos, sheets, icons, map
└── screens/               Discover, Nearby, Favourites, You, detail, admin
```
