import { useMemo, useState } from "react";
import { Trash2, X } from "lucide-react";
import { ITEM_STATUSES, ITEM_TYPES, TRANSFER_MODES, TYPE_META, type Item, type ItemCreate, type ItemType, type Location, type TripDetail } from "@tmt/shared";
import { ApiError, useTripMutations } from "../lib/api";
import { allTimeZones, isoToLocal, localToIso } from "../lib/time";
import { AirportPicker, PlaceSearch } from "./PlaceSearch";

type Target = Item | { type: ItemType; date?: string };
const isItem = (t: Target): t is Item => "id" in t;

interface Form {
  type: ItemType; title: string; status: Item["status"]; startLocal: string; endLocal: string; tz: string; endTz: string;
  costAmount: string; costCurrency: string; confirmationCode: string; url: string; notes: string; tags: string;
  location: Location | null; endLocation: Location | null; details: Record<string, any>;
}

function defaultTz(trip: TripDetail, date?: string): string {
  const before = [...trip.items].filter((i) => !date || i.startAt.slice(0, 10) <= date).sort((a, b) => b.startAt.localeCompare(a.startAt))[0];
  return before?.endTz ?? before?.tz ?? trip.homeTz;
}

function initial(target: Target, trip: TripDetail): Form {
  if (isItem(target)) {
    return { type: target.type, title: target.title, status: target.status, startLocal: isoToLocal(target.startAt, target.tz), endLocal: isoToLocal(target.endAt, target.endTz ?? target.tz), tz: target.tz, endTz: target.endTz ?? target.tz, costAmount: target.costAmount?.toString() ?? "", costCurrency: target.costCurrency ?? "", confirmationCode: target.confirmationCode ?? "", url: target.url ?? "", notes: target.notes ?? "", tags: target.tags.join(", "), location: target.location, endLocation: target.endLocation, details: { ...target.details } };
  }
  const date = target.date ?? trip.startDate ?? new Date().toISOString().slice(0, 10);
  const tz = defaultTz(trip, date);
  const t = target.type;
  const start = `${date}T${t === "lodging" ? "15:00" : t === "restaurant" ? "19:30" : "10:00"}`;
  const end = t === "lodging" ? `${nextDay(date)}T11:00` : t === "activity" ? `${date}T12:00` : "";
  return { type: t, title: "", status: "planned", startLocal: start, endLocal: end, tz, endTz: tz, costAmount: "", costCurrency: trip.homeCurrency, confirmationCode: "", url: "", notes: "", tags: "", location: null, endLocation: null, details: t === "transfer" ? { mode: "train" } : t === "flight" ? { from: {}, to: {} } : {} };
}
function nextDay(d: string) { const x = new Date(d + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + 1); return x.toISOString().slice(0, 10); }

