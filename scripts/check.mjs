/**
 * The check CI runs, and the one to run before saying a change is done.
 *
 * It rebuilds what is generated and fails if the committed copy has drifted,
 * then makes sure the Worker's config still says what the deploy needs it to.
 */
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const problems = [];

async function read(path) {
  try {
    return await readFile(join(root, path), 'utf8');
  } catch {
    return null;
  }
}

/* --- the migration must match the schema it is generated from --- */
const before = await read('migrations/0001_init.sql');
execFileSync(process.execPath, [join(root, 'scripts/build-migration.mjs')], { stdio: 'pipe' });
const after = await read('migrations/0001_init.sql');
if (before !== after) {
  problems.push('migrations/0001_init.sql was out of date — it has been rebuilt, commit the change.');
}

/* --- the shop must still deploy in one click --- */
const wrangler = await read('wrangler.jsonc');
if (!wrangler) {
  problems.push('wrangler.jsonc is missing — there is nothing to deploy.');
} else {
  if (/"database_id"\s*:\s*"(|<[^"]*>|TODO|xxx+)"/i.test(wrangler)) {
    problems.push('wrangler.jsonc has a placeholder database_id. Leave the key out so the deploy provisions one.');
  }
  if (!/"migrations_dir"/.test(wrangler)) {
    problems.push('wrangler.jsonc does not point at the migrations directory.');
  }
}

const readme = await read('README.md');
if (!readme || !readme.includes('deploy.workers.cloudflare.com')) {
  problems.push('README.md has no Deploy to Cloudflare button — that button is the whole install process.');
}

const vars = await read('.dev.vars.example');
if (!vars) {
  problems.push('.dev.vars.example is missing — it is what makes the deploy page ask for the settings.');
}

/* --- the front end the Worker serves must exist --- */
for (const file of ['public/index.html', 'public/app.css', 'public/app.js', 'public/manifest.webmanifest']) {
  if (!(await read(file))) problems.push(`${file} is missing.`);
}

if (problems.length) {
  console.error('check failed:\n');
  for (const p of problems) console.error(`  • ${p}`);
  process.exit(1);
}
console.log('check passed — generated files are current and the deploy path is intact.');
