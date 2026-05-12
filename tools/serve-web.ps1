param(
  [string]$ProjectDir = (Split-Path -Parent $PSScriptRoot),
  [int]$PortStart = 8000,
  [int]$PortEnd = 8099
)

$ErrorActionPreference = "Stop"

$ProjectDir = [System.IO.Path]::GetFullPath($ProjectDir)
$WebDir = [System.IO.Path]::GetFullPath((Join-Path $ProjectDir "web"))

if (-not (Test-Path -LiteralPath $WebDir -PathType Container)) {
  Write-Host "Missing web directory: $WebDir"
  Read-Host "Press Enter to close"
  exit 1
}

function Test-PortAvailable {
  param([int]$Port)
  $Probe = $null
  try {
    $Probe = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $Port)
    $Probe.Start()
    return $true
  } catch {
    return $false
  } finally {
    if ($Probe) { $Probe.Stop() }
  }
}

function Get-FreePort {
  foreach ($Candidate in $PortStart..$PortEnd) {
    if (Test-PortAvailable -Port $Candidate) {
      return $Candidate
    }
  }
  return $null
}

function Get-ContentType {
  param([string]$Path)
  switch ([System.IO.Path]::GetExtension($Path).ToLowerInvariant()) {
    ".html" { "text/html; charset=utf-8" }
    ".htm"  { "text/html; charset=utf-8" }
    ".js"   { "text/javascript; charset=utf-8" }
    ".css"  { "text/css; charset=utf-8" }
    ".json" { "application/json; charset=utf-8" }
    ".csv"  { "text/csv; charset=utf-8" }
    ".svg"  { "image/svg+xml" }
    ".png"  { "image/png" }
    ".jpg"  { "image/jpeg" }
    ".jpeg" { "image/jpeg" }
    ".ico"  { "image/x-icon" }
    default { "application/octet-stream" }
  }
}

function Get-ReasonPhrase {
  param([int]$StatusCode)
  switch ($StatusCode) {
    200 { "OK" }
    400 { "Bad Request" }
    403 { "Forbidden" }
    404 { "Not Found" }
    500 { "Internal Server Error" }
    default { "OK" }
  }
}

function Write-HttpResponse {
  param(
    [System.IO.Stream]$Stream,
    [int]$StatusCode,
    [string]$ContentType,
    [byte[]]$Body
  )
  $Reason = Get-ReasonPhrase -StatusCode $StatusCode
  $Header = "HTTP/1.1 $StatusCode $Reason`r`nContent-Type: $ContentType`r`nContent-Length: $($Body.Length)`r`nConnection: close`r`n`r`n"
  $HeaderBytes = [System.Text.Encoding]::ASCII.GetBytes($Header)
  $Stream.Write($HeaderBytes, 0, $HeaderBytes.Length)
  if ($Body.Length -gt 0) {
    $Stream.Write($Body, 0, $Body.Length)
  }
}

function Write-TextResponse {
  param(
    [System.IO.Stream]$Stream,
    [int]$StatusCode,
    [string]$Text
  )
  $Bytes = [System.Text.Encoding]::UTF8.GetBytes($Text)
  Write-HttpResponse -Stream $Stream -StatusCode $StatusCode -ContentType "text/plain; charset=utf-8" -Body $Bytes
}

function Resolve-WebPath {
  param([string]$RequestPath)
  $CleanPath = [System.Uri]::UnescapeDataString($RequestPath.Split("?")[0])
  if ($CleanPath -eq "/") {
    $CleanPath = "/index.html"
  }
  $RelativePath = $CleanPath.TrimStart("/").Replace("/", [System.IO.Path]::DirectorySeparatorChar)
  $FullPath = [System.IO.Path]::GetFullPath((Join-Path $WebDir $RelativePath))
  $Root = $WebDir.TrimEnd([System.IO.Path]::DirectorySeparatorChar, [System.IO.Path]::AltDirectorySeparatorChar) + [System.IO.Path]::DirectorySeparatorChar
  if (-not $FullPath.StartsWith($Root, [System.StringComparison]::OrdinalIgnoreCase)) {
    return $null
  }
  return $FullPath
}

$Port = Get-FreePort
if (-not $Port) {
  Write-Host "No free local port found in $PortStart-$PortEnd."
  Read-Host "Press Enter to close"
  exit 1
}

$Url = "http://127.0.0.1:$Port/"
$Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Parse("127.0.0.1"), $Port)

try {
  $Listener.Start()
  Write-Host "Starting temperature tool..."
  Write-Host "URL: $Url"
  Write-Host "Serving only: $WebDir"
  Write-Host "Press Ctrl+C or close this window to stop."
  Write-Host ""
  Start-Process $Url

  while ($true) {
    $Client = $Listener.AcceptTcpClient()
    try {
      $Stream = $Client.GetStream()
      $Reader = [System.IO.StreamReader]::new($Stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $RequestLine = $Reader.ReadLine()
      if (-not $RequestLine) {
        Write-TextResponse -Stream $Stream -StatusCode 400 -Text "Bad request"
        continue
      }

      $Parts = $RequestLine.Split(" ")
      if ($Parts.Length -lt 2) {
        Write-TextResponse -Stream $Stream -StatusCode 400 -Text "Bad request"
        continue
      }

      while ($true) {
        $Line = $Reader.ReadLine()
        if ($null -eq $Line -or $Line -eq "") { break }
      }

      $FullPath = Resolve-WebPath -RequestPath $Parts[1]
      if (-not $FullPath) {
        Write-TextResponse -Stream $Stream -StatusCode 403 -Text "Forbidden"
        continue
      }

      if (-not (Test-Path -LiteralPath $FullPath -PathType Leaf)) {
        Write-TextResponse -Stream $Stream -StatusCode 404 -Text "Not found"
        continue
      }

      $Bytes = [System.IO.File]::ReadAllBytes($FullPath)
      Write-HttpResponse -Stream $Stream -StatusCode 200 -ContentType (Get-ContentType -Path $FullPath) -Body $Bytes
    } catch {
      if ($Stream) {
        Write-TextResponse -Stream $Stream -StatusCode 500 -Text $_.Exception.Message
      }
    } finally {
      if ($Client) { $Client.Close() }
    }
  }
} finally {
  $Listener.Stop()
}
