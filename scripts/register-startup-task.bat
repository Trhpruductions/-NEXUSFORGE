@echo off
REM Windows batch wrapper to register NexusForge Task Scheduler with admin elevation
REM Self-elevates if not already admin
REM Usage: Double-click this file

setlocal enabledelayedexpansion

REM DISABLED (2026-10-18): the task this registers runs scripts\startup-production.ps1 as SYSTEM, and that
REM script runs "pm2 save" (forbidden on this PC: the pm2 dump is shared with other bots). Logon start-up is
REM handled by scripts\vexora-autostart.cmd. To remove an old copy of the task, run (as administrator):
REM   powershell -NoProfile -ExecutionPolicy Bypass -File scripts\register-startup-task.ps1 -Uninstall
echo register-startup-task.bat is disabled: its task ran "pm2 save" as SYSTEM, which must never run on this PC.
echo Logon start-up is handled by scripts\vexora-autostart.cmd. See README.md.
exit /b 1

REM Check if running as admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Requesting administrator privileges...
    powershell -Command "Start-Process cmd -Verb RunAs -ArgumentList '/c %0' -Wait"
    exit /b
)

echo.
echo === NexusForge Production Startup Task Registration ===
echo.

cd /d "d:\NEXUSFORGE GAMGING APP"

powershell -NoProfile -ExecutionPolicy Bypass -File scripts\register-startup-task.ps1

if %errorLevel% neq 0 (
    echo.
    echo [ERROR] Task registration failed
    pause
    exit /b 1
) else (
    echo.
    echo [OK] Task registered successfully - press any key to close
    pause
    exit /b 0
)
