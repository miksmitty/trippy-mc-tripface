import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl, { type LngLatBoundsLike, Map as MLMap, Marker } from "maplibre-gl";
import { Crosshair, Layers, Maximize2 } from "lucide-react";
import { DAY_PALETTE, TYPE_META, bucketByDay, type Item, type TravelerLocation, type TripDetail } from "@tmt/shared";
import { useTripUI } from "../lib/tripui";
import { relTime } from "../lib/time";

const STYLE = "https://tiles.openfreemap.org/styles/liberty";
const MODE_ICON: Record<string, string> = { taxi: "🚕", rideshare: "🚗", train: "🚄", bus: "🚌", ferry: "⛴️", car_hire: "🚙", shuttle: "🚐", metro: "🚇", walk: "🚶", bike: "🚲", other: "➡️" };

function greatCircle(a: [number, number], b: [number, number], n = 64): [number, number][] {
  const toRad = (d: number) => (d * Math.PI) / 180, toDeg = (r: number) => (r * 180) / Math.PI;
  const [lon1, lat1, lon2, lat2] = [toRad(a[0]), toRad(a[1]), toRad(b[0]), toRad(b[1])];
  const d = 2 * Math.asin(Math.sqrt(Math.sin((lat2 - lat1) / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2));
  if (d === 0) return [a, b];
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const f = i / n, A = Math.sin((1 - f) * d) / Math.sin(d), B = Math.sin(f * d) / Math.sin(d);
    const x = A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
    const y = A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
    const z = A * Math.sin(lat1) + B * Math.sin(lat2);
    pts.push([toDeg(Math.atan2(y, x)), toDeg(Math.atan2(z, Math.sqrt(x * x + y * y)))]);
  }
  // unwrap antimeridian crossings
  for (let i = 1; i < pts.length; i++) { while (pts[i][0] - pts[i - 1][0] > 180) pts[i][0] -= 360; while (pts[i][0] - pts[i - 1][0] < -180) pts[i][0] += 360; }
  return pts;
}

const hasLL = (l?: { lat?: number; lng?: number } | null): l is { lat: number; lng: number; name: string } => !!l && l.lat != null && l.lng != null;

