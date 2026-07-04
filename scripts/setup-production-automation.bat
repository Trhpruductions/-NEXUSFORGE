@echo off
REM Automated admin task registration for NexusForge production
REM This script registers both startup and health check tasks with full admin privileges

setlocal enabledelayedexpansion

echo.
echo === NexusForge Production Task Setup ===
echo.

REM Check if already running as admin
net session >nul 2>&1
if %errorLevel% neq 0 (
    echo [INFO] Requesting administrator privileges...
    echo.
    
    REM Re-run this script as admin
    powershell -Command "Start-Process cmd -Verb RunAs -ArgumentList '/c %0' -Wait" 2>nul
    exit /b
)

echo [OK] Running with administrator privileges
echo.

cd /d "d:\NEXUSFORGE GAMGING APP"

REM Task 1: Register Startup Task
echo [1/2] Registering NexusForge-Production-Startup task...
powershell -NoProfile -ExecutionPolicy Bypass -Command "
try {
    `$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -File \"d:\NEXUSFORGE GAMGING APP\scripts\startup-production.ps1\" -Resurrect'
    `$triggers = @(
        (New-ScheduledTaskTrigger -AtLogOn -User 'hankh'),
        (New-ScheduledTaskTrigger -AtStartup)
    )
    `$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
    `$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -RunWithHighestPrivileges -MultipleInstances IgnoreNew
    
    Register-ScheduledTask -TaskName 'NexusForge-Production-Startup' -Description 'Auto-start NexusForge services on system reboot or user login' -Action `$action -Trigger `$triggers -Principal `$principal -Settings `$settings -Force | Out-Null
    
    Write-Host '[OK] Startup task registered' -ForegroundColor Green
} catch {
    Write-Host '[ERROR] Failed to register startup task:' -ForegroundColor Red
    Write-Host `$_.Exception.Message -ForegroundColor Red
    exit 1
}
"

if %errorLevel% neq 0 (
    echo [ERROR] Startup task registration failed
    goto :error
)

echo.

REM Task 2: Register Health Check Task
echo [2/2] Registering NexusForge-Health-Check-6Hour task...
powershell -NoProfile -ExecutionPolicy Bypass -Command "
try {
    `$webhook = [System.Environment]::GetEnvironmentVariable('NEXUSFORGE_HEALTH_WEBHOOK', 'Machine')
    if ([string]::IsNullOrWhiteSpace(`$webhook)) {
        Write-Host '[WARNING] NEXUSFORGE_HEALTH_WEBHOOK not set - health alerts disabled' -ForegroundColor Yellow
    }
    
    `$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -ExecutionPolicy Bypass -File \"d:\NEXUSFORGE GAMGING APP\scripts\health-check-6hour.ps1\" -DiscordWebhookUrl ' + `$webhook
    `$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date) -RepetitionInterval (New-TimeSpan -Hours 6) -RepetitionDuration (New-TimeSpan -Days 999)
    `$principal = New-ScheduledTaskPrincipal -UserId 'SYSTEM' -LogonType ServiceAccount -RunLevel Highest
    `$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -RunWithHighestPrivileges -MultipleInstances IgnoreNew
    
    Register-ScheduledTask -TaskName 'NexusForge-Health-Check-6Hour' -Description 'Health check every 6 hours with Discord alerts' -Action `$action -Trigger `$trigger -Principal `$principal -Settings `$settings -Force | Out-Null
    
    Write-Host '[OK] Health check task registered' -ForegroundColor Green
} catch {
    Write-Host '[ERROR] Failed to register health check task:' -ForegroundColor Red
    Write-Host `$_.Exception.Message -ForegroundColor Red
    exit 1
}
"

if %errorLevel% neq 0 (
    echo [ERROR] Health check task registration failed
    goto :error
)

echo.
echo === Task Registration Complete ===
echo.
echo [OK] Both tasks registered successfully
echo.
echo Registered Tasks:
echo   1. NexusForge-Production-Startup - Runs on reboot/login
echo   2. NexusForge-Health-Check-6Hour - Runs every 6 hours
echo.

REM Verify registrations
echo Verifying task registration...
powershell -NoProfile -Command "
`$tasks = @('NexusForge-Production-Startup', 'NexusForge-Health-Check-6Hour')
foreach (`$task in `$tasks) {
    `$t = Get-ScheduledTask -TaskName `$task -ErrorAction SilentlyContinue
    if (`$t) {
        Write-Host \"  [OK] `$task\" -ForegroundColor Green
    } else {
        Write-Host \"  [MISSING] `$task\" -ForegroundColor Red
    }
}
"

echo.
echo === Setup Complete ===
pause
exit /b 0

:error
echo.
echo [ERROR] Task registration failed - check error messages above
pause
exit /b 1
