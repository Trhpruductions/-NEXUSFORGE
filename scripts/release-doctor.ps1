param(
  [string] $ReportPath = "./apps/desktop/.network-smoke/release-doctor-latest.json",
  [switch] $ArchiveReport
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

function Invoke-DoctorCheck {
  param(
    [Parameter(Mandatory = $true)] [string] $Name,
    [Parameter(Mandatory = $true)] [string] $Command
  )

  Write-Host ("[release-doctor] Running {0}: {1}" -f $Name, $Command) -ForegroundColor Cyan
  $startedAt = Get-Date
  $previousErrorAction = $ErrorActionPreference
  $script:ErrorActionPreference = "Continue"
  $output = @()

  try {
    $output = @( & cmd.exe /d /s /c $Command 2>&1 )
    if ($output.Count -gt 0) {
      $output | Out-Host
    }
  } finally {
    $script:ErrorActionPreference = $previousErrorAction
  }

  $finishedAt = Get-Date
  $durationMs = [int][Math]::Round(($finishedAt - $startedAt).TotalMilliseconds)
  $exitCode = if ($LASTEXITCODE -is [int]) { $LASTEXITCODE } else { 0 }
  $passed = ($exitCode -eq 0)

  if ($passed) {
    Write-Host ("[release-doctor] PASS {0} ({1} ms)" -f $Name, $durationMs) -ForegroundColor Green
  } else {
    Write-Host ("[release-doctor] FAIL {0} (exit {1}, {2} ms)" -f $Name, $exitCode, $durationMs) -ForegroundColor Red
  }

  return [PSCustomObject]@{
    name = $Name
    command = $Command
    startedAt = $startedAt.ToString("o")
    finishedAt = $finishedAt.ToString("o")
    durationMs = $durationMs
    exitCode = $exitCode
    passed = $passed
  }
}

try {
  $checks = @(
    [PSCustomObject]@{ name = "powershell-parser"; command = "npm run scripts:validate:powershell" },
    [PSCustomObject]@{ name = "desktop-network-strict"; command = "npm run desktop:network:validate:ci:strict" },
    [PSCustomObject]@{ name = "ops-validate-strict"; command = "npm run ops:validate:strict" },
    [PSCustomObject]@{ name = "candidate-quick"; command = "npm run ops:validate:candidate:quick" }
  )

  $runStartedAt = Get-Date
  $results = New-Object System.Collections.Generic.List[object]
  foreach ($check in $checks) {
    $result = Invoke-DoctorCheck -Name $check.name -Command $check.command
    $results.Add($result) | Out-Null
    if (-not $result.passed) {
      break
    }
  }

  $runFinishedAt = Get-Date
  $failedChecks = @($results | Where-Object { -not $_.passed })
  $passed = ($failedChecks.Count -eq 0 -and $results.Count -eq $checks.Count)

  $reportDirectory = Split-Path -Parent $ReportPath
  if ($reportDirectory) {
    New-Item -ItemType Directory -Path $reportDirectory -Force | Out-Null
  }

  $report = [PSCustomObject]@{
    generatedAt = (Get-Date).ToString("o")
    repoRoot = $repoRoot.Path
    passed = $passed
    startedAt = $runStartedAt.ToString("o")
    finishedAt = $runFinishedAt.ToString("o")
    durationMs = [int][Math]::Round(($runFinishedAt - $runStartedAt).TotalMilliseconds)
    totalChecks = $checks.Count
    executedChecks = $results.Count
    failedChecks = $failedChecks.Count
    checks = $results.ToArray()
  }

  $report | ConvertTo-Json -Depth 8 | Set-Content -Path $ReportPath -Encoding UTF8
  Write-Host ("[release-doctor] Report saved: {0}" -f $ReportPath) -ForegroundColor Green

  if ($ArchiveReport) {
    $archiveDir = "./apps/desktop/.network-smoke/history"
    New-Item -ItemType Directory -Path $archiveDir -Force | Out-Null
    $archiveName = "release-doctor-{0}.json" -f (Get-Date -Format "yyyyMMdd-HHmmss")
    $archivePath = Join-Path $archiveDir $archiveName
    $report | ConvertTo-Json -Depth 8 | Set-Content -Path $archivePath -Encoding UTF8
    Write-Host ("[release-doctor] Archived report: {0}" -f $archivePath) -ForegroundColor Green
  }

  if (-not $passed) {
    $failedNames = ($failedChecks | ForEach-Object { $_.name }) -join ", "
    throw ("Release doctor failed check(s): {0}" -f $failedNames)
  }

  Write-Host "[release-doctor] PASS: all checks completed successfully." -ForegroundColor Green
}
finally {
  Pop-Location
}
