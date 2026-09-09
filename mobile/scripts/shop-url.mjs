/* ==================================================================
   Prints the shop address the app falls back to — the published one in
   app.json — so the launcher can check whether anything is actually
   there before handing over a QR code.

   An app opened against an address with no shop on it looks completely
   fine until the moment someone types a password, and then says only
   that it could not reach the shop. That is a bad place to find out.
   ================================================================== */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

try {
  const app = JSON.parse(readFileSync(join(root, 'app.json'), 'utf8'));
  const url = String(app?.expo?.extra?.apiUrl || '').replace(/\/+$/, '');
  if (!url) process.exit(1);
  console.log(url);
} catch {
  process.exit(1);
}
