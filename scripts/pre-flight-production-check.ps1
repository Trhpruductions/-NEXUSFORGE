#!/usr/bin/env pwsh
# Pre-Flight Production Health Check
# Validates all critical production requirements before starting services

param(
  [switch]$AutoFix = $false,
  [switch]$Silent = $false
)

$ErrorActionPreference = "Continue"
$script:checks = @()

function Write-Check {
  param([string]$Name, [string]$Status, [string]$Message = "")
  $script:checks += @{ Name=$Name; Status=$Status; Message=$Message }
  if (-not $Silent) {
    $color = switch ($Status) {
      "PASS" { "Green" }
      "FAIL" { "Red" }
      "WARN" { "Yellow" }
      default { "White" }
    }
    $tag = "[$Status]"
    Write-Host $tag -ForegroundColor $color -NoNewline
    Write-Host " $Name" -NoNewline
    if ($Message) { Write-Host " - $Message" -ForegroundColor Gray } 
    else { Write-Host "" }
  }
}

if (-not $Silent) {
  Write-Host ""
  Write-Host "Pre-Flight Production Validation" -ForegroundColor Cyan
  Write-Host ""
}

# Check 1: Backend build
$backendDist = "d:\NEXUSFORGE GAMGING APP\apps\server\dist\index.js"
if (Test-Path $backendDist) {
  Write-Check "Backend Build (dist/index.js)" "PASS"
} else {
  Write-Check "Backend Build (dist/index.js)" "FAIL" "Missing"
}

# Check 2: Web build
$webBuild = "d:\NEXUSFORGE GAMGING APP\apps\web\.next-build"
if (Test-Path $webBuild -PathType Container) {
  Write-Check "Web Build (.next-build)" "PASS"
} else {
  Write-Check "Web Build (.next-build)" "FAIL" "Missing"
  if ($AutoFix) {
    Write-Host "  Starting web build..." -ForegroundColor Yellow
    Push-Location "d:\NEXUSFORGE GAMGING APP\apps\web"
    npm run build
    if ($LASTEXITCODE -eq 0) {
      Write-Host "  Build successful" -ForegroundColor Green
      Write-Check "Web Build (.next-build)" "PASS" "auto-fixed"
    } else {
      Write-Host "  Build failed" -ForegroundColor Red
    }
    Pop-Location
  }
}

# Check 3: node_modules
$nodeModules = "d:\NEXUSFORGE GAMGING APP\node_modules"
if (Test-Path $nodeModules -PathType Container) {
  Write-Check "Dependencies (node_modules)" "PASS"
} else {
  Write-Check "Dependencies (node_modules)" "FAIL" "Missing"
}

# Check 4: Environment config
$envLocal = "d:\NEXUSFORGE GAMGING APP\apps\web\.env.local"
if (Test-Path $envLocal) {
  Write-Check "Environment (.env.local)" "PASS"
} else {
  Write-Check "Environment (.env.local)" "WARN" "Missing"
}

# Check 5: Disk space
$drive = Get-Item "D:\" -ErrorAction SilentlyContinue
if ($drive) {
  $freeGB = [Math]::Round($drive.PSObject.Properties['FreeSpace'].Value / 1GB, 1)
  if ($freeGB -gt 2) {
    Write-Check "Disk Space (D:)" "PASS" "$freeGB GB free"
  } else {
    Write-Check "Disk Space (D:)" "WARN" "Only $freeGB GB"
  }
}

# Summary
Write-Host ""
Write-Host "Summary" -ForegroundColor Cyan

$passCount = ($script:checks | Where-Object Status -eq "PASS" | Measure-Object).Count
$warnCount = ($script:checks | Where-Object Status -eq "WARN" | Measure-Object).Count
$failCount = ($script:checks | Where-Object Status -eq "FAIL" | Measure-Object).Count

Write-Host "Results: $($script:checks.Count) total / $passCount pass / $warnCount warn / $failCount fail"

if ($failCount -gt 0) {
  Write-Host "Status: FAIL - Critical checks failed" -ForegroundColor Red
  exit 1
} elseif ($warnCount -gt 0) {
  Write-Host "Status: OK - Ready with warnings" -ForegroundColor Yellow
  exit 0
} else {
  Write-Host "Status: OK - Production ready" -ForegroundColor Green
  exit 0
}
