Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Split-Path -Parent $PSScriptRoot
Set-Location $repoRoot

$summaryPath = Join-Path $repoRoot "BETA_LINKS.txt"

function Stop-ProcessSafe {
  param(
    [Parameter(Mandatory = $true)] [int] $ProcessId,
    [Parameter(Mandatory = $true)] [string] $Name
  )

  $proc = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if (-not $proc) {
    Write-Host "[beta] $Name PID $ProcessId is already stopped."
    return
  }

  try {
    Stop-Process -Id $ProcessId -Force
    Write-Host "[beta] Stopped $Name (PID $ProcessId)."
  } catch {
    Write-Warning "[beta] Failed to stop $Name (PID $ProcessId): $($_.Exception.Message)"
  }
}

$targets = @{}

if (Test-Path $summaryPath) {
  $content = Get-Content $summaryPath -Raw
  foreach ($name in @("api", "apiTunnel", "web", "webTunnel")) {
    if ($content -match "(?m)^$name=(\d+)$") {
      $targets[$name] = [int]$Matches[1]
    }
  }
}

if ($targets.Count -eq 0) {
  Write-Host "[beta] No process IDs found in BETA_LINKS.txt. Attempting fallback port cleanup for 3100 and 4000."
} else {
  Write-Host "[beta] Stopping beta processes from BETA_LINKS.txt..."
  foreach ($name in @("webTunnel", "apiTunnel", "web", "api")) {
    if ($targets.ContainsKey($name)) {
      Stop-ProcessSafe -ProcessId $targets[$name] -Name $name
    }
  }
}

# Fallback cleanup for known beta ports.
foreach ($port in @(3100, 4000)) {
  $listeners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique

  foreach ($owningPid in ($listeners | Where-Object { $_ -gt 0 })) {
    $proc = Get-Process -Id $owningPid -ErrorAction SilentlyContinue
    if (-not $proc) {
      continue
    }

    if ($proc.ProcessName -in @("node", "cloudflared")) {
      try {
        Stop-Process -Id $owningPid -Force
        Write-Host "[beta] Stopped fallback process $($proc.ProcessName) on port $port (PID $owningPid)."
      } catch {
        Write-Warning "[beta] Failed fallback stop for PID $owningPid on port ${port}: $($_.Exception.Message)"
      }
    }
  }
}

Write-Host "[beta] Beta stop sequence complete."
