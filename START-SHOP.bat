@echo off
REM Double-click this file on Windows to run the shop on this computer.
cd /d "%~dp0"

REM Wrangler asks about usage metrics the first time and waits for an
REM answer, which would look like the window had frozen. Answer it here.
set "WRANGLER_SEND_METRICS=false"

echo.
echo   =============================================
echo      Al-Talil Al-Ghali - the shop
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

if exist .dev.vars goto haveVars
echo   First run - choose the owner password.
echo   This is what you will type to sign in as the owner.
echo   At least 8 characters. It stays on this computer.
echo.
:askPassword
set "OWNER_PASSWORD="
set /p "OWNER_PASSWORD=  Owner password: "
node scripts\setup-local-vars.mjs "%OWNER_PASSWORD%"
if errorlevel 1 goto askPassword
set "OWNER_PASSWORD="
echo.
:haveVars

if exist node_modules goto haveModules
echo   Downloading what the shop needs. This takes a couple of
echo   minutes the first time. Leave it alone.
echo.
call npm install
if errorlevel 1 ( echo   Install failed. & pause & exit /b 1 )
:haveModules

echo   Preparing the database...
call npm run db:local >db-setup.log 2>&1
if errorlevel 1 (
  echo   The database could not be prepared. See db-setup.log
  pause
  exit /b 1
)
del db-setup.log >nul 2>nul

REM localhost means "this phone" to a phone, so the app needs this
REM computer's address on the WiFi instead.
set "LANIP="
for /f "usebackq tokens=*" %%a in (`powershell -NoProfile -Command "(Get-NetIPConfiguration ^| Where-Object { $_.IPv4DefaultGateway -ne $null -and $_.NetAdapter.Status -eq 'Up' } ^| Select-Object -First 1).IPv4Address.IPAddress" 2^>nul`) do set "LANIP=%%a"

REM This window is the shop; the QR code for the phone lives in the app's
REM own window. Opening it here saves finding and double-clicking a second
REM file, and the marker tells it the shop is on its way up.
set "APPWINDOW="
if not exist "%~dp0mobile\START-APP.bat" goto noAppWindow
type nul > .shop-starting
start "Al-Talil - phone app" "%~dp0mobile\START-APP.bat"
set "APPWINDOW=yes"
:noAppWindow

echo.
echo   ---------------------------------------------
echo    Starting the shop.
echo.
echo    In a browser here:  http://localhost:3000
if defined LANIP echo    From your phone:    http://%LANIP%:3000
echo.
echo    Owner sign-in:  carsyardltd@icloud.com
echo                    the password you chose
echo.
if defined APPWINDOW echo    THE QR CODE IS NOT IN THIS WINDOW.
if defined APPWINDOW echo    A second window is opening for the phone app, and the
if defined APPWINDOW echo    QR code appears in your browser a minute after that.
if not defined APPWINDOW echo    THE QR CODE IS NOT IN THIS WINDOW. For that, also
if not defined APPWINDOW echo    double-click START-APP inside the "mobile" folder.
echo.
echo    Leave this window open. Ctrl+C stops the shop.
echo   ---------------------------------------------
echo.

call npm run dev -- --ip 0.0.0.0
pause
