param(
  [ValidateSet("patch", "minor", "major", "none")]
  [string] $Bump = "patch",
  [string[]] $Notes = @(),
  [string] $PersistentBaseUrl = "",
  [switch] $ForceUpdate,
  [switch] $AllowEphemeral,
  [switch] $AllowUnresolvedTunnelHostnames,
  [switch] $AllowInsecureTlsValidation,
  [switch] $SkipDownloadUrlValidation,
  [switch] $SkipDoctor
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

$discordDownloadTargetId = [string]$env:DISCORD_DOWNLOAD_TARGET_ID
$discordReportGuildId = [string]$env:DISCORD_REPORT_GUILD_ID
$discordGuildId = [string]$env:DISCORD_GUILD_ID
$discordResolvedTargetId = ""
$discordTargetCandidates = @($discordDownloadTargetId, $discordReportGuildId, $discordGuildId)
foreach ($candidate in $discordTargetCandidates) {
  if (-not [string]::IsNullOrWhiteSpace($candidate)) {
    $discordResolvedTargetId = $candidate.Trim()
    break
  }
}
$discordDownloadChannelName = [string]$env:DISCORD_DOWNLOAD_CHANNEL_NAME
if ([string]::IsNullOrWhiteSpace($discordDownloadChannelName)) {
  $discordDownloadChannelName = "app-downloads"
}

function Format-BaseUrl {
  param([Parameter(Mandatory = $true)] [string] $BaseUrl)

  $normalized = $BaseUrl.Trim()
  if ($normalized.EndsWith("/")) {
    $normalized = $normalized.TrimEnd("/")
  }
  return $normalized
}

function Test-IsEphemeralOrNonDurableUrl {
  param([Parameter(Mandatory = $true)] [string] $BaseUrl)

  $candidate = $BaseUrl.Trim()
  if ([string]::IsNullOrWhiteSpace($candidate)) {
    return $true
  }

  try {
    $uri = [System.Uri]$candidate
    $baseHost = [string]$uri.Host
    if ($null -eq $baseHost) {
      $baseHost = ""
    }
    $baseHost = $baseHost.ToLowerInvariant()
    if ([string]::IsNullOrWhiteSpace($baseHost)) {
      return $true
    }

    if ($baseHost -match "(^|\.)trycloudflare\.com$") {
      return $true
    }

    if ($baseHost -in @("localhost", "127.0.0.1", "0.0.0.0")) {
      return $true
    }

    return $false
  } catch {
    return $true
  }
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
    [Parameter(Mandatory = $true)] [int] $TimeoutSeconds,
    [Parameter(Mandatory = $true)] [string] $Pattern
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)

  while ((Get-Date) -lt $deadline) {
    foreach ($path in $Paths) {
      if (Test-Path $path) {
        $content = Get-Content $path -Raw -ErrorAction SilentlyContinue
        if ($content -match $Pattern) {
          return $Matches[0]
        }
      }
    }

    [System.Threading.Thread]::Sleep(1000)
  }

  throw "Timed out waiting for public URL in logs: $($Paths -join ', ')"
}

function Test-UrlHostnameResolves {
  param([Parameter(Mandatory = $true)] [string] $Url)

  try {
    $uri = [System.Uri]$Url
    $host = [string]$uri.Host
    if ([string]::IsNullOrWhiteSpace($host)) {
      return $false
    }

    $addresses = [System.Net.Dns]::GetHostAddresses($host)
    return ($null -ne $addresses -and $addresses.Count -gt 0)
  }
  catch {
    return $false
  }
}

