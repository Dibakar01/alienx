#!/usr/bin/env bash
# Makes "alienX" a real Mac app (in ~/Applications, with the alien icon). Clicking it opens
# alienX: it starts in the background if needed and opens in your browser. Run it again
# after moving this folder. ALIENX_APPS overrides where the app goes.
set -euo pipefail
cd "$(dirname "$0")/.."
root=$(pwd)
apps=${ALIENX_APPS:-$HOME/Applications}
app="$apps/alienX.app"
mkdir -p "$apps"

# The app runs with a bare PATH, so it carries this shell's, where node, npx and claude live.
script="do shell script \"export PATH=\" & quoted form of \"$PATH\" & \"; bash \" & quoted form of \"$root/scripts/open.sh\""
osacompile -o "$app" -e "$script"

# The alien as the app icon, drawn by Chrome from the brand mark (skipped if Chrome is missing).
chrome=${CHROME_BIN:-"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"}
if [ -x "$chrome" ]; then
  tmp=$(mktemp -d)
  cat > "$tmp/icon.html" <<'HTML'
<html><body style="margin:0;background:transparent"><svg width="1024" height="1024" viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg">
<rect x="80" y="80" width="864" height="864" rx="200" fill="#D92819"/>
<g transform="translate(212 212) scale(25)"><mask id="m"><path d="M12 2C17.6 2 21 5.4 21 10C21 15.6 16.4 22 12 22C7.6 22 3 15.6 3 10C3 5.4 6.4 2 12 2Z" fill="white"/><path d="M5.2 9Q9.95 9.12 10.8 13.8Q6.05 13.68 5.2 9Z"/><path d="M18.8 9Q14.05 9.12 13.2 13.8Q17.95 13.68 18.8 9Z"/></mask><rect width="24" height="24" fill="#FBFAF8" mask="url(#m)"/></g>
</svg></body></html>
HTML
  "$chrome" --headless --hide-scrollbars --force-device-scale-factor=1 --default-background-color=00000000 --window-size=1024,1024 --user-data-dir="$tmp/profile" --screenshot="$tmp/icon.png" "file://$tmp/icon.html" >/dev/null 2>&1 || true
  if [ -f "$tmp/icon.png" ]; then
    mkdir -p "$tmp/alienX.iconset"
    for s in 16 32 128 256 512; do
      sips -z $s $s "$tmp/icon.png" --out "$tmp/alienX.iconset/icon_${s}x${s}.png" >/dev/null
      sips -z $((s * 2)) $((s * 2)) "$tmp/icon.png" --out "$tmp/alienX.iconset/icon_${s}x${s}@2x.png" >/dev/null
    done
    iconutil -c icns "$tmp/alienX.iconset" -o "$app/Contents/Resources/applet.icns"
    # Newer macOS reads the icon from Assets.car when CFBundleIconName is set; drop both so
    # applet.icns (the alien) is used, then re-sign the app locally.
    /usr/libexec/PlistBuddy -c "Delete :CFBundleIconName" "$app/Contents/Info.plist" 2>/dev/null || true
    rm -f "$app/Contents/Resources/Assets.car"
    codesign --force --deep --sign - "$app" >/dev/null 2>&1 || true
    touch "$app"
  fi
  rm -r "$tmp"
fi
echo "alienX app ready: $app (also in Spotlight and Launchpad)."
