@echo off
setlocal EnableDelayedExpansion
title Heartborn - Push to GitHub
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo  Git is not installed. Get it from https://git-scm.com and run this again.
  pause
  exit /b 1
)

if not exist ".git" (
  git init -b main >nul
  echo Created a new git repository.
)

rem ---- who is committing (asked once) ----
git config user.name >nul 2>nul
if errorlevel 1 (
  set /p GNAME=Your GitHub username:
  git config user.name "!GNAME!"
)
git config user.email >nul 2>nul
if errorlevel 1 (
  echo Tip: use your GitHub "noreply" email from https://github.com/settings/emails to keep your real email private.
  set /p GEMAIL=Email for commits:
  git config user.email "!GEMAIL!"
)

rem ---- where to push (asked once) ----
git remote get-url origin >nul 2>nul
if errorlevel 1 (
  echo.
  echo  1. Open https://github.com/new
  echo  2. Name it heartborn, leave "Add a README" UNCHECKED, click Create repository
  echo  3. Copy the URL it shows, like https://github.com/yourname/heartborn.git
  echo.
  set /p REPO=Paste the repository URL here:
  git remote add origin "!REPO!"
)

rem ---- commit and push ----
echo.
set MSG=
set /p MSG=What did you change? (press Enter for "Update"):
if "!MSG!"=="" set MSG=Update

git add -A
git commit -m "!MSG!" >nul 2>nul
if errorlevel 1 echo Nothing new to commit - pushing anyway.
git branch -M main
git push -u origin main
if errorlevel 1 (
  echo.
  echo  Push failed. If a login window appeared, sign in to GitHub and run push.bat again.
  pause
  exit /b 1
)

rem ---- show the website link ----
for /f "delims=" %%u in ('powershell -NoProfile -Command "$u = git remote get-url origin; if ($u -match 'github\.com[:/]([^/]+)/([^/]+?)(\.git)?$') { 'https://' + $matches[1].ToLower() + '.github.io/' + $matches[2] + '/' }"') do set SITE=%%u
for /f "delims=" %%u in ('git remote get-url origin') do set REPOURL=%%u

echo.
echo  ==========================================================
echo   Pushed!
echo   Code:    !REPOURL!
echo   Website: !SITE!
echo   (the website updates about 1-2 minutes after each push)
echo  ==========================================================
echo.
pause
