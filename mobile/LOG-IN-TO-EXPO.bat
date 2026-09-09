@echo off
REM Double-click this on Windows to sign the computer in to your Expo account.
chcp 65001 >nul 2>nul
cd /d "%~dp0"

echo.
echo   =============================================
echo      Signing this computer in to Expo
echo   =============================================
echo.
echo   Only needed when your phone says:
echo   "You're signed in to Expo Go as ..., but not signed
echo    in to Expo CLI."
echo.
echo   Use the same account you are signed in to on the phone.
echo   The password will not appear as you type it. That is normal.
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo   Node.js is not installed yet.
  echo   Get it from https://nodejs.org ^(the green LTS button^).
  echo.
  pause
  exit /b 1
)

if exist node_modules goto haveModules
echo   Downloading what is needed first. Leave it alone.
echo.
call npm install
if errorlevel 1 ( echo   Install failed. & pause & exit /b 1 )
:haveModules

call npx expo login

echo.
set "WHO="
for /f "usebackq tokens=*" %%a in (`node scripts\expo-session.mjs 2^>nul`) do set "WHO=%%a"
if defined WHO goto signedIn
echo   Not signed in. Check the e-mail and password and try again,
echo   or sign out of Expo Go on the phone instead - a signed-out
echo   Expo Go opens the app without any of this.
goto done
:signedIn
echo   Signed in as %WHO%.
echo   Now start the app again and scan the QR code.
:done

echo.
pause
