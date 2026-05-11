param(
  [ValidateSet("patch", "minor", "major", "none")]
  [string] $Bump = "patch",
  [string[]] $Notes = @(),
  [string] $PersistentBaseUrl = "",
  [switch] $ForceUpdate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$runId = Get-Date -Format "yyyyMMdd-HHmmss"
$logDir = Join-Path $repoRoot (".beta-logs\desktop-release-" + $runId)
New-Item -ItemType Directory -Path $logDir -Force | Out-Null

$manifestPath = Join-Path $repoRoot "apps\web\public\desktop-update.json"
$desktopPkgPath = Join-Path $repoRoot "apps\desktop\package.json"
$summaryPath = Join-Path $repoRoot "DESKTOP_RELEASE_LINKS.txt"

if ([string]::IsNullOrWhiteSpace($PersistentBaseUrl)) {
  $PersistentBaseUrl = [string]$env:NEXUSFORGE_PERSISTENT_DOWNLOAD_BASE_URL
}

function Normalize-BaseUrl {
  param([Parameter(Mandatory = $true)] [string] $BaseUrl)

  $normalized = $BaseUrl.Trim()
  if ($normalized.EndsWith("/")) {
    $normalized = $normalized.TrimEnd("/")
  }
  return $normalized
}

function Stop-ProcessIfRunning {
  param([Parameter(Mandatory = $true)] [int] $ProcessId)

  try {
    $existing = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
    if ($existing) {
      Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
      return $true
    }
  } catch {
    # Best effort.
  }

  return $false
}

function Get-NextSemver {
  param(
    [Parameter(Mandatory = $true)] [string] $Version,
    [Parameter(Mandatory = $true)] [string] $BumpType
  )

  $parts = $Version.Split(".")
  if ($parts.Count -lt 3) {
    throw "Invalid desktop version '$Version'. Expected semantic version like 1.0.0"
  }

  $major = [int]$parts[0]
  $minor = [int]$parts[1]
  $patch = [int]$parts[2]

  if ($BumpType -eq "major") {
    $major += 1
    $minor = 0
    $patch = 0
  } elseif ($BumpType -eq "minor") {
    $minor += 1
    $patch = 0
  } elseif ($BumpType -eq "patch") {
    $patch += 1
  }

  return "$major.$minor.$patch"
}

function Get-PortOwnerPid {
  param([Parameter(Mandatory = $true)] [int] $Port)

  $line = netstat -ano | findstr ":$Port" | findstr "LISTENING" | Select-Object -First 1
  if (!$line) {
    return $null
  }

  $pidMatch = [regex]::Match($line, "\s(\d+)\s*$")
  if (!$pidMatch.Success) {
    return $null
  }

  return [int]$pidMatch.Groups[1].Value
}

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

function Repair-GeneratedChromiumLicenses {
  param([Parameter(Mandatory = $true)] [string] $ReleaseDir)

  $licensePath = Join-Path $ReleaseDir "win-unpacked\LICENSES.chromium.html"
  if (!(Test-Path $licensePath)) {
    return
  }

  $content = Get-Content $licensePath -Raw -ErrorAction SilentlyContinue
  if ([string]::IsNullOrWhiteSpace($content)) {
    return
  }

  $content = $content.Replace('<html>', '<html lang="en">')
  $content = $content.Replace(
    '<div style="clear:both; overflow:auto;"><!-- Chromium <3s the following projects -->',
    '<div class="credits-root">'
  )
  $content = $content.Replace(
    '<div class="credits-root"><!-- Chromium <3s the following projects -->',
    '<div class="credits-root">'
  )

  if ($content -notmatch "\.credits-root\s*\{") {
    $creditsCssLink = '<link rel="stylesheet" href="chrome://credits/credits.css">'
    $creditsRootStyle = '<style>.credits-root{clear:both;overflow:auto;}</style>'
    $content = $content.Replace(
      $creditsCssLink,
      ($creditsCssLink + [Environment]::NewLine + $creditsRootStyle)
    )
  }

  [System.IO.File]::WriteAllText(
    $licensePath,
    $content,
    [System.Text.UTF8Encoding]::new($false)
  )
}

if (Test-Path $summaryPath) {
  $previousSummary = Get-Content $summaryPath -Raw -ErrorAction SilentlyContinue
  if (-not [string]::IsNullOrWhiteSpace($previousSummary)) {
    $previousTunnelLine = ($previousSummary -split "`r?`n" | Where-Object { $_ -match '^tunnel=' } | Select-Object -First 1)
    if ($previousTunnelLine) {
      $lineParts = $previousTunnelLine -split '=', 2
      if ($lineParts.Count -eq 2) {
        $pidText = $lineParts[1].Trim()
        if ($pidText -match '^\d+$') {
          $previousTunnelPid = [int]$pidText
          if (Stop-ProcessIfRunning -ProcessId $previousTunnelPid) {
            Write-Host "[desktop-release] Stopped previous tunnel PID $previousTunnelPid"
          }
        }
      }
    }
  }
}

$desktopPkgRaw = Get-Content $desktopPkgPath -Raw
$desktopPkg = $desktopPkgRaw | ConvertFrom-Json
$currentVersion = [string]$desktopPkg.version
$desktopVersion = if ($Bump -eq "none") { $currentVersion } else { Get-NextSemver -Version $currentVersion -BumpType $Bump }

if ($desktopVersion -ne $currentVersion) {
  $escapedCurrentVersion = [regex]::Escape($currentVersion)
  $updatedDesktopPkgRaw = [regex]::Replace(
    $desktopPkgRaw,
    '"version"\s*:\s*"' + $escapedCurrentVersion + '"',
    '"version": "' + $desktopVersion + '"',
    1
  )
  [System.IO.File]::WriteAllText(
    $desktopPkgPath,
    $updatedDesktopPkgRaw,
    [System.Text.UTF8Encoding]::new($false)
  )
  Write-Host "[desktop-release] Bumped desktop version: $currentVersion -> $desktopVersion"
} else {
  Write-Host "[desktop-release] Desktop version unchanged: $desktopVersion"
}

Write-Host "[desktop-release] Building desktop installer..."
& npm.cmd run package:win -w @nexusforge/desktop
if ($LASTEXITCODE -ne 0) {
  throw "Desktop installer build failed."
}

$releaseDir = Join-Path $repoRoot "apps\desktop\release"
$installerName = "NexusForge Desktop Setup $desktopVersion.exe"
$installerPath = Join-Path $releaseDir $installerName
if (!(Test-Path $installerPath)) {
  throw "Installer not found at $installerPath after build."
}

Repair-GeneratedChromiumLicenses -ReleaseDir $releaseDir

$hash = (Get-FileHash -Path $installerPath -Algorithm SHA256).Hash.ToLowerInvariant()

$httpOwnerPid = Get-PortOwnerPid -Port 3200
$httpProc = $null
if ($httpOwnerPid) {
  Write-Host "[desktop-release] Reusing installer file server on port 3200 (PID $httpOwnerPid)."
} else {
  Write-Host "[desktop-release] Starting installer file server on port 3200..."
  $httpProc = Start-LoggedProcess -Name "installer-http" -FilePath "npx.cmd" -Arguments @("--yes", "http-server", "apps/desktop/release", "-p", "3200", "-a", "0.0.0.0") -WorkingDirectory $repoRoot
}

$tunnelProc = $null
$publicBaseUrl = ""
$isEphemeral = $false

if (![string]::IsNullOrWhiteSpace($PersistentBaseUrl)) {
  $publicBaseUrl = Normalize-BaseUrl -BaseUrl $PersistentBaseUrl
  Write-Host "[desktop-release] Using persistent base URL: $publicBaseUrl"
} else {
  Write-Host "[desktop-release] Starting fresh public tunnel..."
  $tunnelProc = Start-LoggedProcess -Name "installer-tunnel" -FilePath "npx.cmd" -Arguments @("--yes", "cloudflared", "tunnel", "--url", "http://localhost:3200") -WorkingDirectory $repoRoot
  $publicBaseUrl = Wait-ForUrl -Paths @($tunnelProc.StdoutLog, $tunnelProc.StderrLog) -TimeoutSeconds 90
  $isEphemeral = $true
}

$encodedInstaller = [System.Uri]::EscapeDataString($installerName)
$downloadUrl = "$publicBaseUrl/$encodedInstaller"

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$manifest.version = $desktopVersion
$manifest.downloadUrl = $downloadUrl
$releaseNotes = if ($Notes.Count -gt 0) { $Notes } else { @($manifest.notes) }
if ($manifest.PSObject.Properties.Name -contains "notes") {
  $manifest.notes = @($releaseNotes)
} else {
  $manifest | Add-Member -NotePropertyName "notes" -NotePropertyValue @($releaseNotes)
}
if ($manifest.PSObject.Properties.Name -contains "sha256") {
  $manifest.sha256 = $hash
} else {
  $manifest | Add-Member -NotePropertyName "sha256" -NotePropertyValue $hash
}
if ($manifest.PSObject.Properties.Name -contains "forceUpdate") {
  $manifest.forceUpdate = [bool]$ForceUpdate
} else {
  $manifest | Add-Member -NotePropertyName "forceUpdate" -NotePropertyValue ([bool]$ForceUpdate)
}

$manifestJson = $manifest | ConvertTo-Json -Depth 10
[System.IO.File]::WriteAllText(
  $manifestPath,
  $manifestJson,
  [System.Text.UTF8Encoding]::new($false)
)

$httpServerPid = if ($httpProc) { $httpProc.ProcessId } else { "" }
$httpServerExistingPid = if ($httpOwnerPid) { $httpOwnerPid } else { "" }

$summary = @(
  "NexusForge Desktop Release Links"
  "Generated: $(Get-Date -Format s)"
  ""
  "Download:   $downloadUrl"
  "Directory:  $publicBaseUrl/"
  "SHA256:     $hash"
  "Version:    $desktopVersion"
  "ForceUpdate: $([bool]$ForceUpdate)"
  "Ephemeral:  $isEphemeral"
  ""
  "Process IDs"
  "httpServer=$httpServerPid"
  "httpServerExistingPid=$httpServerExistingPid"
  "tunnel=$(if ($tunnelProc) { $tunnelProc.ProcessId } else { '' })"
  ""
  "Manifest: $manifestPath"
  "Logs:     $logDir"
) -join [Environment]::NewLine

Set-Content -Path $summaryPath -Value $summary -Encoding UTF8

Write-Host ""
Write-Host "[desktop-release] Share this download URL:" -ForegroundColor Green
Write-Host $downloadUrl -ForegroundColor Cyan
Write-Host ""
Write-Host "[desktop-release] Updated desktop manifest with downloadUrl + sha256." -ForegroundColor Green
Write-Host "[desktop-release] Saved summary to DESKTOP_RELEASE_LINKS.txt"
Write-Host "[desktop-release] Version: $desktopVersion"
if ($isEphemeral) {
  Write-Host "[desktop-release] This URL is ephemeral. Set NEXUSFORGE_PERSISTENT_DOWNLOAD_BASE_URL for durable in-app updates." -ForegroundColor Yellow
  Write-Host "[desktop-release] Keep this PowerShell session open to keep the tunnel alive."
}
