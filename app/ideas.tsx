"use client";

// Ideas: the first half of Create. alienX discovers what is new in the account's world
// (now, or by itself on Sunday evenings) and lists ideas worth saying, each with why now,
// what the reader gets and its sources. "Draft this idea" hands it to the drafting step.
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { Topic } from "../lib/db.ts";
import type { AccountInfo } from "./accounts.tsx";
import { skipTopicAction } from "./actions.ts";
import { Shiny } from "./bits/ShinyText.tsx";

const clockOf = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function Ideas({ accounts, topics, onDraft, drafting }: { accounts: AccountInfo[]; topics: Topic[]; onDraft: (t: Topic) => void; drafting: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [now, setNow] = useState(0);
  const [, start] = useTransition();
  const searching = Object.keys(busy).length > 0;
  const voiced = accounts.some((a) => a.ready);

  useEffect(() => {
    if (!searching) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [searching]);

  const discover = async (handle: string) => {
    setBusy((b) => ({ ...b, [handle]: Date.now() }));
    setErrors((e) => ({ ...e, [handle]: "" }));
    const r = (await fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ research: handle }) })
      .then((x) => x.json())
      .catch((e: unknown) => ({ error: String(e) }))) as { error?: string };
    setBusy(({ [handle]: _, ...rest }) => rest);
    if (r.error) setErrors((e) => ({ ...e, [handle]: r.error! }));
    router.refresh();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="grid gap-1.5">
        <div className="flex flex-wrap gap-2">
          {accounts
            .filter((a) => a.ready)
            .map((a) => (
              <button key={a.handle} type="button" className="btn" disabled={Boolean(busy[a.handle])} onClick={() => discover(a.handle)}>
                {busy[a.handle] ? (
                  <Shiny text={`Discovering… ${clockOf(Math.max(0, Math.round((now - busy[a.handle]!) / 1000)))}`} />
                ) : accounts.length === 1 ? (
                  "Discover new ideas"
                ) : (
                  `Discover for @${a.handle}`
                )}
              </button>
            ))}
        </div>
        {voiced && (
          <p className="text-xs text-muted">
            {searching
              ? "Reading the last two weeks of news and conversations. Usually 3 to 5 minutes; you can keep working."
              : "Ideas trending in your world this fortnight, a mix of angles. New ones arrive by themselves on Sundays at 8 pm."}
          </p>
        )}
        {accounts
          .filter((a) => errors[a.handle])
          .map((a) => (
            <p key={a.handle} role="alert" className="text-sm font-semibold">
              Signal lost. @{a.handle}: {errors[a.handle]}
            </p>
          ))}
      </div>

      {topics.length === 0 ? (
        <div className="grid flex-1 place-items-center rounded-[10px] border border-dashed border-line p-6 text-center text-sm text-muted">
          {voiced ? "No ideas waiting. Discover some, or write your own." : "No voice yet. Teach it with past posts, then discover ideas."}
        </div>
      ) : (
        <ul className="grid min-h-0 flex-1 content-start gap-2.5 overflow-y-auto pr-1">
          {topics.map((t) => {
            const [why, takeaway] = t.why.split("\nTakeaway: ");
            return (
              <li key={t.id} className="grid gap-1.5 rounded-[10px] border border-line bg-paper p-3.5">
                <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                  {accounts.length > 1 && <span className="font-semibold text-ink">@{t.handle}</span>}
                  <span className="rounded-[6px] bg-wash px-1.5 py-0.5 font-semibold text-ink">{t.angle}</span>
                  {t.pillar && <span>{t.pillar}</span>}
                  {t.findings.length > 0 && <span>{t.findings.length === 1 ? "1 source" : `${t.findings.length} sources`}</span>}
                </p>
                <p className="leading-snug font-bold tracking-[-0.01em]">{t.title}</p>
                <p className="line-clamp-2 text-sm text-muted" title={why}>
                  {takeaway ? (
                    <>
                      <span className="font-semibold text-brand">The reader gets: </span>
                      {takeaway}
                    </>
                  ) : (
                    why
                  )}
                </p>
                <div className="flex items-center gap-2 pt-0.5">
                  <button type="button" className="btn btn-primary" disabled={drafting} onClick={() => onDraft(t)}>
                    Draft this idea
                  </button>
                  <button type="button" className="link" onClick={() => start(async () => void (await skipTopicAction(t.id)))}>
                    Skip
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
