@echo off
rem Daily Vexora Gaming backup (Windows scheduled task "Vexora Gaming daily backup").
rem Output is appended to D:\NexusForgeDB\backups\backup-task.log.
cd /d "%~dp0.."
if not exist "D:\NexusForgeDB\backups" mkdir "D:\NexusForgeDB\backups"
echo ==== %DATE% %TIME% >> "D:\NexusForgeDB\backups\backup-task.log"
"C:\Program Files\nodejs\node.exe" scripts\vexora-backup.mjs >> "D:\NexusForgeDB\backups\backup-task.log" 2>&1
