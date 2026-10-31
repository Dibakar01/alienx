// alienX's suggestions waved off with "Not today", shared by every screen (the Studio, Create
// and the dial), so one "not today" means the same everywhere. Only today's count: a new day
// brings everything back. Storage can be missing (private window), so every call is guarded.
const STORE = "alienx.suggest.dismissed"; // { day, ids }

export function readDismissed(today: string): string[] {
  try {
    const saved = JSON.parse(localStorage.getItem(STORE) ?? "null") as { day?: unknown; ids?: unknown } | null;
    return saved?.day === today && Array.isArray(saved.ids) ? saved.ids.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

// Adds one id to today's list, re-reading first so two screens never overwrite each other.
export function dismiss(today: string, id: string): string[] {
  const ids = [...new Set([...readDismissed(today), id])];
  try {
    localStorage.setItem(STORE, JSON.stringify({ day: today, ids }));
  } catch {
    // Nowhere to remember it; it stays hidden until the page reloads.
  }
  return ids;
}
