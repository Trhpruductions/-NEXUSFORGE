#!/usr/bin/env pwsh
# NexusForge Production Automation Setup - Direct Task Registration
# Run this with: powershell -NoProfile -ExecutionPolicy Bypass -File setup-tasks-direct.ps1
# REQUIRES: "Run as Administrator"

Write-Host ""
Write-Host "=== NexusForge Production Task Registration ===" -ForegroundColor Cyan
Write-Host ""

# Verify admin context
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
if (-not $isAdmin) {
  Write-Host "ERROR: This script requires administrator privileges" -ForegroundColor Red
  Write-Host "Please run: powershell -Verb RunAs -NoProfile -ExecutionPolicy Bypass -File setup-tasks-direct.ps1" -ForegroundColor Yellow
  exit 1
}

Write-Host "✓ Running with administrator privileges" -ForegroundColor Green
Write-Host ""

# Task 1: Startup
Write-Host "[1/2] Registering NexusForge-Production-Startup..." -ForegroundColor Yellow
try {
  $action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File 'D:\NEXUSFORGE GAMGING APP\scripts\startup-production.ps1' -Resurrect"
  
  $triggers = @(
    (New-ScheduledTaskTrigger -AtLogOn),
    (New-ScheduledTaskTrigger -AtStartup)
  )
  
  $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -RunWithHighestPrivileges -MultipleInstances IgnoreNew
  
  Register-ScheduledTask -TaskName "NexusForge-Production-Startup" `
    -Description "Auto-start NexusForge services on system startup" `
    -Action $action `
    -Trigger $triggers `
    -Principal $principal `
    -Settings $settings `
    -Force | Out-Null
  
  Write-Host "✓ Startup task registered" -ForegroundColor Green
} catch {
  Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

Write-Host ""

# Task 2: Health Check
Write-Host "[2/2] Registering NexusForge-Health-Check-6Hour..." -ForegroundColor Yellow
try {
  $action = New-ScheduledTaskAction -Execute "powershell.exe" `
    -Argument "-NoProfile -ExecutionPolicy Bypass -File 'D:\NEXUSFORGE GAMGING APP\scripts\health-check-6hour.ps1'"
  
  $trigger = New-ScheduledTaskTrigger -Daily -At 12:00AM -RepetitionInterval (New-TimeSpan -Hours 6) -RepetitionDuration (New-TimeSpan -Days 1000)
  
  $principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
  $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -RunWithHighestPrivileges -MultipleInstances IgnoreNew
  
  Register-ScheduledTask -TaskName "NexusForge-Health-Check-6Hour" `
    -Description "Health check monitoring every 6 hours" `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Force | Out-Null
  
  Write-Host "✓ Health check task registered" -ForegroundColor Green
} catch {
  Write-Host "✗ Failed: $($_.Exception.Message)" -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "=== Verification ===" -ForegroundColor Cyan
Write-Host ""

$tasks = Get-ScheduledTask | Where-Object {$_.TaskName -like "NexusForge*"}
if ($tasks.Count -ge 2) {
  Write-Host "✓ Both tasks registered successfully:" -ForegroundColor Green
  $tasks | ForEach-Object {
    Write-Host "  - $($_.TaskName) (Status: $($_.State))" -ForegroundColor Green
  }
} else {
  Write-Host "⚠ Warning: Expected 2 tasks, found $($tasks.Count)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Setup complete. Tasks will activate on next system restart." -ForegroundColor Green
Write-Host ""
