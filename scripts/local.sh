#!/usr/bin/env bash
# npm run local: build alienX, start it on this Mac only (127.0.0.1:3000) and open it in
# the browser. Ctrl+C stops it. To keep it running in the background instead, use
# scripts/agents.sh.
set -euo pipefail
cd "$(dirname "$0")/.."
url=http://127.0.0.1:3000
if curl -s -o /dev/null "$url"; then echo "alienX is already running at $url"; open "$url"; exit 0; fi
echo "Building alienX…"
npm run build --silent >/dev/null
echo "Starting at $url (Ctrl+C to stop)"
# Open the browser as soon as the server answers.
( for _ in $(seq 1 60); do curl -s -o /dev/null "$url" && { open "$url"; break; }; sleep 0.5; done ) &
# npm start runs the pinned next in node_modules on 127.0.0.1; npx could fetch one.
exec npm start -- -p 3000
