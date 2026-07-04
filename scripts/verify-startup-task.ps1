#!/usr/bin/env pwsh
# Verify NexusForge Production Startup Task Registration

param(
  [switch]$Details = $false
)

$taskName = "NexusForge-Production-Startup"

Write-Host "`n=== Task Scheduler Verification ===" -ForegroundColor Cyan

try {
  $task = Get-ScheduledTask -TaskName $taskName -ErrorAction Stop
  
  Write-Host "TASK FOUND: $taskName" -ForegroundColor Green
  Write-Host "`nTask Details:" -ForegroundColor Yellow
  Write-Host "  State: $($task.State)" -ForegroundColor Gray
  Write-Host "  Description: $($task.Description)" -ForegroundColor Gray
  Write-Host "  Enabled: $($task.Enabled)" -ForegroundColor Gray
  
  if ($Details) {
    Write-Host "`nTriggers:" -ForegroundColor Yellow
    foreach ($trigger in $task.Triggers) {
      Write-Host "  - $($trigger.GetType().Name)" -ForegroundColor Gray
    }
    
    Write-Host "`nAction:" -ForegroundColor Yellow
    Write-Host "  Executable: $($task.Actions.Execute)" -ForegroundColor Gray
    Write-Host "  Arguments: $($task.Actions.Arguments)" -ForegroundColor Gray
  }
  
  Write-Host "`nStatus: REGISTERED AND READY" -ForegroundColor Green
  exit 0
  
} catch {
  Write-Host "TASK NOT FOUND: $taskName" -ForegroundColor Red
  Write-Host "Registration may have failed or requires admin elevation" -ForegroundColor Yellow
  Write-Host "`nError: $_" -ForegroundColor Red
  exit 1
}
