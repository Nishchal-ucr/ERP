/** Today's calendar date in local timezone as YYYY-MM-DD (for `<input type="date">`). */
export function todayIsoLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Convert API `reportDate` (YYYYMMDD integer) to YYYY-MM-DD. */
export function yyyymmddToIso(n: number): string {
  const s = String(Math.floor(n));
  if (s.length !== 8 || !/^\d{8}$/.test(s)) {
    return todayIsoLocal();
  }
  return `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
}

export function clampIsoDate(date: string, min: string, max: string): string {
  const lo = min <= max ? min : max;
  const hi = min <= max ? max : min;
  if (date < lo) return lo;
  if (date > hi) return hi;
  return date;
}
