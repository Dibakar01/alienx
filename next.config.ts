import type { NextConfig } from "next";

// Next's development badge floats over the page and covers its text on a phone.
// Compile and runtime errors are still shown without it.
const nextConfig: NextConfig = { devIndicators: false };

export default nextConfig;
