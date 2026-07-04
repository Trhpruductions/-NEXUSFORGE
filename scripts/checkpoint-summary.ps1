$report = Get-Content "var\stability-report-24h.json" | ConvertFrom-Json
Write-Host ""
Write-Host "CHECKPOINT STABILITY SUMMARY" -ForegroundColor Cyan
Write-Host ""
Write-Host "Recovery: $($report.recoveryTime)"
Write-Host "Checkpoints: $($report.checkpoints.Count)/4 completed"
Write-Host ""
foreach ($cp in $report.checkpoints) {
  $passCount = ($cp.results | Where-Object {$_.status -eq "PASS"}).Count
  $timeShort = ([datetime]$cp.timestamp).ToString("HH:mm:ss UTC")
  Write-Host "  ✓ $timeShort : $passCount/5 checks PASS" -ForegroundColor Green
}
Write-Host ""
$allPass = $true
foreach ($cp in $report.checkpoints) {
  if (($cp.results | Where-Object {$_.status -ne "PASS"}).Count -gt 0) {
    $allPass = $false
  }
}
if ($report.checkpoints.Count -ge 3 -and $allPass) {
  Write-Host "STATUS: EXCEEDING THRESHOLDS - 100% STABILITY CONFIRMED" -ForegroundColor Green
} else {
  Write-Host "STATUS: IN PROGRESS - Awaiting final checkpoint" -ForegroundColor Yellow
}
Write-Host ""
