param(
  [switch]$RequireWatchdogFreshness,
  [int]$WatchdogMaxAgeSeconds = 900
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

function Assert-Pm2ProcessOnline {
  param(
    [Parameter(Mandatory = $true)][string]$Name
  )

  $describeText = (& pm2 describe $Name) -join "`n"
  if (-not $describeText.Trim()) {
    throw "PM2 did not return process description for $Name."
  }

  if ($describeText -match "Process or Namespace\s+$([regex]::Escape($Name))\s+not found") {
    throw "PM2 process not found: $Name"
  }

  if ($describeText -notmatch "status\s+.+online") {
    throw "PM2 process $Name is not online."
  }

  Write-Host "[ops-managed-doctor] PM2 online: $Name" -ForegroundColor Green
}

function Assert-EndpointHealthy {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$TimeoutSec = 8
  )

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec $TimeoutSec
    if ($response.StatusCode -lt 200 -or $response.StatusCode -ge 300) {
      throw "Non-success status code: $($response.StatusCode)"
    }
  } catch {
    throw "Endpoint unhealthy: $Url ($($_.Exception.Message))"
  }

  Write-Host "[ops-managed-doctor] Endpoint healthy: $Url" -ForegroundColor Green
}

function Assert-WatchdogFreshness {
  param(
    [Parameter(Mandatory = $true)][string]$LogPath,
    [Parameter(Mandatory = $true)][int]$MaxAgeSeconds
  )

  if (-not (Test-Path -LiteralPath $LogPath)) {
    throw "Watchdog log not found: $LogPath"
  }

  $tail = Get-Content -LiteralPath $LogPath -Tail 300 -ErrorAction Stop
  $lastLine = ($tail | Where-Object { $_ -and $_.Trim() }) | Select-Object -Last 1
  if (-not $lastLine) {
    throw "Watchdog log is empty: $LogPath"
  }

  try {
    $record = $lastLine | ConvertFrom-Json -ErrorAction Stop
  } catch {
    throw "Watchdog log latest record is invalid JSON."
  }

  if ($record.status -ne "ok") {
    throw "Latest watchdog run status is not ok: $($record.status)"
  }

  $timestampRaw = [string]$record.timestampUtc
  if (-not $timestampRaw.Trim()) {
    throw "Latest watchdog record is missing timestampUtc."
  }

  try {
    $timestamp = [DateTimeOffset]::Parse($timestampRaw)
  } catch {
    throw "Latest watchdog timestampUtc could not be parsed: $timestampRaw"
  }

  $age = (Get-Date).ToUniversalTime() - $timestamp.UtcDateTime
  $ageSeconds = [int][Math]::Floor($age.TotalSeconds)
  if ($ageSeconds -gt $MaxAgeSeconds) {
    throw "Watchdog freshness exceeded threshold: age=${ageSeconds}s max=${MaxAgeSeconds}s"
  }

  Write-Host "[ops-managed-doctor] Watchdog fresh: age=${ageSeconds}s max=${MaxAgeSeconds}s" -ForegroundColor Green
}

try {
  Write-Host "[ops-managed-doctor] Running managed runtime checks" -ForegroundColor Cyan

  Assert-Pm2ProcessOnline -Name "nexusforge-backend-workspace"
  Assert-Pm2ProcessOnline -Name "nexusforge-web-workspace"

  Assert-EndpointHealthy -Url "http://127.0.0.1:4001/api/health"
  Assert-EndpointHealthy -Url "http://127.0.0.1:4001/api/health/discord"
  Assert-EndpointHealthy -Url "http://127.0.0.1:3000/age-gate"

  if ($RequireWatchdogFreshness) {
    $watchdogLogPath = Join-Path $repoRoot "var\ops-managed-watchdog.jsonl"
    Assert-WatchdogFreshness -LogPath $watchdogLogPath -MaxAgeSeconds $WatchdogMaxAgeSeconds
  }

  Write-Host "[ops-managed-doctor] PASS: managed app and bot runtime healthy." -ForegroundColor Green
} finally {
  Pop-Location
}
