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
echo "  Use the same account you are signed in to on the phone."
echo "  The password will not appear as you type it. That is normal."
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

npx expo login
STATUS=$?

echo ""
if [ $STATUS -eq 0 ] && WHO=$(node scripts/expo-session.mjs); then
  echo "  Signed in as $WHO."
  echo "  Now start the app again and scan the QR code."
else
  echo "  Not signed in. Check the e-mail and password and try again,"
  echo "  or sign out of Expo Go on the phone instead — a signed-out"
  echo "  Expo Go opens the app without any of this."
fi
echo ""
read -r -p "  Press Enter to close this window."
