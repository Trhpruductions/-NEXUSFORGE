#!/usr/bin/env pwsh
# 24-Hour Production Stability Validator
# Captures metrics at recovery point and validates throughout recovery period

param(
  [string]$ReportPath = "var/stability-report-24h.json",
  [string]$GateOutputPath = "var/stability-gate-latest.json",
  [int]$WatchdogMaxAgeSeconds = 900,
  [int]$ExpectedManagedServiceCount = 3,
  [int]$MinCheckpointIntervalSeconds = 300,
  [int]$FlapSuppressionWindowSeconds = 300,
  [switch]$Strict = $false,
  [switch]$Checkpoint = $false,
  [switch]$Summary = $false
)

$ProgressPreference = "SilentlyContinue"
$ErrorActionPreference = "Continue"

function Get-Pm2ProcessList {
  try {
    $raw = pm2 jlist 2>$null | Out-String
    if (-not $raw -or -not $raw.Trim()) {
      return @()
    }

    # PM2 can prepend/append non-JSON lines; parse only the first JSON array segment.
    $start = $raw.IndexOf("[")
    $end = $raw.LastIndexOf("]")
    if ($start -lt 0 -or $end -lt $start) {
      return @()
    }

    $json = $raw.Substring($start, ($end - $start + 1))
    $normalized = $json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const arr=JSON.parse(s);const clean=arr.map(p=>({name:p.name,status:(p.pm2_env&&p.pm2_env.status)||'',pm_uptime:(p.pm2_env&&p.pm2_env.pm_uptime)||null}));process.stdout.write(JSON.stringify(clean));});"
    if (-not $normalized -or -not $normalized.Trim()) {
      return @()
    }

    $parsed = $normalized | ConvertFrom-Json -ErrorAction Stop
    if ($parsed -is [System.Array]) {
      return @($parsed)
    }

    if ($null -ne $parsed) {
      return @($parsed)
    }

    return @()
  } catch {
    return @()
  }
}

function Resolve-UptimeHours {
  param(
    [Parameter(Mandatory = $false)]$RawUptime,
    [Parameter(Mandatory = $true)][datetime]$NowUtc
  )

  if ($null -eq $RawUptime) {
    return $null
  }

  try {
    $startUtc = $null

    if ($RawUptime -is [string] -and $RawUptime.Trim()) {
      $parsedStringDate = $null
      if ([datetime]::TryParse($RawUptime, [ref]$parsedStringDate)) {
        $startUtc = $parsedStringDate.ToUniversalTime()
      }
    } elseif ($RawUptime -is [int] -or $RawUptime -is [long] -or $RawUptime -is [double]) {
      $uptimeMs = [int64]$RawUptime
      # PM2 uptime is typically Unix epoch milliseconds.
      if ($uptimeMs -gt 946684800000) {
        $startUtc = [DateTimeOffset]::FromUnixTimeMilliseconds($uptimeMs).UtcDateTime
      }
    }

    if ($null -eq $startUtc) {
      return $null
    }

    $hours = ($NowUtc - $startUtc).TotalHours
    if ($hours -lt 0 -or $hours -gt 24 * 365 * 5) {
      return $null
    }

    return [math]::Round($hours, 1)
  } catch {
    return $null
  }
}

function Get-WatchdogHealth {
  param(
    [Parameter(Mandatory = $true)][datetime]$NowUtc,
    [Parameter(Mandatory = $true)][int]$MaxAgeSeconds
  )

  if ($MaxAgeSeconds -le 0) {
    throw "Watchdog max age must be greater than 0 seconds."
  }

  $repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
  $logPath = Join-Path $repoRoot "var\ops-managed-watchdog.jsonl"
  if (-not (Test-Path -LiteralPath $logPath)) {
    throw "Watchdog log not found: $logPath"
  }

  $tail = Get-Content -LiteralPath $logPath -Tail 300 -ErrorAction Stop
  $lastLine = ($tail | Where-Object { $_ -and $_.Trim() }) | Select-Object -Last 1
  if (-not $lastLine) {
    throw "Watchdog log is empty: $logPath"
  }

  try {
    $record = $lastLine | ConvertFrom-Json -ErrorAction Stop
  } catch {
    throw "Watchdog latest record is invalid JSON."
  }

  $status = [string]$record.status
  if (-not $status.Trim()) {
    throw "Watchdog latest record missing status field."
  }

  $timestampRaw = [string]$record.timestampUtc
  if (-not $timestampRaw.Trim()) {
    throw "Watchdog latest record missing timestampUtc."
  }

  try {
    $timestamp = [DateTimeOffset]::Parse($timestampRaw)
  } catch {
    throw "Watchdog timestampUtc could not be parsed: $timestampRaw"
  }

  $ageSeconds = [int][Math]::Floor(($NowUtc - $timestamp.UtcDateTime).TotalSeconds)
  if ($ageSeconds -lt 0) {
    # Minor clock skew can produce tiny negative ages; clamp to zero.
    $ageSeconds = 0
  }
  $durationMs = [int]$record.durationMs
  $mode = [string]$record.mode
  $runNumber = [int]$record.runNumber

  return @{
    status = $status
    ageSeconds = $ageSeconds
    durationMs = $durationMs
    mode = $mode
    runNumber = $runNumber
    maxAgeSeconds = $MaxAgeSeconds
  }
}

