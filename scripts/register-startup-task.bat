@echo off
REM Windows batch wrapper to register NexusForge Task Scheduler with admin elevation
REM Self-elevates if not already admin
REM Usage: Double-click this file

setlocal enabledelayedexpansion

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
