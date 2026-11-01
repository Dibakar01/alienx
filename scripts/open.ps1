# Opens alienX: builds it if the code changed, starts it in the background on this PC
# only (127.0.0.1:3000, or $env:ALIENX_PORT) if it is not already running, then opens it in the browser. It
# keeps running after this window closes; `npm run stop` stops it.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$port = if ($env:ALIENX_PORT) { $env:ALIENX_PORT } else { 3000 }
$url = "http://127.0.0.1:$port"
# Is something answering on the port? (A refused local connect takes Windows ~2s, hence the 1s cap.)
function Test-Up { try { $c = New-Object Net.Sockets.TcpClient; $up = $c.ConnectAsync('127.0.0.1', [int]$port).Wait(1000); $c.Close(); $up } catch { $false } }

$up = Test-Up
if ($up) {
  # Something answers on the port; only open it if it is alienX.
  $body = ''
  try { $body = [string](Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 10).Content } catch {}
  if ($body -cnotlike '*alienX*') {
    Write-Host "Port $port is busy with another app. Close it, or set ALIENX_PORT to a free port."
    exit 1
  }
}
if (-not $up) {
  New-Item -ItemType Directory -Force data\logs | Out-Null
  # Rebuild when there is no build yet, or any code changed since the last one.
  $build = Get-Item .next\BUILD_ID -ErrorAction SilentlyContinue
  $changed = $null
  if ($build) {
    $changed = Get-ChildItem app, lib, prompts, config, proxy.ts, package.json -Recurse -File -ErrorAction SilentlyContinue |
      Where-Object { $_.LastWriteTime -gt $build.LastWriteTime } | Select-Object -First 1
  }
  if (-not $build -or $changed) {
    Write-Host 'Building alienX...'
    & cmd.exe /c 'npm run build --silent > data\logs\build.log 2>&1'
    if ($LASTEXITCODE -ne 0) {
      Get-Content data\logs\build.log -Tail 30
      Write-Host 'The build failed; the full log is data\logs\build.log.'
      exit 1
    }
  }
  # cmd does the redirect: Start-Process cannot send stdout and stderr to one file.
  Start-Process cmd.exe -ArgumentList "/c npm start -- -p $port >> data\logs\server.log 2>&1" -WorkingDirectory $root -WindowStyle Hidden
  $deadline = (Get-Date).AddSeconds(30)
  while ((Get-Date) -lt $deadline -and -not (Test-Up)) { Start-Sleep -Milliseconds 500 }
}
# ALIENX_NO_BROWSER skips the browser (CI has none).
if (-not $env:ALIENX_NO_BROWSER) { Start-Process $url }
