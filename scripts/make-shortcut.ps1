# Makes an "alienX" shortcut, with the alien icon, in the Start menu and on the Desktop.
# Clicking it opens alienX: it starts in the background if needed and opens in your browser.
# Run it again after moving this folder. $env:ALIENX_APPS puts the one shortcut there instead.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$folders = if ($env:ALIENX_APPS) { @($env:ALIENX_APPS) } else { @([Environment]::GetFolderPath('Programs'), [Environment]::GetFolderPath('Desktop')) }
$shell = New-Object -ComObject WScript.Shell
foreach ($folder in $folders) {
  New-Item -ItemType Directory -Force $folder | Out-Null
  $link = $shell.CreateShortcut((Join-Path $folder 'alienX.lnk'))
  $link.TargetPath = Join-Path $PSHOME 'powershell.exe'
  $link.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$(Join-Path $root 'scripts\open.ps1')`""
  $link.WorkingDirectory = $root
  $link.IconLocation = (Join-Path $root 'brand\alienx.ico') + ',0'
  $link.Description = 'Open alienX'
  $link.Save()
  Write-Host "alienX shortcut ready: $(Join-Path $folder 'alienX.lnk')"
}
Write-Host 'Open it from the Start menu, Search or the Desktop.'
