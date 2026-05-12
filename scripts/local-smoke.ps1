$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

$serverStartedBySmoke = $false
$serverProcess = $null
$serverStdoutLog = Join-Path $env:TEMP "nexusforge-smoke-server.stdout.log"
$serverStderrLog = Join-Path $env:TEMP "nexusforge-smoke-server.stderr.log"

function Invoke-NpmChecked {
  param(
    [Parameter(Mandatory = $true)] [string] $Label,
    [Parameter(Mandatory = $true)] [string[]] $Arguments,
    [switch] $RetryOnTransientFavicon
  )

  $attempt = 1
  $maxAttempts = if ($RetryOnTransientFavicon) { 2 } else { 1 }

  while ($attempt -le $maxAttempts) {
    Write-Host "[smoke] $Label" -ForegroundColor Cyan
    if ($attempt -gt 1) {
      Write-Host "[smoke] Retrying after transient favicon build module error (attempt $attempt of $maxAttempts)" -ForegroundColor Yellow
    }

    $commandOutput = & npm.cmd @Arguments 2>&1
    $commandOutput | ForEach-Object { Write-Host $_ }
    $exitCode = $LASTEXITCODE

    if ($exitCode -eq 0) {
      return
    }

    $hasFaviconModuleError = ($commandOutput -match "Cannot find module for page: /favicon.ico") -or ($commandOutput -match "Failed to collect page data for /favicon.ico")
    if ($RetryOnTransientFavicon -and $attempt -lt $maxAttempts -and $hasFaviconModuleError) {
      $attempt++
      continue
    }

    throw "Command failed (exit $exitCode): npm $($Arguments -join ' ')"
  }
}

Invoke-NpmChecked -Label "Build workspace" -Arguments @("run", "build") -RetryOnTransientFavicon
Invoke-NpmChecked -Label "Lint web" -Arguments @("run", "lint", "-w", "web")
Invoke-NpmChecked -Label "Run server tests" -Arguments @("run", "test", "-w", "server")

function Test-ApiProbe {
  param([Parameter(Mandatory = $true)] [string] $Url)

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -ne 200) {
      throw "Expected 200, got $($response.StatusCode) for $Url"
    }
    Write-Host "[smoke] API OK: $Url" -ForegroundColor Green
  } catch {
    throw "API probe failed for $Url. $($_.Exception.Message)"
  }
}

function Test-ApiHealthy {
  param([Parameter(Mandatory = $true)] [string] $BaseUrl)

  try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/api/health" -UseBasicParsing -TimeoutSec 2
    return $response.StatusCode -eq 200
  } catch {
    return $false
  }
}

function Wait-ForApiHealthy {
  param(
    [Parameter(Mandatory = $true)] [string] $BaseUrl,
    [int] $TimeoutSeconds = 40
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-ApiHealthy -BaseUrl $BaseUrl) {
      return $true
    }

    if ($serverProcess -and $serverProcess.HasExited) {
      return $false
    }

    if ($serverProcess) {
      Wait-Process -Id $serverProcess.Id -Timeout 1 -ErrorAction SilentlyContinue
      $serverProcess.Refresh()
    }
  }

  return $false
}

$apiBase = "http://127.0.0.1:4000"
try {
  if (-not (Test-ApiHealthy -BaseUrl $apiBase)) {
    Write-Host "[smoke] Server not detected; launching temporary server for API probes" -ForegroundColor Yellow

    if (Test-Path $serverStdoutLog) { Remove-Item $serverStdoutLog -Force }
    if (Test-Path $serverStderrLog) { Remove-Item $serverStderrLog -Force }

    $serverProcess = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "-w", "server") -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $serverStdoutLog -RedirectStandardError $serverStderrLog
    $serverStartedBySmoke = $true

    if (-not (Wait-ForApiHealthy -BaseUrl $apiBase -TimeoutSeconds 40)) {
      $stdoutTail = if (Test-Path $serverStdoutLog) { (Get-Content $serverStdoutLog -Tail 20) -join "`n" } else { "(no stdout log)" }
      $stderrTail = if (Test-Path $serverStderrLog) { (Get-Content $serverStderrLog -Tail 20) -join "`n" } else { "(no stderr log)" }
      throw "Server failed to become healthy within timeout.`n--- stdout ---`n$stdoutTail`n--- stderr ---`n$stderrTail"
    }
  }

  Write-Host "[smoke] Running API probes on $apiBase" -ForegroundColor Cyan
  Test-ApiProbe -Url "$apiBase/api/health"
  Test-ApiProbe -Url "$apiBase/api/runtime/launch-mode"

  Write-Host "[smoke] Completed successfully." -ForegroundColor Green
} finally {
  if ($serverStartedBySmoke) {
    Write-Host "[smoke] Stopping temporary server instance" -ForegroundColor Cyan
    powershell -NoProfile -ExecutionPolicy Bypass -File "./scripts/cleanup-server-port.ps1" | Out-Null
    if ($serverProcess -and -not $serverProcess.HasExited) {
      Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    }
  }

  Pop-Location
}
