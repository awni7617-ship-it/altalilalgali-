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

if not exist node_modules (
  echo   First run - downloading what the app needs.
  echo   This takes a few minutes. Leave it alone.
  echo.
  call npm install
  if errorlevel 1 ( echo   Install failed. & pause & exit /b 1 )
)

echo.
echo   A QR code will appear below.
echo   Point your iPhone CAMERA at it, then tap the banner.
echo   Your phone and this computer must be on the same WiFi.
echo.
echo   Press Ctrl+C in this window to stop.
echo.

call npm start
pause
