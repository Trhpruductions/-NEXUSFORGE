$ErrorActionPreference = "Stop"

Write-Host "[smoke] Build workspace" -ForegroundColor Cyan
npm run build

Write-Host "[smoke] Lint web" -ForegroundColor Cyan
npm run lint -w web

Write-Host "[smoke] Run server tests" -ForegroundColor Cyan
npm run test -w server

function Test-ApiProbe {
  param([Parameter(Mandatory = $true)] [string] $Url)

  try {
    $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 5
    if ($response.StatusCode -ne 200) {
      throw "Expected 200, got $($response.StatusCode) for $Url"
    }
    Write-Host "[smoke] API OK: $Url" -ForegroundColor Green
  } catch {
    throw "API probe failed for $Url. $($_.Exception.Message)"
  }
}

$apiBase = "http://127.0.0.1:4000"
try {
  $health = Invoke-WebRequest -Uri "$apiBase/api/health" -UseBasicParsing -TimeoutSec 3
  if ($health.StatusCode -eq 200) {
    Write-Host "[smoke] Server detected on $apiBase, running API probes" -ForegroundColor Cyan
    Test-ApiProbe -Url "$apiBase/api/health"
    Test-ApiProbe -Url "$apiBase/api/runtime/launch-mode"
  } else {
    Write-Host "[smoke] Server probe skipped (non-200 during detection)." -ForegroundColor Yellow
  }
} catch {
  Write-Host "[smoke] Server not running on $apiBase; API probes skipped." -ForegroundColor Yellow
}

Write-Host "[smoke] Completed successfully." -ForegroundColor Green