function Start-EphemeralTunnelWithResolvedHostname {
  param(
    [int] $UrlTimeoutSeconds = 90,
    [int] $DnsProbeAttempts = 10,
    [int] $DnsProbeDelaySeconds = 2,
    [switch] $AllowUnresolvedHostnames
  )

  if ($UrlTimeoutSeconds -lt 15) {
    $UrlTimeoutSeconds = 15
  }
  if ($DnsProbeAttempts -lt 1) {
    $DnsProbeAttempts = 1
  }
  if ($DnsProbeDelaySeconds -lt 1) {
    $DnsProbeDelaySeconds = 1
  }

  $providers = @(
    [PSCustomObject]@{
      Name = "cloudflared"
      Attempts = 4
      FilePath = "npx.cmd"
      Arguments = @("--yes", "cloudflared", "tunnel", "--url", "http://localhost:3200")
      Pattern = "https://[a-z0-9-]+\.trycloudflare\.com"
    },
    [PSCustomObject]@{
      Name = "localtunnel"
      Attempts = 2
      FilePath = "npx.cmd"
      Arguments = @("--yes", "localtunnel", "--port", "3200")
      Pattern = "https://[a-z0-9-]+\.loca\.lt"
    }
  )

  foreach ($provider in $providers) {
    if ($provider.Attempts -lt 1) {
      continue
    }

    for ($attempt = 1; $attempt -le $provider.Attempts; $attempt++) {
      Write-Host ("[desktop-release] Starting public tunnel via {0} (attempt {1}/{2})..." -f $provider.Name, $attempt, $provider.Attempts)
      $tunnelName = "installer-tunnel-{0}-{1}" -f $provider.Name, $attempt
      $tunnelProc = Start-LoggedProcess -Name $tunnelName -FilePath $provider.FilePath -Arguments $provider.Arguments -WorkingDirectory $repoRoot
      $retainTunnelProcess = $false

      try {
        $publicBaseUrl = Wait-ForUrl -Paths @($tunnelProc.StdoutLog, $tunnelProc.StderrLog) -TimeoutSeconds $UrlTimeoutSeconds -Pattern $provider.Pattern

        if ($AllowUnresolvedHostnames) {
          $retainTunnelProcess = $true
          return [PSCustomObject]@{
            PublicBaseUrl = $publicBaseUrl
            TunnelProcess = $tunnelProc
            Provider = $provider.Name
          }
        }

        $dnsResolved = $false

        for ($dnsAttempt = 1; $dnsAttempt -le $DnsProbeAttempts; $dnsAttempt++) {
          if (Test-UrlHostnameResolves -Url $publicBaseUrl) {
            $dnsResolved = $true
            break
          }

          if ($dnsAttempt -lt $DnsProbeAttempts) {
            [System.Threading.Thread]::Sleep($DnsProbeDelaySeconds * 1000)
          }
        }

        if ($dnsResolved) {
          $retainTunnelProcess = $true
          return [PSCustomObject]@{
            PublicBaseUrl = $publicBaseUrl
            TunnelProcess = $tunnelProc
            Provider = $provider.Name
          }
        }

        Write-Host ("[desktop-release] {0} URL did not resolve via DNS: {1}" -f $provider.Name, $publicBaseUrl) -ForegroundColor Yellow
      }
      catch {
        Write-Host ("[desktop-release] {0} bootstrap failed: {1}" -f $provider.Name, $_.Exception.Message) -ForegroundColor Yellow
      }
      finally {
        if (-not $retainTunnelProcess -and (Stop-ProcessIfRunning -ProcessId $tunnelProc.ProcessId)) {
          Write-Host ("[desktop-release] Stopped unresolved tunnel PID {0}" -f $tunnelProc.ProcessId) -ForegroundColor Yellow
        }
      }
    }
  }

  throw "Failed to provision a DNS-resolved temporary tunnel (cloudflared/localtunnel) after multiple attempts."
}

