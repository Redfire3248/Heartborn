@echo off
title Heartborn - Which version is live?
rem Shows the version currently live on the website, and the last one built on this PC.
echo LIVE on https://redfire3248.github.io/Heartborn/ :
powershell -NoProfile -Command "try { $v = Invoke-RestMethod ('https://redfire3248.github.io/Heartborn/version.json?t=' + [DateTime]::Now.Ticks) -Headers @{ 'Cache-Control' = 'no-cache' }; '  version ' + $v.version + '   commit ' + $v.commit + '   built ' + $v.builtAt } catch { '  could not reach the site' }"
echo.
echo BUILT on this PC (dist\version.json):
if exist "%~dp0dist\version.json" (type "%~dp0dist\version.json") else (echo   nothing built yet)
echo.
echo In the game: Settings ^> Version ^> Check for updates, or admin console command: version
pause