export function ItemEditor({ target, trip, onClose }: { target: Target; trip: TripDetail; onClose: () => void }) {
  const [f, setF] = useState<Form>(() => initial(target, trip));
  const [err, setErr] = useState<string | null>(null);
  const m = useTripMutations(trip.slug);
  const editing = isItem(target);
  const set = (p: Partial<Form>) => setF((x) => ({ ...x, ...p }));
  const setD = (p: Record<string, unknown>) => setF((x) => ({ ...x, details: { ...x.details, ...p } }));
  const near = useMemo(() => { const i = trip.items.find((x) => x.location?.lat != null && x.type !== "flight"); return i?.location?.lat != null ? { lat: i.location.lat, lng: i.location.lng! } : undefined; }, [trip.items]);
  const tzs = useMemo(allTimeZones, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null);
    const details = cleanDetails(f.type, f.details);
    const body: ItemCreate = {
      type: f.type, title: f.title || undefined, status: f.status, startAt: localToIso(f.startLocal, f.tz), endAt: f.endLocal ? localToIso(f.endLocal, f.endTz || f.tz) : undefined, tz: f.tz, endTz: f.endLocal ? f.endTz || f.tz : undefined,
      costAmount: f.costAmount ? Number(f.costAmount) : undefined, costCurrency: f.costAmount && f.costCurrency ? f.costCurrency.toUpperCase() : undefined, confirmationCode: f.confirmationCode || undefined, url: f.url || undefined, notes: f.notes || undefined,
      tags: f.tags ? f.tags.split(",").map((s) => s.trim()).filter(Boolean) : undefined, location: f.location ?? undefined, endLocation: f.endLocation ?? undefined, details,
    } as ItemCreate;
    try {
      if (editing) {
        const patch: Record<string, unknown> = { ...body, title: f.title || target.title, endAt: body.endAt ?? null, costAmount: f.costAmount ? Number(f.costAmount) : null, costCurrency: f.costAmount ? f.costCurrency.toUpperCase() : null, confirmationCode: f.confirmationCode || null, url: f.url || null, notes: f.notes || null, tags: body.tags ?? [], location: f.location ?? null, endLocation: f.endLocation ?? null };
        await m.updateItem.mutateAsync({ id: target.id, patch });
      } else await m.createItem.mutateAsync(body);
      onClose();
    } catch (e) { setErr(e instanceof ApiError ? `${e.message}${e.issues ? ": " + (e.issues as { path: (string | number)[]; message: string }[]).map((i) => `${i.path.join(".")} ${i.message}`).join("; ") : ""}` : (e as Error).message); }
  };
  const del = async () => { if (editing && confirm(`Delete "${target.title}"?`)) { await m.deleteItem.mutateAsync(target.id); onClose(); } };

  const meta = TYPE_META[f.type];
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/30 backdrop-blur-[2px]" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-lg h-full bg-paper shadow-pop flex flex-col fade-up">
        <header className="px-5 py-3 border-b border-line flex items-center gap-3 bg-white">
          <span className="text-xl">{meta.emoji}</span>
          <h2 className="font-display font-bold text-lg flex-1">{editing ? `Edit ${meta.label.toLowerCase()}` : `New ${meta.label.toLowerCase()}`}</h2>
          {editing && <button type="button" onClick={del} className="btn-ghost text-rose-600"><Trash2 size={16} /></button>}
          <button type="button" onClick={onClose} className="btn-ghost"><X size={18} /></button>
        </header>
        <div className="flex-1 overflow-auto p-5 space-y-4 scrollbar-thin">
          {!editing && (
            <div className="flex flex-wrap gap-1.5">{ITEM_TYPES.map((t) => <button type="button" key={t} onClick={() => setF(initial({ type: t, date: f.startLocal.slice(0, 10) }, trip))} className={`chip py-1 px-2.5 text-xs ${f.type === t ? "bg-ink text-white border-ink" : "hover:bg-paper-2"}`}>{TYPE_META[t].emoji} {TYPE_META[t].label}</button>)}</div>
          )}

          {f.type === "flight" ? <FlightFields f={f} set={set} setD={setD} /> : (
            <div><label className="label">{f.type === "lodging" ? "Property" : f.type === "restaurant" ? "Restaurant" : f.type === "transfer" ? "Title" : f.type === "meetup" ? "Meetup" : "Title"}</label>
              <input className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder={f.type === "transfer" ? "Shinkansen to Kyoto" : f.type === "lodging" ? "Park Hyatt Tokyo" : f.type === "restaurant" ? "Sushi Saito" : f.type === "meetup" ? "Meet at the station" : "Title"} required autoFocus />
            </div>
          )}

          {f.type !== "flight" && f.type !== "note" && (
            <div><label className="label">{f.type === "transfer" ? "Pick-up" : "Where"}</label><PlaceSearch value={f.location} onChange={(l) => set({ location: l })} near={near} /></div>
          )}
          {f.type === "transfer" && (<>
            <div><label className="label">Drop-off</label><PlaceSearch value={f.endLocation} onChange={(l) => set({ endLocation: l })} near={near} /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Mode</label><select className="input" value={f.details.mode ?? "train"} onChange={(e) => setD({ mode: e.target.value })}>{TRANSFER_MODES.map((mo) => <option key={mo} value={mo}>{mo.replace("_", " ")}</option>)}</select></div>
              <div><label className="label">Provider</label><input className="input" value={f.details.provider ?? ""} onChange={(e) => setD({ provider: e.target.value })} placeholder="JR Central / Uber" /></div>
              <div><label className="label">Vehicle / service</label><input className="input" value={f.details.vehicle ?? ""} onChange={(e) => setD({ vehicle: e.target.value })} placeholder="Nozomi 215" /></div>
              <div className="grid grid-cols-2 gap-2"><div><label className="label">Car</label><input className="input" value={f.details.carriage ?? ""} onChange={(e) => setD({ carriage: e.target.value })} /></div><div><label className="label">Seat</label><input className="input" value={f.details.seat ?? ""} onChange={(e) => setD({ seat: e.target.value })} /></div></div>
            </div>
          </>)}

          <div className="grid grid-cols-2 gap-3">
            <div><label className="label">{f.type === "lodging" ? "Check-in" : f.type === "flight" ? "Departs" : "Starts"}</label><input type="datetime-local" className="input" value={f.startLocal} onChange={(e) => set({ startLocal: e.target.value })} required /></div>
            <div><label className="label">{f.type === "lodging" ? "Check-out" : f.type === "flight" ? "Arrives" : "Ends"} <span className="normal-case font-normal">(optional)</span></label><input type="datetime-local" className="input" value={f.endLocal} onChange={(e) => set({ endLocal: e.target.value })} /></div>
            <div><label className="label">Timezone</label><input list="tzs" className="input mono" value={f.tz} onChange={(e) => set({ tz: e.target.value, endTz: f.endTz === f.tz ? e.target.value : f.endTz })} /></div>
            {(f.type === "flight" || f.type === "transfer") && <div><label className="label">Arrival timezone</label><input list="tzs" className="input mono" value={f.endTz} onChange={(e) => set({ endTz: e.target.value })} /></div>}
            <datalist id="tzs">{tzs.map((z) => <option key={z} value={z} />)}</datalist>
          </div>

          {f.type === "lodging" && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Room</label><input className="input" value={f.details.room ?? ""} onChange={(e) => setD({ room: e.target.value })} /></div>
              <div><label className="label">Booked via</label><input className="input" value={f.details.provider ?? ""} onChange={(e) => setD({ provider: e.target.value })} placeholder="Booking.com" /></div>
              <div><label className="label">Guests</label><input type="number" min={1} className="input" value={f.details.guests ?? ""} onChange={(e) => setD({ guests: e.target.value ? Number(e.target.value) : undefined })} /></div>
              <label className="flex items-center gap-2 text-sm mt-5"><input type="checkbox" checked={!!f.details.breakfastIncluded} onChange={(e) => setD({ breakfastIncluded: e.target.checked })} /> Breakfast included</label>
            </div>
          )}
          {f.type === "restaurant" && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Cuisine</label><input className="input" value={f.details.cuisine ?? ""} onChange={(e) => setD({ cuisine: e.target.value })} /></div>
              <div><label className="label">Party size</label><input type="number" min={1} className="input" value={f.details.partySize ?? ""} onChange={(e) => setD({ partySize: e.target.value ? Number(e.target.value) : undefined })} /></div>
              <div><label className="label">Booked via</label><input className="input" value={f.details.platform ?? ""} onChange={(e) => setD({ platform: e.target.value })} placeholder="OpenTable / phone" /></div>
              <div><label className="label">Dress code</label><input className="input" value={f.details.dressCode ?? ""} onChange={(e) => setD({ dressCode: e.target.value })} /></div>
            </div>
          )}
          {f.type === "activity" && (
            <div className="grid grid-cols-2 gap-3">
              <div><label className="label">Provider</label><input className="input" value={f.details.provider ?? ""} onChange={(e) => setD({ provider: e.target.value })} /></div>
              <div><label className="label">Ticket</label><input className="input" value={f.details.ticketType ?? ""} onChange={(e) => setD({ ticketType: e.target.value })} placeholder="Adult, timed entry" /></div>
            </div>
          )}
          {f.type === "meetup" && (
            <div className="space-y-3">
              <div><label className="label">How to find each other</label><input className="input" value={f.details.instructions ?? ""} onChange={(e) => setD({ instructions: e.target.value })} placeholder="Under the big clock" /></div>
              <div><label className="label">Who's expected (comma separated)</label><input className="input" value={(f.details.expected ?? []).join(", ")} onChange={(e) => setD({ expected: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })} /></div>
            </div>
          )}

          <div>
            <label className="label">Status</label>
            <div className="flex gap-1.5">{ITEM_STATUSES.map((s) => <button type="button" key={s} onClick={() => set({ status: s })} className={`chip py-1 px-2.5 text-xs capitalize ${f.status === s ? "bg-ink text-white border-ink" : "hover:bg-paper-2"}`}>{s}</button>)}</div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1"><label className="label">Confirmation</label><input className="input mono" value={f.confirmationCode} onChange={(e) => set({ confirmationCode: e.target.value })} /></div>
            <div><label className="label">Cost</label><input type="number" step="0.01" min={0} className="input" value={f.costAmount} onChange={(e) => set({ costAmount: e.target.value })} /></div>
            <div><label className="label">Currency</label><input className="input uppercase" maxLength={3} value={f.costCurrency} onChange={(e) => set({ costCurrency: e.target.value.toUpperCase() })} /></div>
          </div>
          <div><label className="label">Link</label><input type="url" className="input" value={f.url} onChange={(e) => set({ url: e.target.value })} placeholder="https://" /></div>
          <div><label className="label">Notes</label><textarea className="input" rows={3} value={f.notes} onChange={(e) => set({ notes: e.target.value })} /></div>
          <div><label className="label">Tags</label><input className="input" value={f.tags} onChange={(e) => set({ tags: e.target.value })} placeholder="comma, separated" /></div>
          {err && <div className="text-sm text-rose-600 bg-rose-50 rounded-xl p-3">{err}</div>}
        </div>
        <footer className="px-5 py-3 border-t border-line bg-white flex justify-end gap-2">
          <button type="button" className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={m.createItem.isPending || m.updateItem.isPending}>{editing ? "Save" : "Add"}</button>
        </footer>
      </form>
    </div>
  );
}

