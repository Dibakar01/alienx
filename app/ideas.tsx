"use client";

// Ideas: what alienX found worth saying, as one surface. Its recommendation (the newest idea not
// tried on this page yet) leads on a taped card; your own words sit right under it; the other ideas
// follow as compact cards. One press on any idea starts its five drafts. Discovering more
// (now, or by itself on Sunday evenings) is the quiet button under the list.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { Topic } from "../lib/db.ts";
import type { AccountInfo } from "./accounts.tsx";
import { skipTopicAction } from "./actions.ts";
import { startJob } from "./activity.tsx";
import { ideaReason } from "./create-pick.ts";
import { Mascot } from "./mascot.tsx";
import { Working } from "./working.tsx";

export function Ideas({
  accounts,
  topics,
  onDraft,
  busy,
  fillOf = {},
  active,
  tried,
  quiet,
  wide,
  composer,
  onTeach,
}: {
  accounts: AccountInfo[];
  topics: Topic[];
  onDraft: (t: Topic) => void;
  // Accounts drafting right now: their ideas wait until the drafts land.
  busy: Record<string, boolean>;
  // The weekday each idea would fill, when alienX would use it for an open day this week.
  fillOf?: Record<number, string>;
  // The idea whose drafts are open, and the ideas already finished with on this page.
  active?: number;
  tried: number[];
  // Something else holds the red: Approve on open drafts, or Write on typed words.
  quiet: boolean;
  // The ideas have the whole sheet: the pick and your own words on the left, the rest on the right.
  wide: boolean;
  composer: React.ReactNode;
  onTeach: () => void;
}) {
  const router = useRouter();
  const [finding, setFinding] = useState<Record<string, number>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [, start] = useTransition();
  const searching = Object.keys(finding).length > 0;
  const ready = accounts.filter((a) => a.ready);
  const multi = accounts.length > 1;
  // alienX's recommendation is the idea it would use to fill an open day this week (the same
  // one the Studio suggests), else the newest one not tried yet.
  const pick = topics.find((t) => fillOf?.[t.id] && !tried.includes(t.id)) ?? topics.find((t) => !tried.includes(t.id)) ?? topics[0];
  const rest = topics.filter((t) => t !== pick);

  const discover = async (handle: string) => {
    const done = startJob({ handle, label: `Finding fresh ideas for @${handle}`, kind: "discover", where: "idea", typical: 240 });
    setFinding((b) => ({ ...b, [handle]: Date.now() }));
    setErrors((e) => ({ ...e, [handle]: "" }));
    const r = (await fetch("/api/plan", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ research: handle }) })
      .then((x) => x.json())
      .catch((e: unknown) => ({ error: String(e) }))) as { error?: string; topics?: unknown[] };
    setFinding(({ [handle]: _, ...others }) => others);
    done(r.error ? { ok: false, text: `No fresh ideas for @${handle} this time.` } : { ok: true, text: `${r.topics?.length ?? "New"} fresh ${r.topics?.length === 1 ? "idea" : "ideas"} for @${handle} ${r.topics?.length === 1 ? "is" : "are"} waiting.` });
    if (r.error) setErrors((e) => ({ ...e, [handle]: r.error! }));
    router.refresh();
  };

  const skip = (t: Topic) => start(async () => void (await skipTopicAction(t.id)));
  // What a card says about its idea's state, when it has one worth saying.
  const state = (t: Topic) => (busy[t.handle] && active === t.id ? "drafting" : active === t.id ? "drafts open" : tried.includes(t.id) ? "drafted" : "");

  return (
    // The bottom padding lets the last idea scroll clear of the activity card above the dock.
    <div
      className={`grid min-h-0 flex-1 content-start gap-5 overflow-x-hidden overflow-y-auto px-1 pt-3 pb-20 ${wide ? "lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:grid-rows-[minmax(0,1fr)] lg:content-stretch lg:gap-7 lg:overflow-y-hidden lg:pt-0 lg:pb-1" : ""}`}
    >
      <div className={`grid content-start gap-4 ${wide ? "lg:min-h-0 lg:overflow-x-hidden lg:overflow-y-auto lg:px-1 lg:pt-3 lg:pb-1" : ""}`}>
        {!ready.length && !multi ? (
          <div className="grid justify-items-start gap-3 rounded-card border border-dashed border-strong p-5">
            <p className="text-lg font-semibold">No voice yet.</p>
            <p className="text-sm text-muted">Give alienX a few real past posts. It studies the voice, then finds ideas and drafts in it.</p>
            <button type="button" className={`btn ${quiet ? "btn-dark" : "btn-primary"}`} onClick={onTeach}>
              Teach the voice with past posts
            </button>
          </div>
        ) : (
          pick && (
            // Keyed by the idea, so a new pick lands with its stamp again.
            <article key={pick.id} aria-labelledby={`idea-${pick.id}`} className="sheet sheet-c tape grid gap-3 px-5 pt-5 pb-4 [--r:-0.5deg] max-sm:px-4">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
                <span className="stamp gap-1.5">
                  <Mascot className="size-4 text-pencil" />
                  alienX recommends
                </span>
                <Meta t={pick} multi={multi} state={state(pick)} />
              </div>
              <h3 id={`idea-${pick.id}`} className="text-xl leading-tight font-bold tracking-[-0.02em] text-balance">
                {pick.title}
              </h3>
              <Takeaway t={pick} className="line-clamp-3 text-[15px] leading-snug" />
              <p className="text-xs text-muted">{ideaReason(pick, pick === topics[0], fillOf[pick.id])}</p>
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pt-1">
                <button
                  id="alienx-pick"
                  type="button"
                  className={`btn px-5 py-3 text-base ${quiet ? "btn-dark" : "btn-primary"}`}
                  disabled={Boolean(busy[pick.handle])}
                  onClick={() => onDraft(pick)}
                >
                  {busy[pick.handle] && active === pick.id ? "Drafting…" : active === pick.id || tried.includes(pick.id) ? "Draft it again" : "Write five drafts"}
                </button>
                <button type="button" className="link text-muted" onClick={() => skip(pick)}>
                  Skip
                </button>
              </div>
            </article>
          )
        )}
        {composer}
      </div>

      <section aria-labelledby="more-ideas" className={`flex flex-col gap-3 ${wide ? "lg:min-h-0 lg:pt-3" : ""}`}>
        <h3 id="more-ideas" className="label flex items-baseline justify-between gap-3">
          {topics.length ? (rest.length ? `More ideas · ${rest.length}` : "No more ideas waiting") : "No ideas waiting"}
        </h3>
        {rest.length > 0 && (
          <ul className={`grid content-start gap-2 ${wide ? "lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1" : ""}`}>
            {rest.map((t) => (
              <li key={t.id} className="relative">
                <button
                  type="button"
                  data-press
                  disabled={Boolean(busy[t.handle])}
                  onClick={() => onDraft(t)}
                  className={`group grid w-full cursor-pointer gap-1 rounded-card border bg-paper p-3 pr-16 text-left hover:border-ink disabled:cursor-default disabled:opacity-60 ${active === t.id ? "border-ink" : "border-line"}`}
                >
                  <Meta t={t} multi={multi} state={state(t)} />
                  <span className="leading-snug font-semibold tracking-[-0.01em]">{t.title}</span>
                  <Takeaway t={t} className="line-clamp-2 text-sm text-muted" />
                  <span aria-hidden="true" className="text-xs font-semibold text-brand opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
                    Write five drafts
                  </span>
                </button>
                <button type="button" className="link absolute top-1.5 right-2.5 text-xs text-muted" aria-label={`Skip: ${t.title}`} onClick={() => skip(t)}>
                  Skip
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Secondary on purpose: the ideas already here come first. */}
        {ready.length > 0 && (
          <div className={`grid gap-2 ${rest.length ? "border-t border-line pt-3" : ""}`}>
            {/* One compact row, so the list above keeps most of the column. */}
            <div role="group" aria-labelledby="discover-label" className="flex flex-wrap items-center gap-1.5">
              <span id="discover-label" className="text-xs font-semibold">
                {multi ? "Discover new ideas for" : "Need more?"}
              </span>
              {ready.map((a) => (
                <button key={a.handle} type="button" className="btn px-2.5 py-1 text-xs" disabled={Boolean(finding[a.handle])} onClick={() => discover(a.handle)}>
                  {finding[a.handle] ? (multi ? `@${a.handle}…` : "Discovering…") : errors[a.handle] ? `Try again${multi ? ` for @${a.handle}` : ""}` : multi ? `@${a.handle}` : "Discover new ideas"}
                </button>
              ))}
            </div>
            {!searching && <p className="text-xs text-muted">From the last two weeks of news. More arrive by themselves on Sundays at 8 pm.</p>}
            {Object.entries(finding).map(([handle, since]) => (
              <div key={handle} className="rounded-card bg-wash p-3">
                <Working
                  compact
                  kind="discover"
                  title={`Finding fresh ideas for @${handle}`}
                  note="Searching the last two weeks, then reading the sources. Usually 3 to 5 minutes; write your own meanwhile."
                  since={since}
                />
              </div>
            ))}
            {ready
              .filter((a) => errors[a.handle])
              .map((a) => (
                <p key={a.handle} role="alert" className="text-sm font-semibold">
                  Signal lost. @{a.handle}: {errors[a.handle]}
                </p>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}

// One line of facts about an idea: whose, which angle, which pillar, how many sources.
function Meta({ t, multi, state }: { t: Topic; multi: boolean; state: string }) {
  return (
    <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
      {multi && <span className="font-semibold text-ink">@{t.handle}</span>}
      <span className="rounded-[6px] bg-wash px-1.5 py-0.5 font-semibold text-ink">{t.angle}</span>
      {t.pillar && <span>{t.pillar}</span>}
      {t.findings.length > 0 && <span>{t.findings.length === 1 ? "1 source" : `${t.findings.length} sources`}</span>}
      {state && <span className="tag">{state}</span>}
    </span>
  );
}

// What the reader gets from the idea; the longer why-now shows on hover.
function Takeaway({ t, className }: { t: Topic; className: string }) {
  const [why, takeaway] = t.why.split("\nTakeaway: ");
  return (
    <span className={className} title={why}>
      {takeaway ? (
        <>
          <span className="font-semibold text-ink">The reader gets: </span>
          {takeaway}
        </>
      ) : (
        why
      )}
    </span>
  );
}
