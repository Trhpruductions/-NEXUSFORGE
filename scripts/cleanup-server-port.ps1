$ErrorActionPreference = "SilentlyContinue"

$listeners = Get-NetTCPConnection -LocalPort 4000 -State Listen | Select-Object -ExpandProperty OwningProcess -Unique
$stopped = $false

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
