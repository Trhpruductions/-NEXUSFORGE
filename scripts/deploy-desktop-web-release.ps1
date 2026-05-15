param(
  [string] $BundleDir = "",
  [string] $RemoteHost = "",
  [string] $RemoteUser = "",
  [string] $RemoteWebRoot = "",
  [int] $RemotePort = 22,
  [string] $SshKeyPath = "",
  [string] $RemoteNginxSnippetPath = "",
  [switch] $SkipNginxReload,
  [switch] $VerifyInsecure
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

function Require-Command {
  param([Parameter(Mandatory = $true)] [string] $Name)

  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw ("Required command '{0}' was not found in PATH." -f $Name)
  }
}

function Resolve-LatestBundleDir {
  param([Parameter(Mandatory = $true)] [string] $Root)

  $candidates = Get-ChildItem -Path $Root -Directory -Filter "desktop-release-*" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending

  if (-not $candidates -or $candidates.Count -eq 0) {
    throw ("No desktop release bundles found under: {0}" -f $Root)
  }

  return $candidates[0].FullName
}

function Assert-FileExists {
  param([Parameter(Mandatory = $true)] [string] $Path)

  if (-not (Test-Path -Path $Path -PathType Leaf)) {
    throw ("Required file not found: {0}" -f $Path)
  }
}

