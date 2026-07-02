$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

function Invoke-CheckedCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  Write-Host "[ops-managed] $Label" -ForegroundColor Cyan
  & npm.cmd @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed (exit $LASTEXITCODE): npm $($Arguments -join ' ')"
  }
}

function Invoke-OptionalCommand {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  Write-Host "[ops-managed] $Label" -ForegroundColor Cyan
  & npm.cmd @Arguments | Out-Host
  if ($LASTEXITCODE -ne 0) {
    Write-Host "[ops-managed] Optional command failed and will be ignored: npm $($Arguments -join ' ')" -ForegroundColor Yellow
  }
}

function Wait-ForEndpoint {
  param(
    [Parameter(Mandatory = $true)][string]$Url,
    [int]$TimeoutSeconds = 45
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 300) {
        Write-Host "[ops-managed] Endpoint healthy: $Url" -ForegroundColor Green
        return
      }
    } catch {
      # keep polling until timeout
    }
  }

  throw "Endpoint did not become healthy within $TimeoutSeconds seconds: $Url"
}

try {
  Invoke-OptionalCommand -Label "Reset managed PM2 workspace processes" -Arguments @("run", "pm2:workspace:delete:all")
  Invoke-CheckedCommand -Label "Build and start managed PM2 stack" -Arguments @("run", "pm2:workspace:start:all")
  try {
    Invoke-CheckedCommand -Label "Restart managed PM2 stack with env refresh" -Arguments @("run", "pm2:workspace:restart:all")
  } catch {
    Write-Host "[ops-managed] Restart path failed; retrying with clean start." -ForegroundColor Yellow
    Invoke-CheckedCommand -Label "Rebuild and start managed PM2 stack" -Arguments @("run", "pm2:workspace:start:all")
  }

  Wait-ForEndpoint -Url "http://127.0.0.1:4001/api/health" -TimeoutSeconds 60
  Wait-ForEndpoint -Url "http://127.0.0.1:3000/age-gate" -TimeoutSeconds 60

  Invoke-CheckedCommand -Label "Validate age-gate security" -Arguments @("run", "age:gate:validate:local")

  $env:NEXUSFORGE_API_BASE = "http://127.0.0.1:4001"
  Invoke-CheckedCommand -Label "Validate Discord report pipeline" -Arguments @("run", "discord:probe", "-w", "@nexusforge/server")

  Invoke-CheckedCommand -Label "Validate desktop network modes (strict)" -Arguments @("run", "desktop:network:validate:ci:strict")

  Write-Host "[ops-managed] PASS: managed workspace stack validated." -ForegroundColor Green
} finally {
  Pop-Location
}
