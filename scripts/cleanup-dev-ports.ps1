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

$ports = @(3000, 3001, 3100, 4000, 4001)
$stopped = @{}

foreach ($port in $ports) {
  $listeners = @(Get-ListeningPidsForPort -Port $port)

  foreach ($pidNumber in $listeners) {
    if (-not $pidNumber -or $stopped.ContainsKey($pidNumber)) {
      continue
    }

    $processInfo = Get-CimInstance Win32_Process -Filter "ProcessId = $pidNumber" | Select-Object -First 1
    $processName = if ($processInfo -and $processInfo.Name) { $processInfo.Name } else { "unknown" }

    try {
      Stop-Process -Id $pidNumber -Force -ErrorAction Stop
      $stopped[$pidNumber] = $true
      Write-Output "Stopped PID $pidNumber ($processName) on port $port"
    } catch {
      Write-Output "Failed to stop PID $pidNumber ($processName) on port $port"
    }
  }
}

$remaining = @()
foreach ($port in $ports) {
  $listener = @(Get-ListeningPidsForPort -Port $port)
  if ($listener.Count -gt 0) {
    $remaining += $port
  }
}

if ($remaining.Count -gt 0) {
  Write-Output ("Warning: ports still occupied after cleanup: " + ($remaining -join ", "))
} elseif ($stopped.Count -eq 0) {
  Write-Output "No listeners found on dev ports"
} else {
  Write-Output "Dev port cleanup complete"
}
