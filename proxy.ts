import { type NextRequest, NextResponse } from "next/server";

// alienX answers only to its own names. A page on another site that rebinds its DNS to
// 127.0.0.1 would send its own Host, and the same-origin checks alone would pass it.
// The tunnel keeps the public Host (scripts/tunnel.sh never sets httpHostHeader).
const HOSTS = new Set(["127.0.0.1:3000", "localhost:3000", "alienx.qalakaar.com"]);

export function proxy(request: NextRequest) {
  if (!HOSTS.has(request.headers.get("host") ?? "")) return new NextResponse("Refused.", { status: 403 });
}
