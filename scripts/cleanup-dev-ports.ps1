$ErrorActionPreference = "SilentlyContinue"

$ports = @(3000, 3001, 3100, 4000, 4001)
$stopped = @{}

foreach ($port in $ports) {
  $listeners = Get-NetTCPConnection -LocalPort $port -State Listen | Select-Object -ExpandProperty OwningProcess -Unique

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
  $listener = Get-NetTCPConnection -LocalPort $port -State Listen | Select-Object -First 1
  if ($listener) {
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
