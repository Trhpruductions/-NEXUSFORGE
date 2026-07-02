param(
  [switch]$Continuous,
  [switch]$Silent,
  [int]$IntervalSeconds = 300,
  [int]$MaxRuns = 0,
  [bool]$PersistAfterSuccess = $true
)

$ErrorActionPreference = "Stop"

if ($IntervalSeconds -lt 15) {
  throw "IntervalSeconds must be at least 15."
}

if ($MaxRuns -lt 0) {
  throw "MaxRuns cannot be negative."
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$logDirectory = Join-Path $repoRoot "var"
$logFile = Join-Path $logDirectory "ops-managed-watchdog.jsonl"

if (-not (Test-Path $logDirectory)) {
  New-Item -Path $logDirectory -ItemType Directory -Force | Out-Null
}

Push-Location $repoRoot

function Write-WatchdogMessage {
  param(
    [Parameter(Mandatory = $true)][string]$Message,
    [ConsoleColor]$ForegroundColor = [ConsoleColor]::White
  )

  if (-not $Silent) {
    Write-Host $Message -ForegroundColor $ForegroundColor
  }
}

function Write-WatchdogLog {
  param(
    [Parameter(Mandatory = $true)][string]$Status,
    [Parameter(Mandatory = $true)][datetime]$StartedAt,
    [Parameter(Mandatory = $true)][datetime]$FinishedAt,
    [Parameter(Mandatory = $true)][int]$DurationMs,
    [Parameter(Mandatory = $true)][int]$HealExitCode,
    [Parameter(Mandatory = $true)][int]$PersistExitCode,
    [Parameter(Mandatory = $true)][int]$RunNumber,
    [string]$ErrorMessage = ""
  )

  $record = [ordered]@{
    timestampUtc = (Get-Date).ToUniversalTime().ToString("o")
    runNumber = $RunNumber
    mode = $(if ($Continuous) { "continuous" } else { "once" })
    status = $Status
    startedAtUtc = $StartedAt.ToUniversalTime().ToString("o")
    finishedAtUtc = $FinishedAt.ToUniversalTime().ToString("o")
    durationMs = $DurationMs
    healExitCode = $HealExitCode
    persistExitCode = $PersistExitCode
    persistEnabled = [bool]$PersistAfterSuccess
    error = $ErrorMessage
  }

  ($record | ConvertTo-Json -Compress) | Add-Content -Path $logFile -Encoding ASCII
}

function Invoke-NpmCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [switch]$AllowFailure
  )

  Write-WatchdogMessage -Message "[ops-managed-watchdog] $Label" -ForegroundColor Cyan
  if ($Silent) {
    & npm.cmd @Arguments *> $null
  } else {
    & npm.cmd @Arguments | Out-Host
  }
  $exitCode = $LASTEXITCODE

  if ($exitCode -ne 0 -and -not $AllowFailure) {
    throw "Command failed (exit $exitCode): npm $($Arguments -join ' ')"
  }

  return $exitCode
}

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  Write-WatchdogMessage -Message "[ops-managed-watchdog] $Label" -ForegroundColor Cyan
  if ($Silent) {
    & $Command @Arguments *> $null
  } else {
    & $Command @Arguments | Out-Host
  }
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    throw "Command failed (exit $exitCode): $Command $($Arguments -join ' ')"
  }

  return $exitCode
}

function Invoke-WatchdogRun {
  param(
    [Parameter(Mandatory = $true)][int]$RunNumber
  )

  $startedAt = Get-Date
  $healExitCode = -1
  $persistExitCode = -1
  $status = "failed"
  $errorMessage = ""

  try {
    $healExitCode = Invoke-NpmCommand -Label "Run managed self-heal" -Arguments @("run", "pm2:workspace:heal")

    if ($PersistAfterSuccess) {
      $persistExitCode = Invoke-CheckedCommand -Label "Persist PM2 workspace state" -Command "powershell" -Arguments @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "./scripts/pm2-workspace-persist.ps1", "-SkipEnsureOnline")
    } else {
      $persistExitCode = 0
    }

    $status = "ok"
  } catch {
    $status = "failed"
    $errorMessage = $_.Exception.Message
    Write-WatchdogMessage -Message "[ops-managed-watchdog] ERROR: $errorMessage" -ForegroundColor Red
  }

  $finishedAt = Get-Date
  $durationMs = [int][Math]::Round(($finishedAt - $startedAt).TotalMilliseconds)

  Write-WatchdogLog -Status $status -StartedAt $startedAt -FinishedAt $finishedAt -DurationMs $durationMs -HealExitCode $healExitCode -PersistExitCode $persistExitCode -RunNumber $RunNumber -ErrorMessage $errorMessage

  if ($status -ne "ok") {
    throw "Managed watchdog run failed."
  }
}

try {
  Write-WatchdogMessage -Message "[ops-managed-watchdog] Starting managed watchdog." -ForegroundColor Green
  Write-WatchdogMessage -Message "[ops-managed-watchdog] Log file: $logFile" -ForegroundColor Gray

  $runNumber = 0
  do {
    $runNumber += 1
    Invoke-WatchdogRun -RunNumber $runNumber

    if (-not $Continuous) {
      break
    }

    if ($MaxRuns -gt 0 -and $runNumber -ge $MaxRuns) {
      Write-WatchdogMessage -Message "[ops-managed-watchdog] Reached MaxRuns=$MaxRuns. Stopping." -ForegroundColor Yellow
      break
    }

    Write-WatchdogMessage -Message "[ops-managed-watchdog] Sleeping for $IntervalSeconds second(s) before next run." -ForegroundColor DarkGray
    Start-Sleep -Seconds $IntervalSeconds
  } while ($true)

  Write-WatchdogMessage -Message "[ops-managed-watchdog] PASS" -ForegroundColor Green
} finally {
  Pop-Location
}