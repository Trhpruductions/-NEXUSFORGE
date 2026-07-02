param(
  [switch]$KeepServerAlive,
  [switch]$SkipBuild,
  [switch]$SkipLint,
  [switch]$SkipServerTests
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

$serverStartedBySmoke = $false
$serverProcess = $null
$runToken = "{0}-{1}" -f $PID, (Get-Date -Format "yyyyMMdd-HHmmss")
$serverStdoutLog = Join-Path $env:TEMP ("nexusforge-smoke-server.stdout.{0}.log" -f $runToken)
$serverStderrLog = Join-Path $env:TEMP ("nexusforge-smoke-server.stderr.{0}.log" -f $runToken)
$webStartedBySmoke = $false
$webProcess = $null
$webStdoutLog = Join-Path $env:TEMP ("nexusforge-smoke-web.stdout.{0}.log" -f $runToken)
$webStderrLog = Join-Path $env:TEMP ("nexusforge-smoke-web.stderr.{0}.log" -f $runToken)

function Get-EnvFileValue {
  param(
    [Parameter(Mandatory = $true)] [string] $Path,
    [Parameter(Mandatory = $true)] [string] $Key
  )

  if (-not (Test-Path -Path $Path)) {
    return $null
  }

  try {
    $content = Get-Content -Path $Path -ErrorAction SilentlyContinue
    foreach ($line in $content) {
      $trimmed = $line.Trim()
      if ($trimmed -eq '' -or $trimmed.StartsWith('#')) {
        continue
      }

      $parts = $trimmed.Split('=', 2)
      if ($parts.Count -ne 2) {
        continue
      }

      if ($parts[0].Trim() -ieq $Key) {
        return $parts[1].Trim()
      }
    }
  } catch {
    return $null
  }

  return $null
}

function Invoke-NpmChecked {
  param(
    [Parameter(Mandatory = $true)] [string] $Label,
    [Parameter(Mandatory = $true)] [string[]] $CommandArguments,
    [switch] $RetryOnTransientFavicon
  )

  $attempt = 1
  $maxAttempts = if ($RetryOnTransientFavicon) { 2 } else { 1 }

  while ($attempt -le $maxAttempts) {
    Write-Host "[smoke] $Label" -ForegroundColor Cyan
    if ($attempt -gt 1) {
      Write-Host "[smoke] Retrying after transient favicon build module error (attempt $attempt of $maxAttempts)" -ForegroundColor Yellow
    }

      $npmOutputFile = Join-Path $env:TEMP ("nexusforge-smoke-npm.{0}.stdout.log" -f $runToken)
      $npmErrorFile = Join-Path $env:TEMP ("nexusforge-smoke-npm.{0}.stderr.log" -f $runToken)
      if (Test-Path $npmOutputFile) { Remove-Item $npmOutputFile -Force -ErrorAction SilentlyContinue }
      if (Test-Path $npmErrorFile) { Remove-Item $npmErrorFile -Force -ErrorAction SilentlyContinue }

      $process = Start-Process -FilePath "npm.cmd" -ArgumentList $CommandArguments -WorkingDirectory $repoRoot -NoNewWindow -Wait -PassThru -RedirectStandardOutput $npmOutputFile -RedirectStandardError $npmErrorFile
      $commandOutput = @()
      if (Test-Path $npmOutputFile) { $commandOutput += Get-Content $npmOutputFile }
      if (Test-Path $npmErrorFile) { $commandOutput += Get-Content $npmErrorFile }
      $commandOutput | ForEach-Object { Write-Host $_ }
      $exitCode = $process.ExitCode

      if ($exitCode -eq 0) {
        return
      }

      $hasFaviconModuleError = ($commandOutput -match "Cannot find module for page: /favicon.ico") -or ($commandOutput -match "Failed to collect page data for /favicon.ico")
      if ($RetryOnTransientFavicon -and $attempt -lt $maxAttempts -and $hasFaviconModuleError) {
        $attempt++
        continue
      }

    throw "Command failed (exit $exitCode): npm $($CommandArguments -join ' ')"
  }
}

$buildArgs = @("run", "build")
$lintArgs = @("run", "lint", "-w", "web")
$serverTestArgs = @("run", "test", "-w", "server")

if (-not $SkipBuild) {
  Invoke-NpmChecked -Label "Build workspace" -CommandArguments $buildArgs -RetryOnTransientFavicon
} else {
  Write-Host "[smoke] Skipping workspace build" -ForegroundColor Yellow
}

if (-not $SkipLint) {
  Invoke-NpmChecked -Label "Lint web" -CommandArguments $lintArgs
} else {
  Write-Host "[smoke] Skipping web lint" -ForegroundColor Yellow
}

if (-not $SkipServerTests) {
  Invoke-NpmChecked -Label "Run server tests" -CommandArguments $serverTestArgs
} else {
  Write-Host "[smoke] Skipping server tests" -ForegroundColor Yellow
}

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

function Test-WebHealthy {
  param([Parameter(Mandatory = $true)] [string] $BaseUrl)

  try {
    $response = Invoke-WebRequest -Uri "$BaseUrl/age-gate" -UseBasicParsing -TimeoutSec 2
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

    if ($serverProcess) {
      Wait-Process -Id $serverProcess.Id -Timeout 1 -ErrorAction SilentlyContinue | Out-Null
      try {
        $serverProcess.Refresh()
      } catch {
        # Parent process handle may be stale while child watcher stays active.
      }
    }
  }

  return $false
}

function Wait-ForWebHealthy {
  param(
    [Parameter(Mandatory = $true)] [string] $BaseUrl,
    [int] $TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-WebHealthy -BaseUrl $BaseUrl) {
      return $true
    }

    if ($webProcess) {
      Wait-Process -Id $webProcess.Id -Timeout 1 -ErrorAction SilentlyContinue | Out-Null
      try {
        $webProcess.Refresh()
      } catch {
        # Parent process handle may be stale while child watcher stays active.
      }
    }
  }

  return $false
}