function Get-ResultFingerprint {
  param(
    [Parameter(Mandatory = $true)][object[]]$Results
  )

  $normalized = @($Results | Sort-Object name | ForEach-Object {
    [PSCustomObject]@{
      name = [string]$_.name
      status = [string]$_.status
      # Keep only stable, health-significant fields for dedupe comparisons.
      statusCode = if ($null -ne $_.statusCode) { [int]$_.statusCode } else { $null }
      watchdogStatus = if ($null -ne $_.watchdogStatus) { [string]$_.watchdogStatus } else { $null }
      onlineCount = if ($null -ne $_.onlineCount) { [int]$_.onlineCount } else { $null }
      totalCount = if ($null -ne $_.totalCount) { [int]$_.totalCount } else { $null }
    }
  })

  return ($normalized | ConvertTo-Json -Depth 10 -Compress)
}

function Get-BlockingCountFromResults {
  param(
    [Parameter(Mandatory = $true)][object[]]$Results,
    [Parameter(Mandatory = $true)][bool]$StrictMode
  )

  $fails = @($Results | Where-Object { $_.status -eq "FAIL" }).Count
  $errors = @($Results | Where-Object { $_.status -eq "ERROR" }).Count
  $warnings = @($Results | Where-Object { $_.status -eq "WARNING" }).Count

  return ($fails + $errors + $(if ($StrictMode) { $warnings } else { 0 }))
}

function Get-CheckpointState {
  param(
    [Parameter(Mandatory = $true)][object[]]$Results,
    [Parameter(Mandatory = $true)][bool]$StrictMode
  )

  $blocking = Get-BlockingCountFromResults -Results $Results -StrictMode $StrictMode
  return $(if ($blocking -eq 0) { "healthy" } else { "degraded" })
}

# Recovery reference point
$recoveryTime = [datetime]"2026-07-04 03:37:00Z"
$currentTime = [datetime]::UtcNow
$elapsedHours = ($currentTime - $recoveryTime).TotalHours
$elapsedMinutes = [math]::Round(($currentTime - $recoveryTime).TotalMinutes)

Write-Host "`n=== NexusForge 24-Hour Stability Validation ===" -ForegroundColor Cyan
Write-Host "Recovery Point: 2026-07-04 03:37 UTC" -ForegroundColor Gray
Write-Host "Current Time:   $($currentTime.ToString('yyyy-MM-dd HH:mm UTC'))" -ForegroundColor Gray
Write-Host "Elapsed:        $elapsedHours hours ($elapsedMinutes minutes)" -ForegroundColor Yellow

# Collect current metrics
$metrics = @{
  timestamp = $currentTime.ToString("o")
  elapsedHours = [math]::Round($elapsedHours, 2)
  elapsedMinutes = $elapsedMinutes
  checks = @()
}

$checkpointSaved = $false
$checkpointSkipped = $false
$checkpointSkipReason = "not-requested"

# 1. PM2 Process Status
Write-Host "`n[1/6] PM2 Process Status..." -ForegroundColor Yellow
try {
  $pm2List = @(Get-Pm2ProcessList)
  $managedServices = @($pm2List | Where-Object { $_.name -like "nexusforge-*workspace" })
  $onlineCount = @($managedServices | Where-Object { $_.status -eq "online" }).Count
  $totalCount = $managedServices.Count

  $metrics.checks += @{
    name = "PM2 Services"
    status = if ($onlineCount -eq $ExpectedManagedServiceCount -and $totalCount -eq $ExpectedManagedServiceCount) { "PASS" } else { "FAIL" }
    onlineCount = $onlineCount
    totalCount = $totalCount
    detail = "$onlineCount/$totalCount services online"
  }

  Write-Host "  Online: $onlineCount/$totalCount" -ForegroundColor $(if ($onlineCount -eq $ExpectedManagedServiceCount -and $totalCount -eq $ExpectedManagedServiceCount) { "Green" } else { "Red" })

  # Get uptimes when PM2 records are available.
  foreach ($proc in $managedServices) {
    $uptimeHours = Resolve-UptimeHours -RawUptime $proc.pm_uptime -NowUtc $currentTime
    if ($null -ne $uptimeHours) {
      Write-Host "    $($proc.name): $uptimeHours h uptime" -ForegroundColor Gray
    }
  }
} catch {
  $metrics.checks += @{ name = "PM2 Services"; status = "ERROR"; detail = $_.Exception.Message }
}