export function TripMap({ trip, travelers, me }: { trip: TripDetail; travelers: TravelerLocation[]; me?: { id: string } }) {
  const ui = useTripUI();
  const el = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MLMap | null>(null);
  const markers = useRef<Marker[]>([]);
  const fitKey = useRef<string>("");
  const [ready, setReady] = useState(false);
  const [layers, setLayers] = useState({ routes: true, flights: true, travelers: true });
  const [showLayers, setShowLayers] = useState(false);

  const visibleItems = useMemo(() => trip.items.filter((i) => i.status !== "cancelled" && (ui.typeFilter.size === 0 || ui.typeFilter.has(i.type))), [trip.items, ui.typeFilter]);
  const days = useMemo(() => bucketByDay(trip.items, trip.startDate, trip.endDate), [trip.items, trip.startDate, trip.endDate]);
  const dayItems = useMemo(() => ui.dayFilter ? new Set([...(days.find((d) => d.date === ui.dayFilter)?.items ?? []), ...(days.find((d) => d.date === ui.dayFilter)?.stays ?? [])].map((i) => i.id)) : null, [days, ui.dayFilter]);
  const shown = useMemo(() => dayItems ? visibleItems.filter((i) => dayItems.has(i.id)) : visibleItems, [visibleItems, dayItems]);

  // init
  useEffect(() => {
    if (!el.current || mapRef.current) return;
    const map = new maplibregl.Map({ container: el.current, style: STYLE, center: [10, 30], zoom: 1.5, attributionControl: { compact: true } });
    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
    map.on("load", () => {
      map.addSource("routes", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addSource("flights", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({ id: "routes-line", type: "line", source: "routes", paint: { "line-color": ["get", "color"], "line-width": 3, "line-opacity": 0.75 }, layout: { "line-cap": "round", "line-join": "round" } });
      map.addLayer({ id: "flights-line", type: "line", source: "flights", paint: { "line-color": "#0ea5e9", "line-width": 2, "line-dasharray": [2, 2], "line-opacity": 0.8 } });
      setReady(true);
    });
    mapRef.current = map;
    ui.registerFlyTo((lng, lat) => map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 13), speed: 1.4 }));
    return () => { map.remove(); mapRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // markers + lines
  useEffect(() => {
    const map = mapRef.current; if (!map || !ready) return;
    markers.current.forEach((m) => m.remove()); markers.current = [];
    const bounds = new maplibregl.LngLatBounds();
    let any = false;
    const add = (lng: number, lat: number, node: HTMLElement, anchor: "bottom" | "center" = "bottom") => { const m = new Marker({ element: node, anchor }).setLngLat([lng, lat]).addTo(map); markers.current.push(m); bounds.extend([lng, lat]); any = true; return m; };
    const accentFor = (it: Item) => ui.colorBy === "day" ? ui.dayColor(itemDate(it)) : TYPE_META[it.type].color;

    const routeFeatures: GeoJSON.Feature[] = [];
    const flightFeatures: GeoJSON.Feature[] = [];

    for (const it of shown) {
      const accent = accentFor(it);
      if (it.type === "flight") {
        if (hasLL(it.location) && hasLL(it.endLocation) && layers.flights) {
          flightFeatures.push({ type: "Feature", properties: { id: it.id }, geometry: { type: "LineString", coordinates: greatCircle([it.location.lng, it.location.lat], [it.endLocation.lng, it.endLocation.lat]) } });
          for (const [loc, which] of [[it.location, "from"], [it.endLocation, "to"]] as const) {
            const node = pin("✈", "#0ea5e9", it, which === "from" ? `${it.title} · departs ${loc.name}` : `${it.title} · arrives ${loc.name}`);
            add(loc.lng, loc.lat, node);
          }
        }
        continue;
      }
      if (hasLL(it.location)) {
        const node = it.type === "lodging" ? home(accent, it) : it.type === "meetup" ? beacon(it) : pin(it.type === "transfer" ? MODE_ICON[(it.details as { mode?: string }).mode ?? "other"] : TYPE_META[it.type].emoji, accent, it, it.title);
        add(it.location.lng, it.location.lat, node, it.type === "lodging" || it.type === "meetup" ? "center" : "bottom");
      }
      if (it.type === "transfer" && hasLL(it.location) && hasLL(it.endLocation) && layers.routes) {
        routeFeatures.push({ type: "Feature", properties: { color: accent }, geometry: { type: "LineString", coordinates: [[it.location.lng, it.location.lat], [it.endLocation.lng, it.endLocation.lat]] } });
        const node = pin("🏁", accent, it, `${it.title} · drop-off ${it.endLocation.name}`);
        add(it.endLocation.lng, it.endLocation.lat, node);
      }
    }
    // day routes through stops (non-flight, with coords), in time order
    if (layers.routes) {
      for (const d of days) {
        if (ui.dayFilter && d.date !== ui.dayFilter) continue;
        const stops = d.items.filter((i) => shown.includes(i) && i.type !== "flight" && i.type !== "transfer" && hasLL(i.location)).map((i) => [i.location!.lng!, i.location!.lat!] as [number, number]);
        const stay = d.stays[0] ?? d.items.find((i) => i.type === "lodging");
        if (stay && hasLL(stay.location) && stops.length) { stops.unshift([stay.location.lng, stay.location.lat]); }
        if (stops.length >= 2) routeFeatures.push({ type: "Feature", properties: { color: ui.dayColor(d.date) }, geometry: { type: "LineString", coordinates: stops } });
      }
    }
    (map.getSource("routes") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features: routeFeatures });
    (map.getSource("flights") as maplibregl.GeoJSONSource).setData({ type: "FeatureCollection", features: flightFeatures });

    if (layers.travelers) for (const t of travelers) {
      const stale = Date.now() - new Date(t.recordedAt).getTime() > 30 * 60_000;
      const node = document.createElement("div");
      node.className = `marker marker-traveler ${stale ? "stale" : "pulse-ring"}`;
      node.style.background = t.color; node.style.color = "white";
      node.textContent = t.name.slice(0, 1).toUpperCase();
      node.title = `${t.name}${t.userId === me?.id ? " (you)" : ""} · ${relTime(t.recordedAt)}${t.label ? ` · ${t.label}` : ""}`;
      const popup = new maplibregl.Popup({ offset: 20, closeButton: false }).setHTML(`<b>${esc(t.name)}</b><div style="color:#57534e;font-size:12px">${relTime(t.recordedAt)}${t.label ? " · " + esc(t.label) : ""}${t.accuracy ? ` · ±${Math.round(t.accuracy)}m` : ""}</div>`);
      add(t.lng, t.lat, node, "center").setPopup(popup);
    }

    const key = `${ui.dayFilter}|${[...ui.typeFilter].join(",")}|${shown.length > 0}`;
    if (any && key !== fitKey.current) { map.fitBounds(bounds as LngLatBoundsLike, { padding: 70, maxZoom: 13, duration: 600 }); fitKey.current = key; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, shown, days, travelers, layers, ui.colorBy, ui.dayFilter]);

  // highlight active/hover
  useEffect(() => {
    for (const m of markers.current) { const e = m.getElement(); const id = e.dataset.item; e.classList.toggle("active", !!id && (id === ui.selectedId || id === ui.hoverId)); }
  }, [ui.selectedId, ui.hoverId, shown]);

  function pin(emoji: string, color: string, it: Item, title: string) {
    const node = document.createElement("div"); node.className = "marker"; node.dataset.item = it.id; node.title = title;
    node.innerHTML = `<div class="marker-pin" style="background:${color}"><span>${emoji}</span></div>`;
    wire(node, it); return node;
  }
  function home(color: string, it: Item) {
    const node = document.createElement("div"); node.className = "marker marker-home"; node.dataset.item = it.id; node.title = it.title; node.style.background = color; node.textContent = "🛏️"; wire(node, it); return node;
  }
  function beacon(it: Item) {
    const node = document.createElement("div"); node.className = "marker marker-beacon pulse-ring"; node.dataset.item = it.id; node.title = it.title; node.textContent = "📍"; wire(node, it); return node;
  }
  function wire(node: HTMLElement, it: Item) {
    node.addEventListener("click", (e) => { e.stopPropagation(); ui.setSelectedId(it.id); });
    node.addEventListener("mouseenter", () => ui.setHoverId(it.id));
    node.addEventListener("mouseleave", () => ui.setHoverId(null));
  }
  function itemDate(it: Item) { return new Intl.DateTimeFormat("en-CA", { timeZone: it.tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(it.startAt)); }

  const fitAll = () => { const map = mapRef.current; if (!map) return; const b = new maplibregl.LngLatBounds(); let any = false; for (const m of markers.current) { b.extend(m.getLngLat()); any = true; } if (any) map.fitBounds(b, { padding: 70, maxZoom: 13 }); };
  const locate = () => { navigator.geolocation?.getCurrentPosition((p) => mapRef.current?.flyTo({ center: [p.coords.longitude, p.coords.latitude], zoom: 14 })); };

  return (
    <div className="relative h-full w-full">
      <div ref={el} style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }} />
      <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center gap-1.5 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-1 card p-1">
          <button onClick={() => ui.setColorBy("day")} className={`btn text-xs py-1 ${ui.colorBy === "day" ? "bg-ink text-white" : "hover:bg-paper-2"}`}>By day</button>
          <button onClick={() => ui.setColorBy("type")} className={`btn text-xs py-1 ${ui.colorBy === "type" ? "bg-ink text-white" : "hover:bg-paper-2"}`}>By type</button>
        </div>
        <div className="pointer-events-auto relative">
          <button onClick={() => setShowLayers(!showLayers)} className="card btn text-xs py-1.5"><Layers size={14} /> Layers</button>
          {showLayers && (
            <div className="absolute top-full mt-1 left-0 card p-2 text-xs space-y-1 w-40 fade-up">
              {(["routes", "flights", "travelers"] as const).map((k) => <label key={k} className="flex items-center gap-2 px-1 py-0.5 cursor-pointer capitalize"><input type="checkbox" checked={layers[k]} onChange={(e) => setLayers({ ...layers, [k]: e.target.checked })} /> {k === "routes" ? "Day routes & transfers" : k === "flights" ? "Flight arcs" : "Travellers"}</label>)}
            </div>
          )}
        </div>
        <div className="flex-1" />
        <button onClick={fitAll} className="pointer-events-auto card btn text-xs py-1.5" title="Fit to visible"><Maximize2 size={14} /></button>
        <button onClick={locate} className="pointer-events-auto card btn text-xs py-1.5" title="Where am I"><Crosshair size={14} /></button>
      </div>
      {ui.colorBy === "type" && (
        <div className="absolute bottom-3 left-3 card px-2.5 py-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px]">
          {Object.entries(TYPE_META).filter(([k]) => k !== "note").map(([k, m]) => <span key={k} className="inline-flex items-center gap-1"><span className="w-2.5 h-2.5 rounded-full" style={{ background: m.color }} />{m.label}</span>)}
        </div>
      )}
      {ui.colorBy === "day" && days.length > 0 && (
        <div className="absolute bottom-3 left-3 card px-2.5 py-1.5 flex flex-wrap gap-x-2.5 gap-y-1 text-[11px] max-w-[60%]">
          {days.map((d, i) => <button key={d.date} onClick={() => ui.setDayFilter(ui.dayFilter === d.date ? null : d.date)} className={`inline-flex items-center gap-1 ${ui.dayFilter && ui.dayFilter !== d.date ? "opacity-40" : ""}`}><span className="w-2.5 h-2.5 rounded-full" style={{ background: DAY_PALETTE[i % DAY_PALETTE.length] }} />D{i + 1}</button>)}
        </div>
      )}
    </div>
  );
}

function esc(s: string) { return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!); }
