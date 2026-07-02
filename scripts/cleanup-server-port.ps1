[CmdletBinding()]
param(
  [int[]]$Ports,
  [string]$EnvFilePath = ""
)

$ErrorActionPreference = "SilentlyContinue"

function Get-ListeningPidsForPort {
  param([int]$Port)

  $result = @()
  $lines = cmd.exe /d /s /c "netstat -ano -p tcp | findstr LISTENING | findstr :$Port"
  foreach ($line in @($lines)) {
    if (-not $line) {
      continue
    }

    $trimmed = $line.Trim()
    if ($trimmed -match "\s+(\d+)$") {
      $pidValue = [int]$matches[1]
      if ($pidValue -gt 0) {
        $result += $pidValue
      }
    }
  }

  return @($result | Select-Object -Unique)
}

if (-not $EnvFilePath) {
  $EnvFilePath = Join-Path $PSScriptRoot "../apps/server/.env"
}

function Get-ConfiguredPort {
  param([string]$Path)

  if (-not (Test-Path -LiteralPath $Path)) {
    return $null
  }

  $lines = Get-Content -LiteralPath $Path -ErrorAction SilentlyContinue
  foreach ($line in $lines) {
    $trimmed = [string]$line
    if (-not $trimmed) {
      continue
    }

    $trimmed = $trimmed.Trim()
    if (-not $trimmed -or $trimmed.StartsWith('#')) {
      continue
    }

    if ($trimmed -match '^[Pp][Oo][Rr][Tt]\s*=\s*"?(\d+)"?$') {
      return [int]$matches[1]
    }
  }

  return $null
}

$ports = @()
if ($Ports -and $Ports.Count -gt 0) {
  $ports = @($Ports | Where-Object { $_ -gt 0 } | Select-Object -Unique)
} else {
  $configuredPort = Get-ConfiguredPort -Path $EnvFilePath
  if ($configuredPort) {
    $ports = @($configuredPort)
  } else {
    $ports = @(4001)
  }
}

$stopped = $false
$listenersByPid = @{}
foreach ($port in $ports) {
  $connections = @(Get-ListeningPidsForPort -Port $port)
  foreach ($pidNumber in $connections) {
    if (-not $pidNumber) {
      continue
    }

    if (-not $listenersByPid.ContainsKey($pidNumber)) {
      $listenersByPid[$pidNumber] = New-Object System.Collections.Generic.HashSet[int]
    }

    [void]$listenersByPid[$pidNumber].Add($port)
  }
}

foreach ($pidNumber in $listenersByPid.Keys) {
  $portList = @($listenersByPid[$pidNumber] | Sort-Object)
  $portLabel = ($portList -join ",")

  try {
    Stop-Process -Id $pidNumber -Force -ErrorAction Stop
    Write-Output "Stopped PID $pidNumber on port(s) $portLabel"
    $stopped = $true
  } catch {
    Write-Output "Failed to stop PID $pidNumber on port(s) $portLabel"
  }
}

if (-not $stopped) {
  Write-Output "No listener found on ports $($ports -join ',')"
}
