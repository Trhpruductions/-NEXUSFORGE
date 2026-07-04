#!/usr/bin/env pwsh
# Pre-Flight Production Health Check
# Validates all critical production requirements before starting services
# Fails LOUD if any requirement unmet

param(
  [switch]$AutoFix = $false,
  [switch]$Silent = $false
)

$ErrorActionPreference = "Continue"
$checks = @()
$failCount = 0
$warnCount = 0

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
    Write-Host "[$Status] $Name" -ForegroundColor $color -NoNewline
    if ($Message) { Write-Host " - $Message" -ForegroundColor Gray } else { Write-Host "" }
  }
  if ($Status -eq "FAIL") { $script:failCount++ }
  if ($Status -eq "WARN") { $script:warnCount++ }
}

if (-not $Silent) {
  Write-Host "`n=== Pre-Flight Production Health Check ===" -ForegroundColor Cyan
  Write-Host "Validating critical production requirements`n"
}

# Check 1: Backend build exists
$backendBuild = "d:\NEXUSFORGE GAMGING APP\apps\server\dist\index.js"
if (Test-Path $backendBuild) {
  Write-Check "Backend Build Artifact" "PASS"
} else {
  Write-Check "Backend Build Artifact" "FAIL" "Missing: $backendBuild"
}

# Check 2: Web production build exists (CRITICAL)
$webBuild = "d:\NEXUSFORGE GAMGING APP\apps\web\.next-build"
if (Test-Path $webBuild -PathType Container) {
  Write-Check "Web Production Build (.next-build)" "PASS"
} else {
  Write-Check "Web Production Build (.next-build)" "FAIL" "Missing: $webBuild"
  if ($AutoFix) {
    Write-Host "  → AutoFix enabled: Building web app..." -ForegroundColor Yellow
    Push-Location "d:\NEXUSFORGE GAMGING APP\apps\web"
    $buildResult = npm run build 2>&1
    Pop-Location
    if ($LASTEXITCODE -eq 0) {
      Write-Host "  ✓ Web build completed" -ForegroundColor Green
      Write-Check "Web Production Build (.next-build)" "PASS" "(auto-fixed)"
      $script:failCount--
    } else {
      Write-Host "  ✗ Web build FAILED" -ForegroundColor Red
    }
  }
}

# Check 3: Desktop build exists
$desktopBuild = "d:\NEXUSFORGE GAMGING APP\apps\desktop\release\NexusForge Desktop Setup 1.0.11.exe"
if (Test-Path $desktopBuild) {
  Write-Check "Desktop Installer Artifact" "PASS"
} else {
  Write-Check "Desktop Installer Artifact" "WARN" "Missing: $desktopBuild (non-critical for API/web)"
}

# Check 4: Environment files present
$envLocal = "d:\NEXUSFORGE GAMGING APP\apps\web\.env.local"
if (Test-Path $envLocal) {
  Write-Check "Web Environment Config (.env.local)" "PASS"
} else {
  Write-Check "Web Environment Config (.env.local)" "WARN" "Missing (may fail startup)"
}

# Check 5: Node modules installed
$nodeModules = "d:\NEXUSFORGE GAMGING APP\node_modules"
if (Test-Path $nodeModules -PathType Container) {
  Write-Check "Root node_modules" "PASS"
} else {
  Write-Check "Root node_modules" "FAIL" "Missing: $nodeModules"
}

# Check 6: PM2 is installed
try {
  $pm2Version = pm2 --version 2>&1
  Write-Check "PM2 CLI" "PASS" "v$pm2Version"
} catch {
  Write-Check "PM2 CLI" "FAIL" "Not installed or not in PATH"
}

# Check 7: Disk space (warn if <2GB free)
$drive = Get-Item "D:\" -ErrorAction SilentlyContinue
if ($drive) {
  $freeGB = [Math]::Round($drive.PSObject.Properties['FreeSpace'].Value / 1GB, 1)
  if ($freeGB -lt 2) {
    Write-Check "Disk Space (D: drive)" "WARN" "Only $($freeGB)GB free"
  } else {
    Write-Check "Disk Space (D: drive)" "PASS" "$($freeGB)GB free"
  }
}

# Summary
Write-Host "`n=== Summary ===" -ForegroundColor Cyan
$passCount = ($checks | Where-Object Status -eq "PASS").Count
$warnCount = $script:warnCount
$failCount = $script:failCount

Write-Host "Checks: $($checks.Count) | [PASS] $passCount | [WARN] $warnCount | [FAIL] $failCount"

if ($failCount -gt 0) {
  Write-Host "`n[FAIL] PRODUCTION NOT READY - Critical failures detected" -ForegroundColor Red
  Write-Host "Use -AutoFix flag to attempt automatic correction" -ForegroundColor Yellow
  exit 1
} elseif ($warnCount -gt 0) {
  Write-Host "`n[WARN] PRODUCTION READY (with warnings) - Proceed with caution" -ForegroundColor Yellow
  exit 0
} else {
  Write-Host "`n[PASS] PRODUCTION READY - All critical checks pass" -ForegroundColor Green
  exit 0
}
