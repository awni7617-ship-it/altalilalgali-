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

echo.
if not defined LANIP goto noQrPage
echo   Opening the QR code in your browser...
node scripts\show-qr.mjs "exp://%LANIP%:8081"
echo.
echo   Scan it from that browser page with the iPhone Camera.
goto qrDone
:noQrPage
echo   Your WiFi address could not be worked out, so look for the
echo   line below that starts with exp:// and type it into Expo Go
echo   under "Enter URL manually".
:qrDone

echo.
echo   ---------------------------------------------
echo    Phone and computer must be on the same WiFi.
echo    Ctrl+C stops it. This window must stay open.
echo   ---------------------------------------------
echo.

call npm start

echo.
echo   The app server stopped.
pause
