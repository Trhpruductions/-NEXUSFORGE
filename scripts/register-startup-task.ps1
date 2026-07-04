#!/usr/bin/env pwsh
# Register NexusForge Production Startup Task in Windows Task Scheduler
# Ensures PM2 resurrects on system reboot or user login
# Requires elevated privileges

param(
  [switch]$Uninstall = $false
)

$taskName = "NexusForge-Production-Startup"
$taskDescription = "Automatically starts NexusForge production services (API, Web, Watchdog) via PM2"
$scriptPath = "d:\NEXUSFORGE GAMGING APP\scripts\startup-production.ps1"
$user = "hankh"

Write-Host "`n=== Windows Task Scheduler Registration ===" -ForegroundColor Cyan

# Check if running as admin
$isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]"Administrator")
if (-not $isAdmin) {
  Write-Host "ERROR: This script requires administrator privileges" -ForegroundColor Red
  Write-Host "Please run PowerShell as Administrator and try again" -ForegroundColor Yellow
  exit 1
}

if ($Uninstall) {
  Write-Host "`nRemoving task: $taskName..." -ForegroundColor Yellow
  try {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction Stop
    Write-Host "Task removed successfully" -ForegroundColor Green
  } catch {
    Write-Host "Failed to remove task: $_" -ForegroundColor Red
    exit 1
  }
  exit 0
}

# Check if task already exists
$existingTask = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($existingTask) {
  Write-Host "Task already exists. Updating..." -ForegroundColor Yellow
  Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue
}

# Validate script exists
if (-not (Test-Path $scriptPath)) {
  Write-Host "ERROR: Startup script not found: $scriptPath" -ForegroundColor Red
  exit 1
}

# Create task action
$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -Resurrect"

# Create task trigger (run at user login AND at startup with 30s delay)
$triggers = @(
  (New-ScheduledTaskTrigger -AtLogOn -User $user),
  (New-ScheduledTaskTrigger -AtStartup)
)

# Create task settings
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -RunWithHighestPrivileges `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Hours 1)

# Create principal (run as system to ensure elevated privileges)
$principal = New-ScheduledTaskPrincipal `
  -UserId "SYSTEM" `
  -LogonType ServiceAccount `
  -RunLevel Highest

# Register the task
Write-Host "Registering scheduled task..." -ForegroundColor Yellow
try {
  Register-ScheduledTask `
    -TaskName $taskName `
    -Description $taskDescription `
    -Action $action `
    -Trigger $triggers `
    -Settings $settings `
    -Principal $principal `
    -Force `
    -ErrorAction Stop | Out-Null
  
  Write-Host "Task registered successfully" -ForegroundColor Green
} catch {
  Write-Host "Failed to register task: $_" -ForegroundColor Red
  exit 1
}

# Verify registration
$task = Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
if ($task) {
  Write-Host "`nTask registered and ready" -ForegroundColor Green
  Write-Host "  Task Name: $taskName" -ForegroundColor Gray
  Write-Host "  Script: $scriptPath" -ForegroundColor Gray
  Write-Host "  Triggers:" -ForegroundColor Gray
  Write-Host "    - At user login (hankh)" -ForegroundColor Gray
  Write-Host "    - At system startup" -ForegroundColor Gray
  Write-Host "`nProduction services will now auto-start on reboot or login" -ForegroundColor Cyan
} else {
  Write-Host "Task registration failed (task not found)" -ForegroundColor Red
  exit 1
}
