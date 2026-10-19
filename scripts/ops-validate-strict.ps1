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
  # Stops the temporary API that local-smoke.ps1 -KeepServerAlive may have started on the .env PORT.
  # cleanup-server-port.ps1 refuses the live ports and never stops a pm2-managed process, so on the
  # production PC this cannot stop the live API (it used to, on every run).
  $smokeApiPort = 4000
  $serverEnvPath = Join-Path $repoRoot "apps/server/.env"
  if (Test-Path -LiteralPath $serverEnvPath) {
    foreach ($line in (Get-Content -LiteralPath $serverEnvPath)) {
      if ($line.Trim() -match '^[Pp][Oo][Rr][Tt]\s*=\s*"?(\d+)"?$') {
        $smokeApiPort = [int]$matches[1]
        break
      }
    }
  }
  & powershell -NoProfile -ExecutionPolicy Bypass -File "./scripts/cleanup-server-port.ps1" -Ports $smokeApiPort | Out-Null
  Pop-Location
}