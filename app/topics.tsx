"use client";

// Topics the weekly research proposed, with the sources behind each. Draft one and it lands
// on the Studio with its image; skip it and it is gone. Research can also be run now, per account.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Topic } from "../lib/db.ts";
import type { AccountInfo } from "./accounts.tsx";
import { skipTopicAction } from "./actions.ts";
import AnimatedList from "./bits/AnimatedList.tsx";
import { Shiny } from "./bits/ShinyText.tsx";
import { Mascot } from "./mascot.tsx";
import { ViewTitle } from "./title.tsx";

const call = (body: unknown) =>
  fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })
    .then((r) => r.json() as Promise<{ error?: string; topics?: Topic[] }>)
    .catch((e: unknown) => ({ error: String(e) }));

export function Topics({ accounts, topics }: { accounts: AccountInfo[]; topics: Topic[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, start] = useTransition();

  const run = async (key: string, body: unknown) => {
    setBusy((b) => ({ ...b, [key]: true }));
    setErrors((e) => ({ ...e, [key]: "" }));
    const r = await call(body);
    setBusy((b) => ({ ...b, [key]: false }));
    if (r.error) setErrors((e) => ({ ...e, [key]: r.error! }));
    router.refresh();
  };

  return (
    <div className="grid h-full grid-rows-[auto_1fr] gap-3 p-2 pb-24 sm:p-3 sm:pb-24 lg:gap-4 lg:px-8 lg:pt-5">
      <header className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <Mascot blink={Object.values(busy).some(Boolean)} className="size-8 text-brand" />
        <div className="min-w-0">
          <ViewTitle name="Topics" who={accounts.length === 1 ? accounts[0]!.name : "all three"} />
          <p className="text-sm text-snow-muted">Every Sunday at 8 pm alienX looks for what is trending in each account's world this fortnight and proposes topics with a takeaway. Draft the ones worth saying.</p>
        </div>
        <div className="ml-auto flex flex-wrap gap-2" role="group" aria-label="Research now">
          {accounts
            .filter((a) => a.ready)
            .map((a) => {
              const key = `r:${a.handle}`;
              return (
                <button key={a.handle} type="button" className="btn btn-ground" disabled={busy[key]} onClick={() => run(key, { research: a.handle })} title={errors[key] || undefined}>
                  {busy[key] ? <Shiny text={`Researching @${a.handle}`} className="text-snow" /> : errors[key] ? `@${a.handle}: try again` : `Find topics for @${a.handle}`}
                </button>
              );
            })}
        </div>
        {accounts
          .filter((a) => errors[`r:${a.handle}`])
          .map((a) => (
            <p key={a.handle} role="alert" className="basis-full text-sm font-semibold text-snow">
              Signal lost. @{a.handle}: {errors[`r:${a.handle}`]}
            </p>
          ))}
      </header>

      <main className="min-h-0 lg:mx-auto lg:w-full lg:max-w-4xl">
        {topics.length === 0 ? (
          <div className="grid h-full place-items-center">
            <div className="sheet sheet-b tape grid max-w-md justify-items-center gap-3 px-8 py-7 text-center">
              <Mascot className="size-12 text-pencil" />
              <p className="font-semibold">No topics waiting.</p>
              <p className="text-sm text-muted">The next research run is Sunday at 8 pm. Find topics for an account above to run it now; it takes a few minutes.</p>
            </div>
          </div>
        ) : (
          <AnimatedList
            items={topics.map((t) => ({ id: t.id, title: t.title }))}
            width="100%"
            maxHeight="100%"
            frame={false}
            selectOnHover={false}
            gap={12}
            className="h-full"
            renderItem={(_, i) => {
              const t = topics[i]!;
              const key = `d:${t.id}`;
              return (
                <article className={`sheet ${i % 2 ? "sheet-b" : "sheet-c"} grid gap-2 px-5 py-4 text-ink`}>
                  <p className="flex flex-wrap items-baseline gap-x-2 text-xs text-muted">
                    <span className="font-semibold text-ink">@{t.handle}</span>
                    <span>{t.angle}</span>
                    {t.pillar && <span>{t.pillar}</span>}
                    <span className="ml-auto">week of {t.week}</span>
                  </p>
                  <h3 className="text-lg leading-snug font-bold tracking-[-0.015em]">{t.title}</h3>
                  <p className="text-sm text-muted">{t.why.split("\nTakeaway: ")[0]}</p>
                  {t.why.includes("\nTakeaway: ") && (
                    <p className="text-sm">
                      <span className="font-semibold text-brand">The reader gets: </span>
                      {t.why.split("\nTakeaway: ")[1]}
                    </p>
                  )}
                  {t.findings.length > 0 && (
                    <ul className="grid gap-1 text-sm">
                      {t.findings.map((f) => (
                        <li key={f.url} className="min-w-0 truncate">
                          <a href={/^https?:\/\//i.test(f.url) ? f.url : undefined} target="_blank" rel="noreferrer" className="link" onClick={(e) => e.stopPropagation()}>
                            {f.title}
                          </a>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    {busy[key] ? (
                      <Shiny text="Drafting the post and drawing its image. About a minute." className="text-sm font-semibold" />
                    ) : (
                      <>
                        <button type="button" className="btn btn-primary" onClick={() => run(key, { id: t.id })}>
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
      </main>
    </div>
  );
}