function Resolve-ServerPort {
  $serverEnvPath = Join-Path $repoRoot "apps/server/.env"
  if (Test-Path $serverEnvPath) {
    $lines = Get-Content $serverEnvPath | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith("#") }
    foreach ($line in $lines) {
      if ($line -match '^[Pp][Oo][Rr][Tt]\s*=\s*"?(\d+)"?$') {
        return [int]$matches[1]
      }
    }
  }

  return 4000
}

$apiPort = Resolve-ServerPort
$apiBase = "http://localhost:$apiPort"
$webBase = "http://127.0.0.1:3000"
try {
  if (-not (Test-ApiHealthy -BaseUrl $apiBase)) {
    Write-Host "[smoke] Server not detected; launching temporary server for API probes" -ForegroundColor Yellow

    $serverProcess = Start-Process -FilePath "node.exe" -ArgumentList @("dist/index.js") -WorkingDirectory (Join-Path $repoRoot "apps/server") -PassThru -WindowStyle Hidden -RedirectStandardOutput $serverStdoutLog -RedirectStandardError $serverStderrLog
    $serverStartedBySmoke = $true

    if (-not (Wait-ForApiHealthy -BaseUrl $apiBase -TimeoutSeconds 60)) {
      $stdoutTail = if (Test-Path $serverStdoutLog) { (Get-Content $serverStdoutLog -Tail 20) -join "`n" } else { "(no stdout log)" }
      $stderrTail = if (Test-Path $serverStderrLog) { (Get-Content $serverStderrLog -Tail 20) -join "`n" } else { "(no stderr log)" }
      throw "Server failed to become healthy within timeout.`n--- stdout ---`n$stdoutTail`n--- stderr ---`n$stderrTail"
    }
  }

  Write-Host "[smoke] Running API probes on $apiBase" -ForegroundColor Cyan
  Test-ApiProbe -Url "$apiBase/api/health"
  Test-ApiProbe -Url "$apiBase/api/runtime/launch-mode"

  if (-not (Test-WebHealthy -BaseUrl $webBase)) {
    Write-Host "[smoke] Web app not detected; launching temporary web app for age gate security validation" -ForegroundColor Yellow

    $webProcess = Start-Process -FilePath "npm.cmd" -ArgumentList @("run", "dev", "-w", "web") -WorkingDirectory $repoRoot -PassThru -WindowStyle Hidden -RedirectStandardOutput $webStdoutLog -RedirectStandardError $webStderrLog
    $webStartedBySmoke = $true

    if (-not (Wait-ForWebHealthy -BaseUrl $webBase -TimeoutSeconds 60)) {
      $webStdoutTail = if (Test-Path $webStdoutLog) { (Get-Content $webStdoutLog -Tail 20) -join "`n" } else { "(no stdout log)" }
      $webStderrTail = if (Test-Path $webStderrLog) { (Get-Content $webStderrLog -Tail 20) -join "`n" } else { "(no stderr log)" }
      throw "Web app failed to become healthy within timeout.`n--- web stdout ---`n$webStdoutTail`n--- web stderr ---`n$webStderrTail"
    }
  }

  $validateAgeGateArgs = @("run", "age:gate:validate:local")
  Invoke-NpmChecked -Label "Validate age-gate security" -CommandArguments $validateAgeGateArgs

  Write-Host "[smoke] Completed successfully." -ForegroundColor Green
} finally {
  if ($webStartedBySmoke) {
    Write-Host "[smoke] Stopping temporary web app instance" -ForegroundColor Cyan
    if ($webProcess -and -not $webProcess.HasExited) {
      Stop-Process -Id $webProcess.Id -Force -ErrorAction SilentlyContinue
    }
  }

  if ($serverStartedBySmoke -and -not $KeepServerAlive) {
    Write-Host "[smoke] Stopping temporary server instance" -ForegroundColor Cyan
    & powershell -NoProfile -ExecutionPolicy Bypass -File "./scripts/cleanup-server-port.ps1" | Out-Null
    if ($serverProcess -and -not $serverProcess.HasExited) {
      Stop-Process -Id $serverProcess.Id -Force -ErrorAction SilentlyContinue
    }
  }

  Pop-Location
}
