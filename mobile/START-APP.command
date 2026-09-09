#!/bin/bash
# Double-click this file on a Mac to start the app and show the QR code.
cd "$(dirname "$0")" || exit 1

echo ""
echo "  ============================================="
echo "     الطليل الغالي — starting the phone app"
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

if [ ! -d node_modules ]; then
  echo "  First run — downloading what the app needs."
  echo "  This takes a few minutes. Leave it alone."
  echo ""
  npm install || { echo "  Install failed."; read -r -p "  Press Enter to close."; exit 1; }
fi

echo ""
echo "  A QR code will appear below."
echo "  Point your iPhone CAMERA at it, then tap the banner."
echo "  Your phone and this computer must be on the same WiFi."
echo ""
echo "  Press Ctrl+C in this window to stop."
echo ""

npm start
