#!/usr/bin/env bash
# Stops the alienX server started by `npm run open`, the alienX app or alienX.command.
# Only a Next.js server running from this folder is stopped; another app on the port is left alone.
port=${ALIENX_PORT:-3000}
root=$(cd "$(dirname "$0")/.." && pwd -P)
stopped='' other=''
for pid in $(lsof -ti tcp:"$port" -sTCP:LISTEN 2>/dev/null); do
  cmd=$(ps -o command= -p "$pid" 2>/dev/null)
  cwd=$(lsof -a -p "$pid" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p')
  if [[ $cmd == *next* && $cwd == "$root" ]]; then kill "$pid" && stopped=1; else other=1; fi
done
if [ -n "$stopped" ]; then echo "alienX stopped."
elif [ -n "$other" ]; then echo "Port $port is used by another app, not alienX; left it running."
else echo "alienX is not running."; fi
