"use client";

// Make your account: one torn sheet, three steps. The X account you post to, what you post
// about, and how you sound, the last two picked as tags (tap a suggestion or type your own).
// Writing to study, facts and a voice to inherit are optional, folded under "Teach it more".
// The voice is built from your writing when you give some, and from the style tags when not.
import { useEffect, useRef, useState, useTransition } from "react";
import { type FormState, saveAccountAction } from "./actions.ts";
import { startJob } from "./activity.tsx";
import { Mascot } from "./mascot.tsx";
import { Working } from "./working.tsx";

const TOPICS = ["Tech", "AI", "Design", "Startups", "Music", "Film", "Culture", "Growth", "Product", "Writing"];
const STYLES = ["Plainspoken", "Witty", "Warm", "Bold", "Story-led", "Short lines", "Asks questions", "Curious", "Calm", "No emoji"];
const MAX_TOPICS = 6;
const MAX_STYLE = 5;

export function Onboard({ first = false, handles = [], onDone }: { first?: boolean; handles?: string[]; onDone: (handle: string) => void }) {
  // Submitted by hand, not <form action>, so a failed save keeps what was typed.
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const form = useRef<HTMLFormElement>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [style, setStyle] = useState<string[]>([]);
  const [type, setType] = useState<"personal" | "brand">("personal");
  const [named, setNamed] = useState(false);
  const [studied, setStudied] = useState(false);
  const [since, setSince] = useState(0);

  useEffect(() => {
    if (!pending) return setSince(0);
    setSince(Date.now());
    // On the front door the bar is right here; from the accounts overlay, which can be closed,
    // it also shows above the dock.
    if (!first) return startJob({ label: "Learning a new voice", kind: "draft", typical: 70 });
  }, [pending, first]);
  useEffect(() => {
    if (!state?.handle) return;
    // Saved: clear the sheet for the next account, then hand over.
    form.current?.reset();
    setTopics([]);
    setStyle([]);
    setType("personal");
    setNamed(false);
    setStudied(false);
    onDone(state.handle);
    // Only a new result counts; a fresh onDone each render must not re-fire it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  const ready = named && (style.length > 0 || studied || handles.length > 0);

  return (
    <form
      ref={form}
      onSubmit={(e) => {
        e.preventDefault();
        const data = new FormData(e.currentTarget);
        start(async () => setState(await saveAccountAction(state, data)));
      }}
      onInput={(e) => {
        const f = e.currentTarget;
        setNamed(Boolean((f.elements.namedItem("handle") as HTMLInputElement).validity.valid && (f.elements.namedItem("display_name") as HTMLInputElement).value.trim()));
        setStudied(Boolean((f.elements.namedItem("source_url") as HTMLInputElement).value.trim() || (f.elements.namedItem("x_samples") as HTMLTextAreaElement).value.trim()));
      }}
      className={`grid w-full gap-5 ${first ? "sheet tape max-w-lg px-5 pt-7 pb-5 sm:px-7" : ""}`}
    >
      {first && (
        <header className="flex items-center gap-3">
          <Mascot className="size-9 text-brand" />
          <h2 className="text-2xl font-bold tracking-[-0.03em]">Make your account</h2>
        </header>
      )}

      <Step n={1} title="Your X account">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="sr-only">X handle</span>
            <span className="field flex items-center gap-0.5 font-mono focus-within:outline-2 focus-within:outline-brand">
              <span className="text-muted">@</span>
              <input name="handle" required pattern="@?[A-Za-z0-9_]{1,15}" maxLength={16} placeholder="handle" autoComplete="off" className="min-w-0 flex-1 bg-transparent outline-none" />
            </span>
          </label>
          <label className="grid gap-1">
            <span className="sr-only">Name</span>
            <input name="display_name" required maxLength={50} placeholder="Name" autoComplete="off" className="field" />
          </label>
        </div>
        <input type="hidden" name="type" value={type} />
        <span className="segmented justify-self-start" style={{ "--at": type === "personal" ? 0 : 1 } as React.CSSProperties} role="group" aria-label="Kind of account">
          <span aria-hidden="true" />
          <button type="button" aria-pressed={type === "personal"} onClick={() => setType("personal")}>
            A person
          </button>
          <button type="button" aria-pressed={type === "brand"} onClick={() => setType("brand")}>
            A brand
          </button>
        </span>
      </Step>

      <Step n={2} title="What you post about" count={`${topics.length}/${MAX_TOPICS}`}>
        <Tags name="pillars" picked={topics} onChange={setTopics} options={TOPICS} max={MAX_TOPICS} placeholder="Add a topic" />
      </Step>

      <Step n={3} title="How you sound" count={`${style.length}/${MAX_STYLE}`}>
        <Tags name="style" picked={style} onChange={setStyle} options={STYLES} max={MAX_STYLE} placeholder="Add a word" />
      </Step>

      <details className="group rounded-card border border-line px-3.5 py-2.5 open:pb-3.5">
        <summary className="cursor-pointer list-none text-sm font-semibold text-muted group-open:text-ink">
          <span className="inline-block transition-transform group-open:rotate-90">›</span> Teach it more <span className="font-normal">(optional)</span>
        </summary>
        <div className="grid gap-3 pt-3">
          <input name="source_url" type="url" placeholder="Your blog or Substack, https://…" className="field" />
          <textarea name="x_samples" rows={3} placeholder="Past X posts, one per line" className="field resize-none font-post" />
          <textarea name="facts" rows={3} maxLength={4000} placeholder="Facts alienX may say about you or your company" className="field resize-none" />
          {handles.length > 0 && (
            <select name="inherits" className="field" defaultValue="">
              <option value="">Its own voice</option>
              {handles.map((h) => (
                <option key={h} value={h}>
                  Sound like @{h}
                </option>
              ))}
            </select>
          )}
        </div>
      </details>

      {pending ? (
        <div className="rounded-card bg-wash p-3">
          <Working compact kind="draft" title="Learning your voice" since={since} typical={70} />
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" className="btn btn-primary px-6 py-3 text-base" disabled={!ready}>
            Make my account
          </button>
          {state?.error && (
            <p role="alert" className="min-w-0 flex-1 text-sm font-semibold">
              {state.error}
            </p>
          )}
        </div>
      )}
    </form>
  );
}

function Step({ n, title, count, children }: { n: number; title: string; count?: string; children: React.ReactNode }) {
  return (
    <fieldset className="grid gap-2.5">
      <legend className="mb-2.5 flex w-full items-baseline gap-2">
        <span className="text-lg font-bold text-brand tabular-nums">{n}</span>
        <span className="font-bold tracking-[-0.01em]">{title}</span>
        {count && <span className="ml-auto text-xs text-muted tabular-nums">{count}</span>}
      </legend>
      {children}
    </fieldset>
  );
}

// Tag chips: tap a suggestion to add or remove it, or type your own and press Enter or a comma.
function Tags({ name, picked, onChange, options, max, placeholder }: { name: string; picked: string[]; onChange: (t: string[]) => void; options: string[]; max: number; placeholder: string }) {
  const [typed, setTyped] = useState("");
  const has = (t: string) => picked.some((p) => p.toLowerCase() === t.toLowerCase());
  const toggle = (t: string) => onChange(has(t) ? picked.filter((p) => p.toLowerCase() !== t.toLowerCase()) : picked.length < max ? [...picked, t] : picked);
  const add = () => {
    const t = typed.replace(/[<>{}[\]`,]/g, "").replace(/\s+/g, " ").trim().slice(0, 32);
    if (t && !has(t) && picked.length < max) onChange([...picked, t]);
    setTyped("");
  };
  const all = [...options, ...picked.filter((p) => !options.some((o) => o.toLowerCase() === p.toLowerCase()))];
  return (
    <div className="flex flex-wrap gap-1.5">
      <input type="hidden" name={name} value={picked.join(",")} />
      {all.map((t) => {
        const on = has(t);
        return (
          <button
            key={t}
            type="button"
            aria-pressed={on}
            disabled={!on && picked.length >= max}
            onClick={() => toggle(t)}
            className={`pill min-h-9 rounded-full border px-3 text-sm transition-[rotate,background-color] [transition-timing-function:var(--spring)] disabled:opacity-40 ${on ? "-rotate-2 border-ink bg-ink font-semibold text-paper" : "border-strong bg-paper hover:border-ink"}`}
          >
            {t}
          </button>
        );
      })}
      <input
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") (e.preventDefault(), add());
        }}
        onBlur={add}
        disabled={picked.length >= max}
        maxLength={32}
        placeholder={placeholder}
        aria-label={placeholder}
        className="field min-h-9 w-32 rounded-full px-3 py-1 text-sm"
      />
    </div>
  );
}
