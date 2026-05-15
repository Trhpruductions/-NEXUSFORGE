param(
  [string] $HistoryDirectory = "./apps/desktop/.network-smoke/history",
  [string] $OutputPath = "./apps/desktop/.network-smoke/history/summary-latest.json",
  [int] $RecentCount = 10,
  [switch] $StrictOnly,
  [switch] $EnforceThresholds,
  [int] $ThresholdWindowCount = 0,
  [int] $MinReportCount = 1,
  [int] $MinTotalRuns = 1,
  [double] $MinPassRate = 100.0,
  [int] $MaxWeightedAvgRunDurationMs = 60000,
  [int] $MaxLatestAvgRunDurationMs = 60000,
  [int] $MaxLatestAvgRunDurationDeltaMs = 5000,
  [int] $MaxSampleRunDurationMs = 90000,
  [int] $MaxP95RunDurationMs = 60000
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($RecentCount -lt 1) {
  throw "RecentCount must be at least 1."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

try {
  if (-not (Test-Path -Path $HistoryDirectory)) {
    throw ("History directory not found: {0}" -f $HistoryDirectory)
  }

  $reportFiles = @(
    Get-ChildItem -Path $HistoryDirectory -File -Filter "ops-soak-*.json" |
      Sort-Object LastWriteTime -Descending
  )
  if ($reportFiles.Count -eq 0) {
    throw ("No archived ops-soak reports found in: {0}" -f $HistoryDirectory)
  }

  $entries = New-Object System.Collections.Generic.List[object]
  $allRunDurationSamples = New-Object System.Collections.Generic.List[int]

  foreach ($reportFile in $reportFiles) {
    try {
      $raw = Get-Content -Path $reportFile.FullName -Raw -Encoding UTF8
      $parsed = ConvertFrom-Json -InputObject $raw

      if ($null -eq $parsed.runs -or [int]$parsed.runs -lt 1) {
        continue
      }

      $entry = [PSCustomObject]@{
        fileName = $reportFile.Name
        fullPath = $reportFile.FullName
        strict = [bool]$parsed.strict
        passed = [bool]$parsed.passed
        runs = [int]$parsed.runs
        totalDurationMs = [int]$parsed.totalDurationMs
        avgRunDurationMs = [int][Math]::Round(([double]$parsed.totalDurationMs / [double]$parsed.runs))
        startedAt = [string]$parsed.startedAt
        finishedAt = [string]$parsed.finishedAt
        runDurations = @()
      }

      if ($StrictOnly -and -not $entry.strict) {
        continue
      }

      if ($parsed.PSObject.Properties.Name -contains "results" -and $null -ne $parsed.results) {
        $entryRunDurations = New-Object System.Collections.Generic.List[int]
        foreach ($runResult in @($parsed.results)) {
          if ($null -eq $runResult) {
            continue
          }

          if ($runResult.PSObject.Properties.Name -contains "durationMs" -and $null -ne $runResult.durationMs) {
            $sampleDuration = [int]$runResult.durationMs
            if ($sampleDuration -gt 0) {
              $allRunDurationSamples.Add($sampleDuration) | Out-Null
              $entryRunDurations.Add($sampleDuration) | Out-Null
            }
          }
        }

        $entry.runDurations = @($entryRunDurations)
      }

      $entries.Add($entry) | Out-Null
    }
    catch {
      Write-Warning ("Skipping unreadable report: {0} ({1})" -f $reportFile.Name, $_.Exception.Message)
    }
  }

  if ($entries.Count -eq 0) {
    if ($StrictOnly) {
      throw "No strict archived soak reports were found."
    }

    throw "No valid archived soak reports were found."
  }

  $recent = @($entries | Select-Object -First $RecentCount)
  $passedCount = @($entries | Where-Object { $_.passed }).Count
  $failedCount = @($entries | Where-Object { -not $_.passed }).Count
  $strictCount = @($entries | Where-Object { $_.strict }).Count

  $totalRuns = ($entries | Measure-Object -Property runs -Sum).Sum
  $totalDurationMs = ($entries | Measure-Object -Property totalDurationMs -Sum).Sum
  $weightedAvgRunMs = [int][Math]::Round(([double]$totalDurationMs / [double]$totalRuns))

  $sampleCount = $allRunDurationSamples.Count
  $sampleMaxRunDurationMs = $null
  $sampleP95RunDurationMs = $null
  if ($sampleCount -gt 0) {
    $sortedSamples = @($allRunDurationSamples | Sort-Object)
    $sampleMaxRunDurationMs = [int]$sortedSamples[-1]

    $p95Index = [int][Math]::Ceiling(0.95 * $sampleCount) - 1
    if ($p95Index -lt 0) {
      $p95Index = 0
    }

    $sampleP95RunDurationMs = [int]$sortedSamples[$p95Index]
  }

  $latest = $entries[0]
  $previous = $null
  if ($entries.Count -gt 1) {
    $previous = $entries[1]
  }

  $durationDeltaMs = $null
  if ($null -ne $previous) {
    $durationDeltaMs = [int]($latest.totalDurationMs - $previous.totalDurationMs)
  }

  $latestAvgRunDurationDeltaMs = $null
  if ($null -ne $previous) {
    $latestAvgRunDurationDeltaMs = [int]($latest.avgRunDurationMs - $previous.avgRunDurationMs)
  }

  $thresholdViolations = New-Object System.Collections.Generic.List[string]

  $summary = [PSCustomObject]@{
    generatedAt = (Get-Date).ToString("o")
    historyDirectory = $HistoryDirectory
    strictOnly = [bool]$StrictOnly
    totalReports = $entries.Count
    passedReports = $passedCount
    failedReports = $failedCount
    strictReports = $strictCount
    passRate = [Math]::Round((([double]$passedCount / [double]$entries.Count) * 100.0), 2)
    totalRuns = [int]$totalRuns
    totalDurationMs = [int]$totalDurationMs
    weightedAvgRunDurationMs = $weightedAvgRunMs
    sampleRunCount = [int]$sampleCount
    sampleMaxRunDurationMs = $sampleMaxRunDurationMs
    sampleP95RunDurationMs = $sampleP95RunDurationMs
    latest = $latest
    previous = $previous
    latestTotalDurationDeltaMs = $durationDeltaMs
    latestAvgRunDurationDeltaMs = $latestAvgRunDurationDeltaMs
    recent = $recent
  }

  $thresholdEntries = if ($ThresholdWindowCount -gt 0) {
    @($entries | Select-Object -First $ThresholdWindowCount)
  } else {
    @($entries)
  }

  $thresholdTotalReports = @($thresholdEntries).Count
  $thresholdPassedReports = @($thresholdEntries | Where-Object { $_.passed }).Count
  $thresholdTotalRuns = [int](($thresholdEntries | Measure-Object -Property runs -Sum).Sum)
  $thresholdTotalDurationMs = [int](($thresholdEntries | Measure-Object -Property totalDurationMs -Sum).Sum)
  $thresholdPassRate = if ($thresholdTotalReports -gt 0) {
    [Math]::Round((([double]$thresholdPassedReports / [double]$thresholdTotalReports) * 100.0), 2)
  } else {
    0
  }

  $thresholdWeightedAvgRunDurationMs = if ($thresholdTotalRuns -gt 0) {
    [int][Math]::Round(([double]$thresholdTotalDurationMs / [double]$thresholdTotalRuns))
  } else {
    0
  }

  $thresholdRunDurations = New-Object System.Collections.Generic.List[int]
  foreach ($thresholdEntry in $thresholdEntries) {
    foreach ($durationValue in @($thresholdEntry.runDurations)) {
      $thresholdRunDurations.Add([int]$durationValue) | Out-Null
    }
  }

  $thresholdSampleMaxRunDurationMs = $null
  $thresholdSampleP95RunDurationMs = $null
  if ($thresholdRunDurations.Count -gt 0) {
    $sortedThresholdDurations = @($thresholdRunDurations | Sort-Object)
    $thresholdSampleMaxRunDurationMs = [int]$sortedThresholdDurations[-1]

    $thresholdP95Index = [int][Math]::Ceiling(0.95 * $sortedThresholdDurations.Count) - 1
    if ($thresholdP95Index -lt 0) {
      $thresholdP95Index = 0
    }

    $thresholdSampleP95RunDurationMs = [int]$sortedThresholdDurations[$thresholdP95Index]
  }

  if ($thresholdTotalReports -lt $MinReportCount) {
    $thresholdViolations.Add(("totalReports {0} < min {1}" -f $thresholdTotalReports, $MinReportCount)) | Out-Null
  }

  if ($thresholdTotalRuns -lt $MinTotalRuns) {
    $thresholdViolations.Add(("totalRuns {0} < min {1}" -f $thresholdTotalRuns, $MinTotalRuns)) | Out-Null
  }

  if ($thresholdPassRate -lt $MinPassRate) {
    $thresholdViolations.Add(("passRate {0}% < min {1}%" -f $thresholdPassRate, $MinPassRate)) | Out-Null
  }

  if ($thresholdWeightedAvgRunDurationMs -gt $MaxWeightedAvgRunDurationMs) {
    $thresholdViolations.Add(("weightedAvgRunDurationMs {0} > max {1}" -f $thresholdWeightedAvgRunDurationMs, $MaxWeightedAvgRunDurationMs)) | Out-Null
  }

  if ($latest.avgRunDurationMs -gt $MaxLatestAvgRunDurationMs) {
    $thresholdViolations.Add(("latest.avgRunDurationMs {0} > max {1}" -f $latest.avgRunDurationMs, $MaxLatestAvgRunDurationMs)) | Out-Null
  }

  if ($null -ne $latestAvgRunDurationDeltaMs -and $latestAvgRunDurationDeltaMs -gt $MaxLatestAvgRunDurationDeltaMs) {
    $thresholdViolations.Add(("latestAvgRunDurationDeltaMs {0} > max {1}" -f $latestAvgRunDurationDeltaMs, $MaxLatestAvgRunDurationDeltaMs)) | Out-Null
  }

  if ($null -ne $thresholdSampleMaxRunDurationMs -and $thresholdSampleMaxRunDurationMs -gt $MaxSampleRunDurationMs) {
    $thresholdViolations.Add(("sampleMaxRunDurationMs {0} > max {1}" -f $thresholdSampleMaxRunDurationMs, $MaxSampleRunDurationMs)) | Out-Null
  }

  if ($null -ne $thresholdSampleP95RunDurationMs -and $thresholdSampleP95RunDurationMs -gt $MaxP95RunDurationMs) {
    $thresholdViolations.Add(("sampleP95RunDurationMs {0} > max {1}" -f $thresholdSampleP95RunDurationMs, $MaxP95RunDurationMs)) | Out-Null
  }

  $thresholdResult = [PSCustomObject]@{
    enforceThresholds = [bool]$EnforceThresholds
    thresholdWindowCount = $ThresholdWindowCount
    observedReports = $thresholdTotalReports
    observedTotalRuns = $thresholdTotalRuns
    observedPassRate = $thresholdPassRate
    observedWeightedAvgRunDurationMs = $thresholdWeightedAvgRunDurationMs
    observedSampleMaxRunDurationMs = $thresholdSampleMaxRunDurationMs
    observedSampleP95RunDurationMs = $thresholdSampleP95RunDurationMs
    minReportCount = $MinReportCount
    minTotalRuns = $MinTotalRuns
    minPassRate = $MinPassRate
    maxWeightedAvgRunDurationMs = $MaxWeightedAvgRunDurationMs
    maxLatestAvgRunDurationMs = $MaxLatestAvgRunDurationMs
    maxLatestAvgRunDurationDeltaMs = $MaxLatestAvgRunDurationDeltaMs
    maxSampleRunDurationMs = $MaxSampleRunDurationMs
    maxP95RunDurationMs = $MaxP95RunDurationMs
    violations = @($thresholdViolations)
    passed = (@($thresholdViolations).Count -eq 0)
  }

  $summary | Add-Member -NotePropertyName thresholdResult -NotePropertyValue $thresholdResult

  $outputDirectory = Split-Path -Parent $OutputPath
  if ($outputDirectory) {
    New-Item -ItemType Directory -Path $outputDirectory -Force | Out-Null
  }

  $summary | ConvertTo-Json -Depth 8 | Set-Content -Path $OutputPath -Encoding UTF8

  Write-Host ("[ops-soak-summary] Reports analyzed: {0}" -f $entries.Count) -ForegroundColor Cyan
  Write-Host ("[ops-soak-summary] Pass rate: {0}%" -f $summary.passRate) -ForegroundColor Green
  Write-Host ("[ops-soak-summary] Weighted avg run: {0} ms" -f $summary.weightedAvgRunDurationMs) -ForegroundColor Green
  if ($null -ne $summary.sampleP95RunDurationMs) {
    Write-Host ("[ops-soak-summary] Sample p95 run: {0} ms" -f $summary.sampleP95RunDurationMs) -ForegroundColor Green
  }

  if ($null -ne $summary.sampleMaxRunDurationMs) {
    Write-Host ("[ops-soak-summary] Sample max run: {0} ms" -f $summary.sampleMaxRunDurationMs) -ForegroundColor Green
  }

  Write-Host ("[ops-soak-summary] Latest report: {0}" -f $latest.fileName) -ForegroundColor Cyan

  if ($null -ne $durationDeltaMs) {
    Write-Host ("[ops-soak-summary] Latest duration delta vs previous: {0} ms" -f $durationDeltaMs) -ForegroundColor Cyan
  }

  Write-Host ("[ops-soak-summary] Summary saved: {0}" -f $OutputPath) -ForegroundColor Green

  if ($EnforceThresholds) {
    $windowLabel = if ($ThresholdWindowCount -gt 0) {
      ("latest {0} report(s)" -f $ThresholdWindowCount)
    } else {
      "all analyzed reports"
    }

    Write-Host ("[ops-soak-summary] Threshold window: {0}" -f $windowLabel) -ForegroundColor Cyan
    Write-Host ("[ops-soak-summary] Threshold observed pass rate: {0}%" -f $thresholdResult.observedPassRate) -ForegroundColor Cyan
    Write-Host ("[ops-soak-summary] Threshold observed runs: {0}" -f $thresholdResult.observedTotalRuns) -ForegroundColor Cyan

    if ($thresholdResult.passed) {
      Write-Host "[ops-soak-summary] Threshold status: PASS" -ForegroundColor Green
    }
  }

  if ($EnforceThresholds -and -not $thresholdResult.passed) {
    throw ("Soak history guard failed: {0}" -f (($thresholdResult.violations -join "; ")))
  }
}
finally {
  Pop-Location
}
