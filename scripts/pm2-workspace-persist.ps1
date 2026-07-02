param(
  [switch]$SkipEnsureOnline
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

function Invoke-Checked {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string]$Command,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  Write-Host "[pm2-persist] $Label" -ForegroundColor Cyan
  & $Command @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed (exit $LASTEXITCODE): $Command $($Arguments -join ' ')"
  }
}

function Test-Pm2ProcessPresent {
  param(
    [Parameter(Mandatory = $true)][string]$DumpContent,
    [Parameter(Mandatory = $true)][string]$ProcessName
  )

  return $DumpContent -match ('"name"\s*:\s*"' + [regex]::Escape($ProcessName) + '"')
}

try {
  if (-not $SkipEnsureOnline) {
    Invoke-Checked -Label "Ensure managed workspace stack is online" -Command "npm.cmd" -Arguments @("run", "pm2:workspace:start:all")
  }

  Invoke-Checked -Label "Persist PM2 process list" -Command "pm2" -Arguments @("save")

  $dumpPath = Join-Path $env:USERPROFILE ".pm2\dump.pm2"
  if (-not (Test-Path -LiteralPath $dumpPath)) {
    throw "PM2 dump file was not created at $dumpPath"
  }

  $dumpContent = Get-Content -LiteralPath $dumpPath -Raw -ErrorAction Stop

  $expected = @("nexusforge-backend-workspace", "nexusforge-web-workspace")
  $missing = @()
  foreach ($name in $expected) {
    if (-not (Test-Pm2ProcessPresent -DumpContent $dumpContent -ProcessName $name)) {
      $missing += $name
    }
  }

  if ($missing.Count -gt 0) {
    throw "PM2 dump is missing expected managed process(es): $($missing -join ', ')"
  }

  Write-Host "[pm2-persist] PASS: managed workspace PM2 processes saved to $dumpPath" -ForegroundColor Green
  Write-Host "[pm2-persist] Recovery command after reboot: npm run pm2:workspace:resurrect" -ForegroundColor Green
} finally {
  Pop-Location
}
