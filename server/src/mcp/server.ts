import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { Principal } from "../auth.js";
import * as T from "../services/trips.js";
import * as I from "../services/items.js";
import * as L from "../services/locations.js";
import { listActivity } from "../services/activity.js";
import { geocode, searchAirports } from "../services/geo.js";
import { tripToMarkdown } from "../services/export.js";
import { HttpError } from "../services/errors.js";
import { DETAILS_BY_TYPE, ITEM_STATUSES, ITEM_TYPES, ItemCreateSchema, ItemUpdateSchema, TRANSFER_MODES, TripCreateSchema, TripUpdateSchema, bucketByDay, localTime, minutesBetween, fmtDuration } from "@tmt/shared";

const text = (s: string) => ({ content: [{ type: "text" as const, text: s }] });
const json = (v: unknown) => text(JSON.stringify(v, null, 2));

function wrap<A extends unknown[]>(fn: (...a: A) => unknown) {
  return async (...a: A) => {
    try { const r = await fn(...a); return typeof r === "string" ? text(r) : json(r); }
    catch (e) { const msg = e instanceof HttpError ? `${e.status}: ${e.message}${e.details ? "\n" + JSON.stringify(e.details, null, 2) : ""}` : (e as Error).message; return { ...text(`Error — ${msg}`), isError: true }; }
  };
}

const TRIP_ARG = z.string().describe("Trip id or slug (from list_trips)");

