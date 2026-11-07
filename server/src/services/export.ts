import { bucketByDay, fmtDuration, fmtMoney, localTime, minutesBetween, TYPE_META, type Item, type TripDetail } from "@tmt/shared";

const fmtDay = (ymd: string) => new Date(ymd + "T00:00:00Z").toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export function tripToMarkdown(t: TripDetail, opts: { includeIds?: boolean } = {}): string {
  const lines: string[] = [];
  lines.push(`# ${t.emoji} ${t.name}`);
  if (t.startDate && t.endDate) lines.push(`${fmtDay(t.startDate)} → ${fmtDay(t.endDate)}`);
  if (t.description) lines.push("", t.description);
  lines.push("", `Travellers: ${t.members.map((m) => `${m.name} (${m.role})`).join(", ")}`);
  if (opts.includeIds) lines.push(`Trip id: ${t.id}  slug: ${t.slug}`);
  const days = bucketByDay(t.items, t.startDate, t.endDate);
  for (const d of days) {
    lines.push("", `## ${fmtDay(d.date)}`);
    if (d.stays.length) lines.push(`_Staying at: ${d.stays.map((s) => s.title).join(", ")}_`);
    if (!d.items.length) { lines.push("_Nothing planned yet_"); continue; }
    for (const it of d.items) lines.push(itemLine(it, t.homeCurrency, opts.includeIds));
  }
  const total = sumCosts(t.items);
  if (total.length) lines.push("", `**Costs:** ${total.map(([c, a]) => fmtMoney(a, c)).join(" + ")}`);
  return lines.join("\n");
}

function itemLine(it: Item, _home: string, ids?: boolean): string {
  const m = TYPE_META[it.type];
  const time = localTime(it.startAt, it.tz);
  const bits: string[] = [`- ${m.emoji} **${time}** ${it.title}`];
  if (it.type === "flight") {
    const d = it.details as { from?: { iata: string; terminal?: string }; to?: { iata: string; terminal?: string }; seat?: string };
    if (it.endAt) bits.push(`→ arrives ${localTime(it.endAt, it.endTz ?? it.tz)} (${fmtDuration(minutesBetween(it.startAt, it.endAt))})`);
    if (d.from?.terminal) bits.push(`T${d.from.terminal}`);
    if (d.seat) bits.push(`seat ${d.seat}`);
  } else if (it.type === "lodging" && it.endAt) {
    bits.push(`until ${localTime(it.endAt, it.endTz ?? it.tz)} ${it.endAt.slice(0, 10)}`);
  } else if (it.endAt) bits.push(`– ${localTime(it.endAt, it.endTz ?? it.tz)}`);
  if (it.location?.name && it.type !== "flight") bits.push(`@ ${it.location.name}`);
  if (it.status !== "planned") bits.push(`[${it.status}]`);
  if (it.confirmationCode) bits.push(`ref ${it.confirmationCode}`);
  if (it.costAmount != null && it.costCurrency) bits.push(fmtMoney(it.costAmount, it.costCurrency));
  if (ids) bits.push(`(id ${it.id})`);
  let out = bits.join(" ");
  if (it.notes) out += `\n  ${it.notes.replace(/\n/g, "\n  ")}`;
  return out;
}

export function sumCosts(items: Item[]): [string, number][] {
  const m = new Map<string, number>();
  for (const i of items) if (i.costAmount != null && i.costCurrency && i.status !== "cancelled") m.set(i.costCurrency, (m.get(i.costCurrency) ?? 0) + i.costAmount);
  return [...m.entries()];
}

function icsDate(iso: string): string { return new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, ""); }
function esc(s: string): string { return s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/[,;]/g, (c) => "\\" + c); }

export function tripToIcs(t: TripDetail, baseUrl: string): string {
  const out = ["BEGIN:VCALENDAR", "VERSION:2.0", `PRODID:-//trippy-mc-tripface//EN`, `X-WR-CALNAME:${esc(t.emoji + " " + t.name)}`, "CALSCALE:GREGORIAN"];
  for (const it of t.items) {
    if (it.status === "cancelled") continue;
    const end = it.endAt ?? new Date(new Date(it.startAt).getTime() + 60 * 60 * 1000).toISOString();
    const desc = [it.confirmationCode ? `Ref: ${it.confirmationCode}` : "", it.notes ?? "", `${baseUrl}/t/${t.slug}?item=${it.id}`].filter(Boolean).join("\n");
    out.push("BEGIN:VEVENT", `UID:${it.id}@trippy`, `DTSTAMP:${icsDate(it.updatedAt)}`, `DTSTART:${icsDate(it.startAt)}`, `DTEND:${icsDate(end)}`, `SUMMARY:${esc(TYPE_META[it.type].emoji + " " + it.title)}`);
    const loc = it.location?.address ?? it.location?.name;
    if (loc) out.push(`LOCATION:${esc(loc)}`);
    if (it.location?.lat != null && it.location.lng != null) out.push(`GEO:${it.location.lat};${it.location.lng}`);
    out.push(`DESCRIPTION:${esc(desc)}`, "END:VEVENT");
  }
  out.push("END:VCALENDAR");
  return out.join("\r\n");
}
