@echo off
title Heartborn - Publish Firebase rules
cd /d "%~dp0"
rem Publishes firestore.rules and database.rules.json to the live Firebase project.
rem The first time, a browser window opens to sign in to your Google account.
call npx firebase-tools login
call npx firebase-tools deploy --only firestore:rules,database
pause