function FlightFields({ f, set, setD }: { f: Form; set: (p: Partial<Form>) => void; setD: (p: Record<string, unknown>) => void }) {
  const d = f.details;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-end">
        <div><label className="label">From</label><AirportPicker value={d.from?.iata} placeholder="LHR" onChange={(a) => { setD({ from: { ...(d.from ?? {}), iata: a.iata } }); set({ tz: a.tz, location: { name: `${a.city} (${a.iata})`, address: a.name, lat: a.lat, lng: a.lng } }); }} /></div>
        <div className="pb-2 text-ink-3">→</div>
        <div><label className="label">To</label><AirportPicker value={d.to?.iata} placeholder="HND" onChange={(a) => { setD({ to: { ...(d.to ?? {}), iata: a.iata } }); set({ endTz: a.tz, endLocation: { name: `${a.city} (${a.iata})`, address: a.name, lat: a.lat, lng: a.lng } }); }} /></div>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div><label className="label">Airline</label><input className="input" value={d.airline ?? ""} onChange={(e) => setD({ airline: e.target.value })} placeholder="British Airways" /></div>
        <div><label className="label">Code</label><input className="input uppercase mono" maxLength={3} value={d.airlineCode ?? ""} onChange={(e) => setD({ airlineCode: e.target.value.toUpperCase() })} placeholder="BA" /></div>
        <div><label className="label">Flight no.</label><input className="input mono" value={d.flightNumber ?? ""} onChange={(e) => setD({ flightNumber: e.target.value.toUpperCase().replace(/\s/g, "") })} placeholder="BA5" /></div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <div><label className="label">Dep. terminal</label><input className="input" value={d.from?.terminal ?? ""} onChange={(e) => setD({ from: { ...(d.from ?? {}), terminal: e.target.value } })} /></div>
        <div><label className="label">Gate</label><input className="input" value={d.from?.gate ?? ""} onChange={(e) => setD({ from: { ...(d.from ?? {}), gate: e.target.value } })} /></div>
        <div><label className="label">Arr. terminal</label><input className="input" value={d.to?.terminal ?? ""} onChange={(e) => setD({ to: { ...(d.to ?? {}), terminal: e.target.value } })} /></div>
        <div><label className="label">Seat</label><input className="input" value={d.seat ?? ""} onChange={(e) => setD({ seat: e.target.value })} /></div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div><label className="label">Cabin</label><select className="input" value={d.cabin ?? ""} onChange={(e) => setD({ cabin: e.target.value || undefined })}><option value="">—</option><option value="economy">Economy</option><option value="premium_economy">Premium economy</option><option value="business">Business</option><option value="first">First</option></select></div>
        <div><label className="label">Aircraft</label><input className="input" value={d.aircraft ?? ""} onChange={(e) => setD({ aircraft: e.target.value })} placeholder="787-9" /></div>
      </div>
      <div><label className="label">Title <span className="normal-case font-normal">(optional, auto from route)</span></label><input className="input" value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder="BA5 LHR → HND" /></div>
    </div>
  );
}

function cleanDetails(type: ItemType, d: Record<string, any>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(d)) {
    if (v === "" || v === undefined || v === null) continue;
    if (typeof v === "object" && !Array.isArray(v)) { const inner = Object.fromEntries(Object.entries(v).filter(([, x]) => x !== "" && x != null)); if (Object.keys(inner).length) out[k] = inner; }
    else out[k] = v;
  }
  if (type === "flight") { if (!(out.from as any)?.iata) delete out.from; if (!(out.to as any)?.iata) delete out.to; }
  return out;
}
