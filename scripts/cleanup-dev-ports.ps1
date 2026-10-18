# Stops stale local DEVELOPMENT servers before `npm run dev` starts new ones.
#
# Safety rules (the live site runs on this same PC under pm2):
# - Only the dev ports are touched: web 3301 and API 4002 by default (NF_DEV_WEB_PORT / NF_DEV_API_PORT
#   change them). The live ports below are refused even when asked for explicitly.
# - Only node.exe processes are stopped, never a process that pm2 manages (checked through the whole
#   parent chain), and never a process that also listens on a live port.
#
# Usage: cleanup-dev-ports.ps1 [-Target all|web|api] [-Ports 3301,4002]
[CmdletBinding()]
param(
  [ValidateSet("all", "web", "api")]
  [string]$Target = "all",
  [int[]]$Ports
)

$ErrorActionPreference = "Continue"

# Live services on this PC. Keep in sync with scripts/dev-server.mjs.
#   3000 another bot, 3300 live website, 3400 vexora-gateway, 4001 live API, 5433 Postgres.
$protectedPorts = @(3000, 3300, 3400, 4001, 5433)

function Get-DevPort {
  param([string]$Name, [int]$Default)
  $raw = [string][Environment]::GetEnvironmentVariable($Name)
  $value = 0
  if ($raw -and [int]::TryParse($raw.Trim(), [ref]$value) -and $value -gt 0 -and $value -lt 65536) {
    return $value
  }
  return $Default
}

function Get-ListeningPids {
  param([int]$Port)

  $found = @()
  try {
    $found = @(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | Select-Object -ExpandProperty OwningProcess)
  } catch {
    # The cmdlet throws when nothing listens (or is unavailable); confirm with netstat, matching the port exactly.
    foreach ($line in @(netstat -ano 2>$null)) {
      $parts = ([string]$line).Trim() -split "\s+"
      if ($parts.Count -ge 5 -and $parts[0] -eq "TCP" -and $parts[3] -eq "LISTENING" -and $parts[1] -match ":(\d+)$") {
        if ([int]$matches[1] -eq $Port) {
          $found += [int]$parts[4]
        }
      }
    }
  }

  return @($found | Where-Object { $_ -gt 0 } | Select-Object -Unique)
}

function Test-Pm2Managed {
  param([int]$ProcessId)

  $current = $ProcessId
  for ($depth = 0; $depth -lt 15 -and $current -gt 0; $depth++) {
    $proc = Get-CimInstance Win32_Process -Filter "ProcessId = $current" -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $proc) {
      break
    }

    $commandLine = [string]$proc.CommandLine
    if ($commandLine -match "(?i)[\\/]pm2[\\/]|ProcessContainer(Fork)?\.js|God Daemon|PM2 v\d") {
      return $true
    }

    $parentId = [int]$proc.ParentProcessId
    if ($parentId -eq $current) {
      break
    }
    $current = $parentId
  }

  return $false
}

function Test-ListensOnProtectedPort {
  param([int]$ProcessId)

  try {
    $listenPorts = @(Get-NetTCPConnection -OwningProcess $ProcessId -State Listen -ErrorAction Stop | Select-Object -ExpandProperty LocalPort)
  } catch {
    return $false
  }

  foreach ($listenPort in $listenPorts) {
    if ($protectedPorts -contains [int]$listenPort) {
      return $true
    }
  }
  return $false
}

$webPort = Get-DevPort -Name "NF_DEV_WEB_PORT" -Default 3301
$apiPort = Get-DevPort -Name "NF_DEV_API_PORT" -Default 4002

if ($Ports -and $Ports.Count -gt 0) {
  $requested = @($Ports | Where-Object { $_ -gt 0 } | Select-Object -Unique)
} elseif ($Target -eq "web") {
  $requested = @($webPort)
} elseif ($Target -eq "api") {
  $requested = @($apiPort)
} else {
  $requested = @($webPort, $apiPort)
}

$refused = @($requested | Where-Object { $protectedPorts -contains $_ })
if ($refused.Count -gt 0) {
  Write-Output ("Refusing to clear port(s) " + ($refused -join ", ") + ": they belong to the live site or other services on this PC. Pick other dev ports with NF_DEV_WEB_PORT / NF_DEV_API_PORT.")
  exit 1
}

$stopped = 0
$leftRunning = @()

foreach ($port in $requested) {
  foreach ($pidNumber in @(Get-ListeningPids -Port $port)) {
    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $pidNumber" -ErrorAction SilentlyContinue | Select-Object -First 1
    $processName = if ($processInfo -and $processInfo.Name) { [string]$processInfo.Name } else { "unknown" }

    if ($processName -ne "node.exe") {
      Write-Output "Left PID $pidNumber ($processName) on port ${port}: not a node dev server."
      $leftRunning += $port
      continue
    }

    if (-not $processInfo.CommandLine) {
      Write-Output "Left PID $pidNumber on port ${port}: its command line could not be read, so it may not be a dev server."
      $leftRunning += $port
      continue
    }

    if (Test-Pm2Managed -ProcessId $pidNumber) {
      Write-Output "Left PID $pidNumber on port ${port}: it is managed by pm2."
      $leftRunning += $port
      continue
    }

    if (Test-ListensOnProtectedPort -ProcessId $pidNumber) {
      Write-Output "Left PID $pidNumber on port ${port}: it also serves a live port."
      $leftRunning += $port
      continue
    }

    try {
      Stop-Process -Id $pidNumber -Force -ErrorAction Stop
      $stopped += 1
      Write-Output "Stopped stale dev server PID $pidNumber ($processName) on port $port"
    } catch {
      Write-Output "Failed to stop PID $pidNumber ($processName) on port $port"
      $leftRunning += $port
    }
  }
}

if ($leftRunning.Count -gt 0) {
  Write-Output ("Warning: dev port(s) still in use: " + (($leftRunning | Select-Object -Unique) -join ", ") + ". Set NF_DEV_WEB_PORT / NF_DEV_API_PORT to use other ports.")
} elseif ($stopped -eq 0) {
  Write-Output ("No listeners on dev port(s) " + ($requested -join ", "))
} else {
  Write-Output "Dev port cleanup complete"
}

exit 0
