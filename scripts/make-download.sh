#!/usr/bin/env bash
# Builds docs/download/alienX.zip for the website's "Download for Mac" button: one
# double-clickable alienX.command, wearing the alien icon, that runs install.sh. Needs
# Google Chrome to draw the icon (same drawing as scripts/make-app.sh). Safe to re-run.
# Also builds docs/download/alienX-windows.zip for "Download for Windows" (see below).
set -euo pipefail
cd "$(dirname "$0")/.."
out=docs/download/alienX.zip
tmp=$(mktemp -d)
trap 'rm -rf "$tmp"' EXIT
cmd="$tmp/alienX.command"

cat > "$cmd" <<'SH'
#!/usr/bin/env bash
# Installs alienX into ~/alienX and opens it. Run it again any time to update.
# It runs alienX's install script, which you can read first at
# https://github.com/Dibakar01/alienx/blob/main/install.sh
set -o pipefail
curl -fsSL https://raw.githubusercontent.com/Dibakar01/alienx/main/install.sh | bash ||
  { echo; read -r -n1 -p "Something went wrong (see above). Press any key to close."; exit 1; }
SH
chmod +x "$cmd"

# The Windows download: docs/download/alienX-windows.zip, one "Install alienX.cmd" that runs
# install.ps1. Windows wants CRLF line endings in a .cmd, so awk adds the \r.
win="$tmp/win/Install alienX.cmd"
mkdir -p "$tmp/win"
awk '{ printf "%s\r\n", $0 }' > "$win" <<'CMD'
@echo off
REM Installs alienX into %USERPROFILE%\alienX and opens it. Run it again any time to update.
REM It runs alienX's install script, which you can read first at
REM https://github.com/Dibakar01/alienx/blob/main/install.ps1
powershell -NoProfile -ExecutionPolicy Bypass -Command "irm https://raw.githubusercontent.com/Dibakar01/alienx/main/install.ps1 | iex"
if errorlevel 1 (
  echo.
  echo Something went wrong ^(see above^).
  pause
  exit /b 1
)
CMD
mkdir -p docs/download
rm -f docs/download/alienX-windows.zip
zip -q -j -X docs/download/alienX-windows.zip "$win"
echo "Built docs/download/alienX-windows.zip ($(du -h docs/download/alienX-windows.zip | cut -f1 | tr -d ' '))"

# The alien icon, drawn by headless Chrome from the brand mark.
chrome=${CHROME_BIN:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
[ -x "$chrome" ] || { echo "Google Chrome is needed to draw the icon: $chrome"; exit 1; }
cat > "$tmp/icon.html" <<'HTML'
<html><body style="margin:0;background:transparent"><svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
<rect x="80" y="80" width="864" height="864" rx="200" fill="#D92819"/>
<g transform="translate(212 212) scale(25)"><mask id="m"><path d="M12 2C17.6 2 21 5.4 21 10C21 15.6 16.4 22 12 22C7.6 22 3 15.6 3 10C3 5.4 6.4 2 12 2Z" fill="white"/><path d="M5.2 9Q9.95 9.12 10.8 13.8Q6.05 13.68 5.2 9Z"/><path d="M18.8 9Q14.05 9.12 13.2 13.8Q17.95 13.68 18.8 9Z"/></mask><rect width="24" height="24" fill="#FBFAF8" mask="url(#m)"/></g>
</svg></body></html>
HTML
"$chrome" --headless --hide-scrollbars --force-device-scale-factor=1 --default-background-color=00000000 --window-size=1024,1024 --user-data-dir="$tmp/profile" --screenshot="$tmp/icon.png" "file://$tmp/icon.html" >/dev/null 2>&1 || true
[ -f "$tmp/icon.png" ] || { echo "Chrome did not draw the icon."; exit 1; }

# Set it as the file's custom icon (stored in the file's resource fork and Finder info).
osascript -l JavaScript - "$tmp/icon.png" "$cmd" <<'JS' >/dev/null
ObjC.import('AppKit');
function run(argv) {
  const img = $.NSImage.alloc.initWithContentsOfFile(argv[0]);
  if (!$.NSWorkspace.sharedWorkspace.setIconForFileOptions(img, argv[1], 0)) throw new Error('could not set the icon');
}
JS

# ditto keeps the icon (resource fork) and the executable bit; the zip holds just the file.
mkdir -p "$(dirname "$out")"
rm -f "$out"
ditto -c -k --sequesterRsrc "$cmd" "$out"
echo "Built $out ($(du -h "$out" | cut -f1 | tr -d ' '))"
