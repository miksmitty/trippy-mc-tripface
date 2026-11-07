import { useCallback, useMemo, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Activity as ActivityIcon, ChevronLeft, List, Map as MapIcon, Plus, Radio, Share2, Wifi, WifiOff } from "lucide-react";
import { DAY_PALETTE, ITEM_TYPES, TYPE_META, bucketByDay, type Item, type ItemType, type TripDetail } from "@tmt/shared";
import { useMe, useTravelers, useTrip } from "../lib/api";
import { fmtDayShort, fmtRange } from "../lib/time";
import { TripUIContext, type ColorBy } from "../lib/tripui";
import { Avatar, TopBar } from "../components/Shell";
import { Timeline } from "../components/Timeline";
import { TripMap } from "../components/TripMap";
import { ItemEditor } from "../components/ItemEditor";
import { ActivityPanel, LivePanel, SharePanel } from "../components/Panels";
import { useTripSocket } from "../hooks/useTripSocket";

export default function TripPage() {
  const { slug = "" } = useParams();
  const trip = useTrip(slug);
  const me = useMe();
  const travelers = useTravelers(slug);
  const { presence, connected } = useTripSocket(slug);
  if (trip.isLoading) return <div className="h-full grid place-items-center text-ink-3">Loading trip…</div>;
  if (trip.isError || !trip.data || !me.data) return <div className="h-full grid place-items-center"><div className="text-center"><div className="text-3xl mb-2">🫥</div><div className="text-ink-2">Trip not found or you don't have access.</div><Link className="btn-soft mt-4" to="/">All trips</Link></div></div>;
  return <TripView trip={trip.data} me={me.data} travelers={travelers.data ?? []} presence={presence} connected={connected} />;
}

