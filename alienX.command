#!/usr/bin/env bash
# Double-click this in Finder to open alienX. The first time, it sets everything up.
cd "$(dirname "$0")"
if [ ! -d node_modules ] || [ ! -f .env ]; then
  bash scripts/setup.sh || { echo; read -r -n1 -p "Something is missing (see above). Press any key to close."; exit 1; }
fi
bash scripts/open.sh
