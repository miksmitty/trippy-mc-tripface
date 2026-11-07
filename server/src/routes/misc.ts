import { createRoute } from "@hono/zod-openapi";
import { errors, jsonRes, makeApp, z } from "./common.js";
import { geocode, searchAirports } from "../services/geo.js";
import { resolveShareToken } from "../services/trips.js";
import { AirportSchema, GeocodeResultSchema, TripDetailSchema } from "@tmt/shared";
import { tripToIcs, tripToMarkdown } from "../services/export.js";

export const miscApp = makeApp();

miscApp.openapi(createRoute({ method: "get", path: "/geo/airports", tags: ["geo"], summary: "Search airports by IATA, city or name", request: { query: z.object({ q: z.string().min(1) }) }, responses: { 200: jsonRes(z.array(AirportSchema)) } }), async (c) =>
  c.json(searchAirports(c.req.valid("query").q), 200));

miscApp.openapi(createRoute({ method: "get", path: "/geo/search", tags: ["geo"], summary: "Geocode a place name / address (OpenStreetMap via Photon)", request: { query: z.object({ q: z.string().min(2), lat: z.coerce.number().optional(), lng: z.coerce.number().optional(), limit: z.coerce.number().optional() }) }, responses: { 200: jsonRes(z.array(GeocodeResultSchema)) } }), async (c) => {
  const q = c.req.valid("query");
  return c.json(await geocode(q.q, { lat: q.lat, lng: q.lng, limit: q.limit }), 200);
});

miscApp.openapi(createRoute({ method: "get", path: "/share/{token}", tags: ["sharing"], summary: "Read a trip through a view-only share link (no auth)", request: { params: z.object({ token: z.string() }) }, responses: { 200: jsonRes(TripDetailSchema.extend({ share: z.object({ label: z.string().nullable(), showConfirmations: z.boolean(), showCosts: z.boolean() }) })), ...errors } }), async (c) => {
  const { link, detail } = resolveShareToken(c.req.valid("param").token);
  return c.json({ ...detail, share: { label: link.label, showConfirmations: link.showConfirmations, showCosts: link.showCosts } }, 200);
});

miscApp.openapi(createRoute({ method: "get", path: "/share/{token}/summary.md", tags: ["sharing"], summary: "Markdown itinerary via share link", request: { params: z.object({ token: z.string() }) }, responses: { 200: { description: "Markdown", content: { "text/markdown": { schema: z.string() } } }, ...errors } }), async (c) => {
  const { detail } = resolveShareToken(c.req.valid("param").token);
  return c.text(tripToMarkdown(detail), 200, { "content-type": "text/markdown; charset=utf-8" }) as any;
});

miscApp.openapi(createRoute({ method: "get", path: "/share/{token}/calendar.ics", tags: ["sharing"], summary: "iCalendar feed via share link (subscribe from any calendar app)", request: { params: z.object({ token: z.string() }) }, responses: { 200: { description: "ICS", content: { "text/calendar": { schema: z.string() } } }, ...errors } }), async (c) => {
  const { detail } = resolveShareToken(c.req.valid("param").token);
  return c.text(tripToIcs(detail, new URL(c.req.url).origin), 200, { "content-type": "text/calendar; charset=utf-8" }) as any;
});
