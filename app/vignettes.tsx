"use client";

// The small moving scrapbook pictures: one for each kind of work alienX does. The landing
// page explains with them, and the loading states show them while that work runs. They
// loop slowly and stand still under reduced motion (styles in globals.css).
import { ICONS } from "../lib/icons.ts";

export type Kind = "discover" | "draft" | "picture" | "post";

// A Phosphor object drawn small, in ink or red.
const Obj = ({ name, x, y, s, red = false, className = "" }: { name: keyof typeof ICONS; x: number; y: number; s: number; red?: boolean; className?: string }) => (
  <g transform={`translate(${x} ${y}) scale(${s / 256})`} className={className}>
    <path d={ICONS[name]} fill={red ? "var(--red)" : "var(--black)"} />
  </g>
);

export function Vignette({ kind }: { kind: Kind }) {
  switch (kind) {
    case "discover":
      return (
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
      );
    case "draft":
      return (
  <svg viewBox="0 0 200 120" className="v-write">
    <rect x="30" y="14" width="140" height="92" rx="6" fill="var(--paper)" stroke="var(--rule)" />
    {[34, 50, 66, 82].map((y, i) => (
      <path key={y} className="ink" style={{ animationDelay: `${i * 0.45}s` }} d={`M44 ${y}H${i === 3 ? 110 : 154}`} stroke={i === 0 ? "var(--black)" : "var(--rule-strong)"} strokeWidth={i === 0 ? 5 : 4} strokeLinecap="round" />
    ))}
    <g className="pen">
      <Obj name="pencil-simple" x={138} y={58} s={40} red />
    </g>
  </svg>
      );
    case "picture":
      return (
  <svg viewBox="0 0 200 120" className="v-pic">
    <g className="pop">
      <g transform="translate(4 4)">
        <Obj name="megaphone" x={52} y={18} s={84} red />
      </g>
      <Obj name="megaphone" x={52} y={18} s={84} />
    </g>
    <path className="arrow" d="M160 24C150 40 146 52 134 62M134 62l2-10M134 62l9-4" fill="none" stroke="var(--pencil)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
      );
    case "post":
      return (
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
      );
  }
}
