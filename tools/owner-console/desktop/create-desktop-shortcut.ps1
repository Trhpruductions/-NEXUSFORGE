# Creates a desktop shortcut for the Nexus Forge Owner Console desktop app on this PC.
# It points at the Electron binary already in the repo and at this folder, so nothing is installed.
$ErrorActionPreference = 'Stop'

$appDir = $PSScriptRoot
$repoRoot = Resolve-Path (Join-Path $appDir '..\..\..')
$electron = Join-Path $repoRoot 'node_modules\electron\dist\electron.exe'
$icon = Join-Path $repoRoot 'apps\desktop\assets\app-icon.ico'

if (-not (Test-Path $electron)) { throw "Electron was not found at $electron. Run npm install at the repo root first." }
if (-not (Test-Path $icon)) { throw "App icon was not found at $icon." }

$desktop = [Environment]::GetFolderPath('Desktop')
$lnkPath = Join-Path $desktop 'Owner Console.lnk'

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($lnkPath)
$shortcut.TargetPath = $electron
$shortcut.Arguments = '"' + $appDir + '"'
$shortcut.WorkingDirectory = $appDir
$shortcut.IconLocation = $icon + ',0'
$shortcut.Description = 'Nexus Forge owner console, this PC only'
$shortcut.Save()

Write-Output "Created $lnkPath"
