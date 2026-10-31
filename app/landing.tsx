"use client";

// The landing page, shown once on the way in: what alienX does, in the order you use it,
// each step with a small moving picture in the One Flow scrapbook style. The pictures loop
// slowly and stop under reduced motion. "Get started" leads to choosing who is posting.
import { ICONS } from "../lib/icons.ts";
import { Mascot } from "./mascot.tsx";

type Step = { n: number; title: string; line: string; art: React.ReactNode };

// A Phosphor object drawn small, in ink or red.
const Obj = ({ name, x, y, s, red = false, className = "" }: { name: keyof typeof ICONS; x: number; y: number; s: number; red?: boolean; className?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s / 256})`} className={className}>
    <path d={ICONS[name]} fill={red ? "var(--red)" : "var(--black)"} />
  </g>
);

const STEPS: Step[] = [
  {
    n: 1,
    title: "Discover",
    line: "In Create, it reads what is trending in your world this fortnight and brings you ideas worth saying.",
    art: (
      <svg viewBox="0 0 200 120" className="v-find">
        {[18, 78, 138].map((x, i) => (
          <g key={x}>
            <rect x={x} y={30 + (i % 2) * 8} width="46" height="58" rx="3" fill="var(--paper)" stroke="var(--rule)" />
            <rect x={x + 7} y={42 + (i % 2) * 8} width="32" height="4" rx="2" fill="var(--rule-strong)" />
            <rect x={x + 7} y={52 + (i % 2) * 8} width="24" height="4" rx="2" fill="var(--rule)" />
            {i === 1 && <rect className="hot" x={x} y={38} width="46" height="58" rx="3" fill="var(--red)" />}
          </g>
        ))}
        <g className="glass">
          <Obj name="magnifying-glass" x={10} y={34} s={56} />
        </g>
      </svg>
    ),
  },
  {
    n: 2,
    title: "Draft",
    line: "From an idea or your own thought, five posts in your voice, shaped for X.",
    art: (
      <svg viewBox="0 0 200 120" className="v-write">
        <rect x="30" y="14" width="140" height="92" rx="6" fill="var(--paper)" stroke="var(--rule)" />
        {[34, 50, 66, 82].map((y, i) => (
          <path key={y} className="ink" style={{ animationDelay: `${i * 0.45}s` }} d={`M44 ${y}H${i === 3 ? 110 : 154}`} stroke={i === 0 ? "var(--black)" : "var(--rule-strong)"} strokeWidth={i === 0 ? 5 : 4} strokeLinecap="round" />
        ))}
        <g className="pen">
          <Obj name="pencil-simple" x={138} y={58} s={40} red />
        </g>
      </svg>
    ),
  },
  {
    n: 3,
    title: "Approve",
    line: "Pick one. alienX draws its picture, attaches the sources behind an idea and books its best slot.",
    art: (
      <svg viewBox="0 0 200 120" className="v-pic">
        <g className="pop">
          <g transform="translate(4 4)">
            <Obj name="megaphone" x={52} y={18} s={84} red />
          </g>
          <Obj name="megaphone" x={52} y={18} s={84} />
        </g>
        <path className="arrow" d="M160 24C150 40 146 52 134 62M134 62l2-10M134 62l9-4" fill="none" stroke="var(--pencil)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    n: 4,
    title: "Post",
    line: "It waits on your Studio calendar. Change anything till then; at its time, one tap posts it.",
    art: (
      <svg viewBox="0 0 200 120" className="v-post">
        {Array.from({ length: 7 }, (_, i) => (
          <rect key={i} x={14 + i * 25} y="62" width="21" height="40" rx="3" fill="var(--paper)" stroke="var(--rule)" />
        ))}
        <g className="card">
          <rect x="90" y="64" width="21" height="36" rx="2" fill="var(--white)" stroke="var(--red)" strokeWidth="2" />
          <rect x="94" y="70" width="13" height="8" rx="1" fill="var(--rule-strong)" />
        </g>
        <g className="stamp-art">
          <rect x="58" y="16" width="88" height="30" rx="4" fill="none" stroke="var(--red)" strokeWidth="3" />
          <text x="102" y="37" textAnchor="middle" fontSize="16" fontWeight="700" fill="var(--red)" letterSpacing=".06em">
            POSTED
          </text>
        </g>
      </svg>
    ),
  },
];

export function Landing({ onStart }: { onStart: () => void }) {
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
            Get started
          </button>
          <span className="text-sm text-snow-faint">Runs on your Mac. Free with your Claude plan.</span>
        </div>
      </section>

      <ol className="rise grid content-start gap-5 sm:grid-cols-2 lg:grid-cols-4">
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
