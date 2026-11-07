import type { Item, ItemType } from "./schemas.js";

export const TYPE_META: Record<ItemType, { label: string; plural: string; emoji: string; color: string }> = {
  flight: { label: "Flight", plural: "Flights", emoji: "✈️", color: "#0ea5e9" },
  lodging: { label: "Stay", plural: "Stays", emoji: "🛏️", color: "#8b5cf6" },
  transfer: { label: "Transfer", plural: "Transfers", emoji: "🚕", color: "#f59e0b" },
  restaurant: { label: "Restaurant", plural: "Restaurants", emoji: "🍽️", color: "#f43f5e" },
  activity: { label: "Activity", plural: "Activities", emoji: "🎟️", color: "#10b981" },
  meetup: { label: "Meetup", plural: "Meetups", emoji: "📍", color: "#d946ef" },
  note: { label: "Note", plural: "Notes", emoji: "📝", color: "#64748b" },
};

export const DAY_PALETTE = ["#0ea5e9", "#f43f5e", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16", "#06b6d4", "#e11d48"];

/** Local calendar date (YYYY-MM-DD) of an ISO datetime in a given IANA tz. */
export function localDate(iso: string, tz: string): string {
  const d = new Date(iso);
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function localTime(iso: string, tz: string, opts: Intl.DateTimeFormatOptions = {}): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit", hour12: false, ...opts }).format(new Date(iso));
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split("-").map(Number);
  const [y2, m2, d2] = b.split("-").map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export function fmtDuration(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return h ? (m ? `${h}h ${m}m` : `${h}h`) : `${m}m`;
}

export function minutesBetween(aIso: string, bIso: string): number {
  return Math.round((new Date(bIso).getTime() - new Date(aIso).getTime()) / 60000);
}

/** Group items into days. Multi-day items (lodging) appear on their start day plus a "stay" marker per covered night. */
export interface DayBucket { date: string; items: Item[]; stays: Item[] }

export function bucketByDay(items: Item[], tripStart?: string | null, tripEnd?: string | null): DayBucket[] {
  const map = new Map<string, DayBucket>();
  const ensure = (date: string) => {
    let b = map.get(date);
    if (!b) { b = { date, items: [], stays: [] }; map.set(date, b); }
    return b;
  };
  if (tripStart && tripEnd) {
    for (let d = tripStart; d <= tripEnd; d = addDays(d, 1)) ensure(d);
  }
  for (const it of items) {
    const sd = localDate(it.startAt, it.tz);
    ensure(sd).items.push(it);
    if (it.type === "lodging" && it.endAt) {
      const ed = localDate(it.endAt, it.endTz ?? it.tz);
      for (let d = sd; d < ed; d = addDays(d, 1)) ensure(d).stays.push(it);
    }
  }
  const out = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
  for (const b of out) b.items.sort((x, y) => new Date(x.startAt).getTime() - new Date(y.startAt).getTime() || x.sortOrder - y.sortOrder);
  return out;
}

export function slugify(s: string): string {
  return s.toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 48) || "trip";
}

export function fmtMoney(amount: number, currency: string): string {
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency, maximumFractionDigits: amount % 1 ? 2 : 0 }).format(amount); }
  catch { return `${amount} ${currency}`; }
}
