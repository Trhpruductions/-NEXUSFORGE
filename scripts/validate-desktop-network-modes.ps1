param(
  [ValidateSet("local", "hosted", "all")]
  [string] $Mode = "all",
  [int] $TimeoutSeconds = 45,
  [string] $ReportPath = "",
  [switch] $AllowFallback
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
$desktopRoot = Join-Path $repoRoot "apps\desktop"
$runToken = "{0}-{1}" -f $PID, (Get-Date -Format "yyyyMMdd-HHmmss")
$reportRoot = Join-Path $desktopRoot ".network-smoke"
$resolvedReportPath = if ([string]::IsNullOrWhiteSpace($ReportPath)) {
  Join-Path $reportRoot ("report-{0}.json" -f $runToken)
} else {
  $ReportPath
}
$results = New-Object System.Collections.Generic.List[object]
$validationFailures = New-Object System.Collections.Generic.List[string]

function Stop-ProcessTree {
  param([Parameter(Mandatory = $true)] [int] $ProcessId)

  try {
    $taskKillOutput = & taskkill.exe /pid $ProcessId /t /f 2>&1
    if ($LASTEXITCODE -ne 0 -and ($taskKillOutput -join "`n") -notmatch "not found|There is no running instance") {
      Write-Warning ("Unable to terminate process tree for PID {0}: {1}" -f $ProcessId, ($taskKillOutput -join " "))
    }
  } catch {
    Write-Warning ("Unable to terminate process tree for PID {0}: {1}" -f $ProcessId, $_.Exception.Message)
  }
}

function Wait-ForFile {
  param(
    [Parameter(Mandatory = $true)] [string] $Path,
    [Parameter(Mandatory = $true)] [datetime] $Deadline
  )

  while ((Get-Date) -lt $Deadline) {
    if (Test-Path $Path) {
      return $true
    }
    [System.Threading.Thread]::Sleep(400)
  }

  return $false
}

function Test-PortOpen {
  param(
    [Parameter(Mandatory = $true)] [int] $Port,
    [string] $TargetHost = "127.0.0.1"
  )

  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $async = $client.BeginConnect($TargetHost, $Port, $null, $null)
    if (-not $async.AsyncWaitHandle.WaitOne(750)) {
      return $false
    }

    $client.EndConnect($async) | Out-Null
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Wait-ForPorts {
  param(
    [Parameter(Mandatory = $true)] [int[]] $Ports,
    [Parameter(Mandatory = $true)] [datetime] $Deadline
  )

  while ((Get-Date) -lt $Deadline) {
    $allReady = $true
    foreach ($port in $Ports) {
      if (-not (Test-PortOpen -Port $port)) {
        $allReady = $false
        break
      }
    }

    if ($allReady) {
      return $true
    }

    [System.Threading.Thread]::Sleep(750)
  }

  return $false
}

function Start-BackgroundProcess {
  param(
    [Parameter(Mandatory = $true)] [string] $WorkingDirectory,
    [Parameter(Mandatory = $true)] [string] $CommandLine,
    [Parameter(Mandatory = $true)] [string] $StdOutPath,
    [Parameter(Mandatory = $true)] [string] $StdErrPath
  )

  return Start-Process -FilePath "cmd.exe" `
    -ArgumentList @("/d", "/s", "/c", $CommandLine) `
    -WorkingDirectory $WorkingDirectory `
    -RedirectStandardOutput $StdOutPath `
    -RedirectStandardError $StdErrPath `
    -PassThru
}

function Read-TextFile {
  param([Parameter(Mandatory = $true)] [string] $Path)

  if (-not (Test-Path $Path)) {
    return ""
  }

  try {
    return [System.IO.File]::ReadAllText($Path)
  } catch {
    return ""
  }
}

function Wait-ForStartupMarker {
  param(
    [Parameter(Mandatory = $true)] [string] $Path,
    [Parameter(Mandatory = $true)] [datetime] $Deadline,
    [Parameter(Mandatory = $true)] [string[]] $Markers
  )

  while ((Get-Date) -lt $Deadline) {
    $content = Read-TextFile -Path $Path
    foreach ($marker in $Markers) {
      if ($content.Contains($marker)) {
        return $marker
      }
    }

    [System.Threading.Thread]::Sleep(750)
  }

  return $null
}

function Invoke-DesktopModeValidation {
  param(
    [Parameter(Mandatory = $true)] [string] $RequestedMode,
    [Parameter(Mandatory = $true)] [int] $TimeoutSeconds
  )

  # Hosted startup can take longer due TLS handshake, DNS, and remote retries.
  $effectiveTimeoutSeconds = if ($RequestedMode -eq "hosted") {
    [Math]::Max($TimeoutSeconds, 90)
  } else {
    $TimeoutSeconds
  }

  $profileRoot = Join-Path $desktopRoot (".network-smoke\{0}-{1}" -f $RequestedMode, $runToken)
  $stdoutLog = Join-Path $profileRoot "stdout.log"
  $stderrLog = Join-Path $profileRoot "stderr.log"
  $startupLog = Join-Path $profileRoot "startup.log"
  $supportLogRoot = Join-Path $profileRoot "support"
  $serviceDeadline = (Get-Date).AddSeconds($effectiveTimeoutSeconds)
  $supportProcesses = New-Object System.Collections.Generic.List[System.Diagnostics.Process]

  New-Item -ItemType Directory -Path $profileRoot -Force | Out-Null
  New-Item -ItemType Directory -Path $supportLogRoot -Force | Out-Null

  if ($RequestedMode -eq "local") {
    $serverRoot = Join-Path $repoRoot "apps\server"
    $apiEntry = Join-Path $serverRoot "dist\index.js"
    $webRoot = Join-Path $repoRoot "apps\web"

    if (-not (Test-Path -Path $apiEntry)) {
      throw ("API entrypoint not found for local-mode validation: {0}" -f $apiEntry)
    }

    if (-not (Test-PortOpen -Port 4000)) {
      Write-Host "[desktop-network] Local API is down; starting temporary API service." -ForegroundColor Yellow
      $apiStdOut = Join-Path $supportLogRoot "api-stdout.log"
      $apiStdErr = Join-Path $supportLogRoot "api-stderr.log"
      $apiProcess = Start-BackgroundProcess -WorkingDirectory $serverRoot -CommandLine "node dist/index.js" -StdOutPath $apiStdOut -StdErrPath $apiStdErr
      $supportProcesses.Add($apiProcess) | Out-Null
    }

    if (-not (Test-PortOpen -Port 3000)) {
      Write-Host "[desktop-network] Local web is down; starting temporary web service." -ForegroundColor Yellow
      $webStdOut = Join-Path $supportLogRoot "web-stdout.log"
      $webStdErr = Join-Path $supportLogRoot "web-stderr.log"
      $webProcess = Start-BackgroundProcess -WorkingDirectory $webRoot -CommandLine "npx next start -p 3000 -H 127.0.0.1" -StdOutPath $webStdOut -StdErrPath $webStdErr
      $supportProcesses.Add($webProcess) | Out-Null
    }

    if (-not (Wait-ForPorts -Ports @(3000, 4000) -Deadline $serviceDeadline)) {
      throw "Timed out waiting for local services on ports 3000 and 4000."
    }
  }

  $baseCommand = @(
    'set "NEXUSFORGE_ALLOW_HOSTED_CERT_BYPASS=true"',
    'set "NEXUSFORGE_DESKTOP_URL=http://localhost:3000/app"'
  )

  if ($RequestedMode -eq "hosted") {
    $baseCommand = @(
      'set "NEXUSFORGE_ALLOW_HOSTED_DEV=true"',
      'set "NEXUSFORGE_ALLOW_HOSTED_CERT_BYPASS=true"',
      'set "NEXUSFORGE_DESKTOP_URL=https://www.nexusforge.app/app"'
    )
  }

  $cacheRoot = Join-Path $profileRoot "cache"
  $electronCommand = 'npx electron --user-data-dir="{0}" --disk-cache-dir="{1}" --disable-gpu-shader-disk-cache .' -f $profileRoot, $cacheRoot
  $commandLine = ($baseCommand + $electronCommand) -join " && "

  $matchedMarker = $null
  $maxAttempts = if ($RequestedMode -eq "hosted") { 2 } else { 1 }
  $process = $null
  try {
    for ($attempt = 1; $attempt -le $maxAttempts -and -not $matchedMarker; $attempt++) {
      if ($attempt -gt 1) {
        Write-Warning ("[desktop-network] Retry {0}/{1} for {2} mode due to missing startup marker on previous attempt." -f $attempt, $maxAttempts, $RequestedMode)
        [System.Threading.Thread]::Sleep(1200)
      }

      Set-Content -Path $startupLog -Value "" -Encoding UTF8
      Set-Content -Path $stdoutLog -Value "" -Encoding UTF8
      Set-Content -Path $stderrLog -Value "" -Encoding UTF8

      $deadline = (Get-Date).AddSeconds($effectiveTimeoutSeconds)
      Write-Host (("[desktop-network] Launching {0} mode validation (attempt {1}/{2})..." -f $RequestedMode, $attempt, $maxAttempts)) -ForegroundColor Cyan

      $process = Start-Process -FilePath "cmd.exe" `
        -ArgumentList @("/d", "/s", "/c", $commandLine) `
        -WorkingDirectory $desktopRoot `
        -RedirectStandardOutput $stdoutLog `
        -RedirectStandardError $stderrLog `
        -PassThru

      try {
        if (-not (Wait-ForFile -Path $startupLog -Deadline $deadline)) {
          if ($attempt -eq $maxAttempts) {
            throw "Timed out waiting for startup log creation."
          }
          continue
        }

        $matchedMarker = Wait-ForStartupMarker -Path $startupLog -Deadline $deadline -Markers @(
          "local-target-connected",
          "hosted-target-connected",
          "hosted-fallback-local-connected",
          "local-fallback-hosted-connected"
        )

        if (-not $matchedMarker) {
          $startupContent = Read-TextFile -Path $startupLog
          $observedLocalReady = $startupContent.Contains('stage="Local services ready"')
          $observedHostedSwitch = $startupContent.Contains('stage="Switching to hosted fallback"')

          if ($RequestedMode -eq "local" -and $observedLocalReady -and -not $observedHostedSwitch) {
            $matchedMarker = "local-target-inferred-ready"
          } elseif ($attempt -eq $maxAttempts) {
            $startupTail = if (Test-Path $startupLog) { (Get-Content $startupLog -Tail 30) -join "`n" } else { "(no startup log)" }
            $stdoutTail = if (Test-Path $stdoutLog) { (Get-Content $stdoutLog -Tail 20) -join "`n" } else { "(no stdout log)" }
            $stderrTail = if (Test-Path $stderrLog) { (Get-Content $stderrLog -Tail 20) -join "`n" } else { "(no stderr log)" }
            throw "No successful startup marker was observed.`n--- startup ---`n$startupTail`n--- stdout ---`n$stdoutTail`n--- stderr ---`n$stderrTail"
          }
        }
      } finally {
        if ($process -and -not $process.HasExited) {
          Stop-ProcessTree -ProcessId $process.Id
        }

        $process = $null
      }
    }

    if (-not $matchedMarker) {
      throw "No successful startup marker was observed."
    }

    $effectiveMode = switch -Regex ($matchedMarker) {
      "local-target-connected|hosted-fallback-local-connected|local-target-inferred-ready" { "local"; break }
      "hosted-target-connected|local-fallback-hosted-connected" { "hosted"; break }
      default { "unknown" }
    }

    $result = [PSCustomObject]@{
      RequestedMode = $RequestedMode
      Marker = $matchedMarker
      EffectiveMode = $effectiveMode
      ModeMatched = ($effectiveMode -eq $RequestedMode)
      StartupLog = $startupLog
      ProfileRoot = $profileRoot
    }
    $results.Add($result) | Out-Null

    if (-not $AllowFallback -and $effectiveMode -ne $RequestedMode) {
      $validationFailures.Add(("Requested mode '{0}' resolved to '{1}' via marker '{2}'." -f $RequestedMode, $effectiveMode, $matchedMarker)) | Out-Null
    }

    Write-Host (("[desktop-network] {0} mode connected via {1} ({2})." -f $RequestedMode, $matchedMarker, $effectiveMode)) -ForegroundColor Green
  } finally {
    foreach ($supportProcess in $supportProcesses) {
      if ($supportProcess -and -not $supportProcess.HasExited) {
        Stop-ProcessTree -ProcessId $supportProcess.Id
      }
    }
  }
}

