#!/usr/bin/env bash
# npm run setup: get alienX ready to run on this Mac. Safe to run again; it never
# overwrites a file you already have.
set -euo pipefail
cd "$(dirname "$0")/.."
ok() { printf '  \033[32m✓\033[0m %s\n' "$1"; }
no() { printf '  \033[31m✗\033[0m %s\n' "$1"; missing=1; }
missing=0

echo "Checking what alienX needs:"
node_major=$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)
if [ "$node_major" -ge 24 ]; then ok "Node $(node -v)"; else no "Node 24 or newer (https://nodejs.org). Found: $(node -v 2>/dev/null || echo none)"; fi
if command -v claude >/dev/null 2>&1; then ok "Claude Code CLI $(claude --version 2>/dev/null | head -1)"; else no "Claude Code CLI: install it (https://claude.com/claude-code), then run \`claude\` once and sign in with your Claude plan"; fi
chrome=${CHROME_BIN:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
if [ -x "$chrome" ]; then ok "Google Chrome (draws the post images)"; else no "Google Chrome in /Applications (https://www.google.com/chrome), or set CHROME_BIN"; fi
[ "$missing" = 0 ] || { echo; echo "Install what is missing above, then run npm run setup again."; exit 1; }

echo; echo "Installing packages:"
npm install --no-audit --no-fund --loglevel=error
ok "packages installed"

echo; echo "Your private files (git-ignored, they stay on this Mac):"
[ -f .env ] && ok ".env already there" || { cp .env.example .env; ok ".env created"; }
[ -f knowledge/facts.md ] || [ -f knowledge/qalakaar-facts.md ] && ok "your facts file is already there" || ok "facts: type them when you make your account (or copy knowledge/facts.example.md to knowledge/facts.md)"
mkdir -p voices data

echo; echo "Ready. Open it with:  npm run open   (or make a one-click app: npm run app)"
echo "Then add your accounts on the first screen."
