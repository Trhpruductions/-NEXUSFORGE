<#
.SYNOPSIS
  Moves the live Nexus Forge database (PostgreSQL 17, D:\NexusForgeDB\data, port 5433) under its own Windows
  service, so it starts at boot, restarts if it crashes, and no longer depends on a console window that can be
  closed or interrupted (that is what stopped it on 18 Oct 2026 at 10:24).

.DESCRIPTION
  Run in an ELEVATED PowerShell (Run as administrator):
    powershell -ExecutionPolicy Bypass -File scripts\ops\register-db-service.ps1            # dry run: shows the plan
    powershell -ExecutionPolicy Bypass -File scripts\ops\register-db-service.ps1 -OwnerApproved

  What it does with -OwnerApproved (the database is down for roughly 10-30 seconds in step 3-4):
    1. Checks: elevated, pg_ctl present, the data folder is the one serving port 5433, no service of that name.
    2. Registers service "nexusforge-db" (NT AUTHORITY\NetworkService, start type automatic, logging to
       D:\NexusForgeDB\data\log) and sets it to restart itself 5/10/30 s after a crash.
    3. Lets the signed-in user start and stop it (so the watchdog, which runs as that user, can start it).
    4. Stops the current console-started database (fast shutdown) and starts the service.
    5. Waits until it accepts connections; if it doesn't within 60 s it removes the service and starts the
       database the old way again, so the site is never left without a database.
  It does not change the data, the port, the password, pg_hba.conf or any other service. It never runs pm2.

  Undo later (elevated): sc.exe stop nexusforge-db ; sc.exe delete nexusforge-db ; then start the database the
  old way: "C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" -D D:\NexusForgeDB\data -o "-p 5433 -c listen_addresses=localhost" -l D:\NexusForgeDB\postgres.log start
#>
param(
  [switch]$OwnerApproved,
  [string]$ServiceName = "nexusforge-db",
  [string]$PgBin = "C:\Program Files\PostgreSQL\17\bin",
  [string]$DataDir = "D:\NexusForgeDB\data",
  [int]$Port = 5433
)

$ErrorActionPreference = "Stop"
$dryRun = -not $OwnerApproved
$pgCtl = Join-Path $PgBin "pg_ctl.exe"
$pgIsReady = Join-Path $PgBin "pg_isready.exe"
$oldLog = "D:\NexusForgeDB\postgres.log"
$options = "-p $Port -c listen_addresses=localhost -c logging_collector=on -c log_directory=log"

function Step($text) { Write-Host "`n== $text" -ForegroundColor Cyan }
function Ready { & $pgIsReady -h 127.0.0.1 -p $Port -q; return $LASTEXITCODE -eq 0 }
function StartOldWay {
  Write-Host "Starting the database the old way (pg_ctl, as before)..."
  Start-Process -FilePath $pgCtl -ArgumentList @("-D", "`"$DataDir`"", "-o", "`"-p $Port -c listen_addresses=localhost`"", "-l", "`"$oldLog`"", "-w", "-t", "60", "start") -WindowStyle Hidden -Wait
}

Step "1. Checks"
$elevated = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
Write-Host "Elevated (Run as administrator): $elevated"
if (-not (Test-Path $pgCtl)) { throw "pg_ctl not found at $pgCtl" }
if (-not (Test-Path (Join-Path $DataDir "PG_VERSION"))) { throw "$DataDir is not a Postgres data folder" }
$pidFile = Join-Path $DataDir "postmaster.pid"
if (Test-Path $pidFile) {
  $pidLines = Get-Content $pidFile
  if ($pidLines[3].Trim() -ne "$Port") { throw "The server in $DataDir is on port $($pidLines[3]), not $Port; stopping." }
  Write-Host "Database in $DataDir is running (pid $($pidLines[0].Trim())) on port $Port."
} else {
  Write-Host "Database in $DataDir is not running right now."
}
if (Get-Service $ServiceName -ErrorAction SilentlyContinue) { throw "A service named $ServiceName already exists. Nothing to do (or remove it first)." }
$user = [Security.Principal.WindowsIdentity]::GetCurrent()
Write-Host "The signed-in user ($($user.Name)) will be allowed to start and stop the service."
Write-Host "Service options: $options"

if ($dryRun) {
  Write-Host "`nDRY RUN: nothing was changed. Run again with -OwnerApproved in an elevated PowerShell to do it." -ForegroundColor Yellow
  exit 0
}
if (-not $elevated) { throw "Run this in an elevated PowerShell (Run as administrator)." }

Step "2. Register the service"
& $pgCtl register -N $ServiceName -D $DataDir -o $options -S auto -U "NT AUTHORITY\NetworkService" -w
if ($LASTEXITCODE -ne 0) { throw "pg_ctl register failed ($LASTEXITCODE). Nothing else was changed." }
& sc.exe description $ServiceName "Nexus Forge Gaming live database (PostgreSQL 17, port $Port, D:\NexusForgeDB\data)" | Out-Null
& sc.exe failure $ServiceName reset= 86400 actions= restart/5000/restart/10000/restart/30000 | Out-Null

Step "3. Let the signed-in user start and stop it (for the watchdog)"
# Default service permissions plus start/stop/query (RP WP LC LO CR) for this user's SID only.
$sid = $user.User.Value
$sddl = (& sc.exe sdshow $ServiceName | Where-Object { $_ -match "^D:" } | Select-Object -First 1).Trim()
$ace = "(A;;RPWPLCLOCRRC;;;$sid)"
if ($sddl -and -not $sddl.Contains($sid)) {
  $newSddl = $sddl -replace "^D:", "D:$ace"
  & sc.exe sdset $ServiceName $newSddl | Out-Null
  if ($LASTEXITCODE -ne 0) { Write-Warning "Could not add start/stop rights for $($user.Name); the watchdog will fall back to pg_ctl." }
}

Step "4. Hand over: stop the console-started database, start the service"
if (Ready) {
  & $pgCtl stop -D $DataDir -m fast -w -t 60
  if ($LASTEXITCODE -ne 0) { Write-Warning "pg_ctl stop reported $LASTEXITCODE" }
}
Start-Service $ServiceName

Step "5. Wait for it to accept connections"
$ok = $false
for ($i = 0; $i -lt 30; $i++) { if (Ready) { $ok = $true; break }; Start-Sleep -Seconds 2 }
if ($ok) {
  Write-Host "Database is up as service $ServiceName (start type automatic, restarts after a crash)." -ForegroundColor Green
  Write-Host "Logs: $DataDir\log"
  exit 0
}

Write-Warning "The service did not come up within 60 s. Rolling back."
& sc.exe stop $ServiceName | Out-Null
Start-Sleep -Seconds 3
& sc.exe delete $ServiceName | Out-Null
if (-not (Ready)) { StartOldWay }
if (Ready) { Write-Host "Rolled back: the database runs the old way again; the service was removed." -ForegroundColor Yellow } else { Write-Error "The database is NOT running. Start it: `"$pgCtl`" -D $DataDir -o `"-p $Port -c listen_addresses=localhost`" -l $oldLog start" }
exit 1
