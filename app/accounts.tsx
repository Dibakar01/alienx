"use client";

// Account upkeep, in one overlay over the object: teach an account with real past posts,
// or add a new one. Both reuse the save actions. The overlay is always mounted and only
// opened and closed, so a save keeps running when it is closed.
import { useActionState, useEffect, useState } from "react";
import { type FormState, addSamplesAction, saveAccountAction } from "./actions.ts";
import { startJob } from "./activity.tsx";
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
        <AddAccount hidden={upkeep.mode !== "add"} handles={accounts.map((a) => a.handle)} onDone={onAdded} />
      </div>
    </dialog>
  );
}

function AddAccount({ hidden, handles, onDone }: { hidden: boolean; handles: string[]; onDone: (handle: string) => void }) {
  const [state, action, pending] = useActionState(saveAccountAction, null);
  // The submit button only looks ready once the required fields are filled.
  const [valid, setValid] = useState(false);
  const since = useJobWhile(pending, "Studying a new account's voice");
  useEffect(() => {
    if (state?.handle) onDone(state.handle);
    // Only a new result counts. The form stays mounted, so a fresh onDone each render must not re-fire it.
  }, [state]);

  return (
    <form hidden={hidden} action={action} onInput={(e) => setValid(e.currentTarget.checkValidity())} className="grid gap-4">
      <p className="text-sm text-muted">Give me a handle and something to study: a blog, past posts, or an account to inherit from.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor="handle" className="label">
            Handle
          </label>
          <input id="handle" name="handle" required maxLength={16} placeholder="@handle" autoComplete="off" className="field font-mono" />
        </div>
        <div className="grid gap-2">
          <label htmlFor="display_name" className="label">
            Display name
          </label>
          <input id="display_name" name="display_name" required autoComplete="off" className="field" />
        </div>
        <div className="grid gap-2">
          <label htmlFor="type" className="label">
            Type
          </label>
          <select id="type" name="type" className="field">
            <option value="personal">Personal</option>
            <option value="brand">Brand</option>
          </select>
        </div>
        <div className="grid gap-2">
          <label htmlFor="inherits" className="label">
            Inherits the voice of
          </label>
          <select id="inherits" name="inherits" className="field">
            <option value="">Nobody</option>
            {handles.map((h) => (
              <option key={h} value={h}>
                @{h}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-2">
          <label htmlFor="source_url" className="label">
            Substack or blog URL
          </label>
          <input id="source_url" name="source_url" type="url" placeholder="https://" className="field" />
        </div>
        <div className="grid gap-2">
          <label htmlFor="pillars" className="label">
            Pillars, comma separated
          </label>
          <input id="pillars" name="pillars" placeholder="Tech, Qalakaar" autoComplete="off" className="field" />
        </div>
      </div>
      <div className="grid gap-2">
        <label htmlFor="new_samples" className="label">
          Past X posts, one per line
        </label>
        <textarea id="new_samples" name="x_samples" rows={3} className="field resize-none font-post" />
      </div>
      {/* Coming soon: upload writing to study. A placeholder for now; nothing is sent. */}
      <div className="grid gap-2">
        <span className="label">Or upload writing</span>
        <div aria-disabled="true" className="grid place-items-center gap-1 rounded-[10px] border border-dashed border-strong bg-wash px-4 py-5 text-center">
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-6 text-muted" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
          </svg>
          <span className="text-sm font-semibold text-muted">Drop essays, posts or a PDF here</span>
          <span className="rounded-[6px] bg-paper px-2 py-0.5 text-xs font-semibold text-muted">Coming soon</span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <button type="submit" className="btn btn-dark" disabled={pending || !valid}>
          {pending ? "Studying…" : "Save and study"}
        </button>
        <span className="text-sm text-muted">{pending ? "" : valid ? "" : "Needs a handle and a name."}</span>
      </div>
      {pending && (
        <div className="rounded-[10px] bg-wash p-3">
          <Working compact kind="draft" title="Studying the human." note="Reading the source, then learning the voice. About a minute or two; you can close this and keep working." since={since} />
        </div>
      )}
      <Result state={state} />
    </form>
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
          <Working compact kind="draft" title="Studying the human." note="Adding the posts and rebuilding the voice. About a minute." since={since} />
        </div>
      )}
      <Result state={state} />
    </form>
  );
}
