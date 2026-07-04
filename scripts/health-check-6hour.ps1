#!/usr/bin/env pwsh
# 6-hour automated health check for NexusForge production services
# Verifies API, Web, and Watchdog are operational
# Reports to Discord webhook on failure

param(
  [string]$DiscordWebhookUrl = $env:NEXUSFORGE_HEALTH_WEBHOOK,
  [switch]$NoAlert = $false,
  [switch]$Verbose = $false
)

$ErrorActionPreference = "Continue"
$ProgressPreference = "SilentlyContinue"

$checkId = [guid]::NewGuid().ToString().Substring(0, 8)
$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss UTC"
$hostname = $env:COMPUTERNAME

Write-Host "`n=== NexusForge 6-Hour Health Check ===" -ForegroundColor Cyan
Write-Host "Timestamp: $timestamp" -ForegroundColor Gray
Write-Host "Check ID: $checkId" -ForegroundColor Gray

# Health check configuration
$checks = @(
  @{
    Name = "Backend API"
    Endpoint = "http://127.0.0.1:4001/api/health"
    Timeout = 5
    Expected = "200"
  },
  @{
    Name = "Web Frontend"
    Endpoint = "http://127.0.0.1:3000/app"
    Timeout = 5
    Expected = "200"
  },
  @{
    Name = "PM2 Services"
    Endpoint = "pm2"
    Timeout = 3
    Expected = "online"
  }
)

$results = @()
$failures = 0

foreach ($check in $checks) {
  Write-Host "`nChecking $($check.Name)..." -ForegroundColor Yellow
  
  $checkStart = Get-Date
  $statusCode = $null
  $responseTime = $null
  $checkError = $null
  
  try {
    if ($check.Endpoint -eq "pm2") {
      # PM2 status check
      $pm2output = & pm2 list 2>&1 | Select-String "nexusforge"
      if ($pm2output -match "online") {
        $statusCode = "online"
        $responseTime = ((Get-Date) - $checkStart).TotalMilliseconds
      } else {
        $statusCode = "offline"
        $checkError = "PM2 services not in online state"
      }
    } else {
      # HTTP health check (PowerShell 5.1 compatible)
      try {
        $response = Invoke-WebRequest -Uri $check.Endpoint -TimeoutSec $check.Timeout -UseBasicParsing -ErrorAction SilentlyContinue
        $statusCode = $response.StatusCode
        $responseTime = $response.Headers.'X-Response-Time' -as [double]
        if (-not $responseTime) {
          $responseTime = ((Get-Date) - $checkStart).TotalMilliseconds
        }
      } catch {
        $statusCode = "ERR"
        $checkError = $_.Exception.Message
        $responseTime = ((Get-Date) - $checkStart).TotalMilliseconds
      }
    }
  } catch {
    $statusCode = "ERR"
    $checkError = $_.Exception.Message
    $responseTime = ((Get-Date) - $checkStart).TotalMilliseconds
  }
  
  $isHealthy = $statusCode -eq $check.Expected
  $status = if ($isHealthy) { "PASS" } else { "FAIL" }
  
  if (-not $isHealthy) {
    $failures++
  }
  
  Write-Host "  Status: $status" -ForegroundColor $(if ($isHealthy) { "Green" } else { "Red" })
  Write-Host "  Response: $statusCode ($responseTime ms)" -ForegroundColor Gray
  if ($checkError) {
    Write-Host "  Error: $checkError" -ForegroundColor Red
  }
  
  $results += @{
    Check = $check.Name
    Status = $status
    Code = $statusCode
    Time = $responseTime
    Error = $checkError
  }
}

Write-Host "`n" + ("=" * 50) -ForegroundColor Cyan
$passCount = ($results | Where-Object { $_.Status -eq "PASS" }).Count
Write-Host "Results: $passCount/$($results.Count) checks passed" -ForegroundColor $(if ($failures -eq 0) { "Green" } else { "Red" })

# Send Discord alert on failure
if ($failures -gt 0 -and -not $NoAlert -and $DiscordWebhookUrl) {
  Write-Host "`nSending Discord alert..." -ForegroundColor Yellow
  
  $failedChecks = $results | Where-Object { $_.Status -eq "FAIL" }
  $description = @()
  $description += "**$failures/$($results.Count) health checks FAILED**"
  $description += ""
  
  foreach ($failed in $failedChecks) {
    $description += "**$($failed.Check)**: $($failed.Code)"
    if ($failed.Error) {
      $description += "> $($failed.Error)"
    }
  }
  
  $description += ""
  $description += "Server: $hostname"
  $description += "Check ID: $checkId"
  
  $payload = @{
    content = "[ALERT] NexusForge Health Check Failed"
    embeds = @(
      @{
        title = "Production Health Alert"
        description = ($description -join "`n")
        color = 15158332  # Red
        timestamp = [datetime]::UtcNow.ToString("o")
        footer = @{
          text = "NexusForge Health Monitor"
        }
      }
    )
  } | ConvertTo-Json -Depth 10
  
  try {
    $alertResponse = Invoke-WebRequest -Uri $DiscordWebhookUrl -Method POST -ContentType "application/json" -Body $payload -UseBasicParsing -ErrorAction SilentlyContinue
    if ($alertResponse.StatusCode -eq 204) {
      Write-Host "Alert sent successfully" -ForegroundColor Green
    } else {
      Write-Host "Alert sent with status $($alertResponse.StatusCode)" -ForegroundColor Yellow
    }
  } catch {
    Write-Host "Failed to send alert: $_" -ForegroundColor Red
  }
}

Write-Host "`n=== Health Check Complete ===" -ForegroundColor Cyan

exit $(if ($failures -eq 0) { 0 } else { 1 })
