# CI on Windows (.github/workflows/windows.yml): install alienX the way a user would, with
# install.ps1 cloning this checkout instead of GitHub, then check it answers, has its shortcut
# and icon, draws a picture with Edge, and stops. Needs a claude on PATH (CI puts a stub there).
# No global 'Stop': Windows PowerShell can turn a program's stderr into an error. Check throws.
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo
$home_ = Join-Path $env:RUNNER_TEMP 'alienX'
$port = 3000
function Test-Up { try { $c = New-Object Net.Sockets.TcpClient; $up = $c.ConnectAsync('127.0.0.1', $port).Wait(1000); $c.Close(); $up } catch { $false } }
function Check($ok, $what) { if (-not $ok) { throw "FAILED: $what" }; Write-Host "ok $what" }

# A file:/// URL, not a plain path: git ignores --depth on a plain local path and says so on stderr.
$env:ALIENX_REPO = 'file:///' + ($repo -replace '\\', '/')
$env:ALIENX_HOME = $home_
$env:ALIENX_APPS = Join-Path $env:RUNNER_TEMP 'shortcuts'
$env:ALIENX_NO_BROWSER = '1'
Write-Host "Installing from $env:ALIENX_REPO to $home_"
# install.ps1 returns 0 even when a step fails, so what it left behind is checked below instead.
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $repo 'install.ps1')

$deadline = (Get-Date).AddSeconds(60)
while ((Get-Date) -lt $deadline -and -not (Test-Up)) { Start-Sleep -Milliseconds 500 }
$status = try { (Invoke-WebRequest "http://127.0.0.1:$port" -UseBasicParsing -TimeoutSec 60).StatusCode } catch { $_.Exception.Message }
Check ($status -eq 200) "alienX answers on 127.0.0.1:$port (got $status)"
$lnk = Join-Path $env:ALIENX_APPS 'alienX.lnk'
Check (Test-Path $lnk) "shortcut at $lnk"
$icon = Join-Path $home_ 'brand\alienx.ico'
Check (Test-Path $icon) "icon at $icon"
Check ((New-Object -ComObject WScript.Shell).CreateShortcut($lnk).IconLocation -like '*\brand\alienx.ico,0') 'shortcut uses the icon'

# Edge, not Chrome: it is the browser every Windows has. No double quotes in the script:
# Windows PowerShell drops them when it passes an argument to a program.
$edge = Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'
Check (Test-Path $edge) "Edge at $edge"
$env:CHROME_BIN = $edge
$js = @'
const fs = await import('node:fs');
const { renderArt, rasterize } = await import('./lib/art.ts');
const { pngSize } = await import('./lib/platform.ts');
const svg = process.env.RUNNER_TEMP + '/ci.svg', png = process.env.RUNNER_TEMP + '/ci.png';
fs.writeFileSync(svg, renderArt({ headline: 'posting more is not better', mark: 'more', markStyle: 'strike', composition: 'versus', objects: ['megaphone', 'hand-palm'], stamp: 'hot', seed: 4242 }));
await rasterize(svg, png);
const size = pngSize(fs.readFileSync(png));
console.log(png, size);
if (size?.width !== 1600 || size?.height !== 900) process.exit(1);
'@
& node --input-type=module -e ($js -replace "`r?`n", ' ')
Check ($LASTEXITCODE -eq 0) 'Edge drew a 1600x900 picture'

& powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $home_ 'scripts\stop.ps1')
Start-Sleep -Seconds 2
Check (-not (Test-Up)) "port $port closed after stop.ps1"