# 2. API Endpoint Health
Write-Host "`n[2/6] API Endpoint (/api/health)..." -ForegroundColor Yellow
try {
  $apiResponse = Invoke-WebRequest -Uri "http://127.0.0.1:4001/api/health" -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
  $apiHealthy = $apiResponse.StatusCode -eq 200
  
  $metrics.checks += @{
    name = "API Health"
    status = if ($apiHealthy) { "PASS" } else { "FAIL" }
    statusCode = $apiResponse.StatusCode
    responseTime = "OK"
  }
  
  Write-Host "  Status: $($apiResponse.StatusCode)" -ForegroundColor $(if ($apiHealthy) { "Green" } else { "Red" })
} catch {
  $metrics.checks += @{ name = "API Health"; status = "FAIL"; detail = $_.Exception.Message }
  Write-Host "  Status: UNREACHABLE" -ForegroundColor Red
}

# 3. Web Endpoint Health
Write-Host "`n[3/6] Web Frontend (/app)..." -ForegroundColor Yellow
try {
  $webResponse = Invoke-WebRequest -Uri "http://127.0.0.1:3000/app" -TimeoutSec 5 -UseBasicParsing -ErrorAction SilentlyContinue
  $webHealthy = $webResponse.StatusCode -eq 200
  
  $metrics.checks += @{
    name = "Web Frontend"
    status = if ($webHealthy) { "PASS" } else { "FAIL" }
    statusCode = $webResponse.StatusCode
    responseTime = "OK"
  }
  
  Write-Host "  Status: $($webResponse.StatusCode)" -ForegroundColor $(if ($webHealthy) { "Green" } else { "Red" })
} catch {
  $metrics.checks += @{ name = "Web Frontend"; status = "FAIL"; detail = $_.Exception.Message }
  Write-Host "  Status: UNREACHABLE" -ForegroundColor Red
}

# 4. Disk Space
Write-Host "`n[4/6] Disk Space..." -ForegroundColor Yellow
try {
  $drive = Get-Volume -DriveLetter D -ErrorAction SilentlyContinue
  if ($drive) {
    $freeGB = [math]::Round($drive.SizeRemaining / 1GB, 1)
    $totalGB = [math]::Round($drive.Size / 1GB, 1)
    $percentFree = [math]::Round(($drive.SizeRemaining / $drive.Size) * 100, 1)
    $healthy = $percentFree -gt 5
    
    $metrics.checks += @{
      name = "Disk Space"
      status = if ($healthy) { "PASS" } else { "FAIL" }
      freeGB = $freeGB
      totalGB = $totalGB
      percentFree = $percentFree
    }
    
    Write-Host "  Free: $freeGB GB / $totalGB GB ($percentFree%)" -ForegroundColor $(if ($healthy) { "Green" } else { "Red" })
  }
} catch {
  Write-Host "  Could not determine disk space" -ForegroundColor Gray
}

# 5. Process Memory Usage
Write-Host "`n[5/6] Memory Usage..." -ForegroundColor Yellow
try {
  $processes = @(
    "node",
    "next"
  )
  
  $totalMemory = 0
  foreach ($procName in $processes) {
    $procs = Get-Process -Name $procName -ErrorAction SilentlyContinue
    if ($procs) {
      $memMB = [math]::Round(($procs | Measure-Object -Property WorkingSet -Sum).Sum / 1MB, 1)
      $totalMemory += $memMB
      Write-Host "    $procName`: $memMB MB" -ForegroundColor Gray
    }
  }
  
  $metrics.checks += @{
    name = "Memory Usage"
    status = if ($totalMemory -lt 2048) { "PASS" } else { "WARNING" }
    totalMemoryMB = $totalMemory
    detail = "$totalMemory MB total"
  }
  
  Write-Host "  Total: $totalMemory MB" -ForegroundColor $(if ($totalMemory -lt 2048) { "Green" } else { "Yellow" })
} catch {
  Write-Host "  Memory check unavailable" -ForegroundColor Gray
}

