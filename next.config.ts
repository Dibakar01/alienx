import type { NextConfig } from "next";

// Every response: no other site may frame alienX (clickjacking on its buttons), no MIME
// sniffing, and no Referer sent to the sites alienX links out to. "same-origin" rather than
// "no-referrer", because no-referrer makes a browser send `Origin: null` on a plain form POST,
// which would fail the same-origin checks on alienX's own requests.
const security = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "same-origin" },
];

// Next's development badge floats over the page and covers its text on a phone.
// Compile and runtime errors are still shown without it.
const nextConfig: NextConfig = {
  devIndicators: false,
  poweredByHeader: false,
  headers: async () => [{ source: "/:path*", headers: security }],
};

export default nextConfig;
