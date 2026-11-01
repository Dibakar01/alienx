# npm run setup: get alienX ready to run on this PC. Safe to run again; it never
# overwrites a file you already have.
# No global 'Stop': PowerShell 5.1 turns a native command's stderr into a terminating error.
Set-Location (Split-Path -Parent $PSScriptRoot)
$script:missing = $false
function ok($text) { Write-Host '  ' -NoNewline; Write-Host 'ok' -ForegroundColor Green -NoNewline; Write-Host " $text" }
function no($text) { Write-Host '  ' -NoNewline; Write-Host 'missing' -ForegroundColor Red -NoNewline; Write-Host " $text"; $script:missing = $true }

Write-Host 'Checking what alienX needs:'
$node = Get-Command node -ErrorAction SilentlyContinue
$nodeMajor = 0
# No quotes inside the node argument: Windows PowerShell 5.1 drops them on the way to node.
if ($node) { $nodeMajor = ([version](& node -p process.versions.node)).Major }
if ($nodeMajor -ge 24) { ok "Node $(& node -v)" }
elseif ($node) { no "Node 24 or newer (https://nodejs.org). Found: $(& node -v)" }
else { no 'Node 24 or newer (https://nodejs.org). Found: none' }
if (Get-Command claude -ErrorAction SilentlyContinue) { ok "Claude Code CLI $(& claude --version 2>$null | Select-Object -First 1)" }
else { no 'Claude Code CLI: install it (https://claude.com/claude-code), then run `claude` once and sign in with your Claude plan' }
$chrome = ''
if ($nodeMajor -ge 24) { $chrome = & node --input-type=module -e "const m = await import('./lib/platform.ts'); process.stdout.write(m.chromePath() ?? '')" 2>$null }
if ($chrome) { ok 'Chrome or Edge (draws the post images)' }
else { no 'Google Chrome (https://www.google.com/chrome) or Microsoft Edge, or set CHROME_BIN' }
if ($script:missing) { Write-Host ''; Write-Host 'Install what is missing above, then run npm run setup again.'; exit 1 }

Write-Host ''; Write-Host 'Installing packages:'
& npm install --no-audit --no-fund --loglevel=error
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
ok 'packages installed'

Write-Host ''; Write-Host 'Your private files (git-ignored, they stay on this PC):'
if (Test-Path .env) { ok '.env already there' } else { Copy-Item .env.example .env -ErrorAction Stop; ok '.env created' }
if ((Test-Path knowledge\facts.md) -or (Test-Path knowledge\qalakaar-facts.md)) { ok 'your facts file is already there' }
else { ok 'facts: type them when you make your account (or copy knowledge\facts.example.md to knowledge\facts.md)' }
New-Item -ItemType Directory -Force voices, data -ErrorAction Stop | Out-Null

Write-Host ''; Write-Host 'Ready. Open it with:  npm run open   (or make a Start menu shortcut: npm run app)'
Write-Host 'Then add your accounts on the first screen.'
