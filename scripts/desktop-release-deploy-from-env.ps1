param(
  [string] $ConfigPath = "./scripts/desktop-release-deploy.env",
  [string] $BundleDir = "",
  [switch] $VerifyInsecure,
  [switch] $SkipNginxReload
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

function Import-DeployEnvFile {
  param([Parameter(Mandatory = $true)] [string] $Path)

  $resolvedPath = if ([System.IO.Path]::IsPathRooted($Path)) {
    $Path
  }
  else {
    Join-Path $repoRoot $Path
  }

  if (-not (Test-Path -Path $resolvedPath -PathType Leaf)) {
    throw ("Deploy env file not found: {0}" -f $resolvedPath)
  }

  $lineNumber = 0
  $validLineRegex = '^[A-Za-z_][A-Za-z0-9_]*\s*=\s*.*$'

  Get-Content -Path $resolvedPath -Encoding UTF8 | ForEach-Object {
    $lineNumber += 1
    $rawLine = [string]$_
    $line = $rawLine.Trim()

    if ([string]::IsNullOrWhiteSpace($line) -or $line.StartsWith("#")) {
      return
    }

    if ($line -notmatch $validLineRegex) {
      throw ("Invalid line in deploy env file ({0}:{1}): {2}" -f $resolvedPath, $lineNumber, $rawLine)
    }

    $parts = $line.Split('=', 2)
    $key = $parts[0].Trim()
    $value = $parts[1].Trim()

    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      if ($value.Length -ge 2) {
        $value = $value.Substring(1, $value.Length - 2)
      }
    }

    [System.Environment]::SetEnvironmentVariable($key, $value)
  }

  return $resolvedPath
}

function Resolve-EffectiveBundleDir {
  param([string] $ExplicitBundleDir)

  if (-not [string]::IsNullOrWhiteSpace($ExplicitBundleDir)) {
    $resolvedBundleDir = if ([System.IO.Path]::IsPathRooted($ExplicitBundleDir)) {
      $ExplicitBundleDir
    }
    else {
      Join-Path $repoRoot $ExplicitBundleDir
    }

    return $resolvedBundleDir
  }

  $bundleRoot = Join-Path $repoRoot "apps\desktop\.network-smoke\deploy-bundles"
  $candidates = Get-ChildItem -Path $bundleRoot -Directory -Filter "desktop-release-*" -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending

  if (-not $candidates -or $candidates.Count -eq 0) {
    throw ("No desktop release bundles found under: {0}" -f $bundleRoot)
  }

  return $candidates[0].FullName
}

function Assert-DeployEnvValue {
  param(
    [Parameter(Mandatory = $true)] [string] $Name,
    [string[]] $DisallowedValues = @()
  )

  $raw = [string][System.Environment]::GetEnvironmentVariable($Name)
  $value = $raw.Trim()

  if ([string]::IsNullOrWhiteSpace($value)) {
    throw ("Missing required deploy value: {0}. Update scripts/desktop-release-deploy.env." -f $Name)
  }

  foreach ($blocked in $DisallowedValues) {
    if ($value -ieq $blocked) {
      throw ("Deploy value {0} is still placeholder '{1}'. Update scripts/desktop-release-deploy.env with real values." -f $Name, $blocked)
    }
  }

  return $value
}

try {
  $resolvedConfigPath = Import-DeployEnvFile -Path $ConfigPath

  [void](Assert-DeployEnvValue -Name "NEXUSFORGE_DEPLOY_HOST" -DisallowedValues @("your-host.example.com", "example.com"))
  [void](Assert-DeployEnvValue -Name "NEXUSFORGE_DEPLOY_USER" -DisallowedValues @("deploy", "user"))
  [void](Assert-DeployEnvValue -Name "NEXUSFORGE_DEPLOY_WEBROOT" -DisallowedValues @("/var/www/nexusforge", "/var/www/example"))
  [void](Assert-DeployEnvValue -Name "NEXUSFORGE_DEPLOY_PORT")

  Write-Host ("[desktop-release-deploy-env] Loaded config: {0}" -f $resolvedConfigPath) -ForegroundColor Cyan

  $effectiveBundleDir = Resolve-EffectiveBundleDir -ExplicitBundleDir $BundleDir
  $manifestPath = Join-Path $effectiveBundleDir "desktop-update.json"

  Write-Host "[desktop-release-deploy-env] Running artifact consistency preflight" -ForegroundColor Cyan
  & node .\scripts\validate-desktop-artifact-consistency.mjs --release-dir $effectiveBundleDir --manifest-path $manifestPath --allow-missing-report
  if ($LASTEXITCODE -ne 0) {
    throw "Artifact consistency preflight failed. Refusing deploy."
  }

  $deployScriptPath = Join-Path $PSScriptRoot "deploy-desktop-web-release.ps1"

  & $deployScriptPath -BundleDir $effectiveBundleDir -VerifyInsecure:$VerifyInsecure -SkipNginxReload:$SkipNginxReload
  if ($LASTEXITCODE -ne 0) {
    throw "Deploy command failed."
  }
}
finally {
  Pop-Location
}