try {
  Require-Command -Name "scp.exe"
  Require-Command -Name "ssh.exe"

  $bundleRoot = Join-Path $repoRoot "apps\desktop\.network-smoke\deploy-bundles"
  $resolvedBundleDir = if ([string]::IsNullOrWhiteSpace($BundleDir)) {
    Resolve-LatestBundleDir -Root $bundleRoot
  }
  else {
    if ([System.IO.Path]::IsPathRooted($BundleDir)) {
      $BundleDir
    }
    else {
      Join-Path $repoRoot $BundleDir
    }
  }

  if (-not (Test-Path -Path $resolvedBundleDir -PathType Container)) {
    throw ("Bundle directory not found: {0}" -f $resolvedBundleDir)
  }

  if ([string]::IsNullOrWhiteSpace($RemoteHost)) {
    $RemoteHost = [string]$env:NEXUSFORGE_DEPLOY_HOST
  }
  if ([string]::IsNullOrWhiteSpace($RemoteUser)) {
    $RemoteUser = [string]$env:NEXUSFORGE_DEPLOY_USER
  }
  if ([string]::IsNullOrWhiteSpace($RemoteWebRoot)) {
    $RemoteWebRoot = [string]$env:NEXUSFORGE_DEPLOY_WEBROOT
  }
  if ([string]::IsNullOrWhiteSpace($SshKeyPath)) {
    $SshKeyPath = [string]$env:NEXUSFORGE_DEPLOY_SSH_KEY_PATH
  }
  if ([string]::IsNullOrWhiteSpace($RemoteNginxSnippetPath)) {
    $RemoteNginxSnippetPath = [string]$env:NEXUSFORGE_DEPLOY_NGINX_SNIPPET_PATH
  }
  if ($RemotePort -eq 22 -and -not [string]::IsNullOrWhiteSpace([string]$env:NEXUSFORGE_DEPLOY_PORT)) {
    $portCandidate = 0
    if (-not [int]::TryParse([string]$env:NEXUSFORGE_DEPLOY_PORT, [ref]$portCandidate)) {
      throw "NEXUSFORGE_DEPLOY_PORT must be a valid integer."
    }
    $RemotePort = $portCandidate
  }

  if ([string]::IsNullOrWhiteSpace($RemoteHost)) {
    throw "RemoteHost is required. Provide -RemoteHost or set NEXUSFORGE_DEPLOY_HOST."
  }
  if ([string]::IsNullOrWhiteSpace($RemoteUser)) {
    throw "RemoteUser is required. Provide -RemoteUser or set NEXUSFORGE_DEPLOY_USER."
  }
  if ([string]::IsNullOrWhiteSpace($RemoteWebRoot)) {
    throw "RemoteWebRoot is required. Provide -RemoteWebRoot or set NEXUSFORGE_DEPLOY_WEBROOT."
  }
  if ($RemotePort -lt 1 -or $RemotePort -gt 65535) {
    throw "RemotePort must be between 1 and 65535."
  }

  $manifestPath = Join-Path $resolvedBundleDir "desktop-update.json"
  $stableInstallerPath = Join-Path $resolvedBundleDir "NexusForge Desktop Setup Latest.exe"
  $versionedInstaller = Get-ChildItem -Path $resolvedBundleDir -File -Filter "NexusForge Desktop Setup *.exe" |
    Where-Object { $_.Name -ne "NexusForge Desktop Setup Latest.exe" } |
    Sort-Object Name |
    Select-Object -First 1

  if (-not $versionedInstaller) {
    throw ("Could not find versioned installer in bundle: {0}" -f $resolvedBundleDir)
  }

  $nginxSnippetLocalPath = Join-Path $resolvedBundleDir "nginx-desktop-release.conf"

  Assert-FileExists -Path $manifestPath
  Assert-FileExists -Path $stableInstallerPath
  Assert-FileExists -Path $versionedInstaller.FullName
  Assert-FileExists -Path $nginxSnippetLocalPath

  if (-not [string]::IsNullOrWhiteSpace($SshKeyPath)) {
    if (-not [System.IO.Path]::IsPathRooted($SshKeyPath)) {
      $SshKeyPath = Join-Path $repoRoot $SshKeyPath
    }
    Assert-FileExists -Path $SshKeyPath
  }

  $remoteHostTarget = "{0}@{1}" -f $RemoteUser, $RemoteHost
  $remoteWebTarget = "{0}:{1}/" -f $remoteHostTarget, $RemoteWebRoot

  $scpBaseArgs = @("-P", "$RemotePort")
  $sshBaseArgs = @("-p", "$RemotePort")
  if (-not [string]::IsNullOrWhiteSpace($SshKeyPath)) {
    $scpBaseArgs += @("-i", $SshKeyPath)
    $sshBaseArgs += @("-i", $SshKeyPath)
  }

  Write-Host ("[desktop-release-deploy] Bundle: {0}" -f $resolvedBundleDir) -ForegroundColor Cyan
  Write-Host ("[desktop-release-deploy] Upload target: {0}" -f $remoteWebTarget) -ForegroundColor Cyan

  $uploadFiles = @($manifestPath, $stableInstallerPath, $versionedInstaller.FullName)
  foreach ($source in $uploadFiles) {
    Write-Host ("[desktop-release-deploy] Uploading {0}" -f ([System.IO.Path]::GetFileName($source))) -ForegroundColor Cyan
    & scp.exe @scpBaseArgs $source $remoteWebTarget
    if ($LASTEXITCODE -ne 0) {
      throw ("Upload failed for file: {0}" -f $source)
    }
  }

  if (-not [string]::IsNullOrWhiteSpace($RemoteNginxSnippetPath)) {
    $remoteSnippetTarget = "{0}:{1}" -f $remoteHostTarget, $RemoteNginxSnippetPath
    Write-Host ("[desktop-release-deploy] Uploading nginx snippet to {0}" -f $RemoteNginxSnippetPath) -ForegroundColor Cyan
    & scp.exe @scpBaseArgs $nginxSnippetLocalPath $remoteSnippetTarget
    if ($LASTEXITCODE -ne 0) {
      throw "Failed to upload nginx snippet."
    }

    if (-not $SkipNginxReload) {
      Write-Host "[desktop-release-deploy] Validating and reloading nginx on remote host" -ForegroundColor Cyan
      $reloadCommand = "sudo nginx -t && sudo systemctl reload nginx"
      & ssh.exe @sshBaseArgs $remoteHostTarget $reloadCommand
      if ($LASTEXITCODE -ne 0) {
        throw "Remote nginx validation/reload failed."
      }
    }
  }
  elseif (-not $SkipNginxReload) {
    Write-Host "[desktop-release-deploy] Nginx snippet path not provided; skipping remote nginx reload." -ForegroundColor Yellow
  }

  Write-Host "[desktop-release-deploy] Running local release verification against public host" -ForegroundColor Cyan
  if ($VerifyInsecure) {
    & npm.cmd run desktop:release:verify:insecure
  }
  else {
    & npm.cmd run desktop:release:verify
  }

  if ($LASTEXITCODE -ne 0) {
    throw "Public release verification failed after deploy."
  }

  Write-Host "[desktop-release-deploy] PASS" -ForegroundColor Green
}
finally {
  Pop-Location
}
