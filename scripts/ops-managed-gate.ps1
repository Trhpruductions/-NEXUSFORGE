$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

function Invoke-CheckedNpm {
  param(
    [Parameter(Mandatory = $true)][string]$Label,
    [Parameter(Mandatory = $true)][string[]]$Arguments
  )

  Write-Host "[ops-managed-gate] $Label" -ForegroundColor Cyan
  & npm.cmd @Arguments | Out-Host
  $exitCode = $LASTEXITCODE
  if ($exitCode -ne 0) {
    throw "Command failed (exit $exitCode): npm $($Arguments -join ' ')"
  }
}

try {
  Invoke-CheckedNpm -Label "Brand and splash asset verification" -Arguments @("run", "brand:verify")
  Invoke-CheckedNpm -Label "Desktop splash packaging verification" -Arguments @("run", "desktop:splash:verify:packaged")
  Invoke-CheckedNpm -Label "Desktop artifact integrity report" -Arguments @("run", "desktop:artifact:report")
  Invoke-CheckedNpm -Label "Desktop artifact consistency validation" -Arguments @("run", "desktop:artifact:validate")
  Invoke-CheckedNpm -Label "Run watchdog once" -Arguments @("run", "pm2:workspace:watchdog:once")
  Invoke-CheckedNpm -Label "Doctor with watchdog freshness" -Arguments @("run", "pm2:workspace:doctor:watchdog")
  Invoke-CheckedNpm -Label "Watchdog status" -Arguments @("run", "pm2:workspace:watchdog:status")
  Invoke-CheckedNpm -Label "Watchdog history threshold guard" -Arguments @("run", "ops:watchdog:summary:guard")
  Invoke-CheckedNpm -Label "Managed runtime validation" -Arguments @("run", "pm2:workspace:validate:managed")

  Write-Host "[ops-managed-gate] PASS: managed runtime gate is healthy." -ForegroundColor Green
} finally {
  Pop-Location
}
