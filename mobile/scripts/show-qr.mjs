/* ==================================================================
   Draws the QR code in the browser instead of the terminal.

   Expo prints its QR code with block characters, which the Windows
   console draws as blanks or as garbage — the code is there, but the
   camera has nothing to read. A browser has no such trouble, so this
   writes the same code to a page and opens it.

   The encoder is toqr, which Expo's own command line already installs;
   if it is ever missing the page still opens and shows the address to
   type into Expo Go by hand, which works just as well.

   Usage:  node scripts/show-qr.mjs "exp://192.168.1.14:8081"
   ================================================================== */
import { writeFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = String(process.argv[2] ?? '').trim();
if (!url) {
  console.error('  No address to show.');
  process.exit(1);
}

/** The QR as a grid of true/false, or null if the encoder is unavailable. */
function encode(text) {
  try {
    const require = createRequire(import.meta.url);
    const { toQR } = require('toqr');
    const cells = toQR(text);
    const size = Math.sqrt(cells.length);
    if (!Number.isInteger(size)) return null;
    return { size, cells };
  } catch {
    return null;
  }
}

/* One <rect> per dark module. A quiet zone of four modules all round is
 * part of the specification — without it a camera cannot find the code. */
function svg(qr) {
  const QUIET = 4;
  const span = qr.size + QUIET * 2;
  const rects = [];
  for (let y = 0; y < qr.size; y++) {
    for (let x = 0; x < qr.size; x++) {
      if (qr.cells[y * qr.size + x] & 1) {
        rects.push(`<rect x="${x + QUIET}" y="${y + QUIET}" width="1" height="1"/>`);
      }
    }
  }
  return `<svg viewBox="0 0 ${span} ${span}" width="360" height="360" role="img"
     aria-label="QR code" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
  <rect width="${span}" height="${span}" fill="#ffffff"/>
  <g fill="#000000">${rects.join('')}</g>
</svg>`;
}

const qr = encode(url);
const escaped = url.replace(/&/g, '&amp;').replace(/</g, '&lt;');

const page = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>الطليل الغالي — open the app</title>
<style>
  :root { color-scheme: light; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    background: #f6f2f7; color: #241b28; padding: 24px;
    font: 15px/1.6 -apple-system, "Segoe UI", system-ui, sans-serif;
  }
  .card {
    background: #fff; border-radius: 20px; padding: 32px 34px; max-width: 460px;
    text-align: center; box-shadow: 0 12px 40px rgba(60, 20, 70, .12);
  }
  h1 { margin: 0 0 4px; font-size: 21px; }
  .sub { margin: 0 0 22px; color: #6b5c72; font-size: 14px; }
  .qr { display: inline-block; padding: 12px; background: #fff; border-radius: 12px; }
  .missing {
    padding: 28px 16px; background: #f6f2f7; border-radius: 12px;
    color: #6b5c72; font-size: 14px;
  }
  .url {
    margin: 20px 0 0; padding: 13px 14px; border-radius: 11px;
    background: #f6f2f7; border: 1px solid #e6dcea;
    font-family: ui-monospace, "Cascadia Mono", Menlo, Consolas, monospace;
    font-size: 15px; word-break: break-all; user-select: all;
  }
  ol { text-align: start; margin: 22px 0 0; padding-inline-start: 22px; color: #4a3d51; }
  li { margin-bottom: 7px; }
  .foot { margin: 20px 0 0; font-size: 13px; color: #8b7d91; }
</style>
</head>
<body>
  <div class="card">
    <h1>الطليل الغالي</h1>
    <p class="sub">Open the app on your iPhone</p>

    ${qr
      ? `<div class="qr">${svg(qr)}</div>`
      : `<div class="missing">The code could not be drawn — use the address below instead. It does exactly the same thing.</div>`}

    <p class="url">${escaped}</p>

    <ol>
      <li>Install <strong>Expo Go</strong> from the App Store, if you have not.</li>
      ${qr ? '<li>Open the iPhone <strong>Camera</strong>, point it at the code above, and tap the banner that appears.</li>' : ''}
      <li>${qr ? 'Or open' : 'Open'} <strong>Expo Go</strong>, tap <strong>Enter URL manually</strong>, and type the address above.</li>
    </ol>

    <p class="foot">
      Your phone and this computer must be on the same WiFi.<br>
      Keep the black window open while you use the app.
    </p>
  </div>
</body>
</html>
`;

const target = join(tmpdir(), 'altalil-open-the-app.html');
writeFileSync(target, page, 'utf8');

console.log(`  QR code opened in your browser: ${target}`);
if (!qr) console.log('  (as an address to type — the code itself could not be drawn)');

/* Opening the browser is a convenience; the path above is the fallback. */
const opener =
  process.platform === 'win32' ? ['cmd', ['/c', 'start', '', target]]
  : process.platform === 'darwin' ? ['open', [target]]
  : ['xdg-open', [target]];

/* A failed spawn reports itself through an 'error' event, not by
 * throwing, so a try/catch here would let it take the process down. */
try {
  const child = spawn(opener[0], opener[1], { detached: true, stdio: 'ignore' });
  child.on('error', () => {
    console.log('  Could not open the browser by itself — open that file yourself.');
  });
  child.unref();
} catch {
  console.log('  Could not open the browser by itself — open that file yourself.');
}
