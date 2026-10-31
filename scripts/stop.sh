#!/usr/bin/env bash
# Stops the alienX server started by `npm run open`, the alienX app or alienX.command.
pid=$(lsof -ti tcp:"${ALIENX_PORT:-3000}" -sTCP:LISTEN 2>/dev/null || true)
if [ -n "$pid" ]; then kill $pid && echo "alienX stopped."; else echo "alienX is not running."; fi
