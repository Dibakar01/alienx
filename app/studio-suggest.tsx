"use client";

// alienX managing on the Studio calendar: what it suggests next (from lib/suggest.ts, nothing
// invented), one tap each, and a way to wave each one off for the rest of the day. The row
// sits under the numbers; on a phone it shows one suggestion and folds the rest behind "+N more".
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
  const [more, setMore] = useState(false);
  const shown = more ? list : list.slice(0, 3);
  return (
    <section aria-label="alienX suggests" className="sheet col-span-6 flex min-w-0 items-center gap-2 px-3 py-1.5 md:col-span-5" style={{ "--r": "0.15deg", "--i": 5 } as React.CSSProperties}>
      <span className="flex shrink-0 items-center gap-1 py-1 text-[11px] font-semibold text-muted">
        <Mascot className="size-3.5 text-pencil" />
        <span className="max-sm:sr-only">alienX suggests</span>
      </span>
      {list.length === 0 ? (
        <p className="py-1 text-xs text-muted">Nothing needs you right now.</p>
      ) : (
        <>
          <ul className={`grid min-w-0 flex-1 gap-x-4 gap-y-1 sm:grid-cols-3 ${more ? "max-h-36 overflow-y-auto overscroll-contain sm:max-h-20" : ""}`}>
            {shown.map((s, i) => {
              const busy = s.action.type === "discover" && finding[s.action.handle];
              return (
                <li key={s.id} className={`flex min-w-0 items-start gap-1.5 ${i > 0 && !more ? "max-sm:hidden" : ""}`}>
                  <span className="line-clamp-2 min-w-0 flex-1 text-xs leading-snug text-ink" title={s.text}>
                    {s.text}
                  </span>
                  <button
                    type="button"
                    className={`btn shrink-0 px-2 py-0.5 text-xs ${s.kind === "due" ? "btn-primary" : "btn-dark"}`}
                    onClick={() => onAct(s)}
                    disabled={Boolean(busy)}
                    aria-label={`${s.label}: ${s.text}`}
                  >
                    {busy ? "Finding…" : s.label}
                  </button>
                  <button type="button" className="grid size-6 shrink-0 place-items-center rounded-full text-sm text-muted hover:bg-wash hover:text-ink" onClick={() => onDismiss(s.id)} aria-label={`Not today: ${s.text}`} title="Not today">
                    <span aria-hidden="true">&times;</span>
                  </button>
                </li>
              );
            })}
          </ul>
          {list.length > 1 && (
            <button
              type="button"
              className={`shrink-0 py-1 text-xs font-semibold text-muted underline underline-offset-4 hover:text-ink ${list.length <= 3 && !more ? "sm:hidden" : ""}`}
              onClick={() => setMore((m) => !m)}
              aria-expanded={more}
            >
              {more ? (
                "Less"
              ) : (
                <>
                  <span className="sm:hidden">+{list.length - 1} more</span>
                  <span className="max-sm:hidden">+{list.length - 3} more</span>
                </>
              )}
            </button>
          )}
        </>
      )}
    </section>
  );
}
