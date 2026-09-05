/**
 * Set or reset the password on any account, from the terminal.
 * This is the way back in if the owner password is ever forgotten.
 *
 *   npm run password                      the owner account
 *   npm run password someone@example.com  a specific account
 */
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { config } from './config.js';
import { db } from './db.js';
import {
  normalizeEmail, findUserByEmail, createUser, setPassword,
  checkPasswordStrength, destroyAllSessions,
} from './auth.js';

const email = normalizeEmail(process.argv[2] || config.adminEmails[0] || '');
if (!email) {
  console.error('Which account? Usage: npm run password someone@example.com');
  process.exit(1);
}

const rl = createInterface({ input: stdin, output: stdout });

/* Ask without echoing, so the password does not stay on screen or in
 * the shell history. */
async function askHidden(prompt) {
  stdout.write(prompt);
  const wasRaw = stdin.isRaw;
  if (stdin.isTTY) stdin.setRawMode(true);

  return new Promise((resolve) => {
    let value = '';
    const onData = (chunk) => {
      const s = chunk.toString('utf8');
      for (const ch of s) {
        if (ch === '\r' || ch === '\n') {
          stdin.removeListener('data', onData);
          if (stdin.isTTY) stdin.setRawMode(wasRaw);
          stdout.write('\n');
          resolve(value);
          return;
        }
        const code = ch.charCodeAt(0);
        if (code === 3) { stdout.write('\n'); process.exit(130); }        // Ctrl-C
        else if (code === 127 || code === 8) value = value.slice(0, -1);  // backspace
        else if (code >= 32) value += ch;
      }
    };
    stdin.on('data', onData);
  });
}

/* When the input is piped rather than typed (a script, a CI job),
 * read it all up front and hand out one line per prompt — readline
 * cannot serve a second question from an already-ended stream. */
async function readAllLines() {
  const chunks = [];
  for await (const chunk of stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8').split(/\r?\n/);
}

let piped = null;
async function askPiped(prompt) {
  if (piped === null) piped = await readAllLines();
  stdout.write(prompt + '\n');
  return piped.shift() ?? '';
}

const ask = stdin.isTTY ? askHidden : askPiped;

const existing = findUserByEmail(email);
console.log(existing ? `\nSetting a new password for ${email}` : `\nCreating a new account for ${email}`);

const password = await ask('New password: ');
const problem = checkPasswordStrength(password);
if (problem) {
  console.error(`\n${problem}`);
  rl.close();
  process.exit(1);
}
const again = await ask('Repeat it:    ');
if (password !== again) {
  console.error('\nThose two passwords are not the same. Nothing was changed.');
  rl.close();
  process.exit(1);
}

if (existing) {
  await setPassword(existing.id, password);
  /* A password reset should end any session someone else may hold. */
  destroyAllSessions(existing.id);
  console.log(`\nDone. ${email} can sign in with the new password; other devices were signed out.`);
} else {
  await createUser({ email, password });
  const created = findUserByEmail(email);
  console.log(
    `\nDone. ${email} was created as ${created.role === 'admin' ? 'the store owner' : 'a customer'}.`,
  );
}

rl.close();
db.close?.();
