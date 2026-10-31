#!/bin/zsh
# Installs alienX's three launchd agents for this user, then (re)starts them:
#   com.qalakaar.alienx.server  builds once, then keeps `next start` running on 127.0.0.1:3000
#   com.qalakaar.alienx.tick    every minute: posts whose slot came turn due, one notification
#   com.qalakaar.alienx.plan    Sundays 20:00: discover new ideas for each account (approve them in Create)
#   com.qalakaar.alienx.pick    daily 07:30: alienX's pick, one approved post for any account with nothing coming
# Re-run after pulling changes: it rebuilds and restarts the server. Logs go to data/logs/.
# Remove with: scripts/agents.sh remove
set -euo pipefail
ROOT=${0:A:h:h}
AGENTS=~/Library/LaunchAgents
LABELS=(server tick plan pick)

for l in $LABELS; do launchctl bootout gui/$UID/com.qalakaar.alienx.$l 2>/dev/null || true; done
if [[ ${1:-} == remove ]]; then
  for l in $LABELS; do rm -f $AGENTS/com.qalakaar.alienx.$l.plist; done
  echo "alienX agents removed."; exit 0
fi

NODE=$(command -v node); NPM=$(command -v npm); CLAUDE=$(command -v claude)
# launchd starts with a bare PATH; give it the folders node, npm and claude live in.
AGENT_PATH="${NODE:h}:${CLAUDE:h}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
mkdir -p $ROOT/data/logs $AGENTS
(cd $ROOT && $NPM run build >/dev/null)

plist() { # label, schedule xml, program args...
  local label=$1 when=$2; shift 2
  local args=""; for a in "$@"; do args+="<string>${a//&/&amp;}</string>"; done
  cat > $AGENTS/com.qalakaar.alienx.$label.plist <<XML
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.qalakaar.alienx.$label</string>
  <key>ProgramArguments</key><array>$args</array>
  <key>WorkingDirectory</key><string>$ROOT</string>
  <key>EnvironmentVariables</key><dict><key>PATH</key><string>$AGENT_PATH</string><key>CLAUDE_BIN</key><string>$CLAUDE</string></dict>
  $when
  <key>StandardOutPath</key><string>$ROOT/data/logs/$label.log</string>
  <key>StandardErrorPath</key><string>$ROOT/data/logs/$label.log</string>
</dict></plist>
XML
  plutil -lint -s $AGENTS/com.qalakaar.alienx.$label.plist
  launchctl bootstrap gui/$UID $AGENTS/com.qalakaar.alienx.$label.plist
}

plist server '<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>' $NPM start
plist tick '<key>StartInterval</key><integer>60</integer>' $NODE --env-file-if-exists=.env scripts/tick.ts
plist plan '<key>StartCalendarInterval</key><dict><key>Weekday</key><integer>0</integer><key>Hour</key><integer>20</integer><key>Minute</key><integer>0</integer></dict>' $NODE --env-file-if-exists=.env scripts/plan.ts --research-only
plist pick '<key>StartCalendarInterval</key><dict><key>Hour</key><integer>7</integer><key>Minute</key><integer>30</integer></dict>' $NODE --env-file-if-exists=.env scripts/plan.ts --daily
echo "alienX agents running. Site: http://127.0.0.1:3000  Logs: $ROOT/data/logs/"
