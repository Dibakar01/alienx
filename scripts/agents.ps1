# Installs alienX's four Scheduled Tasks for this user (no admin), then starts the server:
#   alienX server  builds once, then keeps `next start` running on 127.0.0.1:3000 from logon
#   alienX tick    every minute: posts whose slot came turn due, one notification
#   alienX plan    Sundays 20:00: discover new ideas for each account (approve them in Create)
#   alienX pick    daily 07:30: alienX's pick, one approved post for any account with nothing coming
# Re-run after pulling changes: it rebuilds and restarts the server. Logs go to data\logs\.
# Remove with: scripts\agents.ps1 remove
param([string]$action)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root
$port = if ($env:ALIENX_PORT) { $env:ALIENX_PORT } else { 3000 }
$names = 'server', 'tick', 'plan', 'pick'
$dir = Join-Path $root 'data\agents'

# Take down what is there: the tasks, the server's restart loop, then the server itself.
foreach ($n in $names) {
  $task = Get-ScheduledTask -TaskName "alienX $n" -ErrorAction SilentlyContinue
  if ($task) { $task | Stop-ScheduledTask; $task | Unregister-ScheduledTask -Confirm:$false }
}
Get-CimInstance Win32_Process -Filter "Name = 'cmd.exe'" | Where-Object { $_.CommandLine -like '*\data\agents\server.cmd*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
& (Join-Path $PSScriptRoot 'stop.ps1') | Out-Null
if ($action -eq 'remove') {
  Remove-Item $dir -Recurse -Force -ErrorAction SilentlyContinue
  Write-Host 'alienX agents removed.'; exit 0
}

New-Item -ItemType Directory -Force $dir, (Join-Path $root 'data\logs') | Out-Null
& cmd.exe /c 'npm run build > NUL'
if ($LASTEXITCODE -ne 0) { Write-Host 'The build failed; run npm run build to see why.'; exit 1 }

# Each task runs a small .cmd through wscript, so no console window flashes up every minute.
# The .cmd files find the repo from where they sit (data\agents), so no path is written into them.
Set-Content (Join-Path $dir 'hidden.vbs') 'WScript.Quit CreateObject("WScript.Shell").Run("""" & WScript.Arguments(0) & """", 0, True)' -Encoding ASCII
$head = "@echo off`r`ncd /d `"%~dp0..\..`"`r`n"
$run = @{
  # next start has no KeepAlive here, so the loop brings it back if it stops.
  server = ":loop`r`ncall npx next start -H 127.0.0.1 -p $port >> data\logs\server.log 2>&1`r`nping -n 6 127.0.0.1 > NUL`r`ngoto loop"
  tick = 'node --env-file-if-exists=.env scripts/tick.ts >> data\logs\tick.log 2>&1'
  plan = 'node --env-file-if-exists=.env scripts/plan.ts --research-only >> data\logs\plan.log 2>&1'
  pick = 'node --env-file-if-exists=.env scripts/plan.ts --daily >> data\logs\pick.log 2>&1'
}
$when = @{
  server = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
  tick = New-ScheduledTaskTrigger -Once -At (Get-Date).Date -RepetitionInterval (New-TimeSpan -Minutes 1)
  plan = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Sunday -At 20:00
  pick = New-ScheduledTaskTrigger -Daily -At 07:30
}
$user = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
# Run on battery too, with no time limit (the default stops a task after 3 days).
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -ExecutionTimeLimit ([TimeSpan]::Zero)
foreach ($n in $names) {
  $cmd = Join-Path $dir "$n.cmd"
  Set-Content $cmd ($head + $run[$n]) -Encoding ASCII
  $exec = New-ScheduledTaskAction -Execute 'wscript.exe' -Argument "//B //Nologo `"$(Join-Path $dir 'hidden.vbs')`" `"$cmd`"" -WorkingDirectory $root
  Register-ScheduledTask -TaskName "alienX $n" -Action $exec -Trigger $when[$n] -Principal $user -Settings $settings -Force | Out-Null
}
Start-ScheduledTask -TaskName 'alienX server'
Write-Host "alienX agents running. Site: http://127.0.0.1:$port  Logs: $(Join-Path $root 'data\logs')\"
