param(
  [string] $BundleDir = "",
  [string] $Branch = "gh-pages",
  [string] $Remote = "origin",
  [string] $WorktreeDir = "",
  [string] $CommitMessage = "Publish NexusForge desktop release bundle",
  [switch] $Force,
  [switch] $DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

function Write-Info {
  param([string] $Message)
  Write-Host "[publish-desktop-release-gh-pages] $Message" -ForegroundColor Cyan
}

function Write-ErrorAndExit {
  param([string] $Message)
  Write-Error "[publish-desktop-release-gh-pages] $Message"
  exit 1
}

function Remove-DirectorySafely {
  param([string] $Path)
  if (-not (Test-Path -Path $Path)) {
    return
  }

  Get-ChildItem -Path $Path -Force | ForEach-Object {
    if ($_.Name -eq '.git') {
      return
    }
    Remove-Item -LiteralPath $_.FullName -Force -Recurse -ErrorAction Stop
  }
}

if ([string]::IsNullOrWhiteSpace($BundleDir)) {
  $bundleRoot = Join-Path $repoRoot "apps\desktop\.network-smoke\deploy-bundles"
  if (-not (Test-Path -Path $bundleRoot)) {
    Write-ErrorAndExit "Deployment bundle directory not found: $bundleRoot"
  }

  $latestBundle = Get-ChildItem -Path $bundleRoot -Directory | Sort-Object LastWriteTime -Descending | Select-Object -First 1
  if (-not $latestBundle) {
    Write-ErrorAndExit "No bundle directories found under $bundleRoot"
  }

  $BundleDir = $latestBundle.FullName
}

if (-not (Test-Path -Path $BundleDir)) {
  Write-ErrorAndExit "Bundle directory not found: $BundleDir"
}

$manifestPath = Join-Path $BundleDir "desktop-update.json"
if (-not (Test-Path -Path $manifestPath)) {
  Write-ErrorAndExit "desktop-update.json not found in bundle directory: $BundleDir"
}

$worktreeRoot = if (-not [string]::IsNullOrWhiteSpace($WorktreeDir)) { $WorktreeDir } else { Join-Path $repoRoot "..\gh-pages-worktree" }
$worktreeRoot = Resolve-Path -Path $worktreeRoot -ErrorAction SilentlyContinue | Select-Object -ExpandProperty Path -ErrorAction SilentlyContinue
if (-not $worktreeRoot) {
  $worktreeRoot = Join-Path $repoRoot "..\gh-pages-worktree"
}

if (Test-Path -Path $worktreeRoot) {
  if (-not $Force) {
    Write-ErrorAndExit "Worktree path already exists: $worktreeRoot. Use -Force to overwrite."
  }
  Write-Info "Removing existing worktree path: $worktreeRoot"
  Remove-DirectorySafely -Path $worktreeRoot
  Remove-Item -LiteralPath $worktreeRoot -Force -Recurse -ErrorAction Stop
}

$branchListing = git branch --list $Branch 2>$null | Out-String
$branchExists = if ([string]::IsNullOrWhiteSpace($branchListing)) { $false } else { $true }
if ($branchExists) {
  Write-Info "Creating worktree for existing branch '$Branch' at $worktreeRoot"
  & git worktree add $worktreeRoot $Branch
} else {
  Write-Info "Creating worktree and branch '$Branch' at $worktreeRoot"
  & git worktree add -b $Branch $worktreeRoot
}

if ($LASTEXITCODE -ne 0) {
  Write-ErrorAndExit "Failed to create git worktree for branch '$Branch'"
}

Write-Info "Preparing worktree content"
Push-Location $worktreeRoot

try {
  if (-not $DryRun) {
    Get-ChildItem -Path . -Force | ForEach-Object {
      if ($_.Name -eq '.git') { return }
      Remove-Item -LiteralPath $_.FullName -Force -Recurse -ErrorAction Stop
    }

    Copy-Item -Path (Join-Path $BundleDir '*') -Destination . -Recurse -Force
    git add --all

    $status = git status --porcelain
    if ([string]::IsNullOrWhiteSpace($status)) {
      Write-Info "No changes to commit."
    } else {
      if ($DryRun) {
        Write-Host "DRY RUN: git commit -m '$CommitMessage'"
        Write-Host "DRY RUN: git push $Remote $Branch --force"
      } else {
        git commit -m $CommitMessage
        git push $Remote $Branch --force
      }
    }
  } else {
    Write-Info "Dry run mode enabled. No files changed."
    Write-Host "Bundle directory: $BundleDir"
    Write-Host "Worktree: $worktreeRoot"
  }
}
finally {
  Pop-Location
}

Write-Info "Completed publishing bundle to branch '$Branch' on remote '$Remote'"
Write-Host "Public URL root: https://<username>.github.io/<repo>" -ForegroundColor Green
