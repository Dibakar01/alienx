// Time-zone arithmetic from Intl alone. No imports, so the browser can use it too.

// Wall-clock day, weekday and minute of an instant in a time zone, from Intl alone.
export function local(t: Date, zone: string): { day: string; weekend: boolean; minutes: number } {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", { timeZone: zone, year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" })
      .formatToParts(t)
      .map((p) => [p.type, p.value]),
  );
  return { day: `${parts.year}-${parts.month}-${parts.day}`, weekend: parts.weekday === "Sat" || parts.weekday === "Sun", minutes: Number(parts.hour) * 60 + Number(parts.minute) };
}

// The instant a wall-clock day and minute fall on in a zone.
// ponytail: one offset lookup, exact for zones without daylight saving (IST). Near a DST
// switch elsewhere it can be an hour off; look the offset up twice if that ever matters.
export function at(day: string, minutes: number, zone: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  const naive = Date.UTC(y, m - 1, d, 0, minutes); // the wall time read as if it were UTC
  const shown = local(new Date(naive), zone);
  const [sy, sm, sd] = shown.day.split("-").map(Number) as [number, number, number];
  const offset = Date.UTC(sy, sm - 1, sd, 0, shown.minutes) - naive; // how far the zone runs ahead of UTC
  return new Date(naive - offset);
}

// The day after a wall-clock day, as YYYY-MM-DD.
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

// alienX schedules in India time.
export const ZONE = "Asia/Kolkata";

// "8:45 pm", "Mon 2 Nov" and "Mon 2 Nov, 8:45 pm" in IST.
export const clock = (iso: string) => new Intl.DateTimeFormat("en-IN", { timeZone: ZONE, hour: "numeric", minute: "2-digit" }).format(new Date(iso));
export const dayName = (day: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "UTC", ...opts }).format(new Date(`${day}T00:00:00Z`));
export const when = (iso: string) => `${dayName(local(new Date(iso), ZONE).day)}, ${clock(iso)}`;
