# دار الكحل — Dar al-Kohl

A Palestinian makeup shop that takes its orders over WhatsApp, and a locked
back office for the shopkeeper. Arabic, right-to-left, light and dark.

Live: <https://claude.ai/code/artifact/33da5b73-488e-4d53-acb1-4009e3b51ddd>

## What is here

| File | What it is |
| --- | --- |
| `store.html` | The page. This is the source of truth and the file published to the Artifact. |
| `index.html` | **Generated.** The same page as a complete document — open it by double-clicking, or serve it from GitHub Pages. |
| `build.mjs` | Makes `index.html` out of `store.html`. Run `node build.mjs` after editing. |

Edit `store.html`, never `index.html` — the next build overwrites it.

## The shop

Customers browse, search, filter by section, sort, and fill a basket that
survives closing the tab. Checkout collects a name, phone, city and address
and hands the whole order to WhatsApp as a ready message; payment is on
delivery. Products with no photograph get a mother-of-pearl wash keyed to
their own id, so the grid still reads as a designed set.

## The back office

There is no "admin" button on the shop — a customer sees a shop and nothing
else. The way in is the small ◆ at the bottom of the footer (tapping the
monogram in the header five times does the same), which opens a plain sign-in
sheet: email, password, nothing else on the screen.

Signed in, the header turns black so the mode is never in doubt, and the shop
becomes a workspace: stock value at retail and at cost, projected profit, a
count of what needs attention, and a list of everything down to three pieces
or fewer. Products are added, edited, hidden and deleted from the same grid.
Nothing is public until **حفظ التغييرات** is pressed, which republishes the
page for everyone holding the link.

### Credentials

The page stores only a salted SHA-256 digest of `email:password` — neither the
address nor the password appears in the source. Change them under
**الإعدادات → بيانات الدخول** by filling in all three fields.

The password gate is a courtesy lock on the interface. The real protection is
the Artifact platform: saving calls `publish`, which only the artifact's owner
account may do, so a signed-in stranger would see the workspace and have every
save refused.

## Notes

- `index.html` opened from disk has no `publish`, so the back office there is
  read-only by design — the save bar says so.
- Fonts come from Google Fonts (Reem Kufi, Almarai, IBM Plex Mono) and fall
  back to system faces offline.
- Product photographs are resized in the browser to 760px JPEG before they are
  stored in the page, to keep it small enough to republish.