function Assert-DownloadUrlLooksLikeBinary {
  param(
    [Parameter(Mandatory = $true)] [string] $Url,
    [int] $MaxAttempts = 6,
    [int] $DelaySeconds = 5,
    [switch] $AllowInsecureTlsValidation
  )

  if ($MaxAttempts -lt 1) {
    $MaxAttempts = 1
  }

  if ($DelaySeconds -lt 1) {
    $DelaySeconds = 1
  }

  $lastErrorMessage = ""
  $previousTlsCallback = $null
  $tlsCallbackUpdated = $false
  $previousSecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol

  try {
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12

    if ($AllowInsecureTlsValidation) {
      $previousTlsCallback = [System.Net.ServicePointManager]::ServerCertificateValidationCallback
      [System.Net.ServicePointManager]::ServerCertificateValidationCallback = { $true }
      $tlsCallbackUpdated = $true
      Write-Host "[desktop-release] WARNING: URL validation is running with insecure TLS certificate bypass." -ForegroundColor Yellow
    }

    for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
      try {
        $response = Invoke-WebRequest -Uri $Url -Method Head -UseBasicParsing -TimeoutSec 30
        $statusCode = [int]$response.StatusCode
        if ($statusCode -lt 200 -or $statusCode -ge 400) {
          throw "Unexpected status code $statusCode"
        }

        $contentType = [string]$response.Headers["Content-Type"]
        if ([string]::IsNullOrWhiteSpace($contentType)) {
          $contentType = [string]$response.ContentType
        }
        if ($null -eq $contentType) {
          $contentType = ""
        }
        $contentType = $contentType.ToLowerInvariant()

        if ($contentType -match "text/html") {
          throw "Content-Type '$contentType' indicates HTML, not an installer binary"
        }

        return
      }
      catch {
        $lastErrorMessage = $_.Exception.Message
        if ($attempt -lt $MaxAttempts) {
          Write-Host ("[desktop-release] Download URL check attempt {0}/{1} failed: {2}" -f $attempt, $MaxAttempts, $lastErrorMessage) -ForegroundColor Yellow
          [System.Threading.Thread]::Sleep($DelaySeconds * 1000)
        }
      }
    }

    throw "Download URL validation failed for '$Url' after $MaxAttempts attempts. Ensure this URL serves the .exe file directly. Details: $lastErrorMessage"
  }
  finally {
    [System.Net.ServicePointManager]::SecurityProtocol = $previousSecurityProtocol
    if ($tlsCallbackUpdated) {
      [System.Net.ServicePointManager]::ServerCertificateValidationCallback = $previousTlsCallback
    }
  }
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

