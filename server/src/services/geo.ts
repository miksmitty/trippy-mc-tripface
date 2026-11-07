import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Airport, GeocodeResult } from "@tmt/shared";

const here = dirname(fileURLToPath(import.meta.url));
const AIRPORTS: Airport[] = JSON.parse(readFileSync(resolve(here, "../../data/airports.min.json"), "utf8"));
const BY_IATA = new Map(AIRPORTS.map((a) => [a.iata, a]));

// Rough "importance" so LHR beats a tiny strip when searching "london"
const MAJOR = new Set(["LHR","LGW","STN","LTN","LCY","JFK","EWR","LGA","LAX","SFO","ORD","ATL","DFW","DEN","SEA","BOS","MIA","IAD","DCA","YYZ","YVR","CDG","ORY","AMS","FRA","MUC","MAD","BCN","FCO","MXP","LIN","ZRH","GVA","VIE","CPH","ARN","OSL","HEL","DUB","EDI","MAN","BHX","BRS","LIS","ATH","IST","DXB","DOH","AUH","SIN","HKG","NRT","HND","KIX","ICN","PEK","PVG","BKK","KUL","CGK","DEL","BOM","SYD","MEL","BNE","AKL","JNB","CPT","GRU","EZE","MEX","CUN","HNL","LAS","PHX","SAN","AUS","IAH","MSP","DTW","PHL","CLT","SLC","PDX","YUL","BER","HAM","DUS","BRU","PRG","WAW","BUD","KEF","TLV","CAI","NBO","BOG","LIM","SCL","GIG","ITM","CTS","FUK","OKA","NGO","TPE","MNL","HAN","SGN","DPS","PER","ADL","CHC","WLG","ZQN"]);

export function airportByIata(iata: string): Airport | null { return BY_IATA.get(iata.toUpperCase()) ?? null; }

export function searchAirports(q: string, limit = 8): Airport[] {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const exact = BY_IATA.get(s.toUpperCase());
  const scored = AIRPORTS.map((a) => {
    let score = 0;
    if (a.iata.toLowerCase() === s) score += 100;
    else if (a.iata.toLowerCase().startsWith(s)) score += 40;
    if (a.city.toLowerCase() === s) score += 50;
    else if (a.city.toLowerCase().startsWith(s)) score += 30;
    else if (a.city.toLowerCase().includes(s)) score += 10;
    if (a.name.toLowerCase().includes(s)) score += 15;
    if (score && MAJOR.has(a.iata)) score += 25;
    if (score && /international/i.test(a.name)) score += 5;
    return { a, score };
  }).filter((x) => x.score > 0).sort((x, y) => y.score - x.score).slice(0, limit).map((x) => x.a);
  if (exact && !scored.includes(exact)) scored.unshift(exact);
  return scored.slice(0, limit);
}

/** Free geocoding via Komoot's Photon (OpenStreetMap). Polite use only: personal app, low volume. */
export async function geocode(q: string, opts: { lat?: number; lng?: number; limit?: number } = {}): Promise<GeocodeResult[]> {
  const url = new URL("https://photon.komoot.io/api/");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", String(opts.limit ?? 6));
  url.searchParams.set("lang", "en");
  if (opts.lat != null && opts.lng != null) { url.searchParams.set("lat", String(opts.lat)); url.searchParams.set("lon", String(opts.lng)); }
  const res = await fetch(url, { headers: { "User-Agent": "trippy-mc-tripface/0.1 (personal trip planner)" }, signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`Geocoder returned ${res.status}`);
  const json = (await res.json()) as { features: Array<{ geometry: { coordinates: [number, number] }; properties: Record<string, string | undefined> }> };
  return json.features.map((f) => {
    const p = f.properties;
    const name = p.name ?? p.street ?? q;
    const bits = [p.housenumber && p.street ? `${p.housenumber} ${p.street}` : p.street, p.district, p.city ?? p.town ?? p.village, p.postcode, p.country].filter(Boolean);
    return { name, address: bits.join(", "), lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0], kind: [p.osm_key, p.osm_value].filter(Boolean).join(":") };
  });
}
