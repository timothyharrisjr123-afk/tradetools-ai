/**
 * Mobile calendar agenda helpers (pure). The agenda shows today plus days that
 * have work, so an empty month is one empty state instead of 30 repeated rows.
 */

const WEEKDAY = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTH = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

function parseIso(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso ?? ""));
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

function dayNumber(iso: string): number | null {
  const p = parseIso(iso);
  if (!p) return null;
  return Math.round(Date.UTC(p.y, p.m - 1, p.d) / 86_400_000);
}

/** "Thu, Sep 24" — civil date, no timezone shift. */
export function formatAgendaDate(iso: string): string {
  const p = parseIso(iso);
  if (!p) return iso;
  const weekday = new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
  return `${WEEKDAY[weekday]}, ${MONTH[p.m - 1]} ${p.d}`;
}

/** "Today · Thu, Sep 24", "Tomorrow · Fri, Sep 25", or "Mon, Sep 28". */
export function formatAgendaDayLabel(iso: string, todayIso: string): string {
  const date = formatAgendaDate(iso);
  const a = dayNumber(iso);
  const t = dayNumber(todayIso);
  if (a == null || t == null) return date;
  if (a === t) return `Today · ${date}`;
  if (a === t + 1) return `Tomorrow · ${date}`;
  return date;
}

export function buildMobileAgendaDays(input: {
  days: readonly string[];
  todayIso: string;
  hasWork: (iso: string) => boolean;
}): string[] {
  return input.days.filter(
    (iso) => iso === input.todayIso || input.hasWork(iso)
  );
}

/** Default date for the mobile "Schedule work" action. */
export function defaultAgendaScheduleDate(
  days: readonly string[],
  todayIso: string
): string | null {
  if (days.includes(todayIso)) return todayIso;
  return days[0] ?? null;
}
