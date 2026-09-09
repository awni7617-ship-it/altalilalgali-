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
echo   Signing OUT of Expo Go on the phone works just as well
echo   and needs none of this.
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

echo   Use the same account you are signed in to on the phone.
echo   The password will not appear as you type it. That is normal.
echo.

call npx expo login

set "WHO="
for /f "usebackq tokens=*" %%a in (`node scripts\expo-session.mjs 2^>nul`) do set "WHO=%%a"
if not defined WHO goto tryToken
echo.
echo   Signed in as %WHO%.
echo   Now start the app again and scan the QR code.
echo.
pause
exit /b 0

:tryToken
REM An account made with Google, Apple or GitHub has no password to type,
REM and one with two-factor turned on cannot be signed in this way either.
REM An access token is the way in for both, and for a forgotten password.
echo.
echo   ---------------------------------------------
echo    That did not sign you in.
echo.
echo    If you made your Expo account with Google, Apple or
echo    GitHub, there is no password to type - use a token:
echo.
echo      1. Go to  https://expo.dev/settings/access-tokens
echo      2. Press 'Create token', copy what it gives you.
echo      3. Paste it below and press Enter.
echo.
echo    Or press Enter on its own to skip, and sign out of
echo    Expo Go on the phone instead.
echo   ---------------------------------------------
echo.

set "TOKEN="
set /p "TOKEN=  Token (or Enter to skip): "
if not defined TOKEN goto skipped

REM Kept beside the app rather than in a system setting, so START-APP can
REM find it and so deleting the file is all it takes to undo. Git ignores
REM it; it is a credential and does not belong in the project.
REM Redirection first, so a space before the ">" is not written into
REM the file along with the token.
>expo-token.txt echo %TOKEN%
set "TOKEN="

set "EXPO_TOKEN="
for /f "usebackq tokens=*" %%a in (`type expo-token.txt`) do set "EXPO_TOKEN=%%a"
set "WHO="
for /f "usebackq tokens=*" %%a in (`node scripts\expo-session.mjs 2^>nul`) do set "WHO=%%a"
if not defined WHO goto badToken
echo.
echo   Token saved (%WHO%). Start the app again and scan the QR code.
echo.
pause
exit /b 0

:badToken
echo.
echo   Saved, but it does not look like a token. Check you copied
echo   all of it, or sign out of Expo Go on the phone instead.
echo.
pause
exit /b 0

:skipped
echo.
echo   Skipped. Sign out of Expo Go on the phone and the app
echo   will open without any of this.
echo.
pause