Push-Location $repoRoot
try {
  New-Item -ItemType Directory -Path $reportRoot -Force | Out-Null

  $modes = if ($Mode -eq "all") { @("local", "hosted") } else { @($Mode) }
  foreach ($currentMode in $modes) {
    Invoke-DesktopModeValidation -RequestedMode $currentMode -TimeoutSeconds $TimeoutSeconds
  }

  Write-Host ""
  Write-Host "[desktop-network] Validation summary" -ForegroundColor Cyan
  $results | Format-Table RequestedMode, EffectiveMode, ModeMatched, Marker -AutoSize | Out-String | Write-Host

  $reportDirectory = Split-Path -Parent $resolvedReportPath
  if ($reportDirectory) {
    New-Item -ItemType Directory -Path $reportDirectory -Force | Out-Null
  }

  $reportPayload = @{
    generatedAt = (Get-Date).ToString("o")
    mode = $Mode
    timeoutSeconds = $TimeoutSeconds
    allowFallback = [bool]$AllowFallback
    passed = ($validationFailures.Count -eq 0)
    failures = $validationFailures.ToArray()
    results = $results.ToArray()
  }

  $reportPayload | ConvertTo-Json -Depth 6 | Set-Content -Path $resolvedReportPath -Encoding UTF8
  Write-Host ("[desktop-network] Report saved: {0}" -f $resolvedReportPath) -ForegroundColor Green

  if ($validationFailures.Count -gt 0) {
    Write-Host "[desktop-network] Validation failures detected:" -ForegroundColor Red
    foreach ($failure in $validationFailures) {
      Write-Host (" - {0}" -f $failure) -ForegroundColor Red
    }
    exit 1
  }
} finally {
  Pop-Location
}
