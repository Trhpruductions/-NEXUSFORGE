Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$runId = Get-Date -Format "yyyyMMdd-HHmmss"
$logDir = Join-Path $repoRoot (".beta-logs\" + $runId)
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

function Start-LoggedProcess {
  param(
    [Parameter(Mandatory = $true)] [string] $Name,
    [Parameter(Mandatory = $true)] [string] $FilePath,
    [Parameter(Mandatory = $true)] [string[]] $Arguments,
    [Parameter(Mandatory = $true)] [string] $WorkingDirectory,
    [Parameter(Mandatory = $false)] [hashtable] $EnvironmentVariables
  )

  $stdoutLog = Join-Path $logDir ("$Name.stdout.log")
  $stderrLog = Join-Path $logDir ("$Name.stderr.log")

  if ($EnvironmentVariables -and $EnvironmentVariables.Count -gt 0) {
    $setLines = $EnvironmentVariables.GetEnumerator() | ForEach-Object {
      "set `"$($_.Key)`"=`"$($_.Value)`""
    }
    $setCommand = ($setLines -join " && ")
    $resolvedFilePath = $FilePath
    try {
      $resolvedFilePath = (Get-Command $FilePath -ErrorAction Stop).Source
    } catch {
      # leave FilePath unchanged if resolution fails
    }
    $command = if ($setCommand) { "$setCommand && `"$resolvedFilePath`" $($Arguments -join ' ')" } else { "`"$resolvedFilePath`" $($Arguments -join ' ')" }
    $proc = Start-Process -FilePath "cmd.exe" `
      -ArgumentList @("/d", "/s", "/c", $command) `
      -WorkingDirectory $WorkingDirectory `
      -RedirectStandardOutput $stdoutLog `
      -RedirectStandardError $stderrLog `
      -PassThru
  } else {
    $proc = Start-Process -FilePath $FilePath `
      -ArgumentList $Arguments `
      -WorkingDirectory $WorkingDirectory `
      -RedirectStandardOutput $stdoutLog `
      -RedirectStandardError $stderrLog `
      -PassThru
  }

  [PSCustomObject]@{
    Name = $Name
    ProcessId = $proc.Id
    StdoutLog = $stdoutLog
    StderrLog = $stderrLog
  }
}

function Wait-ForPattern {
  param(
    [Parameter(Mandatory = $true)] [string] $Path,
    [Parameter(Mandatory = $true)] [string] $Pattern,
    [Parameter(Mandatory = $true)] [int] $TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path $Path) {
      $content = Get-Content $Path -Raw -ErrorAction SilentlyContinue
      if (![string]::IsNullOrEmpty($content)) {
        $match = [regex]::Match($content, $Pattern)
        if ($match.Success) {
          return $match.Value
        }
      }
    }

    [System.Threading.Thread]::Sleep(1000)
  }

  throw "Timed out waiting for pattern '$Pattern' in $Path"
}

function Wait-ForHttpUrl {
  param(
    [Parameter(Mandatory = $true)] [string] $Url,
    [Parameter(Mandatory = $true)] [int] $TimeoutSeconds
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return $response.StatusCode
      }
    } catch {
      # ignore transient failures while waiting for startup
    }

    Start-Sleep -Seconds 1
  }

  throw "Timed out waiting for HTTP URL '$Url'"
}

function Wait-ForUrl {
  param(
    [Parameter(Mandatory = $true)] [string[]] $Paths,
    [Parameter(Mandatory = $true)] [int] $TimeoutSeconds
  )

  $pattern = "https://[a-z0-9-]+\.trycloudflare\.com"
  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    foreach ($path in $Paths) {
      if (Test-Path $path) {
        $content = Get-Content $path -Raw -ErrorAction SilentlyContinue
        if (![string]::IsNullOrEmpty($content)) {
          $match = [regex]::Match($content, $pattern)
          if ($match.Success) {
            return $match.Value
          }
        }
      }
    }

    [System.Threading.Thread]::Sleep(1000)
  }

  throw "Timed out waiting for tunnel URL in logs: $($Paths -join ', ')"
}

Write-Host "[beta] Cleaning dev ports..."
& npm.cmd run dev:cleanup | Out-Null

Write-Host "[beta] Starting Web (port 3100)..."
$web = Start-LoggedProcess -Name "web" -FilePath "npm.cmd" -Arguments @( "run", "beta:web" ) -WorkingDirectory $repoRoot

