#!/bin/bash
# Double-click this on a Mac to sign the computer in to your Expo account.
cd "$(dirname "$0")" || exit 1

echo ""
echo "  ============================================="
echo "     Signing this computer in to Expo"
echo "  ============================================="
echo ""
echo "  Only needed when your phone says:"
echo "  \"You're signed in to Expo Go as ..., but not signed"
echo "   in to Expo CLI.\""
echo ""
echo "  Signing OUT of Expo Go on the phone works just as well"
echo "  and needs none of this."
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  Node.js is not installed yet."
  echo "  Get it from https://nodejs.org (the green LTS button)."
  echo ""
  read -r -p "  Press Enter to close."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "  Downloading what is needed first. Leave it alone."
  echo ""
  npm install || { echo "  Install failed."; read -r -p "  Press Enter to close."; exit 1; }
fi

echo "  Use the same account you are signed in to on the phone."
echo "  The password will not appear as you type it. That is normal."
echo ""

npx expo login

if WHO=$(node scripts/expo-session.mjs); then
  echo ""
  echo "  Signed in as $WHO."
  echo "  Now start the app again and scan the QR code."
  echo ""
  read -r -p "  Press Enter to close this window."
  exit 0
fi

# An account made with Google, Apple or GitHub has no password to type,
# and one with two-factor turned on cannot be signed in this way either.
# An access token is the way in for both, and for a forgotten password.
echo ""
echo "  ---------------------------------------------"
echo "   That did not sign you in."
echo ""
echo "   If you made your Expo account with Google, Apple or"
echo "   GitHub, there is no password to type — use a token:"
echo ""
echo "     1. Go to  https://expo.dev/settings/access-tokens"
echo "     2. Press 'Create token', copy what it gives you."
echo "     3. Paste it below and press Enter."
echo ""
echo "   Or press Enter on its own to skip, and sign out of"
echo "   Expo Go on the phone instead."
echo "  ---------------------------------------------"
echo ""

read -r -p "  Token (or Enter to skip): " TOKEN
TOKEN=$(printf '%s' "$TOKEN" | tr -d ' \t\r\n')

if [ -z "$TOKEN" ]; then
  echo ""
  echo "  Skipped. Sign out of Expo Go on the phone and the app"
  echo "  will open without any of this."
  echo ""
  read -r -p "  Press Enter to close this window."
  exit 0
fi

# Kept beside the app rather than in a system setting, so START-APP can
# find it and so deleting the file is all it takes to undo. Git ignores
# it; it is a credential and does not belong in the project.
printf '%s\n' "$TOKEN" > expo-token.txt
chmod 600 expo-token.txt
unset TOKEN

if WHO=$(EXPO_TOKEN=$(cat expo-token.txt) node scripts/expo-session.mjs); then
  echo ""
  echo "  Token saved ($WHO). Start the app again and scan the QR code."
else
  echo ""
  echo "  Saved, but it does not look like a token. Check you copied"
  echo "  all of it, or sign out of Expo Go on the phone instead."
fi

echo ""
read -r -p "  Press Enter to close this window."
