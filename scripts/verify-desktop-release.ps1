param(
  [string] $BaseUrl = "",
  [string] $LocalBaseUrl = "http://127.0.0.1:3200",
  [switch] $Insecure,
  [switch] $SkipLocal
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..")
Push-Location $repoRoot

function Invoke-HeadRequest {
  param(
    [Parameter(Mandatory = $true)] [string] $Url,
    [switch] $AllowInsecure
  )

  $escapedUrl = $Url.Replace('"', '\"')
  $curlCommand = 'curl.exe -sS -L -I'
  if ($AllowInsecure) {
    $curlCommand += ' -k'
  }
  $curlCommand = '{0} "{1}"' -f $curlCommand, $escapedUrl

  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $output = @()

  try {
    $output = @( & cmd.exe /d /s /c $curlCommand 2>&1 )
    if ($LASTEXITCODE -ne 0) {
      return [PSCustomObject]@{
        StatusCode = 0
        ContentType = ""
        ContentLength = ""
        Error = (($output | Select-Object -Last 1) -join "")
      }
    }

    $statusCode = 0
    $headers = @{}
    foreach ($rawLine in $output) {
      $line = [string]$rawLine
      if ($line -match '^HTTP/\S+\s+(\d{3})') {
        $statusCode = [int]$Matches[1]
        $headers = @{}
        continue
      }

      if ([string]::IsNullOrWhiteSpace($line)) {
        continue
      }

      if ($line -match '^\s*([^:]+)\s*:\s*(.*)$') {
        $headerName = [string]$Matches[1]
        $headerValue = [string]$Matches[2]
        if ($null -eq $headerName) {
          $headerName = ""
        }

        $headers[$headerName.Trim().ToLowerInvariant()] = $headerValue.Trim()
      }
    }

    if ($statusCode -eq 0) {
      return [PSCustomObject]@{
        StatusCode = 0
        ContentType = ""
        ContentLength = ""
        Error = "Could not parse HTTP status from response headers."
      }
    }

    return [PSCustomObject]@{
      StatusCode = $statusCode
      ContentType = [string]$headers["content-type"]
      ContentLength = [string]$headers["content-length"]
      Error = $null
    }
  }
  catch {
    return [PSCustomObject]@{
      StatusCode = 0
      ContentType = ""
      ContentLength = ""
      Error = $_.Exception.Message
    }
  }
  finally {
    $ErrorActionPreference = $previousErrorPreference
  }
}

function Invoke-BodySnippetRequest {
  param(
    [Parameter(Mandatory = $true)] [string] $Url,
    [switch] $AllowInsecure
  )

  $escapedUrl = $Url.Replace('"', '\"')
  $curlCommand = 'curl.exe -sS -L --range 0-1023'
  if ($AllowInsecure) {
    $curlCommand += ' -k'
  }
  $curlCommand = '{0} "{1}"' -f $curlCommand, $escapedUrl

  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"

  try {
    $output = @( & cmd.exe /d /s /c $curlCommand 2>&1 )
    if ($LASTEXITCODE -ne 0) {
      return [PSCustomObject]@{
        Snippet = ""
        Error = (($output | Select-Object -Last 1) -join "")
      }
    }

    $text = ($output -join "`n")
    $snippet = $text.Substring(0, [Math]::Min($text.Length, 240))
    $snippet = ($snippet -replace "\s+", " ").Trim()

    return [PSCustomObject]@{
      Snippet = $snippet
      Error = $null
    }
  }
  catch {
    return [PSCustomObject]@{
      Snippet = ""
      Error = $_.Exception.Message
    }
  }
  finally {
    $ErrorActionPreference = $previousErrorPreference
  }
}

function New-CheckResult {
  param(
    [Parameter(Mandatory = $true)] [string] $Name,
    [Parameter(Mandatory = $true)] [bool] $Passed,
    [Parameter(Mandatory = $true)] [string] $Details
  )

  return [PSCustomObject]@{
    Check = $Name
    Passed = $Passed
    Details = $Details
  }
}

function Test-BaseUrlReachable {
  param([Parameter(Mandatory = $true)] [string] $Url)

  try {
    $uri = [System.Uri]$Url
    $port = if ($uri.Port -gt 0) { $uri.Port } elseif ($uri.Scheme -eq "https") { 443 } else { 80 }
    $host = [string]$uri.Host

    if ([string]::IsNullOrWhiteSpace($host)) {
      return $false
    }

    $connection = Test-NetConnection -ComputerName $host -Port $port -WarningAction SilentlyContinue
    return [bool]$connection.TcpTestSucceeded
  }
  catch {
    return $false
  }
}

function Resolve-BaseUrlFromDownloadUrl {
  param([string] $Url)

  $candidate = [string]$Url
  if ([string]::IsNullOrWhiteSpace($candidate)) {
    return ""
  }

  try {
    $uri = [System.Uri]$candidate
    $builder = New-Object System.UriBuilder($uri)
    $path = [string]$builder.Path

    if ([string]::IsNullOrWhiteSpace($path) -or $path -eq "/") {
      $builder.Path = "/"
    }
    else {
      $lastSlashIndex = $path.LastIndexOf("/")
      if ($lastSlashIndex -ge 0) {
        $builder.Path = if ($lastSlashIndex -eq 0) { "/" } else { $path.Substring(0, $lastSlashIndex + 1) }
      }
    }

    $builder.Query = ""
    $builder.Fragment = ""
    return $builder.Uri.AbsoluteUri.TrimEnd("/")
  }
  catch {
    return ""
  }
}

function Test-InstallerHead {
  param(
    [Parameter(Mandatory = $true)] [string] $Name,
    [Parameter(Mandatory = $true)] [string] $Url,
    [switch] $AllowInsecure
  )

  $result = Invoke-HeadRequest -Url $Url -AllowInsecure:$AllowInsecure
  if ($result.Error) {
    return New-CheckResult -Name $Name -Passed $false -Details ("{0} -> HEAD failed: {1}" -f $Url, $result.Error)
  }

  if ($result.StatusCode -lt 200 -or $result.StatusCode -ge 400) {
    return New-CheckResult -Name $Name -Passed $false -Details ("{0} -> HTTP {1}" -f $Url, $result.StatusCode)
  }

  $contentType = [string]$result.ContentType
  if ($null -eq $contentType) {
    $contentType = ""
  }

  $lower = $contentType.ToLowerInvariant()
  if ($lower.Contains("text/html")) {
    $snippetResult = Invoke-BodySnippetRequest -Url $Url -AllowInsecure:$AllowInsecure
    $snippetDetails = if ($snippetResult.Error) {
      "snippet unavailable: {0}" -f $snippetResult.Error
    }
    elseif ([string]::IsNullOrWhiteSpace($snippetResult.Snippet)) {
      "snippet empty"
    }
    else {
      "snippet: {0}" -f $snippetResult.Snippet
    }

    return New-CheckResult -Name $Name -Passed $false -Details ("{0} -> HTML response ({1}); {2}" -f $Url, $contentType, $snippetDetails)
  }

  $sampleResult = Invoke-BodySnippetRequest -Url $Url -AllowInsecure:$AllowInsecure
  if (-not $sampleResult.Error -and -not [string]::IsNullOrWhiteSpace($sampleResult.Snippet)) {
    $sampleLower = $sampleResult.Snippet.ToLowerInvariant()
    if ($sampleLower.Contains("<!doctype html") -or $sampleLower.Contains("<html")) {
      return New-CheckResult -Name $Name -Passed $false -Details ("{0} -> body looks like HTML despite content-type '{1}'; snippet: {2}" -f $Url, $contentType, $sampleResult.Snippet)
    }
  }

  $contentLength = 0
  if ($result.ContentLength -and [long]::TryParse($result.ContentLength, [ref]$contentLength) -and $contentLength -lt 1048576) {
    return New-CheckResult -Name $Name -Passed $false -Details ("{0} -> content-length too small ({1})" -f $Url, $result.ContentLength)
  }

  return New-CheckResult -Name $Name -Passed $true -Details ("{0} -> HTTP {1}, {2}, length={3}" -f $Url, $result.StatusCode, $contentType, $result.ContentLength)
}

try {
  $manifestPath = Join-Path $repoRoot "apps\web\public\desktop-update.json"

  if (-not (Test-Path -Path $manifestPath)) {
    throw ("Manifest file not found: {0}" -f $manifestPath)
  }

  $manifest = Get-Content -Path $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
  $version = [string]$manifest.version
  $manifestDownloadUrl = [string]$manifest.downloadUrl

  if ([string]::IsNullOrWhiteSpace($version)) {
    throw "Manifest version is missing."
  }

  if ([string]::IsNullOrWhiteSpace($manifestDownloadUrl)) {
    throw "Manifest downloadUrl is missing."
  }

  $resolvedBaseUrl = [string]$BaseUrl
  if ([string]::IsNullOrWhiteSpace($resolvedBaseUrl)) {
    $resolvedBaseUrl = [string]$env:NEXUSFORGE_PERSISTENT_DOWNLOAD_BASE_URL
  }
  if ([string]::IsNullOrWhiteSpace($resolvedBaseUrl) -and ($manifest.PSObject.Properties.Name -contains "downloadFolderUrl")) {
    $resolvedBaseUrl = [string]$manifest.downloadFolderUrl
  }
  if ([string]::IsNullOrWhiteSpace($resolvedBaseUrl)) {
    $resolvedBaseUrl = Resolve-BaseUrlFromDownloadUrl -Url $manifestDownloadUrl
  }
  if ([string]::IsNullOrWhiteSpace($resolvedBaseUrl)) {
    $resolvedBaseUrl = "https://www.nexusforge.app"
  }

  $normalizedBaseUrl = $resolvedBaseUrl.TrimEnd("/")
  $normalizedLocalBaseUrl = $LocalBaseUrl.TrimEnd("/")
  $effectiveSkipLocal = [bool]$SkipLocal

  $encodedLatest = [System.Uri]::EscapeDataString("NexusForge Desktop Setup Latest.exe")
  $encodedVersioned = [System.Uri]::EscapeDataString(("NexusForge Desktop Setup {0}.exe" -f $version))

  $publicManifestUrl = "{0}/desktop-update.json" -f $normalizedBaseUrl
  $publicLatestUrl = "{0}/{1}" -f $normalizedBaseUrl, $encodedLatest
  $publicVersionUrl = "{0}/{1}" -f $normalizedBaseUrl, $encodedVersioned

  $checks = New-Object System.Collections.Generic.List[object]

  Write-Host ("[desktop-release-verify] Base URL: {0}" -f $normalizedBaseUrl) -ForegroundColor Cyan
  Write-Host ("[desktop-release-verify] Local URL: {0}" -f $normalizedLocalBaseUrl) -ForegroundColor Cyan
  Write-Host ("[desktop-release-verify] Manifest version: {0}" -f $version) -ForegroundColor Cyan

  if (-not $effectiveSkipLocal -and -not (Test-BaseUrlReachable -Url $normalizedLocalBaseUrl)) {
    Write-Host ("[desktop-release-verify] Local base URL is unreachable; skipping local checks for {0}. Use -SkipLocal explicitly to silence this warning." -f $normalizedLocalBaseUrl) -ForegroundColor Yellow
    $effectiveSkipLocal = $true
  }

  $manifestCommandText = "node ./scripts/validate-desktop-update-endpoints.mjs --base `"$normalizedBaseUrl`""
  if ($Insecure) {
    $manifestCommandText += " --insecure"
  }

  $previousErrorPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  $manifestOutput = @()
  try {
    $manifestOutput = @( & cmd.exe /d /s /c $manifestCommandText 2>&1 )
  }
  finally {
    $ErrorActionPreference = $previousErrorPreference
  }
  $manifestPass = ($LASTEXITCODE -eq 0)
  $manifestDetails = if ($manifestPass) {
    ("{0} -> validator passed" -f $publicManifestUrl)
  } else {
    ("{0} -> {1}" -f $publicManifestUrl, (($manifestOutput | Select-Object -Last 1) -join ""))
  }
  $checks.Add((New-CheckResult -Name "Public manifest validator" -Passed $manifestPass -Details $manifestDetails)) | Out-Null

  $checks.Add((Test-InstallerHead -Name "Public stable installer" -Url $publicLatestUrl -AllowInsecure:$Insecure)) | Out-Null
  $checks.Add((Test-InstallerHead -Name "Public versioned installer" -Url $publicVersionUrl -AllowInsecure:$Insecure)) | Out-Null

  if (-not $effectiveSkipLocal) {
    $localLatestUrl = "{0}/{1}" -f $normalizedLocalBaseUrl, $encodedLatest
    $localVersionUrl = "{0}/{1}" -f $normalizedLocalBaseUrl, $encodedVersioned
    $checks.Add((Test-InstallerHead -Name "Local stable installer" -Url $localLatestUrl)) | Out-Null
    $checks.Add((Test-InstallerHead -Name "Local versioned installer" -Url $localVersionUrl)) | Out-Null
  }

  Write-Host ""
  Write-Host "[desktop-release-verify] Result summary" -ForegroundColor Cyan
  $checks | Select-Object Check, Passed, Details | Format-Table -AutoSize | Out-String | Write-Host

  $failed = @($checks | Where-Object { -not $_.Passed })
  if ($failed.Count -gt 0) {
    Write-Host "[desktop-release-verify] Failed checks (full details):" -ForegroundColor Yellow
    foreach ($failure in $failed) {
      Write-Host ("  - {0}: {1}" -f $failure.Check, $failure.Details) -ForegroundColor Yellow
    }

    $publicFailed = @($failed | Where-Object { $_.Check -like "Public*" })
    if ($publicFailed.Count -gt 0) {
      Write-Host "[desktop-release-verify] Public endpoint remediation hints:" -ForegroundColor Yellow
      Write-Host "  1) Ensure /desktop-update.json and /NexusForge Desktop Setup*.exe bypass SPA rewrite rules." -ForegroundColor Yellow
      Write-Host "  2) Verify static root contains desktop-update.json and both installer filenames." -ForegroundColor Yellow
      Write-Host "  3) Re-test with: npm run desktop:release:verify:insecure" -ForegroundColor Yellow
    }
    throw ("Release verification failed ({0} check(s))." -f $failed.Count)
  }

  Write-Host "[desktop-release-verify] PASS" -ForegroundColor Green
}
finally {
  Pop-Location
}