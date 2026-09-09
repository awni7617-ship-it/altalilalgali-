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

# A second copy of the app server only makes a dead window: it finds the
# port busy and, with the key menu off, has no way to ask about using
# another one. Running this again should simply hand the QR code back.
if curl -sS -m 2 http://127.0.0.1:8081/status 2>/dev/null | grep -q 'packager-status:running'; then
  rm -f ../.shop-starting
  echo "  The app is already running in another window."
  if [ -n "$LANIP" ]; then
    echo "  Here is its QR code again."
    echo ""
    node scripts/show-qr.mjs "exp://$LANIP:8081"
  fi
  echo ""
  read -r -p "  Press Enter to close this window."
  exit 0
fi

# START-SHOP leaves this behind when it opens this window itself, which
# means the shop is still warming up and is worth waiting for. Removing
# it first keeps a stale one from costing the next run the same wait.
if [ -f ../.shop-starting ]; then
  rm -f ../.shop-starting
  if [ -n "$LANIP" ]; then
    printf "  Waiting for the shop on this computer"
    for _ in $(seq 1 20); do
      curl -fsS -o /dev/null -m 2 "http://$LANIP:3000/login" 2>/dev/null && break
      printf "."
      sleep 2
    done
    echo ""
  fi
fi

if [ -z "$EXPO_PUBLIC_API_URL" ] && [ -n "$LANIP" ] &&
   curl -fsS -o /dev/null -m 2 "http://$LANIP:3000/login" 2>/dev/null; then
  export EXPO_PUBLIC_API_URL="http://$LANIP:3000"
  echo "  Shop:  http://$LANIP:3000   (running on this computer)"
else
  PUBLISHED=$(node scripts/shop-url.mjs 2>/dev/null)
  echo "  Shop:  $PUBLISHED   (the published one in app.json)"

  # Nothing on this computer, so everything rests on that address being
  # live. If it is not, the app opens perfectly and then fails at the
  # password — which is far too late to learn it.
  if [ -n "$PUBLISHED" ] &&
     ! curl -fsS -o /dev/null -m 8 "$PUBLISHED/login" 2>/dev/null; then
    echo ""
    echo "  ============================================="
    echo "   NOTHING IS ANSWERING AT THAT ADDRESS."
    echo ""
    echo "   No shop is running on this computer either, so"
    echo "   the app will open but signing in will fail with"
    echo "   \"could not reach the shop\"."
    echo ""
    echo "   Close this window and double-click START-SHOP"
    echo "   in the folder above instead. It starts both."
    echo "  ============================================="
    echo ""
    read -r -p "  Press Enter to carry on anyway, or close this window."
  fi
fi

# An access token saved by LOG-IN-TO-EXPO, for an Expo account made with
# Google, Apple or GitHub — those have no password for `expo login` to
# take. Git ignores the file; it is a credential.
if [ -f expo-token.txt ]; then
  EXPO_TOKEN=$(tr -d ' \t\r\n' < expo-token.txt)
  [ -n "$EXPO_TOKEN" ] && export EXPO_TOKEN
fi

# A phone signed in to Expo Go will not open a dev server whose computer
# is signed out — it refuses with "not signed in to Expo CLI". Saying so
# here beats letting the phone be the one to break the news.
echo ""
if EXPO_USER=$(node scripts/expo-session.mjs 2>/dev/null); then
  echo "  Expo:  signed in as $EXPO_USER"
else
  echo "  Expo:  this computer is not signed in (usually fine)."
  echo "         If the phone says \"not signed in to Expo CLI\","
  echo "         double-click LOG-IN-TO-EXPO in this folder, or sign"
  echo "         out of Expo Go on the phone."
fi

echo ""
if [ -n "$LANIP" ]; then
  echo "  Opening the QR code in your browser…"
  node scripts/show-qr.mjs "exp://$LANIP:8081"
  echo ""
  echo "  Scan it from that browser page with the iPhone Camera."

  # Expo's menu of keys to press is for launching on a simulator or a
  # phone plugged into this computer. Pressing one asks for things that
  # are not needed here — Expo Go on the machine, a development build,
  # an account — so with the QR code already in the browser there is
  # nothing in that menu worth the confusion it causes. CI turns it off.
  # The cost is Metro's watch mode, which only matters when editing the
  # app's code: delete this line to get live reloading back.
  export CI=1
else
  echo "  Your WiFi address could not be worked out, so look for the"
  echo "  line below that starts with exp:// and type it into Expo Go"
  echo "  under 'Enter URL manually'."
fi

echo ""
echo "  ---------------------------------------------"
echo "   Phone and computer must be on the same WiFi."
echo "   Nothing to press in here — the QR code is in"
echo "   your browser. Leave this open; Ctrl+C stops it."
echo "  ---------------------------------------------"
echo ""

npm start

# Reaching here means Expo stopped. Without this the window would close
# and take the reason with it.
echo ""
echo "  The app server stopped."
read -r -p "  Press Enter to close this window."
