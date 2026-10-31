"use client";

// The loading state for real work: a moving picture of the job, what is happening in plain
// words, how long it has taken, and that you can keep going. One look for every wait.
import { useElapsed } from "./activity.tsx";
import { type Kind, Vignette } from "./vignettes.tsx";

export function Working({ kind, title, note, since, compact = false }: { kind: Kind; title: string; note?: string; since?: number; compact?: boolean }) {
  const elapsed = useElapsed(since);
  return (
    <div role="status" aria-live="polite" className={`grid justify-items-center gap-2 text-center ${compact ? "grid-cols-[6rem_minmax(0,1fr)] items-center justify-items-start text-left" : "px-4 py-6"}`}>
      <div className={`overflow-hidden rounded-[8px] bg-wash ${compact ? "row-span-2 w-24" : "w-52"} aspect-[5/3]`}>
        <Vignette kind={kind} />
      </div>
      <p className="font-semibold">
        {title}
        {elapsed && <span className="ml-2 font-normal text-muted tabular-nums">{elapsed}</span>}
      </p>
      {note && <p className={`text-sm text-muted ${compact ? "" : "max-w-sm"}`}>{note}</p>}
    </div>
  );
}
