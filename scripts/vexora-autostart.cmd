@echo off
REM Brings Vexora Gaming up after a reboot. Run at logon by
REM Startup\VexoraGamingAutostart.vbs (no visible window).
REM
REM 1. Starts the app's own Postgres (D:\NexusForgeDB, port 5433). It is not a
REM    Windows service, so nothing else starts it. Done first and without a
REM    delay, so it is up before C:\Bots\_pm2-resurrect-at-logon.cmd (15s)
REM    brings the API back.
REM 2. The pm2 resurrect restores nexusforge-backend-workspace and
REM    nexusforge-web-workspace from dump.pm2. If the API burned through its
REM    restarts before the DB was ready, or the resurrect failed, start or
REM    restart them here.
REM 3. vexora-gateway (local port 3400) and vexora-tunnel (Cloudflare tunnel for
REM    https://nfgcord.com) are NOT in dump.pm2, so without this step the public
REM    site stays down after a reboot. They are defined in ecosystem.config.cjs
REM    and started here when missing.
REM 4. dump.pm2 holds the API's settings from before graceful shutdown existed (it is never saved, see below).
REM    If the resurrected API lacks shutdown_with_message, restart it once from ecosystem.config.cjs so pm2
REM    picks up the settings there (a restart by name does not re-read the file).
REM
REM Deliberately NO "pm2 save" here - see the note in
REM D:\dynamite-bot\scripts\autostart.cmd (a save at logon once overwrote
REM dump.pm2 and other bots stopped coming back).

setlocal
cd /d "%~dp0.."

REM pm2 lives in the user's npm folder. At logon %APPDATA% is not always set in this script's environment,
REM so the profile path comes first; without it "pm2" is not found and the public site stays down.
set "PATH=%USERPROFILE%\AppData\Roaming\npm;%APPDATA%\npm;C:\Program Files\nodejs;%PATH%"
set "PGBIN=C:\Program Files\PostgreSQL\17\bin"
set "PGDATA=D:\NexusForgeDB\data"
set "LOG=D:\NexusForgeDB\autostart.log"

echo ==== %date% %time% logon start >> "%LOG%"

REM Once the database runs as the Windows service "nexusforge-db" (scripts\ops\register-db-service.ps1), Windows
REM starts it at boot; only make sure it is running, and never start a second copy with pg_ctl.
sc.exe query nexusforge-db >nul 2>&1
if not errorlevel 1 (
  sc.exe query nexusforge-db | find "RUNNING" >nul
  if errorlevel 1 (
    echo starting service nexusforge-db >> "%LOG%"
    sc.exe start nexusforge-db >> "%LOG%" 2>&1
  ) else (
    echo service nexusforge-db running >> "%LOG%"
  )
  goto :after_postgres
)

"%PGBIN%\pg_isready.exe" -h 127.0.0.1 -p 5433 -q
if errorlevel 1 (
  echo starting postgres on 5433 >> "%LOG%"
  REM Output to nul, not %LOG%: postgres inherits the handle and would keep
  REM %LOG% locked, so every later ">> %LOG%" (incl. the pm2 calls) fails.
  REM Wait up to 5 minutes: after the PC was switched off without a clean shutdown, crash recovery took 2 min 22 s
  REM (19 Oct 2026), and a 60-second wait logged "FAILED" while the database was still coming up.
  "%PGBIN%\pg_ctl.exe" -D "%PGDATA%" -o "-p 5433 -c listen_addresses=localhost" -l "D:\NexusForgeDB\postgres.log" -w -t 300 start >nul 2>&1
  "%PGBIN%\pg_isready.exe" -h 127.0.0.1 -p 5433 -q
  if errorlevel 1 ( echo postgres not ready after 5 minutes - see D:\NexusForgeDB\postgres.log >> "%LOG%" ) else ( echo postgres started >> "%LOG%" )
) else (
  echo postgres already up >> "%LOG%"
)

:after_postgres
REM Give the pm2 resurrect time to run first.
timeout /t 60 /nobreak >nul 2>&1

for %%A in (nexusforge-backend-workspace nexusforge-web-workspace vexora-gateway vexora-tunnel vexora-watchdog) do call :ensure %%A
exit /b 0

:ensure
set "STATE="
REM Tries pm2 jlist up to 6 times, 15 s apart: right after a reboot pm2 can be slow, and on 19 Oct 2026 one failed read
REM left every app alone (and the API without its graceful-shutdown settings).
for /f "delims=" %%S in ('node scripts\ops\pm2-app-state.mjs %1 6 15 2^>nul') do set "STATE=%%S"
if "%STATE%"=="online" (
  echo %1 online >> "%LOG%"
  goto :eof
)
if "%STATE%"=="" set "STATE=unreadable"
if "%STATE%"=="unreadable" (
  REM pm2 jlist could not be read: do nothing rather than restart apps that may be running fine.
  echo %1 status unknown - pm2 not readable after 6 tries, left alone >> "%LOG%"
  goto :eof
)
echo %1 status "%STATE%" - starting from ecosystem.config.cjs >> "%LOG%"
if "%STATE%"=="missing" (
  call pm2 start ecosystem.config.cjs --only %1 --update-env >> "%LOG%" 2>&1
) else (
  call pm2 restart ecosystem.config.cjs --only %1 --update-env >> "%LOG%" 2>&1
)
goto :eof
