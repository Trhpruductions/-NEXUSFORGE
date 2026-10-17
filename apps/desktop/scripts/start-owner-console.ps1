$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$packageRoot = Split-Path $scriptRoot -Parent
$electronPath = Join-Path $packageRoot "..\..\node_modules\.bin\electron"
$electronPath = Resolve-Path $electronPath -ErrorAction Stop
# Separate profile so the owner session never shares cookies or storage with the main desktop app.
$profileDir = Join-Path $packageRoot ".electron-owner-profile"
$cacheDir = Join-Path $packageRoot ".electron-owner-cache"

if (-not $env:NEXUSFORGE_OWNER_CONSOLE_URL -or [string]::IsNullOrWhiteSpace($env:NEXUSFORGE_OWNER_CONSOLE_URL)) {
  $env:NEXUSFORGE_OWNER_CONSOLE_URL = 'http://127.0.0.1:3000/owner'
}
# main.js reads the start URL from NEXUSFORGE_DESKTOP_URL.
$env:NEXUSFORGE_DESKTOP_URL = $env:NEXUSFORGE_OWNER_CONSOLE_URL

Write-Host "Launching Owner Console window: $($env:NEXUSFORGE_DESKTOP_URL)"
Write-Host "User data dir: $profileDir"

& "$electronPath" --user-data-dir="$profileDir" --disk-cache-dir="$cacheDir" --disable-gpu-shader-disk-cache .
