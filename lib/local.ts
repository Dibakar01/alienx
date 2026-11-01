import fs from "node:fs";
import path from "node:path";

// This Mac's own setup, kept out of git (config/local.json): the order the accounts stand in,
// which cut-paper figure a person gets, and posting windows for particular handles. Anything
// left out falls back to the shared defaults, so a fresh install needs no file at all.
export type Local = { order?: string[]; figures?: Record<string, string>; slots?: Record<string, unknown> };

export function readLocal(dir = process.cwd()): Local {
  try {
    const raw = JSON.parse(fs.readFileSync(path.join(dir, "config", "local.json"), "utf8")) as Local;
    return raw && typeof raw === "object" ? raw : {};
  } catch {
    return {};
  }
}

// Accounts in the local order, then the brand ones, then by handle.
export function ordered<T extends { handle: string; type: string }>(accounts: T[], order: string[] = []): T[] {
  const rank = (a: T) => (order.indexOf(a.handle) + 1 || order.length + 1 + (a.type === "brand" ? 0 : 1));
  return [...accounts].sort((a, b) => rank(a) - rank(b) || a.handle.localeCompare(b.handle));
}
