import { useEffect, useRef, useState } from "react";
import { MapPin, X } from "lucide-react";
import type { Airport, Location } from "@tmt/shared";
import { geocode, searchAirports } from "../lib/api";

function useDebounced<T>(v: T, ms: number) { const [d, setD] = useState(v); useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]); return d; }

export function PlaceSearch({ value, onChange, placeholder = "Search a place or address…", near }: { value: Location | null | undefined; onChange: (l: Location | null) => void; placeholder?: string; near?: { lat: number; lng: number } }) {
  const [q, setQ] = useState(value?.name ?? "");
  const [results, setResults] = useState<Awaited<ReturnType<typeof geocode>>>([]);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const dq = useDebounced(q, 350);
  const skip = useRef(false);
  useEffect(() => { setQ(value?.name ?? ""); }, [value?.name]);
  useEffect(() => {
    if (skip.current) { skip.current = false; return; }
    if (dq.trim().length < 3 || dq === value?.name) { setResults([]); return; }
    let live = true; setBusy(true);
    geocode(dq, near).then((r) => { if (live) { setResults(r); setOpen(true); } }).catch(() => { }).finally(() => live && setBusy(false));
    return () => { live = false; };
  }, [dq, near, value?.name]);
  const pick = (r: { name: string; address: string; lat: number; lng: number }) => { skip.current = true; onChange({ name: r.name, address: r.address, lat: r.lat, lng: r.lng }); setQ(r.name); setOpen(false); setResults([]); };
  const pinned = value?.lat != null;
  return (
    <div className="relative">
      <div className="flex items-center gap-1.5">
        <div className="relative flex-1">
          <input className={`input pr-8 ${pinned ? "border-emerald-300 bg-emerald-50/40" : ""}`} value={q} placeholder={placeholder}
            onChange={(e) => { setQ(e.target.value); if (value && e.target.value !== value.name) onChange(e.target.value ? { name: e.target.value } : null); }}
            onFocus={() => results.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
          <MapPin size={14} className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${pinned ? "text-emerald-600" : "text-ink-3"}`} />
        </div>
        {value && <button type="button" className="btn-ghost px-2" onClick={() => { onChange(null); setQ(""); }}><X size={14} /></button>}
      </div>
      {pinned && value?.address && <div className="text-[11px] text-ink-3 mt-1 truncate">{value.address}</div>}
      {busy && <div className="text-[11px] text-ink-3 mt-1">Searching…</div>}
      {open && results.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 mt-1 card max-h-60 overflow-auto p-1">
          {results.map((r, i) => <li key={i}><button type="button" onMouseDown={() => pick(r)} className="w-full text-left rounded-lg px-2.5 py-1.5 hover:bg-paper-2"><div className="text-sm font-medium">{r.name}</div><div className="text-[11px] text-ink-3 truncate">{r.address}</div></button></li>)}
        </ul>
      )}
    </div>
  );
}

export function AirportPicker({ value, onChange, placeholder }: { value: string | undefined; onChange: (a: Airport) => void; placeholder: string }) {
  const [q, setQ] = useState(value ?? "");
  const [results, setResults] = useState<Airport[]>([]);
  const [open, setOpen] = useState(false);
  const dq = useDebounced(q, 200);
  useEffect(() => { setQ(value ?? ""); }, [value]);
  useEffect(() => {
    if (dq.trim().length < 2 || dq === value) { setResults([]); return; }
    let live = true; searchAirports(dq).then((r) => live && (setResults(r), setOpen(true))).catch(() => { });
    return () => { live = false; };
  }, [dq, value]);
  return (
    <div className="relative">
      <input className="input uppercase mono" value={q} placeholder={placeholder} onChange={(e) => setQ(e.target.value)} onFocus={() => results.length && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} />
      {open && results.length > 0 && (
        <ul className="absolute z-30 left-0 right-0 mt-1 card max-h-60 overflow-auto p-1 min-w-64">
          {results.map((a) => <li key={a.iata}><button type="button" onMouseDown={() => { onChange(a); setQ(a.iata); setOpen(false); setResults([]); }} className="w-full text-left rounded-lg px-2.5 py-1.5 hover:bg-paper-2 flex items-center gap-2"><span className="mono font-bold w-10">{a.iata}</span><span className="text-sm truncate">{a.city} · <span className="text-ink-3">{a.name}</span></span></button></li>)}
        </ul>
      )}
    </div>
  );
}
