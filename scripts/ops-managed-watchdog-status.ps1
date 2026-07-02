param(
  [int]$MaxAgeSeconds = 900
)

$ErrorActionPreference = "Stop"

if ($MaxAgeSeconds -le 0) {
  throw "MaxAgeSeconds must be greater than 0."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$logPath = Join-Path $repoRoot "var\ops-managed-watchdog.jsonl"

function Get-LatestWatchdogRecord {
  param(
    [Parameter(Mandatory = $true)][string]$Path
  )

  if (-not (Test-Path -LiteralPath $Path)) {
    throw "Watchdog log not found: $Path"
  }

  $tail = Get-Content -LiteralPath $Path -Tail 300 -ErrorAction Stop
  $lastLine = ($tail | Where-Object { $_ -and $_.Trim() }) | Select-Object -Last 1
  if (-not $lastLine) {
    throw "Watchdog log is empty: $Path"
  }

  try {
    return ($lastLine | ConvertFrom-Json -ErrorAction Stop)
  } catch {
    throw "Watchdog latest record is invalid JSON."
  }
}

$record = Get-LatestWatchdogRecord -Path $logPath
if ($record.status -ne "ok") {
  throw "Watchdog latest status is not ok: $($record.status)"
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

$age = (Get-Date).ToUniversalTime() - $timestamp.UtcDateTime
$ageSeconds = [int][Math]::Floor($age.TotalSeconds)
if ($ageSeconds -gt $MaxAgeSeconds) {
  throw "Watchdog stale: age=${ageSeconds}s max=${MaxAgeSeconds}s"
}

$runNumber = [int]$record.runNumber
$mode = [string]$record.mode
$durationMs = [int]$record.durationMs

Write-Host "[ops-managed-watchdog-status] PASS run=$runNumber mode=$mode age=${ageSeconds}s durationMs=$durationMs" -ForegroundColor Green
