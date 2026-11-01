# Stops the alienX server started by `npm run open`, the alienX shortcut or alienX.cmd.
$port = if ($env:ALIENX_PORT) { $env:ALIENX_PORT } else { 3000 }
$owners = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique
if ($owners) { Stop-Process -Id $owners -Force; Write-Host 'alienX stopped.' } else { Write-Host 'alienX is not running.' }