Write-Host "[beta] Waiting for web readiness..."
$null = Wait-ForPattern -Path $web.StdoutLog -Pattern "Ready in" -TimeoutSeconds 120
$null = Wait-ForHttpUrl -Url "http://127.0.0.1:3100/" -TimeoutSeconds 60

Write-Host "[beta] Starting Web tunnel..."
$webTunnel = Start-LoggedProcess -Name "web-tunnel" -FilePath "npm.cmd" -Arguments @( "run", "beta:tunnel:web" ) -WorkingDirectory $repoRoot
$webUrl = Wait-ForUrl -Paths @($webTunnel.StdoutLog, $webTunnel.StderrLog) -TimeoutSeconds 90

Write-Host "[beta] Starting API service..."
$apiEnv = @{
  APP_WEB_URL = $webUrl
  CLIENT_ORIGIN = $webUrl
  PORT = "4001"
}
$api = Start-LoggedProcess -Name "api" -FilePath "npm.cmd" -Arguments @( "run", "beta:api:tunnel" ) -WorkingDirectory $repoRoot -EnvironmentVariables $apiEnv
$null = Wait-ForHttpUrl -Url "http://127.0.0.1:4001/api/health" -TimeoutSeconds 60

Write-Host "[beta] Starting API tunnel..."
$apiTunnel = Start-LoggedProcess -Name "api-tunnel" -FilePath "npm.cmd" -Arguments @( "run", "beta:tunnel:api" ) -WorkingDirectory $repoRoot -EnvironmentVariables $apiEnv
$apiUrl = Wait-ForUrl -Paths @($apiTunnel.StdoutLog, $apiTunnel.StderrLog) -TimeoutSeconds 90

Write-Host "[beta] Restarting Web with public API URL..."
Stop-Process -Id $web.ProcessId -Force
$web = Start-LoggedProcess -Name "web" -FilePath "npm.cmd" -Arguments @( "run", "beta:web" ) -WorkingDirectory $repoRoot -EnvironmentVariables @{ NEXT_PUBLIC_API_URL = $apiUrl; NEXT_PUBLIC_APP_URL = $webUrl; NEXUSFORGE_DESKTOP_ONLY = "false" }

Write-Host "[beta] Waiting for web readiness after restart..."
$null = Wait-ForPattern -Path $web.StdoutLog -Pattern "Ready in" -TimeoutSeconds 120
$null = Wait-ForHttpUrl -Url "http://127.0.0.1:3100/" -TimeoutSeconds 60

$envLocalPath = Join-Path $repoRoot "apps\web\.env.local"
$envLocalContent = @(
  "NEXT_PUBLIC_API_URL=$apiUrl"
  "NEXT_PUBLIC_APP_URL=$webUrl"
  "NEXUSFORGE_DESKTOP_ONLY=false"
  ""
) -join [Environment]::NewLine
Set-Content -Path $envLocalPath -Value $envLocalContent -Encoding UTF8

Write-Host "[beta] Updated apps/web/.env.local with public API URL."

$summaryPath = Join-Path $repoRoot "BETA_LINKS.txt"
$summary = @(
  "NexusForge Beta Links"
  "Generated: $(Get-Date -Format s)"
  ""
  "Tester Hub: $webUrl/beta"
  "Checklist:  $webUrl/beta/checklist"
  "Feedback:   $webUrl/beta/feedback"
  "API Health: $apiUrl/api/health"
  ""
  "Desktop launch target: $webUrl/app"
  "Desktop launch env: NEXUSFORGE_DESKTOP_URL=$webUrl/app"
  ""
  "Process IDs"
  "api=$($api.ProcessId)"
  "apiTunnel=$($apiTunnel.ProcessId)"
  "web=$($web.ProcessId)"
  "webTunnel=$($webTunnel.ProcessId)"
  ""
  "Logs: $logDir"
) -join [Environment]::NewLine

Set-Content -Path $summaryPath -Value $summary -Encoding UTF8

Write-Host ""
Write-Host "[beta] Ready. Share this link with testers:" -ForegroundColor Green
Write-Host "$webUrl/beta" -ForegroundColor Cyan
Write-Host ""
Write-Host "[beta] Saved link summary to BETA_LINKS.txt"
Write-Host "[beta] Keep this PowerShell session open to keep processes running."
