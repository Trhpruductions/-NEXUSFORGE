@echo off
rem Nexus Forge Owner Console. Runs on 127.0.0.1 only. The server prints a one-time link and opens it in the default browser.
setlocal
cd /d "%~dp0"
title Nexus Forge Owner Console (127.0.0.1 only)
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js was not found on PATH. Install Node.js 22.13 or newer, then run this file again.
  pause
  exit /b 1
)
node server.js %*
echo.
echo The owner console has stopped.
pause
