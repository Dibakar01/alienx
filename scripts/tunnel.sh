#!/bin/zsh
# Puts alienX on https://alienx.qalakaar.com through a Cloudflare Tunnel. Run it yourself,
# once, after creating the Cloudflare Access app for that name and after these two (the
# first opens a browser to sign in to Cloudflare):
#   cloudflared tunnel login
#   cloudflared tunnel create alienx
# It writes ~/.cloudflared/config.yml, points the DNS name at the tunnel and installs the
# tunnel as a login agent. The Host header is left as the browser sent it: alienX's
# same-origin check depends on that, so never add httpHostHeader to the config.
set -euo pipefail
HOST=alienx.qalakaar.com
ID=$(cloudflared tunnel list --output json | /usr/bin/python3 -c 'import json,sys; print(next(t["id"] for t in json.load(sys.stdin) if t["name"]=="alienx"))')
cat > ~/.cloudflared/config.yml <<YML
tunnel: $ID
credentials-file: $HOME/.cloudflared/$ID.json
ingress:
  - hostname: $HOST
    service: http://127.0.0.1:3000
  - service: http_status:404
YML
cloudflared tunnel ingress validate
# The login must exist before the name points anywhere, or the site is briefly public.
read -q "?Is the Cloudflare Access app for $HOST in place (One-time PIN, your emails)? [y/N] " || {
  echo; echo "Create it first: Zero Trust > Access > Applications > Self-hosted > $HOST. Then run this again."; exit 1; }
echo
cloudflared tunnel route dns alienx $HOST
cloudflared service install
echo "Tunnel up. Open https://$HOST in a private window: the Cloudflare login should come first."