# 6. Watchdog Freshness Check
Write-Host "`n[6/6] Watchdog Freshness..." -ForegroundColor Yellow
try {
  $watchdog = Get-WatchdogHealth -NowUtc $currentTime -MaxAgeSeconds $WatchdogMaxAgeSeconds
  $watchdogHealthy = ($watchdog.status -eq "ok" -and $watchdog.ageSeconds -ge 0 -and $watchdog.ageSeconds -le $watchdog.maxAgeSeconds)

  $metrics.checks += @{
    name = "Watchdog Freshness"
    status = if ($watchdogHealthy) { "PASS" } else { "FAIL" }
    watchdogStatus = $watchdog.status
    ageSeconds = $watchdog.ageSeconds
    maxAgeSeconds = $watchdog.maxAgeSeconds
    mode = $watchdog.mode
    runNumber = $watchdog.runNumber
    durationMs = $watchdog.durationMs
    detail = "status=$($watchdog.status) age=$($watchdog.ageSeconds)s max=$($watchdog.maxAgeSeconds)s mode=$($watchdog.mode)"
  }

  Write-Host "  Status: $($watchdog.status)" -ForegroundColor $(if ($watchdogHealthy) { "Green" } else { "Red" })
  Write-Host "  Age: $($watchdog.ageSeconds)s (max $($watchdog.maxAgeSeconds)s)" -ForegroundColor $(if ($watchdogHealthy) { "Green" } else { "Red" })
  Write-Host "  Mode: $($watchdog.mode)" -ForegroundColor Gray
} catch {
  $metrics.checks += @{ name = "Watchdog Freshness"; status = "ERROR"; detail = $_.Exception.Message }
  Write-Host "  Status: ERROR" -ForegroundColor Red
}

# Summary
Write-Host "`n" + ("=" * 60) -ForegroundColor Cyan
$passCount = @($metrics.checks | Where-Object { $_.status -eq "PASS" }).Count
$warningCount = @($metrics.checks | Where-Object { $_.status -eq "WARNING" }).Count
$failCount = @($metrics.checks | Where-Object { $_.status -eq "FAIL" }).Count
$errorCount = @($metrics.checks | Where-Object { $_.status -eq "ERROR" }).Count
$blockingCount = $failCount + $errorCount + $(if ($Strict) { $warningCount } else { 0 })
$totalChecks = $metrics.checks.Count

Write-Host "Summary: $passCount/$totalChecks checks PASSED" -ForegroundColor $(if ($blockingCount -eq 0) { "Green" } else { "Red" })
if ($warningCount -gt 0) {
  Write-Host "Warnings: $warningCount" -ForegroundColor Yellow
}
if ($Strict) {
  Write-Host "Strict Mode: ON (warnings are blocking)" -ForegroundColor Yellow
}

if ($blockingCount -gt 0) {
  Write-Host "FAILURES DETECTED:" -ForegroundColor Red
  $metrics.checks | Where-Object { $_.status -in $(if ($Strict) { @("FAIL", "ERROR", "WARNING") } else { @("FAIL", "ERROR") }) } | ForEach-Object {
    Write-Host "  - $($_.name): $($_.detail)" -ForegroundColor Red
  }
}

