// True when a request was sent by alienX's own page. It compares the Origin's host with the
// host the request was addressed to, the same rule Next applies to server actions.
export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === request.headers.get("host");
  } catch {
    return false;
  }
}
