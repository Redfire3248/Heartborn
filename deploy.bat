@echo off
title Heartborn - Deploy website
cd /d "%~dp0"
rem Builds the game and publishes it to https://redfire3248.github.io/Heartborn/
rem (commit your changes first, so the version number matches the code)

echo Building...
call npm run build || (echo Build failed & pause & exit /b 1)

set SITE=%TEMP%\heartborn-site
if exist "%SITE%" rmdir /s /q "%SITE%"
xcopy dist "%SITE%\" /e /i /q >nul
type nul > "%SITE%\.nojekyll"
pushd "%SITE%"
git init -q -b gh-pages
git add -A
git commit -q -m "Deploy game"
git push -f https://github.com/Redfire3248/Heartborn.git gh-pages || (popd & echo Push failed & pause & exit /b 1)
popd

echo.
echo Deployed version:
type dist\version.json
echo.
echo It is live in about a minute. Check with: check-version.bat
pause
