param(
  [string] $OutputRoot = "./apps/desktop/.network-smoke/deploy-bundles"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

try {
  $manifestPath = Join-Path $repoRoot "apps\web\public\desktop-update.json"
  if (-not (Test-Path -Path $manifestPath)) {
    throw ("Manifest not found: {0}" -f $manifestPath)
  }

  $manifest = Get-Content -Path $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $version = [string]$manifest.version
  if ([string]::IsNullOrWhiteSpace($version)) {
    throw "desktop-update.json is missing 'version'."
  }

  $releaseDir = Join-Path $repoRoot "apps\desktop\release"
  $versionedInstallerName = "NexusForge Desktop Setup {0}.exe" -f $version
  $latestInstallerName = "NexusForge Desktop Setup Latest.exe"

  $versionedInstallerPath = Join-Path $releaseDir $versionedInstallerName
  $latestInstallerPath = Join-Path $releaseDir $latestInstallerName

  if (-not (Test-Path -Path $versionedInstallerPath)) {
    throw ("Versioned installer not found: {0}" -f $versionedInstallerPath)
  }

  if (-not (Test-Path -Path $latestInstallerPath)) {
    throw ("Stable installer not found: {0}" -f $latestInstallerPath)
  }

  $bundleId = Get-Date -Format "yyyyMMdd-HHmmss"
  $bundleDir = Join-Path $repoRoot (Join-Path $OutputRoot ("desktop-release-{0}" -f $bundleId))
  New-Item -ItemType Directory -Path $bundleDir -Force | Out-Null

  $bundleManifestPath = Join-Path $bundleDir "desktop-update.json"
  Copy-Item -Path $manifestPath -Destination $bundleManifestPath -Force
  Copy-Item -Path $versionedInstallerPath -Destination (Join-Path $bundleDir $versionedInstallerName) -Force
  Copy-Item -Path $latestInstallerPath -Destination (Join-Path $bundleDir $latestInstallerName) -Force

  $downloadPagePath = Join-Path $repoRoot "apps\web\public\download.html"
  if (-not (Test-Path -Path $downloadPagePath)) {
    throw ("Download page not found: {0}" -f $downloadPagePath)
  }
  Copy-Item -Path $downloadPagePath -Destination (Join-Path $bundleDir "download.html") -Force

  # Rewrite the bundled manifest to use a root-relative installer URL for static host deployment.
  $bundleManifest = Get-Content -Path $bundleManifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $bundleManifest.downloadUrl = [System.Uri]::EscapeDataString("NexusForge Desktop Setup Latest.exe")
  if ($bundleManifest.PSObject.Properties.Name -contains "downloadUrls") {
    $bundleManifest.downloadUrls = @([System.Uri]::EscapeDataString("NexusForge Desktop Setup Latest.exe"))
  }
  $bundleManifestJson = $bundleManifest | ConvertTo-Json -Depth 10
  [System.IO.File]::WriteAllText($bundleManifestPath, $bundleManifestJson, [System.Text.UTF8Encoding]::new($false))

  $nginxSnippet = @"
# Serve desktop update manifest as real file (no SPA fallback)
location = /desktop-update.json {
  add_header Cache-Control "no-store" always;
  try_files /desktop-update.json =404;
}

# Serve stable/versioned installers as binary files (no HTML rewrites)
location ~* ^/NexusForge%20Desktop%20Setup%20(Latest|[0-9]+\.[0-9]+\.[0-9]+)\.exe$ {
  default_type application/octet-stream;
  add_header Cache-Control "public, max-age=300" always;
  try_files `$uri =404;
}

# Example SPA fallback block (keep after installer/manifest locations)
location / {
  try_files `$uri `$uri/ /index.html;
}
"@

  Set-Content -Path (Join-Path $bundleDir "nginx-desktop-release.conf") -Value $nginxSnippet -Encoding UTF8

  $verifyNotes = @"
Desktop release deployment bundle
Generated: $(Get-Date -Format s)
Version: $version

Upload these files to your public download host root (same host as desktop-update.json and installer URLs):
- desktop-update.json
- $latestInstallerName
- $versionedInstallerName

Then verify from this repo:
1) npm run desktop:release:verify:insecure
2) npm run desktop:release:verify

If verify shows HTML for installer URLs, your host is still rewriting to SPA HTML.
Use nginx-desktop-release.conf rules and disable CDN/page rewrite rules for these paths.
"@

  Set-Content -Path (Join-Path $bundleDir "VERIFY-DEPLOYMENT.txt") -Value $verifyNotes -Encoding UTF8

  Write-Host "[desktop-release-bundle] PASS" -ForegroundColor Green
  Write-Host ("[desktop-release-bundle] Bundle: {0}" -f $bundleDir) -ForegroundColor Cyan
  Write-Host ("[desktop-release-bundle] Files: desktop-update.json, {0}, {1}, nginx-desktop-release.conf, VERIFY-DEPLOYMENT.txt" -f $latestInstallerName, $versionedInstallerName) -ForegroundColor Cyan
}
finally {
  Pop-Location
}
