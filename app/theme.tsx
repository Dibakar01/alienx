"use client";

// Light or dark. Until someone chooses, the page follows the system; a choice is remembered
// on this device and applied before the first paint by the script in layout.tsx.
import { useEffect, useState } from "react";
import { THEME_KEY } from "../lib/theme.ts";

const system = () => (window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark");

export function useTheme(): ["light" | "dark", () => void] {
  const [theme, setTheme] = useState<"light" | "dark">("dark");
  useEffect(() => {
    const read = () => setTheme((document.documentElement.dataset.theme as "light" | "dark" | undefined) ?? system());
    read();
    const m = window.matchMedia("(prefers-color-scheme: light)");
    m.addEventListener("change", read);
    return () => m.removeEventListener("change", read);
  }, []);
  const flip = () => {
    const next = theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Not remembered; it still switches now.
    }
    setTheme(next);
  };
  return [theme, flip];
}

// Sun in the dark, moon in the light: the icon shows where pressing takes you.
export function ThemeIcon({ theme, className = "" }: { theme: "light" | "dark"; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      {theme === "dark" ? (
        <path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
      ) : (
        <path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z" />
      )}
    </svg>
  );
}