export function buildMcpServer(p: Principal): McpServer {
  const s = new McpServer({ name: "trippy-mc-tripface", version: "0.1.0" }, {
    instructions: [
      "You are operating a personal trip planner on behalf of the key owner. Trips contain items of type flight, lodging, transfer, restaurant, activity, meetup and note.",
      "All times are ISO-8601 WITH the local UTC offset (e.g. 2026-03-14T09:30:00+09:00). Give tz (IANA) when you know it; flights infer tz and coordinates from IATA codes.",
      "Prefer get_trip_markdown to read an itinerary, add_item/update_item/delete_item to change it, geocode/search_airports to resolve places. Every change is attributed to this API key in the activity log.",
      "Per-type details schemas: " + JSON.stringify(Object.fromEntries(Object.entries(DETAILS_BY_TYPE).map(([k, v]) => [k, Object.keys((v as z.ZodObject<z.ZodRawShape>).shape ?? {})]))),
      `Transfer modes: ${TRANSFER_MODES.join(", ")}. Statuses: ${ITEM_STATUSES.join(", ")}.`,
    ].join("\n"),
  });
  const { user, actor } = p;

  s.registerTool("list_trips", { title: "List trips", description: "Trips the user can see, with role and item counts." }, wrap(() => T.listTrips(user)));

  s.registerTool("get_trip", { title: "Get trip (JSON)", description: "Full trip with every item (ids, times, locations, details) and members.", inputSchema: { trip: TRIP_ARG } }, wrap(({ trip }) => T.getTripDetail(user, trip)));

  s.registerTool("get_trip_markdown", { title: "Get trip (Markdown)", description: "Compact day-by-day itinerary with item ids. Best first call when asked about a trip.", inputSchema: { trip: TRIP_ARG } }, wrap(({ trip }) => tripToMarkdown(T.getTripDetail(user, trip), { includeIds: true })));

  s.registerTool("create_trip", { title: "Create trip", description: "Create a new trip. Dates are YYYY-MM-DD.", inputSchema: TripCreateSchema.shape }, wrap((input) => T.createTrip(user, actor, TripCreateSchema.parse(input))));

  s.registerTool("update_trip", { title: "Update trip", description: "Change name, dates, emoji, colour, currency or home timezone.", inputSchema: { trip: TRIP_ARG, ...TripUpdateSchema.shape } }, wrap(({ trip, ...patch }) => T.updateTrip(user, actor, trip, TripUpdateSchema.parse(patch))));

  s.registerTool("add_item", {
    title: "Add item",
    description: `Add a ${ITEM_TYPES.join("/")} to a trip. Flights: details {from:{iata}, to:{iata}, airlineCode, flightNumber, seat, cabin, terminal...}; title can be omitted. Lodging: startAt = check-in, endAt = check-out, location = property. Transfer: details.mode required, location = pickup, endLocation = drop-off. Restaurant/activity: location is the venue. Meetup: a place + time where travellers converge; shows as a beacon on the live map.`,
    inputSchema: { trip: TRIP_ARG, item: ItemCreateSchema.describe("The item to add") },
  }, wrap(({ trip, item }) => I.createItem(user, actor, trip, ItemCreateSchema.parse(item))));

  s.registerTool("update_item", { title: "Update item", description: "Partial update. Only send fields that change; details are merged with existing details.", inputSchema: { trip: TRIP_ARG, itemId: z.string(), patch: ItemUpdateSchema } }, wrap(({ trip, itemId, patch }) => I.updateItem(user, actor, trip, itemId, ItemUpdateSchema.parse(patch))));

  s.registerTool("delete_item", { title: "Delete item", description: "Remove an item. A snapshot is kept in the activity log.", inputSchema: { trip: TRIP_ARG, itemId: z.string() } }, wrap(({ trip, itemId }) => { I.deleteItem(user, actor, trip, itemId); return { ok: true }; }));

  s.registerTool("set_item_status", { title: "Set status", description: "Mark an item planned / booked / confirmed / cancelled, optionally with a confirmation code.", inputSchema: { trip: TRIP_ARG, itemId: z.string(), status: z.enum(ITEM_STATUSES), confirmationCode: z.string().optional() } },
    wrap(({ trip, itemId, status, confirmationCode }) => I.updateItem(user, actor, trip, itemId, { status, ...(confirmationCode ? { confirmationCode } : {}) })));

  s.registerTool("find_gaps", { title: "Find free time", description: "List unplanned windows per day (≥ minMinutes) so you can suggest things to do.", inputSchema: { trip: TRIP_ARG, minMinutes: z.number().int().positive().default(120) } }, wrap(({ trip, minMinutes }) => {
    const d = T.getTripDetail(user, trip);
    const out: { date: string; from: string; to: string; minutes: number }[] = [];
    for (const day of bucketByDay(d.items, d.startDate, d.endDate)) {
      const timed = day.items.filter((i) => i.type !== "lodging" && i.type !== "note" && i.status !== "cancelled");
      const tz = timed[0]?.tz ?? day.stays[0]?.tz ?? d.homeTz;
      let cursor = `${day.date}T09:00:00`;
      const toIso = (local: string) => new Date(new Date(local + "Z").getTime() - tzOffsetMs(tz, new Date(local + "Z"))).toISOString();
      let cursorIso = toIso(cursor);
      for (const it of timed) {
        const gap = minutesBetween(cursorIso, it.startAt);
        if (gap >= minMinutes) out.push({ date: day.date, from: localTime(cursorIso, tz), to: localTime(it.startAt, tz), minutes: gap });
        const end = it.endAt ?? new Date(new Date(it.startAt).getTime() + 90 * 60000).toISOString();
        if (new Date(end) > new Date(cursorIso)) cursorIso = end;
      }
      const dayEnd = toIso(`${day.date}T22:00:00`);
      const tail = minutesBetween(cursorIso, dayEnd);
      if (tail >= minMinutes) out.push({ date: day.date, from: localTime(cursorIso, tz), to: "22:00", minutes: tail });
      void cursor;
    }
    return out;
  }));

  s.registerTool("search_airports", { title: "Search airports", description: "Find IATA codes by city, name or code.", inputSchema: { q: z.string() } }, wrap(({ q }) => searchAirports(q)));

  s.registerTool("geocode", { title: "Geocode place", description: "Resolve a place/address to name, address, lat, lng (OpenStreetMap). Pass near lat/lng to bias results.", inputSchema: { q: z.string(), lat: z.number().optional(), lng: z.number().optional() } }, wrap(({ q, lat, lng }) => geocode(q, { lat, lng })));

  s.registerTool("get_travelers", { title: "Where is everyone", description: "Latest shared location of each traveller on the trip.", inputSchema: { trip: TRIP_ARG } }, wrap(({ trip }) => L.listTravelerLocations(user, trip).map((l) => ({ ...l, ageMinutes: minutesBetween(l.recordedAt, new Date().toISOString()) }))));

  s.registerTool("get_activity", { title: "Recent changes", description: "Who changed what, including other agents.", inputSchema: { trip: TRIP_ARG, limit: z.number().int().max(200).default(30) } }, wrap(({ trip, limit }) => { const { trip: t } = T.requireAccess(trip, user); return listActivity(t.id, limit); }));

  s.registerTool("invite_member", { title: "Invite member", description: "Share the trip with someone by email as editor or viewer.", inputSchema: { trip: TRIP_ARG, email: z.string().email(), role: z.enum(["editor", "viewer"]).default("editor") } }, wrap(({ trip, email, role }) => T.invite(user, actor, trip, email, role)));

  s.registerTool("create_share_link", { title: "Create share link", description: "Make a view-only link. Returns the token; the URL is <base>/s/<token>.", inputSchema: { trip: TRIP_ARG, label: z.string().optional(), showConfirmations: z.boolean().default(false), showCosts: z.boolean().default(false) } }, wrap((a) => T.createShareLink(user, actor, a.trip, a)));

  s.registerTool("flight_summary", { title: "Flight summary", description: "All flights with durations and layovers.", inputSchema: { trip: TRIP_ARG } }, wrap(({ trip }) => {
    const d = T.getTripDetail(user, trip);
    const flights = d.items.filter((i) => i.type === "flight");
    return flights.map((f, idx) => {
      const next = flights[idx + 1];
      const layover = next && f.endAt && (next.details as any).from?.iata === (f.details as any).to?.iata ? fmtDuration(minutesBetween(f.endAt, next.startAt)) : null;
      return { id: f.id, title: f.title, status: f.status, departs: `${localTime(f.startAt, f.tz)} ${f.tz}`, arrives: f.endAt ? `${localTime(f.endAt, f.endTz ?? f.tz)} ${f.endTz}` : null, duration: f.endAt ? fmtDuration(minutesBetween(f.startAt, f.endAt)) : null, layoverBeforeNext: layover, confirmation: f.confirmationCode, details: f.details };
    });
  }));

  return s;
}

function tzOffsetMs(tz: string, at: Date): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(at);
    const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    return Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) - at.getTime();
  } catch { return 0; }
}