function Invoke-CommandWithRetry {
  param(
    [Parameter(Mandatory = $true)] [scriptblock] $Action,
    [Parameter(Mandatory = $true)] [string] $Description,
    [int] $MaxAttempts = 3,
    [int] $DelaySeconds = 3
  )

  if ($MaxAttempts -lt 1) {
    $MaxAttempts = 1
  }
  if ($DelaySeconds -lt 1) {
    $DelaySeconds = 1
  }

  $lastErrorMessage = ""

  for ($attempt = 1; $attempt -le $MaxAttempts; $attempt++) {
    try {
      & $Action
      if ($LASTEXITCODE -eq 0) {
        return
      }

      $lastErrorMessage = "$Description exited with code $LASTEXITCODE"
    }
    catch {
      $lastErrorMessage = $_.Exception.Message
    }

    if ($attempt -lt $MaxAttempts) {
      Write-Host ("[desktop-release] {0} failed (attempt {1}/{2}): {3}" -f $Description, $attempt, $MaxAttempts, $lastErrorMessage) -ForegroundColor Yellow
      [System.Threading.Thread]::Sleep($DelaySeconds * 1000)
      continue
    }

    throw "{0} failed after {1} attempts. Last error: {2}" -f $Description, $MaxAttempts, $lastErrorMessage
  }
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

if ($SkipDoctor) {
  Write-Host "[desktop-release] Skipping release doctor gate due to -SkipDoctor." -ForegroundColor Yellow
} else {
  Write-Host "[desktop-release] Running release doctor archive gate..."
  & npm.cmd run ops:doctor:archive
  if ($LASTEXITCODE -ne 0) {
    throw "Release doctor gate failed. Fix failures before publishing desktop release."
  }
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

$latestInstallerName = "NexusForge Desktop Setup Latest.exe"
$latestInstallerPath = Join-Path $releaseDir $latestInstallerName
Copy-Item -Path $installerPath -Destination $latestInstallerPath -Force

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
  $publicBaseUrl = Format-BaseUrl -BaseUrl $PersistentBaseUrl
  if ((Test-IsEphemeralOrNonDurableUrl -BaseUrl $publicBaseUrl) -and -not $AllowEphemeral) {
    throw "Refusing to publish desktop release with non-durable base URL '$publicBaseUrl'. Provide a persistent host or re-run with -AllowEphemeral for temporary testing only."
  }
  if ((Test-IsEphemeralOrNonDurableUrl -BaseUrl $publicBaseUrl) -and $AllowEphemeral) {
    $isEphemeral = $true
  }
  Write-Host "[desktop-release] Using persistent base URL: $publicBaseUrl"
} else {
  if (-not $AllowEphemeral) {
    throw "Persistent base URL is required. Set -PersistentBaseUrl or NEXUSFORGE_PERSISTENT_DOWNLOAD_BASE_URL. Use -AllowEphemeral only for temporary testing links."
  }

  $tunnelResult = Start-EphemeralTunnelWithResolvedHostname -AllowUnresolvedHostnames:$AllowUnresolvedTunnelHostnames
  $tunnelProc = $tunnelResult.TunnelProcess
  $publicBaseUrl = [string]$tunnelResult.PublicBaseUrl
  $tunnelProvider = [string]$tunnelResult.Provider
  Write-Host ("[desktop-release] Using temporary tunnel provider: {0}" -f $tunnelProvider) -ForegroundColor Cyan
  if ($AllowUnresolvedTunnelHostnames) {
    Write-Host "[desktop-release] WARNING: Allowing unresolved tunnel hostname by explicit override." -ForegroundColor Yellow
  }
  $isEphemeral = $true
}

$encodedInstaller = [System.Uri]::EscapeDataString($installerName)
$downloadUrl = "$publicBaseUrl/$encodedInstaller"
$encodedLatestInstaller = [System.Uri]::EscapeDataString($latestInstallerName)
$stableDownloadUrl = "$publicBaseUrl/$encodedLatestInstaller"
if ($SkipDownloadUrlValidation) {
  Write-Host "[desktop-release] WARNING: Skipping download URL validation by explicit override." -ForegroundColor Yellow
} else {
  Assert-DownloadUrlLooksLikeBinary -Url $stableDownloadUrl -AllowInsecureTlsValidation:$AllowInsecureTlsValidation
}

$manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
$manifest.version = $desktopVersion
$manifest.downloadUrl = $stableDownloadUrl
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

Invoke-CommandWithRetry -Description "desktop manifest validation" -MaxAttempts 2 -DelaySeconds 2 -Action {
  & npm.cmd run desktop:manifest:validate -w @nexusforge/server
}

$httpServerPid = if ($httpProc) { $httpProc.ProcessId } else { "" }
$httpServerExistingPid = if ($httpOwnerPid) { $httpOwnerPid } else { "" }

$summary = @(
  "NexusForge Desktop Release Links"
  "Generated: $(Get-Date -Format s)"
  ""
  "Download:   $downloadUrl"
  "DownloadStable: $stableDownloadUrl"
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

if (-not [string]::IsNullOrWhiteSpace($env:DISCORD_BOT_TOKEN) -and -not [string]::IsNullOrWhiteSpace($discordResolvedTargetId)) {
  Write-Host "[desktop-release] Updating Discord download embed..."
  Invoke-CommandWithRetry -Description "Discord download embed update" -MaxAttempts 3 -DelaySeconds 4 -Action {
    & npm.cmd run discord:post:download -w @nexusforge/server -- $discordResolvedTargetId $discordDownloadChannelName
  }
  Write-Host "[desktop-release] Discord download embed updated." -ForegroundColor Green
} else {
  Write-Host "[desktop-release] Skipping Discord embed update (set DISCORD_BOT_TOKEN and one of DISCORD_DOWNLOAD_TARGET_ID / DISCORD_REPORT_GUILD_ID / DISCORD_GUILD_ID to enable)." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "[desktop-release] Share this download URL:" -ForegroundColor Green
Write-Host $stableDownloadUrl -ForegroundColor Cyan
Write-Host "[desktop-release] Version-specific URL:" -ForegroundColor Green
Write-Host $downloadUrl -ForegroundColor Cyan
Write-Host ""
Write-Host "[desktop-release] Updated desktop manifest with downloadUrl + sha256." -ForegroundColor Green
Write-Host "[desktop-release] Saved summary to DESKTOP_RELEASE_LINKS.txt"
Write-Host "[desktop-release] Version: $desktopVersion"
if ($isEphemeral) {
  Write-Host "[desktop-release] This URL is ephemeral. Set NEXUSFORGE_PERSISTENT_DOWNLOAD_BASE_URL for durable in-app updates." -ForegroundColor Yellow
  Write-Host "[desktop-release] Keep this PowerShell session open to keep the tunnel alive."
}
