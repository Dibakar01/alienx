// Account avatars, drawn as small cut-paper portraits in the One Flow palette. A brand is the
// alien; a person can be given a figure in config/local.json; anyone else gets their initial.
// Colours come from the theme tokens.
import { Mascot } from "./mascot.tsx";

type Who = { handle: string; name: string; type: "personal" | "brand"; figure?: string | null };

// Shoulders and neck, shared by the portraits.
const BODY = "M14 100C16 78 30 68 50 68S84 78 86 100Z";
const NECK = "M42 58h16v13a8 8 0 0 1-16 0Z";

function Headphones() {
  // Wavy hair swept up, red headphones.
  return (
    <>
      <path d={BODY} fill="var(--black)" />
      <path d={NECK} fill="var(--pencil)" />
      <ellipse cx="50" cy="44" rx="17" ry="20" fill="var(--white)" stroke="var(--black)" strokeWidth="3" />
      <path d="M31 40C30 24 40 16 52 17C64 15 72 24 70 38C66 31 60 29 56 31C51 26 44 27 40 31C36 30 33 34 31 40Z" fill="var(--black)" />
      <path d="M29 46C28 26 72 26 71 46" fill="none" stroke="var(--red)" strokeWidth="4" strokeLinecap="round" />
      <rect x="24" y="42" width="9" height="15" rx="4" fill="var(--red)" />
      <rect x="67" y="42" width="9" height="15" rx="4" fill="var(--red)" />
      <path d="M44 55c3 2 9 2 12 0" fill="none" stroke="var(--pencil)" strokeWidth="2.5" strokeLinecap="round" />
    </>
  );
}

function Glasses() {
  // Neat side-parted hair, square glasses, a red code bracket on the shirt.
  return (
    <>
      <path d={BODY} fill="var(--black)" />
      <path d={NECK} fill="var(--pencil)" />
      <ellipse cx="50" cy="44" rx="16" ry="19" fill="var(--white)" stroke="var(--black)" strokeWidth="3" />
      <path d="M33 40C32 26 42 21 52 22C62 21 69 28 67 40C63 34 55 31 46 33C41 33 36 35 33 40Z" fill="var(--black)" />
      <rect x="37.5" y="40" width="11" height="8" rx="2" fill="none" stroke="var(--black)" strokeWidth="2.5" />
      <rect x="51.5" y="40" width="11" height="8" rx="2" fill="none" stroke="var(--black)" strokeWidth="2.5" />
      <path d="M48.5 43h3" stroke="var(--black)" strokeWidth="2.5" />
      <path d="M44 85l-6 6 6 6M56 85l6 6-6 6" fill="none" stroke="var(--red)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

const FIGURES: Record<string, () => React.ReactNode> = { headphones: Headphones, glasses: Glasses };

export function Avatar({ who, size = 48, className = "" }: { who: Who; size?: number; className?: string }) {
  const Portrait = who.figure ? FIGURES[who.figure] : undefined;
  const box = { width: size, height: size };
  if (who.type === "brand")
    return (
      <span style={box} className={`grid shrink-0 place-items-center rounded-full bg-brand ${className}`} aria-hidden="true">
        <Mascot className="size-[62%] text-paper" />
      </span>
    );
  if (Portrait)
    return (
      <svg viewBox="0 0 100 100" style={box} className={`shrink-0 overflow-hidden rounded-full bg-wash ${className}`} aria-hidden="true">
        <Portrait />
      </svg>
    );
  return (
    <span style={{ ...box, fontSize: size * 0.42 }} className={`grid shrink-0 place-items-center rounded-full bg-ink font-bold text-paper ${className}`} aria-hidden="true">
      {who.name.slice(0, 1)}
    </span>
  );
}
