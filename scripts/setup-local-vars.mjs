/* ==================================================================
   Writes the .dev.vars file the local shop needs, once.

   The owner password and the key that signs sessions have to come from
   somewhere, and a password baked into a file everybody downloads is
   not a password. So the first run asks for one and this writes it
   down, next to a freshly generated signing key.

   .dev.vars is git-ignored and never leaves the machine — the live
   shop on Cloudflare uses its own secrets, set separately.

   Usage:  node scripts/setup-local-vars.mjs "the-password"
   Exit 1 means the password was refused; the caller should ask again.
   ================================================================== */
import { existsSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const target = join(root, '.dev.vars');

if (existsSync(target)) process.exit(0);

const password = String(process.argv[2] ?? '');

if (password.length < 8) {
  console.log('  That is too short — it needs at least 8 characters.');
  process.exit(1);
}
if (!/[^\s]/.test(password)) {
  console.log('  A password cannot be only spaces.');
  process.exit(1);
}
if (password.includes('\n') || password.includes('\r')) {
  console.log('  That password cannot be used here. Please choose another.');
  process.exit(1);
}

writeFileSync(
  target,
  [
    '# Settings for the shop running on this computer only.',
    '# Git ignores this file. The published shop uses its own secrets.',
    `ADMIN_PASSWORD=${password}`,
    `SECRET_KEY=${randomBytes(48).toString('hex')}`,
    'REQUIRE_LOGIN=true',
    '',
  ].join('\n'),
  { mode: 0o600 },
);

console.log('  Saved. That is the password you will sign in with.');
