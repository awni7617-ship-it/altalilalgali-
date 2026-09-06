/*
 * store.html is the page body that gets published as the Artifact.
 * index.html is the same page as a complete document you can open by
 * double-clicking, or serve from GitHub Pages.
 *
 * It is generated, never hand-edited:  node build.mjs
 *
 * The wrapper below is the same one the page writes for itself when the
 * shopkeeper presses "حفظ التغييرات", so the two builds cannot drift.
 */
import fs from 'node:fs';
import path from 'node:path';

const here = path.dirname(new URL(import.meta.url).pathname);
const src = fs.readFileSync(path.join(here, 'store.html'), 'utf8');
const CLOSE = '</scr' + 'ipt>';

function between(open, close, label) {
  const a = src.indexOf(open);
  if (a < 0) throw new Error(`store.html is missing ${label}`);
  const b = src.indexOf(close, a + open.length);
  if (b < 0) throw new Error(`store.html never closes ${label}`);
  return src.slice(a + open.length, b);
}

const style = between('<style id="app-style">', '</sty' + 'le>', 'the stylesheet');
const data = between('<script type="application/json" id="shop-data">', CLOSE, 'the shop data');
const script = between('<script id="app-script">', '\n' + CLOSE, 'the app script');

const name = JSON.parse(data).settings.name_ar;

const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${name}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Reem+Kufi:wght@400;500;600;700&family=Almarai:wght@300;400;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet">
<style id="app-style">${style}</style>
</head>
<body>
<div id="app"></div>
<div class="toasts" id="toasts" role="status" aria-live="polite"></div>
<script type="application/json" id="shop-data">${data.trim()}${CLOSE}
<script id="app-script">${script}
${CLOSE}
</body>
</html>
`;

fs.writeFileSync(path.join(here, 'index.html'), html);
console.log(`index.html written — ${(html.length / 1024).toFixed(1)} KB`);
