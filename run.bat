@echo off
title Heartborn
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed.
  echo  Download the LTS version from https://nodejs.org and run this again.
  echo.
  pause
  exit /b 1
)

if not exist "node_modules\vite" (
  echo Installing Heartborn for the first time ^(only happens once^)...
  call npm install
  if errorlevel 1 (
    echo.
    echo  Install failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

echo Building the game...
node node_modules\vite\bin\vite.js build --logLevel error
if errorlevel 1 (
  echo.
  echo  Build failed. See the error above.
  pause
  exit /b 1
)

echo.
echo  ==========================================
echo   HEARTBORN is running
echo   http://localhost:5173
echo   Keep this window open while you play.
echo  ==========================================
echo.
node node_modules\vite\bin\vite.js preview --port 5173 --open
pause
