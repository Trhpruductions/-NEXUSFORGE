param(
  [int] $Runs = 3,
  [switch] $Strict,
  [switch] $ArchiveReports,
  [string] $ArchiveDirectory = "./apps/desktop/.network-smoke/history",
  [string] $ReportPath = "./apps/desktop/.network-smoke/ops-soak-latest.json"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if ($Runs -lt 1) {
  throw "Runs must be at least 1."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

$modeLabel = if ($Strict) { "strict" } else { "standard" }
$scriptName = if ($Strict) { "ops:validate:strict" } else { "ops:validate" }
$summary = New-Object System.Collections.Generic.List[object]
$startedAt = Get-Date

try {
  Write-Host ("[ops-soak] Starting {0} soak with {1} run(s)." -f $modeLabel, $Runs) -ForegroundColor Cyan

  for ($i = 1; $i -le $Runs; $i++) {
    $runStart = Get-Date
    Write-Host ("[ops-soak] Run {0}/{1} -> npm run {2}" -f $i, $Runs, $scriptName) -ForegroundColor Cyan

    $output = & npm.cmd run $scriptName 2>&1
    $output | ForEach-Object { Write-Host $_ }
    $exitCode = $LASTEXITCODE

    $runEnd = Get-Date
    $durationMs = [int][Math]::Round(($runEnd - $runStart).TotalMilliseconds)

    $summary.Add([PSCustomObject]@{
      run = $i
      script = $scriptName
      exitCode = $exitCode
      durationMs = $durationMs
      startedAt = $runStart.ToString("o")
      finishedAt = $runEnd.ToString("o")
    }) | Out-Null

    if ($exitCode -ne 0) {
      throw ("Run {0}/{1} failed with exit code {2}." -f $i, $Runs, $exitCode)
    }
  }

  Write-Host "[ops-soak] All runs passed." -ForegroundColor Green
}
finally {
  $finishedAt = Get-Date
  $reportDirectory = Split-Path -Parent $ReportPath
  if ($reportDirectory) {
    New-Item -ItemType Directory -Path $reportDirectory -Force | Out-Null
  }

  $failedRuns = @($summary | Where-Object { $_.exitCode -ne 0 }).Count

  $report = [PSCustomObject]@{
    passed = ($summary.Count -eq $Runs -and $failedRuns -eq 0)
    strict = [bool]$Strict
    runs = $Runs
    script = $scriptName
    startedAt = $startedAt.ToString("o")
    finishedAt = $finishedAt.ToString("o")
    totalDurationMs = [int][Math]::Round(($finishedAt - $startedAt).TotalMilliseconds)
    results = $summary
  }

  $report | ConvertTo-Json -Depth 6 | Set-Content -Path $ReportPath -Encoding UTF8
  Write-Host ("[ops-soak] Report saved: {0}" -f $ReportPath) -ForegroundColor Green

  if ($ArchiveReports) {
    $archiveTimestamp = $finishedAt.ToString("yyyyMMdd-HHmmss")
    $archiveMode = if ($Strict) { "strict" } else { "standard" }
    $archiveFileName = "ops-soak-{0}-r{1}-{2}.json" -f $archiveMode, $Runs, $archiveTimestamp
    $archivePath = Join-Path $ArchiveDirectory $archiveFileName

    New-Item -ItemType Directory -Path $ArchiveDirectory -Force | Out-Null
    $report | ConvertTo-Json -Depth 6 | Set-Content -Path $archivePath -Encoding UTF8
    Write-Host ("[ops-soak] Archived report: {0}" -f $archivePath) -ForegroundColor Green
  }

  Pop-Location
}
