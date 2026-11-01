"use client";

// Account upkeep, in one overlay over the object: teach an account with real past posts,
// or add a new one. Both reuse the save actions. The overlay is always mounted and only
// opened and closed, so a save keeps running when it is closed.
import { useActionState, useEffect, useState } from "react";
import { type FormState, addSamplesAction } from "./actions.ts";
import { startJob } from "./activity.tsx";
import { Onboard } from "./onboard.tsx";
import { Working } from "./working.tsx";

// While a save is studying a voice, it shows in the activity pill on every screen.
function useJobWhile(pending: boolean, label: string) {
  const [since, setSince] = useState(0);
  useEffect(() => {
    if (!pending) return setSince(0);
    setSince(Date.now());
    const done = startJob({ label, kind: "draft", typical: 90 });
    return () => done();
  }, [pending, label]);
  return since;
}

export type AccountInfo = {
  handle: string;
  name: string;
  type: "personal" | "brand";
  // A cut-paper figure for a person, from config/local.json ("headphones" or "glasses").
  figure?: string | null;
  inherits: string | null;
  pillars: string[];
  ready: boolean;
  emoji: boolean;
  banned: string[];
  articles: number;
  samples: number;
  // The account's posting rules from config/slots.json, for the Studio's calendar and stats.
  // Windows are India-time "HH:MM" pairs; weeks run Monday to Sunday.
  cadence: { per_week: number; per_day: number; gap_min: number; weekday: string[][]; weekend: string[][] };
};

// Which form the overlay shows, and which account past posts are for.
export type Upkeep = { mode: "posts" | "add"; who: string };

function Result({ state }: { state: FormState }) {
  if (!state) return null;
  return state.error ? (
    <div className="grid gap-1" role="alert">
      <p className="text-sm font-medium">Signal lost. Try again.</p>
      <p className="font-mono text-xs text-muted">{state.error}</p>
    </div>
  ) : (
    <p className="text-sm text-muted" role="status">
      {state.ok}
    </p>
  );
}

export function Accounts({
  ref,
  accounts,
  upkeep,
  onChange,
  onAdded,
}: {
  ref: React.Ref<HTMLDialogElement>;
  accounts: AccountInfo[];
  upkeep: Upkeep;
  onChange: (next: Upkeep) => void;
  onAdded: (handle: string) => void;
}) {
  // Bumped after each new account, so the next one starts on a fresh sheet.
  const [added, setAdded] = useState(0);
  return (
    <dialog ref={ref} aria-labelledby="accounts-title" className="m-auto max-h-[calc(100dvh-1.5rem)] w-[min(34rem,calc(100%-1.5rem))] overflow-y-auto rounded-object bg-paper p-5 text-ink shadow-object sm:p-6">
      <div className="grid gap-5">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="accounts-title" className="text-lg leading-tight font-medium">
            Accounts
          </h2>
          {/* A dialog form closes the overlay natively; Esc does the same. */}
          <form method="dialog">
            <button className="link">Close</button>
          </form>
        </div>
        <div role="group" aria-label="What to do" className="flex flex-wrap gap-2">
          {(["posts", "add"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={upkeep.mode === mode}
              onClick={() => onChange({ ...upkeep, mode })}
              className={`pill cursor-pointer rounded-card border px-3.5 py-2 text-sm ${upkeep.mode === mode ? "border-brand bg-brand-wash font-medium text-brand" : "border-strong hover:border-ink active:bg-wash"}`}
            >
              {mode === "posts" ? "Add past posts" : "Add an account"}
            </button>
          ))}
        </div>
        <PastPosts hidden={upkeep.mode !== "posts"} accounts={accounts} who={upkeep.who} onWho={(who) => onChange({ ...upkeep, who })} />
        <div hidden={upkeep.mode !== "add"}>
          <Onboard
            key={added}
            handles={accounts.map((a) => a.handle)}
            onDone={(h) => {
              setAdded((k) => k + 1);
              onAdded(h);
            }}
          />
        </div>
      </div>
    </dialog>
  );
}

function PastPosts({ hidden, accounts, who, onWho }: { hidden: boolean; accounts: AccountInfo[]; who: string; onWho: (handle: string) => void }) {
  const [state, action, pending] = useActionState(addSamplesAction, null);
  const since = useJobWhile(pending, "Rebuilding a voice from past posts");
  const [valid, setValid] = useState(false);
  // A saved form is cleared, so it is not ready again until something is pasted.
  useEffect(() => setValid(false), [state]);
  const account = accounts.find((a) => a.handle === who) ?? accounts[0];
  if (!account) return null;
  const voice = account.ready ? (account.inherits && !account.articles && !account.samples ? `voice inherited from @${account.inherits}` : "voice built") : "no voice yet";

  return (
    <form hidden={hidden} action={action} onInput={(e) => setValid(e.currentTarget.checkValidity())} className="grid gap-4">
      <div className="grid gap-2">
        <label htmlFor="samples-for" className="label">
          Account
        </label>
        <select id="samples-for" name="handle" value={account.handle} onChange={(e) => onWho(e.target.value)} className="field font-mono">
          {accounts.map((a) => (
            <option key={a.handle} value={a.handle}>
              @{a.handle}
            </option>
          ))}
        </select>
        <p className="font-mono text-xs text-muted">
          {account.articles} articles / {account.samples} past posts / {voice}
        </p>
      </div>
      <div className="grid gap-2">
        <label htmlFor="samples" className="label">
          Real X posts by this account, one per line
        </label>
        <textarea id="samples" name="x_samples" rows={4} required className="field resize-none font-post" />
        <p className="text-sm text-muted">Real posts teach how this account sounds at 280 characters. They count for more than essays.</p>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="submit" className="btn btn-dark" disabled={pending || !valid}>
          {pending ? "Studying…" : "Add and rebuild"}
        </button>
        <span className="text-sm text-muted">{pending ? "" : valid ? "" : "Paste at least one post."}</span>
      </div>
      {pending && (
        <div className="rounded-[10px] bg-wash p-3">
          <Working compact kind="draft" title="Learning the voice" since={since} typical={60} />
        </div>
      )}
      <Result state={state} />
    </form>
  );
}
