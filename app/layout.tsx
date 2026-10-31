import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";
import Script from "next/script";
import { themeScript } from "../lib/theme.ts";

// One Flow's only typeface.
const outfit = Outfit({ subsets: ["latin"], variable: "--font-outfit" });

export const metadata: Metadata = { title: "alienX" };

// The page is the dark ground. Everything on it, the mascot mark included, is drawn by the views.
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // The theme script may set data-theme before React runs, so the attribute can differ from the server's.
    <html lang="en" className={outfit.variable} suppressHydrationWarning>

      <body className="bg-ground font-sans text-[15px] leading-normal tracking-[-0.006em] text-snow antialiased">
        <Script id="alienx-theme" strategy="beforeInteractive">
          {themeScript}
        </Script>
        {children}
      </body>
    </html>
  );
}
