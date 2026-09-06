# دار الكحل — Dar al-Kohl

A Palestinian makeup shop: customers browse and order from their phone, the
shopkeeper runs the whole thing from hers. Arabic, right-to-left, light and
dark, and it installs to an iPhone Home Screen like an app.

Runs on Cloudflare Workers with a D1 database.

## Start here

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/awni7617-ship-it/altalilalgali-)

One click. Cloudflare creates the database, asks for the shopkeeper's sign-in
if you want to set it, builds and deploys. No terminal, nothing to install.
Every later push to the default branch deploys itself.

When it finishes you get a public address — something like
`https://dar-al-kohl.<your-name>.workers.dev`. That is the shop. Send it to
anybody.

**The first thing to do after it deploys** is sign in and change the password.
The shop starts with `awni7617@gmail.com` / `123456` unless the deploy page was
given something else, and it is on the open internet. The back office says so
in orange until it is changed.

### On an iPhone

Open the address in Safari, press Share, then **Add to Home Screen**. It opens
without Safari's chrome, keeps its own icon, and behaves like an app. The
checkout, the photographs and the back office all work the same there — the
shop is the same shop on every device, because the stock lives in the database
rather than in one browser.

## What it does

**For a customer.** Browse by section, search, sort by price or by discount,
fill a basket that survives closing the tab, and check out with a name, phone,
city and address. Payment is on delivery. The order is recorded in the shop
straight away, and WhatsApp opens with the same order written out, so there is
a copy in the thread too.

**For the shopkeeper.** The way in is the small ◆ at the bottom of the footer,
or five taps on the monogram in the header — there is no "admin" button for a
customer to find, and the sign-in screen says nothing about what is behind it.
Signed in, the header turns black so the mode is never in doubt, and the shop
becomes a workspace:

- Stock at retail and at cost, projected profit, and what needs attention.
- Every order, with one button to move it along. **Confirming an order takes
  the pieces off the shelf**, once; cancelling a confirmed one puts them back.
- Products added, edited, hidden and deleted from the same grid, with up to six
  photographs each, resized in the browser before they are uploaded.
- Shop settings — name, tagline, WhatsApp number, delivery charge, free-delivery
  threshold, the dollar rate the profit is worked out from.

Everything saves as you go. There is no publish step, because there is nothing
to publish to: the customer's next page load reads the same database.

## How it is put together

| Path | What it is |
| --- | --- |
| `src/worker.js` | The router. The API under `/api`, photographs under `/photo`, everything else falls through to the shop front. |
| `src/api.js` | The routes. What a customer may read and do, and what needs a session. |
| `src/session.js` | Accounts, cookies and sign-in throttling. |
| `src/lib/model.js` | Validation and the money maths — what a price and a margin *mean*. |
| `src/lib/schema.js` | The schema, as statements the Worker can run itself. |
| `src/lib/seed.js` | What a brand-new shop starts with. |
| `public/` | The shop front: one page, one stylesheet, one script. |
| `artifact/` | The older self-contained page — one HTML file, no server. See below. |

Three things are true of the deploy and worth knowing:

- **The Worker builds its own tables.** The one-click flow provisions an empty
  database and never runs wrangler's migrations, so a Worker that assumed a
  migrated schema would arrive broken. This one creates what is missing on
  first sight and stocks the shop.
- **`migrations/0001_init.sql` is generated** from `src/lib/schema.js` by
  `npm run build:migration`. `npm run check` fails if the committed copy has
  drifted, because a stale migration is the dangerous one.
- **`wrangler.jsonc` has no `database_id`.** That is deliberate: the deploy
  flow creates the database and binds it. A placeholder there does not defer
  the decision, it guarantees a failed deploy.

To have the deploy apply migrations before it publishes, set the Cloudflare
build's deploy command to `npm run deploy:cf`. It is not required — see the
first point.

## The CPU budget is real, and only production enforces it

A Worker on the free plan gets **10ms of CPU per request**, and neither Node
nor `wrangler dev` enforces it. Password hashing is the thing that runs into
it: 210,000 PBKDF2 rounds cost about 30ms, which kills every sign-in while
every test passes. This shop hashes at 12,000 rounds — about 6ms on the
slowest machine it has been built on — and `tests/domain.test.js` holds that
line.

That is weaker than OWASP would like, and it is a deliberate trade: a sign-in
that always fails protects nothing. Sign-in is throttled per IP to make up some
of the difference, and `PBKDF2_ITERATIONS` raises the count on a paid plan.
Accounts made under the old number keep working — each stored hash remembers
its own count.

## Working on it

```
npm install
npm run dev        # wrangler dev, with a local D1
npm test           # the API end to end through the real Worker
npm run check      # rebuilds what is generated, fails if it drifted
```

`npm test` runs against an in-memory SQLite standing in for D1, using the same
migration SQL that ships. `DARKOHL_SCHEMA=<file> npm test` runs it against a
schema dumped from a live database instead — the way to prove that what is
*deployed* still satisfies the app.

Before saying a change works, check it against the running thing. The CPU
limit and an unmigrated database are both invisible locally.

## The single-file version

`artifact/` holds the earlier build: the whole shop in one HTML file, with the
catalogue written into the page. It needs no server and no deploy, and it is
still the right answer for handing someone a shop on a USB stick. It does not
share this one's database, so the two do not stay in step — the Worker is the
real shop now.

```
node artifact/build.mjs     # regenerates artifact/index.html from store.html
```
