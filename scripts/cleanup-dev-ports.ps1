$ErrorActionPreference = "SilentlyContinue"

$ports = @(3000, 3001, 4000)
$stopped = @()

foreach ($port in $ports) {
  $listeners = Get-NetTCPConnection -LocalPort $port -State Listen | Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($pidNumber in $listeners) {
    if ($pidNumber -and -not $stopped.Contains($pidNumber)) {
      try {
        Stop-Process -Id $pidNumber -Force -ErrorAction Stop
        $stopped += $pidNumber
        Write-Output "Stopped PID $pidNumber on port $port"
      } catch {
        Write-Output "Failed to stop PID $pidNumber on port $port"
      }
    }
  }
}

if ($stopped.Count -eq 0) {
  Write-Output "No listeners found on dev ports"
} else {
  Write-Output "Dev port cleanup complete"
}
