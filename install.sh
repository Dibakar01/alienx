#!/usr/bin/env bash
# Installs alienX on a Mac in one line:
#   curl -fsSL https://raw.githubusercontent.com/Dibakar01/alienx/main/install.sh | bash
# Puts it in ~/alienX, sets it up, adds an alienX app to ~/Applications and opens it.
# Run it again to update. ALIENX_HOME, ALIENX_REPO and ALIENX_APPS override the defaults.
set -euo pipefail
repo=${ALIENX_REPO:-https://github.com/Dibakar01/alienx.git}
home=${ALIENX_HOME:-$HOME/alienX}
command -v git >/dev/null 2>&1 || { echo "First install Apple's command line tools:  xcode-select --install"; exit 1; }
if [ -d "$home/.git" ]; then
  echo "Updating alienX in $home"
  git -C "$home" pull --ff-only --quiet
else
  echo "Downloading alienX to $home"
  git clone --quiet --depth 1 "$repo" "$home"
fi
bash "$home/scripts/setup.sh"
bash "$home/scripts/make-app.sh"
bash "$home/scripts/open.sh"
echo "Done. Next time, open alienX from your Applications folder or Spotlight."
