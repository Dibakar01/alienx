import { type NextRequest, NextResponse } from "next/server";

// alienX answers only to its own names. A page on another site that rebinds its DNS to
// 127.0.0.1 would send its own Host, and the same-origin checks alone would pass it.
// alienX runs on this Mac only, on any port.
const OWN = /^(127\.0\.0\.1|localhost)(:\d{1,5})?$/;

export function proxy(request: NextRequest) {
  if (!OWN.test(request.headers.get("host") ?? "")) return new NextResponse("Refused.", { status: 403 });
}
