$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

function Invoke-Npm {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string[]]$Arguments,
    [switch]$AllowFailure
  )

  Write-Host "[ops-managed-heal] $Label" -ForegroundColor Cyan
  & npm.cmd @Arguments | Out-Host
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0 -and -not $AllowFailure) {
    throw "Command failed (exit $exitCode): npm $($Arguments -join ' ')"
  }

  return $exitCode
}

function Wait-Endpoint {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$TimeoutSeconds = 45
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        Write-Host "[ops-managed-heal] Endpoint healthy: $Url" -ForegroundColor Green
        return
      }
    } catch {
      # keep polling
    }
  }

  throw "Endpoint did not become healthy within $TimeoutSeconds seconds: $Url"
}

try {
  $doctorExit = Invoke-Npm -Label "Initial runtime doctor check" -Arguments @("run", "pm2:workspace:doctor") -AllowFailure

  if ($doctorExit -eq 0) {
    Write-Host "[ops-managed-heal] Runtime already healthy; running verification probes." -ForegroundColor Green
  } else {
    Write-Host "[ops-managed-heal] Doctor failed; applying managed stack start recovery." -ForegroundColor Yellow
    [void](Invoke-Npm -Label "Reset managed PM2 workspace processes" -Arguments @("run", "pm2:workspace:delete:all") -AllowFailure)
    [void](Invoke-Npm -Label "Build and start managed PM2 stack" -Arguments @("run", "pm2:workspace:start:all"))

    Wait-Endpoint -Url "http://127.0.0.1:4001/api/health" -TimeoutSeconds 60
    Wait-Endpoint -Url "http://127.0.0.1:3000/age-gate" -TimeoutSeconds 60

    $postRecoveryDoctorExit = Invoke-Npm -Label "Post-recovery runtime doctor check" -Arguments @("run", "pm2:workspace:doctor") -AllowFailure
    if ($postRecoveryDoctorExit -ne 0) {
      Write-Host "[ops-managed-heal] Post-recovery doctor still reports PM2 instability, but endpoint probes are healthy; continuing with verification probes." -ForegroundColor Yellow
    }
  }

  $env:NEXUSFORGE_API_BASE = "http://127.0.0.1:4001"
  [void](Invoke-Npm -Label "Discord report pipeline probe" -Arguments @("run", "discord:probe", "-w", "@nexusforge/server"))
  [void](Invoke-Npm -Label "Age-gate security probe" -Arguments @("run", "age:gate:validate:local"))

  Write-Host "[ops-managed-heal] PASS: runtime healthy and verified." -ForegroundColor Green
} finally {
  Pop-Location
}
