param(
  [string]$LogPath = "./var/ops-managed-watchdog.jsonl",
  [string]$OutputPath = "./var/ops-managed-watchdog-summary-latest.json",
  [int]$RecentCount = 20,
  [switch]$EnforceThresholds,
  [int]$ThresholdWindowCount = 0,
  [int]$MinRuns = 1,
  [double]$MinPassRate = 100.0,
  [int]$MaxLatestAgeSeconds = 900,
  [int]$MaxAvgDurationMs = 30000,
  [int]$MaxP95DurationMs = 60000,
  [int]$MaxFailureCount = 0
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($RecentCount -lt 1) {
  throw "RecentCount must be at least 1."
}

if ($MinRuns -lt 1) {
  throw "MinRuns must be at least 1."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

function Parse-WatchdogRecords {
  param(
    [Parameter(Mandatory = $true)][string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Watchdog log not found: $Path"
  }

  $lines = Get-Content -LiteralPath $Path -ErrorAction Stop
  $records = New-Object System.Collections.Generic.List[object]

  foreach ($line in $lines) {
    if (-not $line -or -not $line.Trim()) {
      continue
    }

    try {
      $entry = $line | ConvertFrom-Json -ErrorAction Stop
      $timestamp = [DateTimeOffset]::Parse([string]$entry.timestampUtc)

      $records.Add([PSCustomObject]@{
        timestampUtc = $timestamp
        runNumber = [int]$entry.runNumber
        mode = [string]$entry.mode
        status = [string]$entry.status
        durationMs = [int]$entry.durationMs
        healExitCode = [int]$entry.healExitCode
        persistExitCode = [int]$entry.persistExitCode
        error = [string]$entry.error
      }) | Out-Null
    } catch {
      Write-Warning ("Skipping invalid watchdog line: {0}" -f $_.Exception.Message)
    }
  }

  return @($records | Sort-Object timestampUtc -Descending)
}

function Get-P95 {
  param(
    [Parameter(Mandatory = $true)][int[]]$Samples
  )

  if ($Samples.Length -eq 0) {
    return $null
  }

  $sorted = @($Samples | Sort-Object)
  $index = [int][Math]::Ceiling(0.95 * $sorted.Length) - 1
  if ($index -lt 0) {
    $index = 0
  }

  return [int]$sorted[$index]
}

try {
  $records = Parse-WatchdogRecords -Path $LogPath
  if ($records.Count -eq 0) {
    throw "No valid watchdog records found in $LogPath"
  }

  $latest = $records[0]
  $recent = @($records | Select-Object -First $RecentCount)

  $window = if ($ThresholdWindowCount -gt 0) {
    @($records | Select-Object -First $ThresholdWindowCount)
  } else {
    @($records)
  }

  $windowCount = $window.Count
  $successCount = @($window | Where-Object { $_.status -eq "ok" }).Count
  $failureCount = @($window | Where-Object { $_.status -ne "ok" }).Count
  $passRate = if ($windowCount -gt 0) {
    [Math]::Round((([double]$successCount / [double]$windowCount) * 100.0), 2)
  } else {
    0
  }

  $durations = @($window | ForEach-Object { [int]$_.durationMs })
  $avgDurationMs = if ($durations.Count -gt 0) {
    [int][Math]::Round((($durations | Measure-Object -Average).Average))
  } else {
    0
  }
  $maxDurationMs = if ($durations.Count -gt 0) { [int](($durations | Measure-Object -Maximum).Maximum) } else { 0 }
  $p95DurationMs = if ($durations.Count -gt 0) { Get-P95 -Samples $durations } else { $null }

  $latestAgeSeconds = [int][Math]::Floor(((Get-Date).ToUniversalTime() - $latest.timestampUtc.UtcDateTime).TotalSeconds)

  $violations = New-Object System.Collections.Generic.List[string]
  if ($windowCount -lt $MinRuns) {
    $violations.Add(("runs {0} < min {1}" -f $windowCount, $MinRuns)) | Out-Null
  }

  if ($passRate -lt $MinPassRate) {
    $violations.Add(("passRate {0}% < min {1}%" -f $passRate, $MinPassRate)) | Out-Null
  }

  if ($latestAgeSeconds -gt $MaxLatestAgeSeconds) {
    $violations.Add(("latestAgeSeconds {0} > max {1}" -f $latestAgeSeconds, $MaxLatestAgeSeconds)) | Out-Null
  }

  if ($avgDurationMs -gt $MaxAvgDurationMs) {
    $violations.Add(("avgDurationMs {0} > max {1}" -f $avgDurationMs, $MaxAvgDurationMs)) | Out-Null
  }

  if ($null -ne $p95DurationMs -and $p95DurationMs -gt $MaxP95DurationMs) {
    $violations.Add(("p95DurationMs {0} > max {1}" -f $p95DurationMs, $MaxP95DurationMs)) | Out-Null
  }

  if ($failureCount -gt $MaxFailureCount) {
    $violations.Add(("failureCount {0} > max {1}" -f $failureCount, $MaxFailureCount)) | Out-Null
  }

  $thresholdResult = [PSCustomObject]@{
    enforceThresholds = [bool]$EnforceThresholds
    thresholdWindowCount = $ThresholdWindowCount
    observedRuns = $windowCount
    observedPassRate = $passRate
    observedLatestAgeSeconds = $latestAgeSeconds
    observedAvgDurationMs = $avgDurationMs
    observedP95DurationMs = $p95DurationMs
    observedFailureCount = $failureCount
    minRuns = $MinRuns
    minPassRate = $MinPassRate
    maxLatestAgeSeconds = $MaxLatestAgeSeconds
    maxAvgDurationMs = $MaxAvgDurationMs
    maxP95DurationMs = $MaxP95DurationMs
    maxFailureCount = $MaxFailureCount
    violations = @($violations)
    passed = (@($violations).Count -eq 0)
  }

  $summary = [PSCustomObject]@{
    generatedAt = (Get-Date).ToString("o")
    logPath = $LogPath
    totalRecords = $records.Count
    latest = [PSCustomObject]@{
      timestampUtc = $latest.timestampUtc.ToString("o")
      runNumber = $latest.runNumber
      mode = $latest.mode
      status = $latest.status
      durationMs = $latest.durationMs
      healExitCode = $latest.healExitCode
      persistExitCode = $latest.persistExitCode
      error = $latest.error
      ageSeconds = $latestAgeSeconds
    }
    window = [PSCustomObject]@{
      runCount = $windowCount
      successCount = $successCount
      failureCount = $failureCount
      passRate = $passRate
      avgDurationMs = $avgDurationMs
      maxDurationMs = $maxDurationMs
      p95DurationMs = $p95DurationMs
    }
    recent = @($recent | ForEach-Object {
      [PSCustomObject]@{
        timestampUtc = $_.timestampUtc.ToString("o")
        runNumber = $_.runNumber
        mode = $_.mode
        status = $_.status
        durationMs = $_.durationMs
        healExitCode = $_.healExitCode
        persistExitCode = $_.persistExitCode
        error = $_.error
      }
    })
    thresholdResult = $thresholdResult
  }

  $outputDirectory = Split-Path -Parent $OutputPath
  if ($outputDirectory) {
    New-Item -Path $outputDirectory -ItemType Directory -Force | Out-Null
  }

  $summary | ConvertTo-Json -Depth 8 | Set-Content -Path $OutputPath -Encoding UTF8

  Write-Host ("[ops-watchdog-summary] Records analyzed: {0}" -f $records.Count) -ForegroundColor Cyan
  Write-Host ("[ops-watchdog-summary] Pass rate: {0}%" -f $passRate) -ForegroundColor Green
  Write-Host ("[ops-watchdog-summary] Latest age: {0}s" -f $latestAgeSeconds) -ForegroundColor Green
  Write-Host ("[ops-watchdog-summary] Avg duration: {0} ms" -f $avgDurationMs) -ForegroundColor Green
  if ($null -ne $p95DurationMs) {
    Write-Host ("[ops-watchdog-summary] P95 duration: {0} ms" -f $p95DurationMs) -ForegroundColor Green
  }
  Write-Host ("[ops-watchdog-summary] Summary saved: {0}" -f $OutputPath) -ForegroundColor Green

  if ($EnforceThresholds) {
    if (-not $thresholdResult.passed) {
      throw ("Watchdog history guard failed: {0}" -f (($thresholdResult.violations -join "; ")))
    }

    Write-Host "[ops-watchdog-summary] Threshold status: PASS" -ForegroundColor Green
  }
}
finally {
  Pop-Location
}
