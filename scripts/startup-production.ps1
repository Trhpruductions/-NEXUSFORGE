#!/usr/bin/env pwsh
# Production Startup Script with Pre-Flight Validation
# Usage: .\scripts\startup-production.ps1 [-AutoFix] [-SkipValidation]

param(
  [switch]$AutoFix = $false,
  [switch]$SkipValidation = $false,
  [switch]$Resurrect = $false
)

$ErrorActionPreference = "Stop"
$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$rootPath = Split-Path -Parent $scriptPath

Write-Host "`n=== NexusForge Production Startup ===" -ForegroundColor Cyan
Write-Host "Started: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')" -ForegroundColor Gray

# Step 1: Pre-flight validation (unless skipped)
if (-not $SkipValidation) {
  Write-Host "`n→ Running pre-flight health checks..." -ForegroundColor Yellow
  $preFlightArgs = @("-Silent")
  if ($AutoFix) { $preFlightArgs += "-AutoFix" }
  
  & "$scriptPath\pre-flight-production-check.ps1" @preFlightArgs
  if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Pre-flight checks FAILED — startup cancelled" -ForegroundColor Red
    exit 1
  }
  Write-Host "✓ Pre-flight checks passed`n" -ForegroundColor Green
}

# Step 2: Choose startup mode
if ($Resurrect) {
  Write-Host "→ Mode: Resurrecting previous process list..." -ForegroundColor Yellow
  pm2 resurrect
  if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠ Resurrect failed, attempting fresh start instead" -ForegroundColor Yellow
    Push-Location $rootPath
    pm2 start ecosystem.config.cjs
    Pop-Location
  }
} else {
  Write-Host "→ Mode: Starting from ecosystem config..." -ForegroundColor Yellow
  Push-Location $rootPath
  pm2 start ecosystem.config.cjs
  Pop-Location
}

if ($LASTEXITCODE -ne 0) {
  Write-Host "✗ PM2 startup FAILED" -ForegroundColor Red
  exit 1
}

# Step 3: Wait for services to initialize
Write-Host "→ Waiting for services to initialize (5s)..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# Step 4: Health check (wait up to 30s for API readiness)
Write-Host "→ Validating service health..." -ForegroundColor Yellow
$retries = 6
$apiReady = $false
for ($i = 0; $i -lt $retries; $i++) {
  try {
    $health = Invoke-WebRequest -Uri "http://127.0.0.1:4001/api/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    if ($health.StatusCode -eq 200) {
      $apiReady = $true
      break
    }
  } catch {}
  if ($i -lt $retries - 1) {
    Write-Host "  · Retry $($i+1)/$retries..." -ForegroundColor Gray
    Start-Sleep -Seconds 5
  }
}

if (-not $apiReady) {
  Write-Host "✗ API health check FAILED — backend may not be responding" -ForegroundColor Red
  pm2 list
  exit 1
}

Write-Host "✓ API responding (200 OK)`n" -ForegroundColor Green

# Step 5: Save state and display summary
pm2 save | Out-Null
pm2 list

Write-Host "`n✅ Production startup complete" -ForegroundColor Green
Write-Host "Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss UTC')" -ForegroundColor Gray
Write-Host "`nMonitoring URLs:`n  · API: http://127.0.0.1:4001`n  · Web: http://127.0.0.1:3000`n  · Dashboard: pm2 monit" -ForegroundColor Cyan
