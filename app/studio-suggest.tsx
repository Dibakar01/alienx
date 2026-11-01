"use client";

// alienX managing on the Studio calendar: what it suggests next (from lib/suggest.ts, nothing
// invented), one tap each, and a way to wave each one off for the rest of the day. One small
// button at the end of the numbers; the list opens over the page.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Post, Topic } from "../lib/db.ts";
import { type Suggestion, suggest } from "../lib/suggest.ts";
import type { AccountInfo } from "./accounts.tsx";
import { startJob } from "./activity.tsx";
import { dismiss as dismissFor, readDismissed } from "./dismissed.ts";
import { Mascot } from "./mascot.tsx";

// The suggestions still worth showing, how to dismiss one, and discovering ideas as a job.
export function useSuggestions(accounts: AccountInfo[], posts: Post[], topics: Topic[], nowMs: number, today: string) {
  const router = useRouter();
  // Read at once (the shell never server-renders a profile), so nothing dismissed flashes back.
  const [hidden, setHidden] = useState<string[]>(() => readDismissed(today));
  const [finding, setFinding] = useState<Record<string, true>>({});

  useEffect(() => setHidden(readDismissed(today)), [today]);

  const dismiss = (id: string) => setHidden(dismissFor(today, id));

  const discover = async (handle: string) => {
    if (finding[handle]) return;
    setFinding((f) => ({ ...f, [handle]: true }));
    const done = startJob({ handle, label: `Finding fresh ideas for @${handle}`, kind: "discover", where: "idea", typical: 240 });
    const r = (await fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ research: handle }) })
      .then((x) => x.json())
      .catch((e: unknown) => ({ error: String(e) }))) as { error?: string; topics?: unknown[] };
    const n = r.topics?.length;
    done(r.error ? { ok: false, text: `No fresh ideas for @${handle} this time.` } : { ok: true, text: `${n ?? "New"} fresh ${n === 1 ? "idea" : "ideas"} for @${handle} ${n === 1 ? "is" : "are"} waiting in Create.` });
    setFinding(({ [handle]: _, ...rest }) => rest);
    router.refresh();
  };

  const list = suggest(accounts, posts, topics, new Date(nowMs)).filter((s) => !hidden.includes(s.id));
  return { list, dismiss, discover, finding };
}

export function Suggestions({
  list,
  finding,
  onAct,
  onDismiss,
}: {
  list: Suggestion[];
  finding: Record<string, true>;
  onAct: (s: Suggestion) => void;
  onDismiss: (id: string) => void;
}) {
  if (list.length === 0) return null; // nothing to suggest: no button at all
  return (
    <>
      {/* One small button: the alien and how many ideas it has; the list opens over the page. */}
      <button
        type="button"
        popoverTarget="alienx-suggests"
        className="suggest-anchor flex items-center gap-1.5 rounded-card border border-line px-2 py-1 text-ink hover:border-strong"
        aria-label={`alienX suggests ${list.length} ${list.length === 1 ? "thing" : "things"}`}
        title="alienX suggests"
      >
        <Mascot className="size-4 text-brand" />
        <span aria-hidden="true">{list.length}</span>
      </button>
      <section id="alienx-suggests" popover="auto" aria-label="alienX suggests" className="suggest-pop">
        <ul className="grid gap-2">
          {list.map((s) => {
            const busy = s.action.type === "discover" && finding[s.action.handle];
            return (
              <li key={s.id} className="flex min-w-0 items-center gap-2">
                <span className="min-w-0 flex-1 text-sm">{s.text}</span>
                <button type="button" className="btn shrink-0 px-2 py-0.5 text-xs" onClick={() => onAct(s)} disabled={Boolean(busy)} aria-label={`${s.label}: ${s.text}`}>
                  {busy ? "Finding…" : s.label}
                </button>
                <button type="button" className="grid size-6 shrink-0 place-items-center rounded-full text-sm text-muted hover:bg-wash hover:text-ink" onClick={() => onDismiss(s.id)} aria-label={`Not today: ${s.text}`} title="Not today">
                  <span aria-hidden="true">&times;</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </>
  );
}
