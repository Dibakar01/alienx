"use client";

// Find, step 1 of the flow. Look for what is new in the account's world (or wait for the
// Sunday run), pick a topic, draft it; the post lands in the Studio with its picture.
// Laid out in that order: the search on the left, the topics to pick from on the right.
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import type { Post, Topic } from "../lib/db.ts";
import { when } from "../lib/time.ts";
import type { AccountInfo } from "./accounts.tsx";
import { skipTopicAction } from "./actions.ts";
import AnimatedList from "./bits/AnimatedList.tsx";
import { Shiny } from "./bits/ShinyText.tsx";
import { Mascot } from "./mascot.tsx";
import { ViewTitle } from "./title.tsx";

type Reply = { error?: string; topics?: Topic[]; post?: Post };
const call = (body: unknown) =>
  fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json() as Promise<Reply>)
    .catch((e: unknown) => ({ error: String(e) }) as Reply);

const clockOf = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export function Topics({ accounts, topics, onOpenStudio }: { accounts: AccountInfo[]; topics: Topic[]; onOpenStudio?: () => void }) {
  const router = useRouter();
  // When each running job started, so the wait shows honestly as elapsed time.
  const [busy, setBusy] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ text: string } | null>(null);
  const [now, setNow] = useState(0);
  const [, start] = useTransition();
  const working = Object.keys(busy).length > 0;
  const who = accounts.length === 1 ? accounts[0]!.name : accounts.length === 3 ? "all three" : "all accounts";

  useEffect(() => {
    if (!working) return;
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [working]);

  const run = async (key: string, body: unknown): Promise<Reply> => {
    setBusy((b) => ({ ...b, [key]: Date.now() }));
    setErrors((e) => ({ ...e, [key]: "" }));
    const r = await call(body);
    setBusy(({ [key]: _, ...rest }) => rest);
    if (r.error) setErrors((e) => ({ ...e, [key]: r.error! }));
    router.refresh();
    return r;
  };
  const draft = async (t: Topic) => {
    const r = await run(`d:${t.id}`, { id: t.id });
    if (r.post) {
      navigator.vibrate?.(12);
      setDone({ text: `Drafted and scheduled for ${when(r.post.scheduled_at)} IST.` });
    }
  };
  const since = (key: string) => (busy[key] ? clockOf(Math.max(0, Math.round((now - busy[key]) / 1000))) : "");

  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-3 p-2 pb-24 sm:p-3 sm:pb-24 lg:gap-4 lg:px-8 lg:pt-5">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2 pr-14">
        <Mascot blink={working} className="size-8 text-brand" />
        <div className="min-w-0">
          <ViewTitle name="Find" who={who} />
          <p className="text-sm text-snow-muted max-sm:hidden">Step 1: find what is worth saying this week. Then Write, then Studio.</p>
        </div>
      </header>

      <main className="grid min-h-0 gap-4 overflow-y-auto lg:mx-auto lg:w-full lg:max-w-6xl lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)] lg:overflow-visible">
        {/* 1. Look for what is new. */}
        <section aria-labelledby="find-1" className="sheet tape grid content-start gap-3 self-start p-5">
          <h3 id="find-1" className="flex items-baseline gap-2.5 text-lg font-semibold">
            <span className="text-brand">1</span> Look for what&apos;s new
          </h3>
          <p className="text-sm text-muted">
            alienX searches the last two weeks of news, releases and conversations in {accounts.length === 1 ? `${accounts[0]!.name}'s` : "each account's"} world, reads the sources, and proposes a mixed week: a trending moment, a useful lesson, a story and an argument.
          </p>
          <div className="grid gap-2">
            {accounts
              .filter((a) => a.ready)
              .map((a) => {
                const key = `r:${a.handle}`;
                return (
                  <div key={a.handle} className="grid gap-1">
                    <button type="button" className="btn btn-primary py-3 text-base" disabled={Boolean(busy[key])} onClick={() => run(key, { research: a.handle })}>
                      {busy[key] ? <Shiny text={`Searching… ${since(key)}`} /> : accounts.length === 1 ? "Find topics now" : `Find topics for @${a.handle}`}
                    </button>
                    {busy[key] && <p className="text-xs text-muted">Searching the web and reading sources. Usually 3 to 5 minutes; you can switch views meanwhile.</p>}
                    {errors[key] && (
                      <p role="alert" className="text-sm font-semibold">
                        Signal lost. {errors[key]}
                      </p>
                    )}
                  </div>
                );
              })}
          </div>
          <p className="border-t border-line pt-3 text-xs text-muted">It also runs by itself every Sunday at 8 pm, when alienX is running.</p>
        </section>

        {/* 2. Pick one to draft. */}
        <section aria-labelledby="find-2" className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3">
          <h3 id="find-2" className="flex items-baseline gap-2.5 px-1 text-lg font-semibold">
            <span className={topics.length ? "text-brand" : "text-snow-faint"}>2</span> Pick one to draft
            <span className="text-sm font-normal text-snow-muted">{topics.length ? `${topics.length} waiting` : ""}</span>
          </h3>
          {topics.length === 0 ? (
            <div className="sheet sheet-b grid content-center justify-items-center gap-2 self-start px-8 py-10 text-center">
              <Mascot className="size-12 text-pencil" />
              <p className="font-semibold">No topics yet.</p>
              <p className="max-w-sm text-sm text-muted">Find topics, and they land here with their sources and what the reader gets.</p>
            </div>
          ) : (
            <AnimatedList
              items={topics.map((t) => ({ id: t.id, title: t.title }))}
              width="100%"
              // The list scrolls inside the view; the page itself never does.
              maxHeight="calc(100dvh - 12.5rem)"
              showGradients={false}
              frame={false}
              selectOnHover={false}
              gap={12}
              className="h-full"
              renderItem={(_, i) => {
                const t = topics[i]!;
                const key = `d:${t.id}`;
                const [why, takeaway] = t.why.split("\nTakeaway: ");
                return (
                  <article className={`sheet ${i % 2 ? "sheet-b" : "sheet-c"} grid gap-2 px-5 py-4 text-ink`}>
                    <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                      {accounts.length > 1 && <span className="font-semibold text-ink">@{t.handle}</span>}
                      <span className="rounded-[6px] bg-wash px-1.5 py-0.5 font-semibold text-ink">{t.angle}</span>
                      {t.pillar && <span>{t.pillar}</span>}
                    </p>
                    <h4 className="text-lg leading-snug font-bold tracking-[-0.015em]">{t.title}</h4>
                    <p className="text-sm text-muted">
                      <span className="font-semibold text-ink">Why now: </span>
                      {why}
                    </p>
                    {takeaway && (
                      <p className="text-sm">
                        <span className="font-semibold text-brand">The reader gets: </span>
                        {takeaway}
                      </p>
                    )}
                    {t.findings.length > 0 && (
                      <details className="text-sm">
                        <summary className="cursor-pointer text-muted">{t.findings.length === 1 ? "1 source" : `${t.findings.length} sources`}</summary>
                        <ul className="mt-1 grid gap-1">
                          {t.findings.map((f, k) => (
                            <li key={`${k}:${f.url}`} className="min-w-0 truncate">
                              <a href={/^https?:\/\//i.test(f.url) ? f.url : undefined} target="_blank" rel="noreferrer" className="link" onClick={(e) => e.stopPropagation()}>
                                {f.title}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {busy[key] ? (
                        <Shiny text={`Drafting and drawing its picture… ${since(key)}`} className="text-sm font-semibold" />
                      ) : (
                        <>
                          <button type="button" className="btn btn-primary" onClick={() => draft(t)}>
                            Draft this
                          </button>
                          <button type="button" className="btn" onClick={() => start(async () => void (await skipTopicAction(t.id)))}>
                            Skip
                          </button>
                        </>
                      )}
                      {errors[key] && (
                        <p role="alert" className="basis-full text-sm font-semibold">
                          Signal lost. {errors[key]}
                        </p>
                      )}
                    </div>
                  </article>
                );
              }}
            />
          )}
        </section>
      </main>

      {done && (
        <div role="status" className="rise fixed bottom-24 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-card bg-panel px-4 py-2.5 text-sm text-snow shadow-object">
          <span>{done.text}</span>
          {onOpenStudio && (
            <button type="button" className="font-semibold text-snow underline underline-offset-4" onClick={onOpenStudio}>
              See it in Studio
            </button>
          )}
          <button type="button" aria-label="Dismiss" className="text-snow-faint" onClick={() => setDone(null)}>
            ×
          </button>
        </div>
      )}
    </div>
  );
}
