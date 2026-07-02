#!/usr/bin/env pwsh
# Setup GitHub Releases Distribution - Alternative to GitHub Pages
# Purpose: Create official distribution channel independent of GitHub Pages
# Triggered: On demand or post-build

param(
    [string]$Version = "1.0.11",
    [string]$InstallerPath = "apps/desktop/release/NexusForge Desktop Setup $Version.exe",
    [string]$ReleaseTitle = "NexusForge Desktop v$Version",
    [string]$ReleaseNotes = "Stable production release - NexusForge Gaming Platform"
)

$ErrorActionPreference = "Stop"

Write-Host "`n=== GitHub Releases Distribution Setup ===" -ForegroundColor Cyan

# Validate installer exists
if (-not (Test-Path $InstallerPath)) {
    Write-Host "[ERROR] Installer not found: $InstallerPath" -ForegroundColor Red
    exit 1
}

$installerSize = (Get-Item $InstallerPath).Length / 1MB
$hash = (Get-FileHash $InstallerPath -Algorithm SHA256).Hash
$hashShort = $hash.Substring(0, 8)

Write-Host "[INFO] Installer: $InstallerPath"
Write-Host "[INFO] Size: $([Math]::Round($installerSize, 1)) MB"
Write-Host "[INFO] SHA256: $hashShort..."

# Check if release already exists
Write-Host "`n[STEP 1] Checking if release v$Version exists..."
try {
    $existing = gh release view "v$Version" --repo Trhpructions/-NEXUSFORGE 2>&1
    if ($existing) {
        Write-Host "[WARNING] Release v$Version already exists"
        Write-Host "[ACTION] Deleting existing release..."
        gh release delete "v$Version" --repo Trhpruductions/-NEXUSFORGE --yes 2>&1 | Out-Null
        Write-Host "[OK] Old release deleted"
    }
} catch {
    Write-Host "[OK] Release v$Version does not exist (new release)"
}

# Create new release with installer
Write-Host "`n[STEP 2] Creating GitHub release..."
try {
    gh release create "v$Version" `
        --repo Trhpruductions/-NEXUSFORGE `
        --title "$ReleaseTitle" `
        --notes "$ReleaseNotes`n`nSHA256: $hash`nSize: $([Math]::Round($installerSize, 1)) MB" `
        "$InstallerPath" `
        2>&1
    
    Write-Host "[OK] Release created successfully"
    Write-Host "[INFO] Download URL: https://github.com/Trhpructions/-NEXUSFORGE/releases/download/v$Version/NexusForge%20Desktop%20Setup%20$Version.exe"
} catch {
    Write-Host "[ERROR] Failed to create release: $_" -ForegroundColor Red
    exit 1
}

# Create/update draft release for next version
Write-Host "`n[STEP 3] Setting up draft release for next version..."
try {
    # Pre-release tag (for testing)
    gh release create "v$Version-beta" `
        --repo Trhpructions/-NEXUSFORGE `
        --title "NexusForge Desktop v$Version (Beta)" `
        --notes "Beta/pre-release version - testing only" `
        --prerelease `
        --draft `
        2>&1 | Out-Null
    
    Write-Host "[OK] Draft beta release created"
} catch {
    Write-Host "[OK] Draft already exists or skipped"
}

Write-Host "`n=== GitHub Releases Setup Complete ===" -ForegroundColor Green
Write-Host "[VERIFY] Check release: https://github.com/Trhpructions/-NEXUSFORGE/releases"
Write-Host "`n"
exit 0
