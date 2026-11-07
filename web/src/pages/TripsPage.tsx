import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import type { Trip, TripCreate } from "@tmt/shared";
import { api, useTrips } from "../lib/api";
import { TopBar } from "../components/Shell";
import { fmtRange } from "../lib/time";

const EMOJIS = ["🧳", "🌸", "🏝️", "🏔️", "🗼", "🎿", "🏜️", "🛶", "🎡", "🍝", "🐘", "🌋"];
const COLORS = ["#0ea5e9", "#f43f5e", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];

export default function TripsPage() {
  const trips = useTrips();
  const [open, setOpen] = useState(false);
  const upcoming = (trips.data ?? []).filter((t) => !t.endDate || t.endDate >= new Date().toISOString().slice(0, 10));
  const past = (trips.data ?? []).filter((t) => t.endDate && t.endDate < new Date().toISOString().slice(0, 10));
  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-5xl mx-auto p-6">
          <div className="flex items-end justify-between mb-6">
            <div><h1 className="font-display text-3xl font-bold tracking-tight">Trips</h1><p className="text-ink-2 text-sm mt-1">{trips.data?.length ?? 0} trips · agents can add more via the API</p></div>
            <button className="btn-primary" onClick={() => setOpen(true)}><Plus size={16} /> New trip</button>
          </div>
          {trips.isLoading && <div className="text-ink-3">Loading…</div>}
          {trips.data?.length === 0 && <div className="card p-10 text-center text-ink-2">No trips yet. Create one, or ask your agent to.</div>}
          <Section title="Upcoming & current" trips={upcoming} />
          <Section title="Past" trips={past} />
        </div>
      </main>
      {open && <NewTripDialog onClose={() => setOpen(false)} />}
    </div>
  );
}

function Section({ title, trips }: { title: string; trips: Trip[] }) {
  if (!trips.length) return null;
  return (
    <section className="mb-8">
      <h2 className="label mb-3">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {trips.map((t) => (
          <Link key={t.id} to={`/t/${t.slug}`} className="card p-5 hover:-translate-y-0.5 hover:shadow-pop transition-all relative overflow-hidden group">
            <div className="absolute inset-x-0 top-0 h-1.5" style={{ background: t.color }} />
            <div className="text-3xl mb-3">{t.emoji}</div>
            <div className="font-display font-bold text-lg leading-tight">{t.name}</div>
            <div className="text-sm text-ink-2 mt-1">{fmtRange(t.startDate, t.endDate)}</div>
            <div className="flex items-center gap-2 mt-4 text-xs text-ink-3"><span className="chip">{t.itemCount ?? 0} items</span><span className="chip capitalize">{t.myRole}</span></div>
          </Link>
        ))}
      </div>
    </section>
  );
}

function NewTripDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const nav = useNavigate();
  const [f, setF] = useState<TripCreate>({ name: "", emoji: "🧳", color: "#0ea5e9", homeCurrency: "GBP", homeTz: Intl.DateTimeFormat().resolvedOptions().timeZone });
  const m = useMutation({ mutationFn: (b: TripCreate) => api<Trip>("/trips", { method: "POST", json: b }), onSuccess: (t) => { qc.invalidateQueries({ queryKey: ["trips"] }); nav(`/t/${t.slug}`); } });
  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm grid place-items-center p-4 z-50" onClick={onClose}>
      <form className="card w-full max-w-md p-6 fade-up" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); m.mutate({ ...f, startDate: f.startDate || undefined, endDate: f.endDate || undefined, description: f.description || undefined }); }}>
        <h2 className="font-display text-xl font-bold mb-4">New trip</h2>
        <label className="label">Name</label>
        <input className="input mb-3" autoFocus value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Japan in spring" required />
        <div className="grid grid-cols-2 gap-3 mb-3">
          <div><label className="label">Start</label><input type="date" className="input" value={f.startDate ?? ""} onChange={(e) => setF({ ...f, startDate: e.target.value })} /></div>
          <div><label className="label">End</label><input type="date" className="input" value={f.endDate ?? ""} onChange={(e) => setF({ ...f, endDate: e.target.value })} /></div>
        </div>
        <label className="label">Description</label>
        <textarea className="input mb-3" rows={2} value={f.description ?? ""} onChange={(e) => setF({ ...f, description: e.target.value })} />
        <div className="flex items-center gap-1 mb-3 flex-wrap">{EMOJIS.map((e) => <button type="button" key={e} onClick={() => setF({ ...f, emoji: e })} className={`text-xl p-1.5 rounded-lg hover:bg-paper-2 ${f.emoji === e ? "bg-paper-2 ring-2 ring-ink/20" : ""}`}>{e}</button>)}</div>
        <div className="flex items-center gap-2 mb-5">{COLORS.map((c) => <button type="button" key={c} onClick={() => setF({ ...f, color: c })} style={{ background: c }} className={`w-6 h-6 rounded-full ${f.color === c ? "ring-2 ring-offset-2 ring-ink/40" : ""}`} />)}</div>
        <div className="grid grid-cols-2 gap-3 mb-5">
          <div><label className="label">Home currency</label><input className="input uppercase" maxLength={3} value={f.homeCurrency ?? ""} onChange={(e) => setF({ ...f, homeCurrency: e.target.value.toUpperCase() })} /></div>
          <div><label className="label">Home timezone</label><input className="input" value={f.homeTz ?? ""} onChange={(e) => setF({ ...f, homeTz: e.target.value })} /></div>
        </div>
        {m.isError && <div className="text-sm text-rose-600 mb-3">{(m.error as Error).message}</div>}
        <div className="flex justify-end gap-2"><button type="button" className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={m.isPending}>Create</button></div>
      </form>
    </div>
  );
}
