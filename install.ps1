# Installs alienX on Windows in one line, in PowerShell:
#   irm https://raw.githubusercontent.com/Dibakar01/alienx/main/install.ps1 | iex
# Puts it in %USERPROFILE%\alienX, sets it up, adds an alienX shortcut to the Start menu and
# Desktop and opens it. Run it again to update. ALIENX_HOME, ALIENX_REPO and ALIENX_APPS
# override the defaults. No admin needed.
# Everything sits in a function; a failure throws, which exits 1 for the downloaded .cmd and
# CI without closing an interactive PowerShell window.
function Install-AlienX {
  $ErrorActionPreference = 'Stop'
  $repo = if ($env:ALIENX_REPO) { $env:ALIENX_REPO } else { 'https://github.com/Dibakar01/alienx.git' }
  $home_ = if ($env:ALIENX_HOME) { $env:ALIENX_HOME } else { Join-Path $env:USERPROFILE 'alienX' }

  $missing = @()
  if (-not (Get-Command git -ErrorAction SilentlyContinue)) { $missing += 'Git: https://git-scm.com/download/win' }
  if (-not (Get-Command node -ErrorAction SilentlyContinue)) { $missing += 'Node 24 or newer: https://nodejs.org' }
  elseif (([version](& node -p 'process.versions.node')).Major -lt 24) { $missing += "Node 24 or newer: https://nodejs.org (found $(& node -v))" }
  if (-not (Get-Command claude -ErrorAction SilentlyContinue)) { $missing += 'Claude Code CLI: https://claude.com/claude-code, then run `claude` once and sign in with your Claude plan' }
  if ($missing.Count) {
    Write-Host 'First install:'
    $missing | ForEach-Object { Write-Host "  $_" }
    throw 'Install what is missing above, then open a new PowerShell window and run the install line again.'
  }

  if (Test-Path (Join-Path $home_ '.git')) {
    Write-Host "Updating alienX in $home_"
    & git -C $home_ pull --ff-only --quiet
  } else {
    Write-Host "Downloading alienX to $home_"
    & git clone --quiet --depth 1 $repo $home_
  }
  if ($LASTEXITCODE -ne 0) { throw 'git failed (see above).' }

  foreach ($step in 'setup', 'make-shortcut', 'open') {
    & powershell.exe -NoProfile -ExecutionPolicy Bypass -File (Join-Path $home_ "scripts\$step.ps1")
    if ($LASTEXITCODE -ne 0) { throw "alienX $step did not finish (see above)." }
  }
  Write-Host 'Done. Next time, open alienX from the Start menu, Search or the Desktop.'
}
Install-AlienX
