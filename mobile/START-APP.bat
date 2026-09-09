@echo off
REM Double-click this file on Windows to start the app and show the QR code.
REM UTF-8, so the block characters Expo draws its QR code with are not
REM turned into blanks by the console's default code page.
chcp 65001 >nul 2>nul
cd /d "%~dp0"

echo.
echo   =============================================
echo      Al-Talil Al-Ghali - starting the phone app
echo   =============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js is not installed yet.
  echo   Get it from https://nodejs.org ^(the green LTS button^),
  echo   then double-click this file again.
  echo.
  pause
  exit /b 1
)

if exist node_modules goto haveModules
echo   First run - downloading what the app needs.
echo   This takes a few minutes. Leave it alone.
echo.
call npm install
if errorlevel 1 ( echo   Install failed. & pause & exit /b 1 )
:haveModules

REM This computer's address on the WiFi. The phone needs that, not
REM localhost, which to a phone means the phone.
set "LANIP="
for /f "usebackq tokens=*" %%a in (`powershell -NoProfile -Command "(Get-NetIPConfiguration ^| Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } ^| Select-Object -First 1).IPv4Address.IPAddress" 2^>nul`) do set "LANIP=%%a"

REM A second copy of the app server only makes a dead window: it finds the
REM port busy and, with the key menu off, has no way to ask about using
REM another one. Running this again should simply hand the QR code back.
curl -sS -m 2 "http://127.0.0.1:8081/status" 2>nul | findstr /c:"packager-status:running" >nul
if errorlevel 1 goto notRunningYet
del ..\.shop-starting >nul 2>nul
echo   The app is already running in another window.
if not defined LANIP goto alreadyRunningNoQr
echo   Here is its QR code again.
echo.
node scripts\show-qr.mjs "exp://%LANIP%:8081"
:alreadyRunningNoQr
echo.
pause
exit /b 0
:notRunningYet

REM START-SHOP leaves this behind when it opens this window itself, which
REM means the shop is still warming up and is worth waiting for. Removing
REM it first keeps a stale one from costing the next run the same wait.
if not exist ..\.shop-starting goto noWait
del ..\.shop-starting >nul 2>nul
if not defined LANIP goto noWait
echo   Waiting for the shop on this computer...
set /a SHOPTRIES=0
:waitForShop
curl -sS -o nul -m 2 "http://%LANIP%:3000/login" >nul 2>nul
if not errorlevel 1 goto noWait
set /a SHOPTRIES+=1
if %SHOPTRIES% GEQ 20 goto noWait
timeout /t 2 /nobreak >nul
goto waitForShop
:noWait

REM If START-SHOP is running here, talk to that instead of the published
REM shop - otherwise there is nothing to sign in to until it is on
REM Cloudflare.
if defined EXPO_PUBLIC_API_URL goto haveShop
if not defined LANIP goto noLocalShop
curl -sS -o nul -m 2 "http://%LANIP%:3000/login" >nul 2>nul
if errorlevel 1 goto noLocalShop
set "EXPO_PUBLIC_API_URL=http://%LANIP%:3000"
echo   Shop:  http://%LANIP%:3000   ^(running on this computer^)
goto haveShop
:noLocalShop
echo   Shop:  the published one in app.json
echo          ^(start START-SHOP first to use the one on this computer^)
:haveShop

REM A phone signed in to Expo Go will not open a dev server whose computer
REM is signed out - it refuses with "not signed in to Expo CLI". Saying so
REM here beats letting the phone be the one to break the news.
echo.
set "EXPOUSER="
for /f "usebackq tokens=*" %%a in (`node scripts\expo-session.mjs 2^>nul`) do set "EXPOUSER=%%a"
if not defined EXPOUSER goto expoSignedOut
echo   Expo:  signed in as %EXPOUSER%
goto expoChecked
:expoSignedOut
echo   Expo:  this computer is not signed in ^(usually fine^).
echo          If the phone says "not signed in to Expo CLI",
echo          double-click LOG-IN-TO-EXPO in this folder, or sign
echo          out of Expo Go on the phone.
:expoChecked

echo.
if not defined LANIP goto noQrPage
echo   Opening the QR code in your browser...
node scripts\show-qr.mjs "exp://%LANIP%:8081"
echo.
echo   Scan it from that browser page with the iPhone Camera.
REM Expo's menu of keys to press is for launching on a simulator or a
REM phone plugged into this computer. Pressing one asks for things that
REM are not needed here - Expo Go on the machine, a development build,
REM an account - so with the QR code already in the browser there is
REM nothing in that menu worth the confusion it causes. CI turns it off.
REM The cost is Metro's watch mode, which only matters when editing the
REM app's code: delete this line to get live reloading back.
set "CI=1"
goto qrDone
:noQrPage
echo   Your WiFi address could not be worked out, so look for the
echo   line below that starts with exp:// and type it into Expo Go
echo   under "Enter URL manually".
:qrDone

echo.
echo   ---------------------------------------------
echo    Phone and computer must be on the same WiFi.
echo    Nothing to press in here - the QR code is in
echo    your browser. Leave this open; Ctrl+C stops it.
echo   ---------------------------------------------
echo.

call npm start

echo.
echo   The app server stopped.
pause
