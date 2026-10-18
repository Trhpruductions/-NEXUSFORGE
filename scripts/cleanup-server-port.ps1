# Stops a stale local DEVELOPMENT API server. Kept for older callers (local-smoke.ps1, ops-validate-strict.ps1,
# the server/ workspace shim); the work is done by cleanup-dev-ports.ps1, which only touches dev ports, never
# a pm2-managed process and never the live ports.
#
# It used to read PORT from apps/server/.env. On the production PC that is the live API port (4001), so
# every run stopped the live API. -EnvFilePath is still accepted but no longer read.
[CmdletBinding()]
param(
  [int[]]$Ports,
  [string]$EnvFilePath = ""
)

$cleanupScript = Join-Path $PSScriptRoot "cleanup-dev-ports.ps1"

if ($Ports -and $Ports.Count -gt 0) {
  & $cleanupScript -Ports $Ports
} else {
  & $cleanupScript -Target api
}

exit $LASTEXITCODE
