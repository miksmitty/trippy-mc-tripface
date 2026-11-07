import { useState } from "react";
import { ArrowRight, Bot, Check, Copy, ExternalLink, MapPin, Moon, Users } from "lucide-react";
import { fmtDuration, fmtMoney, minutesBetween, TYPE_META, daysBetween, localDate, type FlightDetails, type Item, type LodgingDetails, type RestaurantDetails, type TransferDetails, type MeetupDetails, type ActivityDetails } from "@tmt/shared";
import { localTime, tzAbbrev } from "../../lib/time";
import { useTripUI } from "../../lib/tripui";

const STATUS: Record<Item["status"], string> = { planned: "bg-stone-100 text-stone-600", booked: "bg-sky-100 text-sky-700", confirmed: "bg-emerald-100 text-emerald-700", cancelled: "bg-rose-100 text-rose-700 line-through" };
const MODE_ICON: Record<string, string> = { taxi: "🚕", rideshare: "🚗", train: "🚄", bus: "🚌", ferry: "⛴️", car_hire: "🚙", shuttle: "🚐", metro: "🚇", walk: "🚶", bike: "🚲", other: "➡️" };

export function ItemCard({ item, accent }: { item: Item; accent: string }) {
  const ui = useTripUI();
  const active = ui.selectedId === item.id, hover = ui.hoverId === item.id;
  const meta = TYPE_META[item.type];
  const onClick = () => {
    ui.setSelectedId(active ? null : item.id);
    const loc = item.location;
    if (loc?.lat != null && loc.lng != null) ui.flyTo(loc.lng, loc.lat);
  };
  return (
    <article
      onClick={onClick} onMouseEnter={() => ui.setHoverId(item.id)} onMouseLeave={() => ui.setHoverId(null)}
      className={`card relative overflow-hidden cursor-pointer transition-all ${active ? "ring-2 ring-ink/70 shadow-pop" : hover ? "shadow-pop -translate-y-px" : ""} ${item.status === "cancelled" ? "opacity-60" : ""}`}
    >
      <div className="absolute left-0 top-0 bottom-0 w-1.5" style={{ background: accent }} />
      <div className="pl-5 pr-4 py-3">
        {item.type === "flight" ? <Flight item={item} /> : item.type === "lodging" ? <Lodging item={item} /> : item.type === "transfer" ? <Transfer item={item} /> : item.type === "restaurant" ? <Restaurant item={item} /> : item.type === "meetup" ? <Meetup item={item} /> : item.type === "note" ? <Note item={item} /> : <Activity item={item} />}
        <Footer item={item} />
        {active && (
          <div className="mt-3 pt-3 border-t border-dashed border-line fade-up text-[13px] space-y-2">
            {item.notes && <p className="text-ink-2 whitespace-pre-wrap">{item.notes}</p>}
            {item.location?.address && <div className="flex items-start gap-1.5 text-ink-2"><MapPin size={14} className="mt-0.5 shrink-0" /><span>{item.location.address}</span></div>}
            <div className="flex flex-wrap gap-1.5">
              {item.url && <a href={item.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="chip hover:bg-paper-2"><ExternalLink size={11} /> Open link</a>}
              {item.location?.lat != null && <a href={`https://www.google.com/maps/dir/?api=1&destination=${item.location.lat},${item.location.lng}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="chip hover:bg-paper-2">🧭 Directions</a>}
              {!ui.readOnly && <button className="chip hover:bg-paper-2" onClick={(e) => { e.stopPropagation(); ui.openEditor(item); }}>✏️ Edit</button>}
              <span className="chip text-ink-3">{meta.emoji} added by {item.createdBy.kind === "agent" ? <><Bot size={11} /> {item.createdBy.label.split(" (")[0]}</> : item.createdBy.label}</span>
            </div>
          </div>
        )}
      </div>
    </article>
  );
}

function Footer({ item }: { item: Item }) {
  const ui = useTripUI();
  const bits: React.ReactNode[] = [];
  if (item.status !== "planned") bits.push(<span key="s" className={`px-1.5 py-0.5 rounded-md text-[10.5px] font-semibold uppercase tracking-wide ${STATUS[item.status]}`}>{item.status}</span>);
  if (ui.showConfirmations && item.confirmationCode) bits.push(<CopyChip key="c" text={item.confirmationCode} />);
  if (ui.showCosts && item.costAmount != null && item.costCurrency && item.costAmount > 0) bits.push(<span key="m" className="chip">{fmtMoney(item.costAmount, item.costCurrency)}</span>);
  if (item.createdBy.kind === "agent") bits.push(<span key="a" className="chip text-violet-700 bg-violet-50 border-violet-200" title={`Added by ${item.createdBy.label}`}><Bot size={11} /> agent</span>);
  for (const t of item.tags) bits.push(<span key={t} className="chip">#{t}</span>);
  if (!bits.length) return null;
  return <div className="flex flex-wrap items-center gap-1.5 mt-2">{bits}</div>;
}

function CopyChip({ text }: { text: string }) {
  const [ok, setOk] = useState(false);
  return <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); }} className="chip mono hover:bg-paper-2" title="Copy confirmation">{ok ? <Check size={11} /> : <Copy size={11} />} {text}</button>;
}

function Time({ iso, tz, big }: { iso: string; tz: string; big?: boolean }) {
  return <span className={big ? "font-display font-bold text-2xl tabular-nums leading-none" : "font-semibold tabular-nums"}>{localTime(iso, tz)}</span>;
}

// ---------- Flight ----------
function Flight({ item }: { item: Item }) {
  const d = item.details as FlightDetails;
  const dur = item.endAt ? minutesBetween(item.startAt, item.endAt) : d.durationMin;
  const depDay = localDate(item.startAt, item.tz), arrDay = item.endAt ? localDate(item.endAt, item.endTz ?? item.tz) : depDay;
  const dayDiff = daysBetween(depDay, arrDay);
  return (
    <div>
      <div className="flex items-center gap-2 text-[11.5px] text-ink-2 mb-2">
        <span className="font-semibold text-ink">{d.airline ?? "Flight"}</span>
        {d.flightNumber && <span className="mono bg-paper-2 rounded px-1.5 py-0.5">{d.flightNumber.toUpperCase().startsWith((d.airlineCode ?? "").toUpperCase()) ? d.flightNumber : `${d.airlineCode ?? ""}${d.flightNumber}`}</span>}
        {d.cabin && <span className="capitalize">{d.cabin.replace("_", " ")}</span>}
        {d.aircraft && <span className="hidden sm:inline">· {d.aircraft}</span>}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <div>
          <div className="font-display font-bold text-3xl tracking-tight leading-none">{d.from.iata}</div>
          <div className="text-[12px] text-ink-2 truncate mt-1">{d.from.city ?? d.from.name}</div>
          <div className="mt-1.5 flex items-baseline gap-1.5"><Time iso={item.startAt} tz={item.tz} /><span className="text-[11px] text-ink-3">{tzAbbrev(item.tz, item.startAt)}</span></div>
          <div className="flex gap-1 mt-1.5">{d.from.terminal && <span className="chip">T{d.from.terminal}</span>}{d.from.gate && <span className="chip">Gate {d.from.gate}</span>}</div>
        </div>
        <div className="flex flex-col items-center text-ink-3 w-24 sm:w-32">
          <div className="text-[11px] font-medium text-ink-2">{dur ? fmtDuration(dur) : ""}</div>
          <div className="relative w-full h-px bg-line my-1.5"><span className="absolute left-1/2 -translate-x-1/2 -top-2.5 text-[15px] rotate-90 sm:rotate-0" style={{ color: "#0ea5e9" }}>✈</span><span className="absolute left-0 -top-[3px] w-1.5 h-1.5 rounded-full bg-ink-3" /><span className="absolute right-0 -top-[3px] w-1.5 h-1.5 rounded-full bg-ink-3" /></div>
          <div className="text-[11px]">{item.endAt ? "non-stop" : ""}</div>
        </div>
        <div className="text-right">
          <div className="font-display font-bold text-3xl tracking-tight leading-none">{d.to.iata}</div>
          <div className="text-[12px] text-ink-2 truncate mt-1">{d.to.city ?? d.to.name}</div>
          {item.endAt && <div className="mt-1.5 flex items-baseline gap-1.5 justify-end"><Time iso={item.endAt} tz={item.endTz ?? item.tz} />{dayDiff > 0 && <sup className="text-[10px] font-bold text-rose-500">+{dayDiff}</sup>}<span className="text-[11px] text-ink-3">{tzAbbrev(item.endTz ?? item.tz, item.endAt)}</span></div>}
          <div className="flex gap-1 mt-1.5 justify-end">{d.to.terminal && <span className="chip">T{d.to.terminal}</span>}{d.seat && <span className="chip">💺 {d.seat}</span>}</div>
        </div>
      </div>
    </div>
  );
}

// ---------- Lodging ----------
function Lodging({ item }: { item: Item }) {
  const d = item.details as LodgingDetails;
  const nights = item.endAt ? daysBetween(localDate(item.startAt, item.tz), localDate(item.endAt, item.endTz ?? item.tz)) : null;
  return (
    <div className="flex gap-3">
      <div className="w-11 h-11 rounded-xl grid place-items-center text-xl shrink-0 bg-violet-50 text-violet-700">🛏️</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2"><h3 className="font-display font-bold text-[17px] leading-tight truncate">{item.title}</h3>{nights != null && <span className="chip shrink-0"><Moon size={11} /> {nights} night{nights === 1 ? "" : "s"}</span>}</div>
        <div className="text-[12.5px] text-ink-2 mt-0.5 truncate">{item.location?.address ?? item.location?.name}</div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[12.5px]">
          <span><span className="text-ink-3">Check-in</span> <Time iso={item.startAt} tz={item.tz} /></span>
          {item.endAt && <span><span className="text-ink-3">Check-out</span> <Time iso={item.endAt} tz={item.endTz ?? item.tz} /> <span className="text-ink-3">{new Date(item.endAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: item.endTz ?? item.tz })}</span></span>}
          {d.room && <span className="text-ink-2">{d.room}</span>}
          {d.breakfastIncluded && <span className="text-ink-2">🥐 breakfast</span>}
          {d.provider && <span className="text-ink-3">via {d.provider}</span>}
        </div>
      </div>
    </div>
  );
}

// ---------- Transfer ----------
function Transfer({ item }: { item: Item }) {
  const d = item.details as TransferDetails;
  const dur = item.endAt ? minutesBetween(item.startAt, item.endAt) : d.durationMin;
  return (
    <div className="flex gap-3">
      <div className="w-11 h-11 rounded-xl grid place-items-center text-xl shrink-0 bg-amber-50">{MODE_ICON[d.mode] ?? "➡️"}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2"><Time iso={item.startAt} tz={item.tz} /><h3 className="font-semibold text-[15px] truncate">{item.title}</h3></div>
        <div className="flex items-center gap-1.5 text-[12.5px] text-ink-2 mt-1 min-w-0">
          <span className="truncate">{item.location?.name ?? "—"}</span><ArrowRight size={13} className="shrink-0 text-ink-3" /><span className="truncate">{item.endLocation?.name ?? "—"}</span>
          {item.endAt && <span className="text-ink-3 shrink-0">· arr <Time iso={item.endAt} tz={item.endTz ?? item.tz} /></span>}
        </div>
        <div className="flex flex-wrap gap-1 mt-2">{dur ? <span className="chip">{fmtDuration(dur)}</span> : null}{d.provider && <span className="chip">{d.provider}</span>}{d.vehicle && <span className="chip">{d.vehicle}</span>}{d.carriage && <span className="chip">Car {d.carriage}</span>}{d.seat && <span className="chip">Seat {d.seat}</span>}</div>
      </div>
    </div>
  );
}

// ---------- Restaurant ----------
function Restaurant({ item }: { item: Item }) {
  const d = item.details as RestaurantDetails;
  return (
    <div className="flex gap-3 items-start">
      <div className="text-center shrink-0 w-14"><Time iso={item.startAt} tz={item.tz} big /><div className="text-[10px] text-ink-3 mt-0.5 uppercase tracking-wider">{new Date(item.startAt).toLocaleDateString("en-GB", { weekday: "short", timeZone: item.tz })}</div></div>
      <div className="w-px self-stretch bg-line" />
      <div className="min-w-0 flex-1">
        <h3 className="font-display font-bold text-[17px] leading-tight truncate">🍽️ {item.title}</h3>
        <div className="text-[12.5px] text-ink-2 mt-0.5 flex flex-wrap gap-x-2">{d.cuisine && <span>{d.cuisine}</span>}{d.partySize && <span className="inline-flex items-center gap-1"><Users size={12} /> {d.partySize}</span>}{d.platform && <span className="text-ink-3">via {d.platform}</span>}{d.dressCode && <span className="text-ink-3">👔 {d.dressCode}</span>}</div>
        {item.location?.address && <div className="text-[12px] text-ink-3 truncate mt-1">{item.location.address}</div>}
      </div>
    </div>
  );
}

// ---------- Activity ----------
function Activity({ item }: { item: Item }) {
  const d = item.details as ActivityDetails;
  const dur = item.endAt ? minutesBetween(item.startAt, item.endAt) : d.durationMin;
  return (
    <div className="flex gap-3 items-start">
      <div className="text-center shrink-0 w-14"><Time iso={item.startAt} tz={item.tz} big />{item.endAt && <div className="text-[11px] text-ink-3 mt-0.5">– {localTime(item.endAt, item.endTz ?? item.tz)}</div>}</div>
      <div className="w-px self-stretch bg-line" />
      <div className="min-w-0 flex-1">
        <h3 className="font-semibold text-[15px] leading-tight">🎟️ {item.title}</h3>
        <div className="text-[12.5px] text-ink-2 mt-0.5 flex flex-wrap gap-x-2">{item.location?.name && <span>{item.location.name}</span>}{dur ? <span className="text-ink-3">{fmtDuration(dur)}</span> : null}{d.ticketType && <span className="text-ink-3">{d.ticketType}</span>}</div>
      </div>
    </div>
  );
}

// ---------- Meetup ----------
function Meetup({ item }: { item: Item }) {
  const d = item.details as MeetupDetails;
  return (
    <div className="flex gap-3 items-start">
      <div className="relative w-11 h-11 rounded-full grid place-items-center text-xl shrink-0 bg-fuchsia-50 text-fuchsia-600 pulse-ring">📍</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2"><Time iso={item.startAt} tz={item.tz} /><h3 className="font-semibold text-[15px] truncate">{item.title}</h3></div>
        <div className="text-[12.5px] text-ink-2 mt-0.5">{item.location?.name}</div>
        {d.instructions && <div className="text-[12.5px] text-fuchsia-800 bg-fuchsia-50 rounded-lg px-2 py-1 mt-1.5 inline-block">{d.instructions}</div>}
        {d.expected?.length ? <div className="text-[12px] text-ink-3 mt-1.5">Expected: {d.expected.join(", ")}</div> : null}
      </div>
    </div>
  );
}

// ---------- Note ----------
function Note({ item }: { item: Item }) {
  return (
    <div className="flex gap-3">
      <div className="text-lg leading-none mt-0.5">📝</div>
      <div className="min-w-0 flex-1"><h3 className="font-semibold text-[14.5px]">{item.title}</h3>{item.notes && <p className="text-[12.5px] text-ink-2 mt-0.5 line-clamp-2 whitespace-pre-wrap">{item.notes}</p>}</div>
    </div>
  );
}
