$ErrorActionPreference = "SilentlyContinue"

$ports = @(4000, 4001)
$stopped = $false
$listeners = @()
foreach ($port in $ports) {
  $listeners += Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
}
$listeners = $listeners | Select-Object -Unique

foreach ($pidNumber in $listeners) {
  if (-not $pidNumber) {
    continue
  }

  try {
    Stop-Process -Id $pidNumber -Force -ErrorAction Stop
    Write-Output "Stopped PID $pidNumber on port 4000"
    $stopped = $true
  } catch {
    Write-Output "Failed to stop PID $pidNumber on port 4000"
  }
}

if (-not $stopped) {
  Write-Output "No listener found on port 4000"
}
