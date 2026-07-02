param(
  [switch]$SoakMode
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

function Invoke-NpmChecked {
  param(
    [Parameter(Mandatory = $true)] [string]$Label,
    [Parameter(Mandatory = $true)] [string[]]$Arguments
  )

  Write-Host "[ops-strict] $Label" -ForegroundColor Cyan
  & npm.cmd @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed (exit $LASTEXITCODE): npm $($Arguments -join ' ')"
  }
}

try {
  $localSmokeArgs = @("-NoProfile", "-ExecutionPolicy", "Bypass", "-File", "./scripts/local-smoke.ps1", "-KeepServerAlive")
  if ($SoakMode) {
    $localSmokeArgs += @("-SkipBuild", "-SkipLint", "-SkipServerTests")
  }

  & powershell @localSmokeArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed (exit $LASTEXITCODE): powershell ./scripts/local-smoke.ps1"
  }

  Invoke-NpmChecked -Label "Validate desktop network modes (strict)" -Arguments @("run", "desktop:network:validate:ci:strict")
  Invoke-NpmChecked -Label "Validate Discord report pipeline" -Arguments @("run", "discord:probe", "-w", "@nexusforge/server")

  Write-Host "[ops-strict] PASS: strict release gate validated." -ForegroundColor Green
} finally {
  & powershell -NoProfile -ExecutionPolicy Bypass -File "./scripts/cleanup-server-port.ps1" | Out-Null
  Pop-Location
}