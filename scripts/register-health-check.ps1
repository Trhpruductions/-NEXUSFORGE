#!/usr/bin/env pwsh
# Register 6-hour health check monitoring in Windows Task Scheduler
# Runs every 6 hours to validate production services

param(
  [switch]$Uninstall = $false
)

$taskName = "NexusForge-Health-Check-6Hour"
$taskDescription = "NexusForge production health check - runs every 6 hours to verify API, Web, and services"
$scriptPath = "d:\NEXUSFORGE GAMGING APP\scripts\health-check-6hour.ps1"

Write-Host "`n=== 6-Hour Health Check Registration ===" -ForegroundColor Cyan

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
  Write-Host "ERROR: Health check script not found: $scriptPath" -ForegroundColor Red
  exit 1
}

# Create task action
$action = New-ScheduledTaskAction `
  -Execute "powershell.exe" `
  -Argument "-NoProfile -ExecutionPolicy Bypass -File `"$scriptPath`" -DiscordWebhookUrl $env:NEXUSFORGE_HEALTH_WEBHOOK"

# Create task trigger (repeating every 6 hours, starting at system startup)
$trigger = New-ScheduledTaskTrigger `
  -Once -At (Get-Date) `
  -RepetitionInterval (New-TimeSpan -Hours 6) `
  -RepetitionDuration (New-TimeSpan -Days 999)  # Repeat for ~3 years

# Create task settings
$settings = New-ScheduledTaskSettingsSet `
  -AllowStartIfOnBatteries `
  -DontStopIfGoingOnBatteries `
  -RunWithHighestPrivileges `
  -MultipleInstances IgnoreNew `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 30)

# Create principal (run as system)
$principal = New-ScheduledTaskPrincipal `
  -UserId "SYSTEM" `
  -LogonType ServiceAccount `
  -RunLevel Highest

# Register the task
Write-Host "Registering health check task..." -ForegroundColor Yellow
try {
  Register-ScheduledTask `
    -TaskName $taskName `
    -Description $taskDescription `
    -Action $action `
    -Trigger $trigger `
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
  Write-Host "`nHealth check task is ready" -ForegroundColor Green
  Write-Host "  Task Name: $taskName" -ForegroundColor Gray
  Write-Host "  Script: $scriptPath" -ForegroundColor Gray
  Write-Host "  Frequency: Every 6 hours" -ForegroundColor Gray
  Write-Host "`nNote: Discord alerts require NEXUSFORGE_HEALTH_WEBHOOK environment variable" -ForegroundColor Yellow
} else {
  Write-Host "Task registration failed (task not found)" -ForegroundColor Red
  exit 1
}
