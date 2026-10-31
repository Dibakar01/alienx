// A view's title: its name with a red pencil line that draws itself each time the view
// is shown, then who it is for. The same on every view, so the screens read as one place.
export function ViewTitle({ name, who }: { name: string; who: string }) {
  return (
    <h2 className="text-xl leading-tight font-bold tracking-[-0.022em]">
      <span className="pencil-mark">
        {name}
        <svg viewBox="0 0 100 10" preserveAspectRatio="none" aria-hidden="true">
          <path d="M1 6.5C18 4.8 33 7.6 50 5.6S82 3.9 99 5.2" />
        </svg>
      </span>{" "}
      <span className="text-snow-muted">· {who}</span>
    </h2>
  );
}
