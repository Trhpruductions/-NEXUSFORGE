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
    [Parameter(Mandatory = $true)] [string] $WorkingDirectory
  )

  $stdoutLog = Join-Path $logDir ("$Name.stdout.log")
  $stderrLog = Join-Path $logDir ("$Name.stderr.log")

  $proc = Start-Process -FilePath $FilePath `
    -ArgumentList $Arguments `
    -WorkingDirectory $WorkingDirectory `
    -RedirectStandardOutput $stdoutLog `
    -RedirectStandardError $stderrLog `
    -PassThru

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
      if ($content -match $Pattern) {
        return $Matches[0]
      }
    }

    [System.Threading.Thread]::Sleep(1000)
  }

  throw "Timed out waiting for pattern '$Pattern' in $Path"
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
        if ($content -match $pattern) {
          return $Matches[0]
        }
      }
    }

    [System.Threading.Thread]::Sleep(1000)
  }

  throw "Timed out waiting for tunnel URL in logs: $($Paths -join ', ')"
}

Write-Host "[beta] Cleaning dev ports..."
& npm.cmd run dev:cleanup | Out-Null

Write-Host "[beta] Starting API service..."
$api = Start-LoggedProcess -Name "api" -FilePath "npm.cmd" -Arguments @("run", "beta:api") -WorkingDirectory $repoRoot

Write-Host "[beta] Starting API tunnel..."
$apiTunnel = Start-LoggedProcess -Name "api-tunnel" -FilePath "npm.cmd" -Arguments @("run", "beta:tunnel:api") -WorkingDirectory $repoRoot
$apiUrl = Wait-ForUrl -Paths @($apiTunnel.StdoutLog, $apiTunnel.StderrLog) -TimeoutSeconds 90

$envLocalPath = Join-Path $repoRoot "apps\web\.env.local"
$envLocalContent = @(
  "NEXT_PUBLIC_API_URL=$apiUrl"
  "NEXUSFORGE_DESKTOP_ONLY=false"
  ""
) -join [Environment]::NewLine
Set-Content -Path $envLocalPath -Value $envLocalContent -Encoding UTF8

Write-Host "[beta] Updated apps/web/.env.local with public API URL."

Write-Host "[beta] Starting Web (port 3100)..."
$web = Start-LoggedProcess -Name "web" -FilePath "npm.cmd" -Arguments @("run", "beta:web") -WorkingDirectory $repoRoot

Write-Host "[beta] Waiting for web readiness..."
$null = Wait-ForPattern -Path $web.StdoutLog -Pattern "Ready in" -TimeoutSeconds 120

Write-Host "[beta] Starting Web tunnel..."
$webTunnel = Start-LoggedProcess -Name "web-tunnel" -FilePath "npm.cmd" -Arguments @("run", "beta:tunnel:web") -WorkingDirectory $repoRoot
$webUrl = Wait-ForUrl -Paths @($webTunnel.StdoutLog, $webTunnel.StderrLog) -TimeoutSeconds 90

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
