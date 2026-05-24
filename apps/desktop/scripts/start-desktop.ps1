$ErrorActionPreference = 'Stop'
$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
$packageRoot = Split-Path $scriptRoot -Parent
$electronPath = Join-Path $packageRoot "..\..\node_modules\.bin\electron"
$electronPath = Resolve-Path $electronPath -ErrorAction Stop
$profileDir = Join-Path $packageRoot ".electron-profile"
$cacheDir = Join-Path $packageRoot ".electron-cache"

if (-not $env:NEXUSFORGE_DESKTOP_URL -or [string]::IsNullOrWhiteSpace($env:NEXUSFORGE_DESKTOP_URL)) {
  $env:NEXUSFORGE_DESKTOP_URL = 'http://127.0.0.1:3000/app'
}

Write-Host "Launching desktop app via Electron binary: $electronPath"
Write-Host "User data dir: $profileDir"
Write-Host "Cache dir: $cacheDir"

& "$electronPath" --user-data-dir="$profileDir" --disk-cache-dir="$cacheDir" --disable-gpu-shader-disk-cache .
