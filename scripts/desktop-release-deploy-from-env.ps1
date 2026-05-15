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

try {
  $resolvedConfigPath = Import-DeployEnvFile -Path $ConfigPath

  Write-Host ("[desktop-release-deploy-env] Loaded config: {0}" -f $resolvedConfigPath) -ForegroundColor Cyan

  $deployScriptPath = Join-Path $PSScriptRoot "deploy-desktop-web-release.ps1"
  $deployArgs = @()
  if (-not [string]::IsNullOrWhiteSpace($BundleDir)) {
    $deployArgs += @("-BundleDir", $BundleDir)
  }
  if ($VerifyInsecure) {
    $deployArgs += "-VerifyInsecure"
  }
  if ($SkipNginxReload) {
    $deployArgs += "-SkipNginxReload"
  }

  & $deployScriptPath @deployArgs
  if ($LASTEXITCODE -ne 0) {
    throw "Deploy command failed."
  }
}
finally {
  Pop-Location
}
