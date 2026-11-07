import { localDate, localTime } from "@tmt/shared";
export { localDate, localTime };

const pad = (n: number) => String(n).padStart(2, "0");

export function tzOffsetMinutes(tz: string, at: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(at);
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return Math.round((Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - at.getTime()) / 60000);
  } catch { return 0; }
}

/** "YYYY-MM-DDTHH:mm" wall-clock in tz → ISO with offset */
export function localToIso(local: string, tz: string): string {
  if (!local) return "";
  const guess = new Date(local.length === 16 ? local + ":00Z" : local + "Z");
  let off = tzOffsetMinutes(tz, guess);
  let utc = new Date(guess.getTime() - off * 60000);
  off = tzOffsetMinutes(tz, utc);
  const sign = off >= 0 ? "+" : "-", a = Math.abs(off);
  return `${local.slice(0, 16)}:00${sign}${pad(Math.floor(a / 60))}:${pad(a % 60)}`;
}

/** ISO → "YYYY-MM-DDTHH:mm" wall-clock in tz (for datetime-local inputs) */
export function isoToLocal(iso: string | null | undefined, tz: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(d);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${g("year")}-${g("month")}-${g("day")}T${g("hour")}:${g("minute")}`;
}

export function fmtDayLong(ymd: string): string {
  return new Date(ymd + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
}
export function fmtDayShort(ymd: string): string {
  return new Date(ymd + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
}
export function fmtRange(a?: string | null, b?: string | null): string {
  if (!a) return "Dates TBC";
  const o: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", timeZone: "UTC" };
  const s = new Date(a + "T00:00:00Z").toLocaleDateString("en-GB", o);
  if (!b || b === a) return s;
  return `${s} – ${new Date(b + "T00:00:00Z").toLocaleDateString("en-GB", { ...o, year: "numeric" })}`;
}
export function tzAbbrev(tz: string, at: string): string {
  try { return new Intl.DateTimeFormat("en-GB", { timeZone: tz, timeZoneName: "short" }).formatToParts(new Date(at)).find((p) => p.type === "timeZoneName")?.value ?? tz; } catch { return tz; }
}
export function relTime(iso: string): string {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}

export const COMMON_TZ = ["Europe/London", "Europe/Paris", "Europe/Berlin", "Europe/Madrid", "Europe/Rome", "Europe/Lisbon", "Europe/Amsterdam", "Europe/Athens", "Europe/Istanbul", "America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "America/Toronto", "America/Vancouver", "America/Mexico_City", "America/Sao_Paulo", "America/Buenos_Aires", "Asia/Tokyo", "Asia/Seoul", "Asia/Shanghai", "Asia/Hong_Kong", "Asia/Singapore", "Asia/Bangkok", "Asia/Kolkata", "Asia/Dubai", "Asia/Tel_Aviv", "Australia/Sydney", "Australia/Melbourne", "Australia/Perth", "Pacific/Auckland", "Pacific/Honolulu", "Africa/Johannesburg", "Africa/Cairo", "Africa/Nairobi", "UTC"];
export function allTimeZones(): string[] {
  try { const z = (Intl as unknown as { supportedValuesOf?: (k: string) => string[] }).supportedValuesOf?.("timeZone"); if (z?.length) return z; } catch { /* */ }
  return COMMON_TZ;
}
