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
REM
REM Deliberately NO "pm2 save" here - see the note in
REM D:\dynamite-bot\scripts\autostart.cmd (a save at logon once overwrote
REM dump.pm2 and other bots stopped coming back).

setlocal
cd /d "%~dp0.."

set "PATH=%APPDATA%\npm;C:\Program Files\nodejs;%PATH%"
set "PGBIN=C:\Program Files\PostgreSQL\17\bin"
set "PGDATA=D:\NexusForgeDB\data"
set "LOG=D:\NexusForgeDB\autostart.log"

echo ==== %date% %time% logon start >> "%LOG%"

"%PGBIN%\pg_isready.exe" -h 127.0.0.1 -p 5433 -q
if errorlevel 1 (
  echo starting postgres on 5433 >> "%LOG%"
  REM Output to nul, not %LOG%: postgres inherits the handle and would keep
  REM %LOG% locked, so every later ">> %LOG%" (incl. the pm2 calls) fails.
  "%PGBIN%\pg_ctl.exe" -D "%PGDATA%" -o "-p 5433 -c listen_addresses=localhost" -l "D:\NexusForgeDB\postgres.log" -w -t 60 start >nul 2>&1
  "%PGBIN%\pg_isready.exe" -h 127.0.0.1 -p 5433 -q
  if errorlevel 1 ( echo postgres FAILED to start - see D:\NexusForgeDB\postgres.log >> "%LOG%" ) else ( echo postgres started >> "%LOG%" )
) else (
  echo postgres already up >> "%LOG%"
)

REM Give the pm2 resurrect time to run first.
timeout /t 60 /nobreak >nul 2>&1

for %%A in (nexusforge-backend-workspace nexusforge-web-workspace vexora-gateway vexora-tunnel) do call :ensure %%A
exit /b 0

:ensure
set "STATE="
for /f "delims=" %%S in ('node -e "const l=JSON.parse(require('child_process').execSync('pm2 jlist',{encoding:'utf8'}));const p=l.find(x=>x.name===process.argv[1]);console.log(p?p.pm2_env.status:'missing')" %1 2^>nul') do set "STATE=%%S"
if "%STATE%"=="online" (
  echo %1 online >> "%LOG%"
  goto :eof
)
echo %1 status "%STATE%" - starting >> "%LOG%"
if "%STATE%"=="missing" (
  call pm2 start ecosystem.config.cjs --only %1 --update-env >> "%LOG%" 2>&1
) else (
  call pm2 restart %1 --update-env >> "%LOG%" 2>&1
)
goto :eof
