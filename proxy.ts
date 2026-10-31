import { type NextRequest, NextResponse } from "next/server";

// alienX answers only to its own names. A page on another site that rebinds its DNS to
// 127.0.0.1 would send its own Host, and the same-origin checks alone would pass it.
// The tunnel keeps the public Host (scripts/tunnel.sh never sets httpHostHeader).
// This Mac on any port, or the public name. A rebinding page always arrives under its own name.
const OWN = /^(127\.0\.0\.1|localhost)(:\d{1,5})?$|^alienx\.qalakaar\.com$/;

export function proxy(request: NextRequest) {
  if (!OWN.test(request.headers.get("host") ?? "")) return new NextResponse("Refused.", { status: 403 });
}
