// True when a request was sent by alienX's own page. It compares the Origin's host with the
// host the request was addressed to, the same rule Next applies to server actions, so it
// holds both on 127.0.0.1 and behind the Cloudflare Tunnel (which keeps the public Host).
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === (request.headers.get("x-forwarded-host") ?? request.headers.get("host"));
  } catch {
    return false;
  }
}
