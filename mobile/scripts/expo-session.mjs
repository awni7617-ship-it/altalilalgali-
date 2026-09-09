/* ==================================================================
   Reports whether Expo's command line is signed in.

   Expo Go refuses to open a dev server when the phone is signed in to
   an Expo account and the computer is not signed in to the same one:
   "You're signed in to Expo Go as ..., but not signed in to Expo CLI."
   Knowing which side is signed in is what lets START-APP say so before
   the phone does.

   The sign-in lives in ~/.expo/state.json under "auth", or in an
   EXPO_TOKEN variable — the same two places the CLI itself looks. This
   only reads them, so it costs nothing and works with no internet.

   Exit 0 means signed in, and the name is printed. Exit 1 means not.
   ================================================================== */
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

if (process.env.EXPO_TOKEN) {
  console.log('EXPO_TOKEN');
  process.exit(0);
}

/* Matches the CLI: EXPO_STAGING and EXPO_LOCAL move the whole folder. */
const folder =
  process.env.EXPO_STAGING ? '.expo-staging'
  : process.env.EXPO_LOCAL ? '.expo-local'
  : '.expo';

try {
  const state = JSON.parse(readFileSync(join(homedir(), folder, 'state.json'), 'utf8'));
  const auth = state?.auth;
  if (auth && (auth.sessionSecret || auth.accessToken)) {
    console.log(auth.username || 'signed in');
    process.exit(0);
  }
} catch {
  /* No file, unreadable, or not JSON — all mean not signed in. */
}

process.exit(1);
