#!/usr/bin/env bash
# Opens alienX: builds it if the code changed, starts it in the background on this Mac
# only (127.0.0.1:3000, or $ALIENX_PORT) if it is not already running, then opens it in the browser. It
# keeps running after this window closes; `npm run stop` stops it.
set -euo pipefail
cd "$(dirname "$0")/.."
port=${ALIENX_PORT:-3000}
url=http://127.0.0.1:$port
if body=$(curl -sL "$url"); then
  # Something answers on the port; only open it if it is alienX.
  if [[ $body != *alienX* ]]; then
    echo "Port $port is busy with another app. Close it, or set ALIENX_PORT to a free port."
    exit 1
  fi
else
  # Rebuild when there is no build yet, or any code changed since the last one.
  if [ ! -f .next/BUILD_ID ] || [ -n "$(find app lib prompts config proxy.ts package.json -newer .next/BUILD_ID 2>/dev/null | head -1)" ]; then
    echo "Building alienX…"
    mkdir -p data/logs
    npm run build --silent > data/logs/build.log 2>&1 || { tail -30 data/logs/build.log; echo "The build failed; the full log is data/logs/build.log."; exit 1; }
  fi
  mkdir -p data/logs
  nohup npx next start -H 127.0.0.1 -p "$port" >> data/logs/server.log 2>&1 &
  for _ in $(seq 1 60); do curl -s -o /dev/null "$url" && break; sleep 0.5; done
fi
open "$url"
