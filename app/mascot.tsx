import { useId } from "react";

// The same three shapes as public/mascot.svg: one head, two eyes cut out of it.
const HEAD = "M12 2C17.6 2 21 5.4 21 10C21 15.6 16.4 22 12 22C7.6 22 3 15.6 3 10C3 5.4 6.4 2 12 2Z";
const EYES = ["M5.2 9Q9.95 9.12 10.8 13.8Q6.05 13.68 5.2 9Z", "M18.8 9Q14.05 9.12 13.2 13.8Q17.95 13.68 18.8 9Z"];

// Drawn through a mask so the eyes are separate shapes and can blink. Colour comes from
// the surrounding text colour.
export function Mascot({ blink = false, className }: { blink?: boolean; className?: string }) {
  const id = useId();
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <mask id={id}>
        <path d={HEAD} fill="white" />
        {EYES.map((d) => (
          <path key={d} d={d} className={blink ? "blink" : undefined} />
        ))}
      </mask>
      <rect width="24" height="24" fill="currentColor" mask={`url(#${id})`} />
    </svg>
  );
}