# Save report
if ($Checkpoint -or $Summary) {
  $checkpointSkipReason = "not-evaluated"
  $reportDir = Split-Path $ReportPath
  if (-not (Test-Path $reportDir)) {
    New-Item -ItemType Directory -Path $reportDir -Force | Out-Null
  }

  if ($MinCheckpointIntervalSeconds -le 0) {
    $MinCheckpointIntervalSeconds = 1
  }
  if ($FlapSuppressionWindowSeconds -le 0) {
    $FlapSuppressionWindowSeconds = 1
  }

  $currentFingerprint = Get-ResultFingerprint -Results @($metrics.checks)
  $currentState = Get-CheckpointState -Results @($metrics.checks) -StrictMode ([bool]$Strict)
  
  if (Test-Path $ReportPath) {
    $existingReport = Get-Content $ReportPath -Raw | ConvertFrom-Json
    $checkpoints = @($existingReport.checkpoints)
    $lastCheckpoint = $null
    $previousCheckpoint = $null
    if ($checkpoints.Count -ge 1) {
      $lastCheckpoint = $checkpoints[-1]
    }
    if ($checkpoints.Count -ge 2) {
      $previousCheckpoint = $checkpoints[-2]
    }

    $skipCheckpoint = $false
    if ($null -ne $lastCheckpoint) {
      $lastTimestamp = [DateTimeOffset]::Parse([string]$lastCheckpoint.timestamp)
      $secondsSinceLast = [int][Math]::Floor(($currentTime - $lastTimestamp.UtcDateTime).TotalSeconds)
      $lastFingerprint = Get-ResultFingerprint -Results @($lastCheckpoint.results)
      $lastState = Get-CheckpointState -Results @($lastCheckpoint.results) -StrictMode ([bool]$Strict)

      if ($secondsSinceLast -lt $MinCheckpointIntervalSeconds -and $lastFingerprint -eq $currentFingerprint) {
        $skipCheckpoint = $true
        $checkpointSkipped = $true
        $checkpointSkipReason = "deduped-identical-within-$MinCheckpointIntervalSeconds-s"
      }

      if (-not $skipCheckpoint -and $secondsSinceLast -lt $MinCheckpointIntervalSeconds -and $lastState -eq $currentState) {
        $skipCheckpoint = $true
        $checkpointSkipped = $true
        $checkpointSkipReason = "deduped-same-state-within-$MinCheckpointIntervalSeconds-s"
      }

      if (-not $skipCheckpoint -and $currentState -eq "degraded" -and $null -ne $previousCheckpoint -and $secondsSinceLast -lt $FlapSuppressionWindowSeconds -and $lastState -ne $currentState) {
        $previousTimestamp = [DateTimeOffset]::Parse([string]$previousCheckpoint.timestamp)
        $secondsSincePrevious = [int][Math]::Floor(($currentTime - $previousTimestamp.UtcDateTime).TotalSeconds)
        $previousState = Get-CheckpointState -Results @($previousCheckpoint.results) -StrictMode ([bool]$Strict)

        if ($previousState -eq $currentState -and $secondsSincePrevious -lt ($FlapSuppressionWindowSeconds * 2)) {
          $skipCheckpoint = $true
          $checkpointSkipped = $true
          $checkpointSkipReason = "suppressed-flap-within-$FlapSuppressionWindowSeconds-s"
        }
      }
    }

    if ($skipCheckpoint) {
      Write-Host "`nCheckpoint skipped ($checkpointSkipReason)" -ForegroundColor Yellow
    } else {
      $existingReport.checkpoints += @{ timestamp = $metrics.timestamp; results = $metrics.checks }
      $existingReport | ConvertTo-Json -Depth 10 | Set-Content $ReportPath
      $checkpointSaved = $true
      $checkpointSkipReason = "none"
      Write-Host "`nCheckpoint saved ($($existingReport.checkpoints.Count) total)" -ForegroundColor Green
    }
  } else {
    $fullReport = @{
      recoveryTime = "2026-07-04T03:37:00Z"
      checkpoints = @(@{ timestamp = $metrics.timestamp; results = $metrics.checks })
    }
    $fullReport | ConvertTo-Json -Depth 10 | Set-Content $ReportPath
    $checkpointSaved = $true
    $checkpointSkipReason = "none"
    Write-Host "`nInitial report created" -ForegroundColor Green
  }
}

# Emit a machine-readable gate summary for CI/CD and ops dashboards.
if ($GateOutputPath -and $GateOutputPath.Trim()) {
  $gateDir = Split-Path -Parent $GateOutputPath
  if ($gateDir) {
    New-Item -Path $gateDir -ItemType Directory -Force | Out-Null
  }

  $gateResult = @{
    generatedAt = (Get-Date).ToString("o")
    strictMode = [bool]$Strict
    passed = ($blockingCount -eq 0)
    counts = @{
      total = $totalChecks
      pass = $passCount
      warning = $warningCount
      fail = $failCount
      error = $errorCount
      blocking = $blockingCount
    }
    checks = $metrics.checks
    checkpointRequested = [bool]($Checkpoint -or $Summary)
    checkpointSaved = $checkpointSaved
    checkpointSkipped = $checkpointSkipped
    checkpointSkipReason = $checkpointSkipReason
    reportPath = $ReportPath
  }

  $gateResult | ConvertTo-Json -Depth 10 | Set-Content -Path $GateOutputPath -Encoding UTF8
  Write-Host "Gate result saved: $GateOutputPath" -ForegroundColor Gray
}

Write-Host "`n=== End Validation ===" -ForegroundColor Cyan

exit $(if ($blockingCount -gt 0) { 1 } else { 0 })
