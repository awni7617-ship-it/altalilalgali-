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

# If START-SHOP is running on this computer, talk to that instead of the
# published shop — otherwise there would be nothing to sign in to until
# the shop is on Cloudflare. The phone needs the WiFi address, not
# localhost, which to a phone means the phone.
LANIP=""
for iface in en0 en1 en2 en3 en4 en5; do
  LANIP=$(ipconfig getifaddr "$iface" 2>/dev/null) && [ -n "$LANIP" ] && break
  LANIP=""
done
if [ -z "$LANIP" ]; then
  DEFAULT_IFACE=$(route -n get default 2>/dev/null | awk '/interface:/{print $2}')
  [ -n "$DEFAULT_IFACE" ] && LANIP=$(ipconfig getifaddr "$DEFAULT_IFACE" 2>/dev/null)
fi

if [ -z "$EXPO_PUBLIC_API_URL" ] && [ -n "$LANIP" ] &&
   curl -sS -o /dev/null -m 2 "http://$LANIP:3000/login" 2>/dev/null; then
  export EXPO_PUBLIC_API_URL="http://$LANIP:3000"
  echo "  Shop:  http://$LANIP:3000   (running on this computer)"
else
  echo "  Shop:  the published one in app.json"
  echo "         (start START-SHOP first to use the one on this computer)"
fi

echo ""
echo "  ---------------------------------------------"
echo "   A QR code appears below, after about a minute."
echo "   Point your iPhone CAMERA at it, then tap the banner."
echo ""
if [ -n "$LANIP" ]; then
  echo "   NO QR CODE, or it will not scan?"
  echo "   Open Expo Go on the iPhone, tap 'Enter URL manually',"
  echo "   and type this — it does the same thing:"
  echo ""
  echo "        exp://$LANIP:8081"
  echo ""
else
  echo "   No QR code? Expo also prints an exp:// address below."
  echo "   Type that into 'Enter URL manually' in Expo Go."
  echo ""
fi
echo "   Phone and computer must be on the same WiFi."
echo "   Ctrl+C stops it. This window must stay open."
echo "  ---------------------------------------------"
echo ""

npm start

# Reaching here means Expo stopped. Without this the window would close
# and take the reason with it.
echo ""
echo "  The app server stopped."
read -r -p "  Press Enter to close this window."