export function TripView({ trip, me, travelers, presence, connected, shareMode }: { trip: TripDetail; me: { id: string; name: string; avatarColor: string; email: string; actorKind: "user" | "agent" }; travelers: { tripId: string; userId: string; name: string; color: string; lat: number; lng: number; accuracy: number | null; heading: number | null; speed: number | null; label: string | null; recordedAt: string }[]; presence: { userId: string; name: string; color: string }[]; connected: boolean; shareMode?: { showConfirmations: boolean; showCosts: boolean; label: string | null } }) {
  const [sp, setSp] = useSearchParams();
  const selectedId = sp.get("item");
  const setSelectedId = useCallback((id: string | null) => { setSp((p) => { const n = new URLSearchParams(p); if (id) n.set("item", id); else n.delete("item"); return n; }, { replace: true }); }, [setSp]);
  const [hoverId, setHoverId] = useState<string | null>(null);
  const [dayFilter, setDayFilter] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<Set<ItemType>>(new Set());
  const [colorBy, setColorBy] = useState<ColorBy>("day");
  const [editing, setEditing] = useState<Item | { type: ItemType; date?: string } | null>(null);
  const [panel, setPanel] = useState<"share" | "activity" | "live" | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "map">("list");
  const [addMenu, setAddMenu] = useState(false);
  const flyRef = useRef<(lng: number, lat: number) => void>(() => { });

  const readOnly = !!shareMode || trip.myRole === "viewer";
  const days = useMemo(() => bucketByDay(trip.items, trip.startDate, trip.endDate), [trip.items, trip.startDate, trip.endDate]);
  const dayIdx = useMemo(() => new Map(days.map((d, i) => [d.date, i])), [days]);
  const ui = useMemo(() => ({
    selectedId, setSelectedId, hoverId, setHoverId, dayFilter, setDayFilter, typeFilter, colorBy, setColorBy, readOnly,
    toggleType: (t: ItemType) => setTypeFilter((s) => { const n = new Set(s); n.has(t) ? n.delete(t) : n.add(t); return n; }),
    openEditor: (t: Item | { type: ItemType; date?: string }) => setEditing(t),
    showConfirmations: shareMode ? shareMode.showConfirmations : true, showCosts: shareMode ? shareMode.showCosts : true,
    dayColor: (date: string) => DAY_PALETTE[(dayIdx.get(date) ?? 0) % DAY_PALETTE.length], dayIndex: (date: string) => dayIdx.get(date) ?? 0,
    flyTo: (lng: number, lat: number) => flyRef.current(lng, lat), registerFlyTo: (fn: (lng: number, lat: number) => void) => { flyRef.current = fn; },
  }), [selectedId, setSelectedId, hoverId, dayFilter, typeFilter, colorBy, readOnly, shareMode, dayIdx]);

  const counts = useMemo(() => { const c: Partial<Record<ItemType, number>> = {}; for (const i of trip.items) c[i.type] = (c[i.type] ?? 0) + 1; return c; }, [trip.items]);
  const total = useMemo(() => { const m = new Map<string, number>(); for (const i of trip.items) if (i.costAmount && i.costCurrency && i.status !== "cancelled") m.set(i.costCurrency, (m.get(i.costCurrency) ?? 0) + i.costAmount); return [...m.entries()]; }, [trip.items]);

  return (
    <TripUIContext.Provider value={ui}>
      <div className="h-full flex flex-col">
        <TopBar>
          <Link to="/" className="btn-ghost px-1.5 -ml-2 hidden sm:inline-flex" title="All trips"><ChevronLeft size={18} /></Link>
          <span className="text-2xl">{trip.emoji}</span>
          <div className="min-w-0 flex-1"><div className="font-display font-bold text-[17px] leading-tight truncate">{trip.name}</div><div className="text-[11.5px] text-ink-2 truncate">{fmtRange(trip.startDate, trip.endDate)}{days.length ? ` · ${days.length} days` : ""}{total.length ? ` · ${total.map(([c, a]) => new Intl.NumberFormat("en-GB", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(a)).join(" + ")}` : ""}</div></div>
          <div className="hidden md:flex items-center -space-x-1.5 mr-2">{trip.members.map((m) => <span key={m.userId} className="relative"><Avatar name={m.name} color={m.color} size={26} title={`${m.name} · ${m.role}`} />{presence.some((p) => p.userId === m.userId) && <span className="absolute -bottom-0 -right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" title="online" />}</span>)}</div>
          {!shareMode && <span title={connected ? "Live updates connected" : "Reconnecting…"} className={connected ? "text-emerald-600" : "text-ink-3"}>{connected ? <Wifi size={15} /> : <WifiOff size={15} />}</span>}
          {!shareMode && <button className="btn-ghost" onClick={() => setPanel("live")} title="Live map & location sharing"><Radio size={16} />{travelers.length > 0 && <span className="text-xs font-semibold text-emerald-700">{travelers.length}</span>}</button>}
          {!shareMode && <button className="btn-ghost hidden sm:inline-flex" onClick={() => setPanel("activity")} title="Activity"><ActivityIcon size={16} /></button>}
          {!shareMode && <button className="btn-ghost" onClick={() => setPanel("share")} title="Share"><Share2 size={16} /><span className="hidden lg:inline">Share</span></button>}
          {!readOnly && (
            <div className="relative">
              <button className="btn-primary" onClick={() => setAddMenu(!addMenu)}><Plus size={16} /><span className="hidden sm:inline">Add</span></button>
              {addMenu && <div className="absolute right-0 top-full mt-1 card p-1.5 w-44 z-30 fade-up" onMouseLeave={() => setAddMenu(false)}>{ITEM_TYPES.map((t) => <button key={t} className="w-full text-left btn-ghost justify-start" onClick={() => { setAddMenu(false); setEditing({ type: t, date: dayFilter ?? undefined }); }}>{TYPE_META[t].emoji} {TYPE_META[t].label}</button>)}</div>}
            </div>
          )}
        </TopBar>

        {shareMode && <div className="bg-amber-50 border-b border-amber-200 text-amber-900 text-xs px-4 py-1.5 text-center">Shared view{shareMode.label ? ` · ${shareMode.label}` : ""} · read-only{!shareMode.showConfirmations && " · booking references hidden"}</div>}

        {/* Filter bar */}
        <div className="border-b border-line bg-white/70 px-3 py-1.5 flex items-center gap-1.5 overflow-x-auto scrollbar-thin shrink-0">
          <button onClick={() => setDayFilter(null)} className={`chip py-1 whitespace-nowrap ${!dayFilter ? "bg-ink text-white border-ink" : "hover:bg-paper-2"}`}>All days</button>
          {days.map((d, i) => <button key={d.date} onClick={() => setDayFilter(dayFilter === d.date ? null : d.date)} className={`chip py-1 whitespace-nowrap ${dayFilter === d.date ? "text-white" : "hover:bg-paper-2"}`} style={dayFilter === d.date ? { background: DAY_PALETTE[i % DAY_PALETTE.length], borderColor: DAY_PALETTE[i % DAY_PALETTE.length] } : {}}><span className="font-bold">D{i + 1}</span> {fmtDayShort(d.date)}</button>)}
          <span className="w-px h-5 bg-line mx-1 shrink-0" />
          {ITEM_TYPES.filter((t) => counts[t]).map((t) => <button key={t} onClick={() => ui.toggleType(t)} className={`chip py-1 whitespace-nowrap ${typeFilter.has(t) ? "text-white" : "hover:bg-paper-2"}`} style={typeFilter.has(t) ? { background: TYPE_META[t].color, borderColor: TYPE_META[t].color } : {}}>{TYPE_META[t].emoji} {counts[t]}</button>)}
        </div>

        <div className="flex-1 min-h-0 flex">
          <aside className={`${mobileView === "list" ? "flex" : "hidden"} lg:flex flex-col w-full lg:w-[500px] xl:w-[560px] shrink-0 border-r border-line overflow-y-auto scrollbar-thin bg-paper`}>
            <Timeline trip={trip} />
          </aside>
          <main className={`${mobileView === "map" ? "block" : "hidden"} lg:block flex-1 min-w-0 relative`}>
            <TripMap trip={trip} travelers={travelers} me={me} />
          </main>
        </div>

        <div className="lg:hidden fixed bottom-4 left-1/2 -translate-x-1/2 card p-1 flex gap-1 z-30">
          <button onClick={() => setMobileView("list")} className={`btn ${mobileView === "list" ? "bg-ink text-white" : ""}`}><List size={16} /> Plan</button>
          <button onClick={() => setMobileView("map")} className={`btn ${mobileView === "map" ? "bg-ink text-white" : ""}`}><MapIcon size={16} /> Map</button>
        </div>

        {editing && <ItemEditor target={editing} trip={trip} onClose={() => setEditing(null)} />}
        {panel === "share" && <SharePanel trip={trip} me={me} onClose={() => setPanel(null)} />}
        {panel === "activity" && <ActivityPanel trip={trip} onClose={() => setPanel(null)} />}
        {panel === "live" && <LivePanel trip={trip} me={me} travelers={travelers} onClose={() => setPanel(null)} />}
      </div>
    </TripUIContext.Provider>
  );
}
