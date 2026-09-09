#!/bin/bash
# Double-click this file on a Mac to run the shop on this computer.
cd "$(dirname "$0")" || exit 1

# Wrangler asks about usage metrics the first time and waits for an answer,
# which would look like the window had frozen. Answer it here instead.
export WRANGLER_SEND_METRICS=false

echo ""
echo "  ============================================="
echo "     الطليل الغالي — the shop"
echo "  ============================================="
echo ""

if ! command -v node >/dev/null 2>&1; then
  echo "  Node.js is not installed yet."
  echo "  Get it from https://nodejs.org (the green LTS button),"
  echo "  then double-click this file again."
  echo ""
  read -r -p "  Press Enter to close."
  exit 1
fi

if [ ! -f .dev.vars ]; then
  echo "  First run — choose the owner password."
  echo "  This is what you will type to sign in as the owner."
  echo "  At least 8 characters. It stays on this computer."
  echo ""
  while :; do
    read -r -p "  Owner password: " OWNER_PASSWORD
    node scripts/setup-local-vars.mjs "$OWNER_PASSWORD" && break
  done
  unset OWNER_PASSWORD
  echo ""
fi

if [ ! -d node_modules ]; then
  echo "  Downloading what the shop needs. This takes a couple of"
  echo "  minutes the first time. Leave it alone."
  echo ""
  npm install || { echo "  Install failed."; read -r -p "  Press Enter to close."; exit 1; }
fi

echo "  Preparing the database…"
if ! npm run db:local >db-setup.log 2>&1; then
  echo "  The database could not be prepared:"
  tail -20 db-setup.log
  read -r -p "  Press Enter to close."
  exit 1
fi
rm -f db-setup.log

# localhost means "this phone" to a phone, so the app needs this
# computer's address on the WiFi instead.
LANIP=""
for iface in en0 en1 en2 en3 en4 en5; do
  LANIP=$(ipconfig getifaddr "$iface" 2>/dev/null) && [ -n "$LANIP" ] && break
  LANIP=""
done
if [ -z "$LANIP" ]; then
  DEFAULT_IFACE=$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')
  [ -n "$DEFAULT_IFACE" ] && LANIP=$(ipconfig getifaddr "$DEFAULT_IFACE" 2>/dev/null)
fi

echo ""
echo "  ---------------------------------------------"
echo "   Starting the shop."
echo ""
echo "   In a browser here:  http://localhost:3000"
if [ -n "$LANIP" ]; then
  echo "   From your phone:    http://$LANIP:3000"
fi
echo ""
echo "   Owner sign-in:  carsyardltd@icloud.com"
echo "                   the password you chose"
echo ""
echo "   Leave this window open. Ctrl+C stops the shop."
echo "  ---------------------------------------------"
echo ""

npm run dev -- --ip 0.0.0.0
