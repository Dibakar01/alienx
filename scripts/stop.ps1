# Stops the alienX server started by `npm run open`, the alienX shortcut or alienX.cmd.
$port = if ($env:ALIENX_PORT) { $env:ALIENX_PORT } else { 3000 }
$root = Split-Path -Parent $PSScriptRoot
$owners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique
# Only a Next.js server started from this folder is stopped; its command line runs
# next from this folder's node_modules. Another app on the port is left alone.
$ours = @()
foreach ($id in $owners) {
  $cmd = (Get-CimInstance Win32_Process -Filter "ProcessId=$id" -ErrorAction SilentlyContinue).CommandLine
  if ($cmd -and $cmd.ToLower().Contains('next') -and $cmd.ToLower().Contains($root.ToLower())) { $ours += $id }
}
if ($ours.Count) { Stop-Process -Id $ours -Force; Write-Host 'alienX stopped.' }
elseif ($owners) { Write-Host "Port $port is used by another app, not alienX; left it running." }
else { Write-Host 'alienX is not running.' }
