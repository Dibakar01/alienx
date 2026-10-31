"use client";

// The landing page, shown once on the way in: what alienX does, in the order you use it,
// each step with a small moving picture in the One Flow scrapbook style. The pictures loop
// slowly and stop under reduced motion. "Get started" leads to choosing who is posting, and
// the steps match the rail inside the app: Who, then 1 Idea, 2 Approve, 3 Studio.
import { Mascot } from "./mascot.tsx";
import { Vignette } from "./vignettes.tsx";

type Step = { n: number; title: string; line: string; art: React.ReactNode };

// The same steps, in the same order and words, as the step rail inside the app.
const STEPS: Step[] = [
  {
    n: 1,
    title: "Idea",
    line: "It reads what is trending in your world this fortnight and brings ideas worth saying. Or write your own.",
    art: <Vignette kind="discover" />,
  },
  {
    n: 2,
    title: "Approve",
    line: "Five drafts in your voice, shaped for X. Approve one: alienX draws its picture, adds the sources and books its best slot.",
    art: <Vignette kind="draft" />,
  },
  {
    n: 3,
    title: "Studio",
    line: "Your calendar. alienX adds one pick a day at a healthy pace. Change anything; at its time, one tap posts it.",
    art: <Vignette kind="post" />,
  },
];

export function Landing({ onStart, cta = "Get started" }: { onStart: () => void; cta?: string }) {
  return (
    <div className="grid h-full grid-rows-[auto_auto_1fr] gap-5 overflow-y-auto p-4 pb-28 sm:p-6 sm:pb-28 lg:gap-7 lg:px-10 lg:pt-8">
      <header className="flex items-center gap-3 pr-14">
        <Mascot className="size-9 text-brand" />
        <span className="text-lg font-bold tracking-[-0.02em]">alienX</span>
      </header>

      <section className="rise grid max-w-3xl gap-3">
        <h2 className="text-4xl leading-[1.05] font-bold tracking-[-0.04em] sm:text-5xl lg:text-6xl">
          alienX writes your X.{" "}
          <span className="pencil-mark text-brand">
            You press post.
            <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
              <path d="M1 6.5C18 4.8 33 7.6 50 5.6S82 3.9 99 5.2" />
            </svg>
          </span>
        </h2>
        <p className="max-w-2xl text-lg text-snow-muted">
          It finds what is trending in your world, writes in your own voice, draws the picture and picks the time. Nothing goes out until you tap.
        </p>
        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button type="button" className="btn btn-primary px-6 py-3 text-base" onClick={onStart}>
            {cta}
          </button>
          <span className="text-sm text-snow-faint">Runs on your Mac. Free with your Claude plan.</span>
        </div>
      </section>

      <ol className="rise grid content-start gap-5 sm:grid-cols-3">
        {STEPS.map((s, i) => (
          <li key={s.n} style={{ "--i": i + 1, "--r": `${(i % 2 ? 1 : -1) * 0.6}deg` } as React.CSSProperties} className={`sheet ${["", "sheet-b", "sheet-c"][i % 3]} grid content-start gap-2 p-5 hover:[rotate:0deg]`}>
            <div className="aspect-[5/3] overflow-hidden rounded-[6px] bg-wash">{s.art}</div>
            <p className="flex items-baseline gap-2 pt-1">
              <span className="text-lg font-bold text-brand tabular-nums">{s.n}</span>
              <span className="text-lg font-bold tracking-[-0.015em]">{s.title}</span>
            </p>
            <p className="text-sm text-muted">{s.line}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
