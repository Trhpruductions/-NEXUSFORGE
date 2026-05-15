param(
  [string] $ScriptsPath = "./scripts",
  [string] $Pattern = "*.ps1"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

try {
  if (-not (Test-Path -Path $ScriptsPath)) {
    throw ("Scripts path not found: {0}" -f $ScriptsPath)
  }

  $files = @(Get-ChildItem -Path $ScriptsPath -File -Filter $Pattern | Sort-Object FullName)
  if ($files.Count -eq 0) {
    throw ("No PowerShell files matched '{0}' under '{1}'." -f $Pattern, $ScriptsPath)
  }

  $allErrors = New-Object System.Collections.Generic.List[object]

  foreach ($file in $files) {
    $tokens = $null
    $errors = $null
    [void][System.Management.Automation.Language.Parser]::ParseFile($file.FullName, [ref]$tokens, [ref]$errors)

    if ($errors -and $errors.Count -gt 0) {
      foreach ($parseError in $errors) {
        $allErrors.Add([PSCustomObject]@{
          file = $file.FullName
          message = $parseError.Message
          line = $parseError.Extent.StartLineNumber
          column = $parseError.Extent.StartColumnNumber
        }) | Out-Null
      }
    }
  }

  if ($allErrors.Count -gt 0) {
    Write-Host "[ps-validate] Parse errors detected:" -ForegroundColor Red
    foreach ($parseError in $allErrors) {
      Write-Host (" - {0}:{1}:{2} {3}" -f $parseError.file, $parseError.line, $parseError.column, $parseError.message) -ForegroundColor Red
    }

    throw ("PowerShell validation failed with {0} parse error(s)." -f $allErrors.Count)
  }

  Write-Host ("[ps-validate] Parsed {0} script(s) successfully." -f $files.Count) -ForegroundColor Green
}
finally {
  Pop-Location
}
