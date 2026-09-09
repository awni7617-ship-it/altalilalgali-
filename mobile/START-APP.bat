@echo off
REM Double-click this file on Windows to start the app and show the QR code.
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

REM If START-SHOP is running on this computer, talk to that instead of the
REM published shop - otherwise there would be nothing to sign in to until
REM the shop is on Cloudflare. The phone needs the WiFi address, not
REM localhost, which to a phone means the phone.
if defined EXPO_PUBLIC_API_URL goto haveShop
set "LANIP="
for /f "usebackq tokens=*" %%a in (`powershell -NoProfile -Command "(Get-NetIPConfiguration ^| Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } ^| Select-Object -First 1).IPv4Address.IPAddress" 2^>nul`) do set "LANIP=%%a"
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
echo   ---------------------------------------------
echo    A QR code appears below, after about a minute.
echo    Point your iPhone CAMERA at it, then tap the banner.
echo.
if not defined LANIP goto noManualUrl
echo    NO QR CODE, or it will not scan?
echo    Open Expo Go on the iPhone, tap 'Enter URL manually',
echo    and type this - it does the same thing:
echo.
echo         exp://%LANIP%:8081
echo.
goto haveManualUrl
:noManualUrl
echo    No QR code? Expo also prints an exp:// address below.
echo    Type that into 'Enter URL manually' in Expo Go.
echo.
:haveManualUrl
echo    Phone and computer must be on the same WiFi.
echo    Ctrl+C stops it. This window must stay open.
echo   ---------------------------------------------
echo.

call npm start

echo.
echo   The app server stopped.
pause
