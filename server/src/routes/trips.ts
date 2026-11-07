import { createRoute } from "@hono/zod-openapi";
import { errors, jsonBody, jsonRes, makeApp, requirePrincipal, z } from "./common.js";
import * as T from "../services/trips.js";
import * as I from "../services/items.js";
import * as L from "../services/locations.js";
import { listActivity } from "../services/activity.js";
import { tripToIcs, tripToMarkdown } from "../services/export.js";
import { ActivitySchema, InviteSchema, ItemCreateSchema, ItemSchema, ItemUpdateSchema, LocationPingSchema, MemberSchema, ShareLinkCreateSchema, ShareLinkSchema, TravelerLocationSchema, TripCreateSchema, TripDetailSchema, TripSchema, TripUpdateSchema } from "@tmt/shared";

export const tripsApp = makeApp();
const tripParam = z.object({ trip: z.string().openapi({ param: { name: "trip", in: "path" }, description: "Trip id or slug", example: "japan-spring" }) });
const itemParam = tripParam.extend({ item: z.string().openapi({ param: { name: "item", in: "path" } }) });
const ok = jsonRes(z.object({ ok: z.boolean() }));

tripsApp.openapi(createRoute({ method: "get", path: "/trips", tags: ["trips"], summary: "List trips I can see", responses: { 200: jsonRes(z.array(TripSchema)), ...errors } }), async (c) => c.json(T.listTrips(requirePrincipal(c).user), 200));

tripsApp.openapi(createRoute({ method: "post", path: "/trips", tags: ["trips"], summary: "Create a trip", request: { body: jsonBody(TripCreateSchema) }, responses: { 200: jsonRes(TripSchema), ...errors } }), async (c) => {
  const p = requirePrincipal(c);
  return c.json(T.createTrip(p.user, p.actor, c.req.valid("json")), 200);
});

tripsApp.openapi(createRoute({ method: "get", path: "/trips/{trip}", tags: ["trips"], summary: "Get a trip with all items and members", request: { params: tripParam }, responses: { 200: jsonRes(TripDetailSchema), ...errors } }), async (c) =>
  c.json(T.getTripDetail(requirePrincipal(c).user, c.req.valid("param").trip), 200));

tripsApp.openapi(createRoute({ method: "patch", path: "/trips/{trip}", tags: ["trips"], summary: "Update trip settings", request: { params: tripParam, body: jsonBody(TripUpdateSchema) }, responses: { 200: jsonRes(TripSchema), ...errors } }), async (c) => {
  const p = requirePrincipal(c);
  return c.json(T.updateTrip(p.user, p.actor, c.req.valid("param").trip, c.req.valid("json")), 200);
});

tripsApp.openapi(createRoute({ method: "delete", path: "/trips/{trip}", tags: ["trips"], summary: "Delete a trip (owner only)", request: { params: tripParam }, responses: { 200: ok, ...errors } }), async (c) => {
  T.deleteTrip(requirePrincipal(c).user, c.req.valid("param").trip);
  return c.json({ ok: true }, 200);
});

tripsApp.openapi(createRoute({ method: "get", path: "/trips/{trip}/summary.md", tags: ["trips"], summary: "Human/agent readable Markdown itinerary", request: { params: tripParam }, responses: { 200: { description: "Markdown", content: { "text/markdown": { schema: z.string() } } }, ...errors } }), async (c) => {
  const d = T.getTripDetail(requirePrincipal(c).user, c.req.valid("param").trip);
  return c.text(tripToMarkdown(d, { includeIds: true }), 200, { "content-type": "text/markdown; charset=utf-8" }) as any;
});

tripsApp.openapi(createRoute({ method: "get", path: "/trips/{trip}/calendar.ics", tags: ["trips"], summary: "iCalendar feed of the trip", request: { params: tripParam }, responses: { 200: { description: "ICS", content: { "text/calendar": { schema: z.string() } } }, ...errors } }), async (c) => {
  const d = T.getTripDetail(requirePrincipal(c).user, c.req.valid("param").trip);
  const base = new URL(c.req.url).origin;
  return c.text(tripToIcs(d, base), 200, { "content-type": "text/calendar; charset=utf-8" }) as any;
});

// ---- items ----
tripsApp.openapi(createRoute({ method: "get", path: "/trips/{trip}/items", tags: ["items"], summary: "List items (sorted by start time)", request: { params: tripParam }, responses: { 200: jsonRes(z.array(ItemSchema)), ...errors } }), async (c) => {
  const p = requirePrincipal(c);
  const { trip } = T.requireAccess(c.req.valid("param").trip, p.user);
  return c.json(I.listItems(trip.id), 200);
});

tripsApp.openapi(createRoute({ method: "post", path: "/trips/{trip}/items", tags: ["items"], summary: "Add an item (flight, lodging, transfer, restaurant, activity, meetup, note)", description: "startAt/endAt must be ISO-8601 with the local UTC offset. Flights: give details.from.iata and details.to.iata and the server fills airport names, coordinates and timezones.", request: { params: tripParam, body: jsonBody(ItemCreateSchema) }, responses: { 200: jsonRes(ItemSchema), ...errors } }), async (c) => {
  const p = requirePrincipal(c);
  return c.json(I.createItem(p.user, p.actor, c.req.valid("param").trip, c.req.valid("json")), 200);
});

tripsApp.openapi(createRoute({ method: "get", path: "/trips/{trip}/items/{item}", tags: ["items"], summary: "Get one item", request: { params: itemParam }, responses: { 200: jsonRes(ItemSchema), ...errors } }), async (c) => {
  const { trip, item } = c.req.valid("param");
  return c.json(I.getItem(requirePrincipal(c).user, trip, item), 200);
});

tripsApp.openapi(createRoute({ method: "patch", path: "/trips/{trip}/items/{item}", tags: ["items"], summary: "Update an item (partial; details are merged)", request: { params: itemParam, body: jsonBody(ItemUpdateSchema) }, responses: { 200: jsonRes(ItemSchema), ...errors } }), async (c) => {
  const p = requirePrincipal(c);
  const { trip, item } = c.req.valid("param");
  return c.json(I.updateItem(p.user, p.actor, trip, item, c.req.valid("json")), 200);
});

tripsApp.openapi(createRoute({ method: "delete", path: "/trips/{trip}/items/{item}", tags: ["items"], summary: "Delete an item", request: { params: itemParam }, responses: { 200: ok, ...errors } }), async (c) => {
  const p = requirePrincipal(c);
  const { trip, item } = c.req.valid("param");
  I.deleteItem(p.user, p.actor, trip, item);
  return c.json({ ok: true }, 200);
});

// ---- members & invites ----
tripsApp.openapi(createRoute({ method: "get", path: "/trips/{trip}/members", tags: ["sharing"], summary: "List members and pending invites", request: { params: tripParam }, responses: { 200: jsonRes(z.object({ members: z.array(MemberSchema), invites: z.array(z.object({ id: z.string(), email: z.string(), role: z.string() })) })), ...errors } }), async (c) => {
  const { trip } = T.requireAccess(c.req.valid("param").trip, requirePrincipal(c).user);
  return c.json({ members: T.listMembers(trip.id), invites: T.listInvites(trip.id).map((i) => ({ id: i.id, email: i.email, role: i.role })) }, 200);
});
tripsApp.openapi(createRoute({ method: "post", path: "/trips/{trip}/members", tags: ["sharing"], summary: "Invite someone by email (joins immediately if they have an account)", request: { params: tripParam, body: jsonBody(InviteSchema) }, responses: { 200: jsonRes(z.object({ status: z.enum(["added", "invited"]), member: MemberSchema.optional() })), ...errors } }), async (c) => {
  const p = requirePrincipal(c);
  const b = c.req.valid("json");
  return c.json(T.invite(p.user, p.actor, c.req.valid("param").trip, b.email, b.role), 200);
});
tripsApp.openapi(createRoute({ method: "patch", path: "/trips/{trip}/members/{userId}", tags: ["sharing"], summary: "Change a member's role", request: { params: tripParam.extend({ userId: z.string() }), body: jsonBody(z.object({ role: z.enum(["editor", "viewer"]) })) }, responses: { 200: ok, ...errors } }), async (c) => {
  const p = requirePrincipal(c);
  const { trip, userId } = c.req.valid("param");
  T.setMemberRole(p.user, p.actor, trip, userId, c.req.valid("json").role);
  return c.json({ ok: true }, 200);
});
tripsApp.openapi(createRoute({ method: "delete", path: "/trips/{trip}/members/{userId}", tags: ["sharing"], summary: "Remove a member (or leave, if it's you)", request: { params: tripParam.extend({ userId: z.string() }) }, responses: { 200: ok, ...errors } }), async (c) => {
  const p = requirePrincipal(c);
  const { trip, userId } = c.req.valid("param");
  T.removeMember(p.user, p.actor, trip, userId);
  return c.json({ ok: true }, 200);
});

// ---- share links ----
tripsApp.openapi(createRoute({ method: "get", path: "/trips/{trip}/share", tags: ["sharing"], summary: "List view-only share links", request: { params: tripParam }, responses: { 200: jsonRes(z.array(ShareLinkSchema)), ...errors } }), async (c) =>
  c.json(T.listShareLinks(requirePrincipal(c).user, c.req.valid("param").trip), 200));
tripsApp.openapi(createRoute({ method: "post", path: "/trips/{trip}/share", tags: ["sharing"], summary: "Create a view-only share link", request: { params: tripParam, body: jsonBody(ShareLinkCreateSchema) }, responses: { 200: jsonRes(ShareLinkSchema), ...errors } }), async (c) => {
  const p = requirePrincipal(c);
  return c.json(T.createShareLink(p.user, p.actor, c.req.valid("param").trip, c.req.valid("json")), 200);
});
tripsApp.openapi(createRoute({ method: "delete", path: "/trips/{trip}/share/{id}", tags: ["sharing"], summary: "Revoke a share link", request: { params: tripParam.extend({ id: z.string() }) }, responses: { 200: ok, ...errors } }), async (c) => {
  const { trip, id } = c.req.valid("param");
  T.deleteShareLink(requirePrincipal(c).user, trip, id);
  return c.json({ ok: true }, 200);
});

// ---- travellers (live) ----
tripsApp.openapi(createRoute({ method: "get", path: "/trips/{trip}/travelers", tags: ["live"], summary: "Latest known location of each traveller sharing theirs", request: { params: tripParam }, responses: { 200: jsonRes(z.array(TravelerLocationSchema)), ...errors } }), async (c) =>
  c.json(L.listTravelerLocations(requirePrincipal(c).user, c.req.valid("param").trip), 200));
tripsApp.openapi(createRoute({ method: "put", path: "/trips/{trip}/travelers/me", tags: ["live"], summary: "Publish my current location to the trip", request: { params: tripParam, body: jsonBody(LocationPingSchema) }, responses: { 200: jsonRes(TravelerLocationSchema), ...errors } }), async (c) => {
  const p = requirePrincipal(c);
  return c.json(L.pingLocation(p.user, p.actor, c.req.valid("param").trip, c.req.valid("json")), 200);
});
tripsApp.openapi(createRoute({ method: "delete", path: "/trips/{trip}/travelers/me", tags: ["live"], summary: "Stop sharing my location", request: { params: tripParam }, responses: { 200: ok, ...errors } }), async (c) => {
  L.clearLocation(requirePrincipal(c).user, c.req.valid("param").trip);
  return c.json({ ok: true }, 200);
});

// ---- activity ----
tripsApp.openapi(createRoute({ method: "get", path: "/trips/{trip}/activity", tags: ["trips"], summary: "Recent changes (who/what/when, including agents)", request: { params: tripParam, query: z.object({ limit: z.coerce.number().int().min(1).max(500).optional() }) }, responses: { 200: jsonRes(z.array(ActivitySchema)), ...errors } }), async (c) => {
  const { trip } = T.requireAccess(c.req.valid("param").trip, requirePrincipal(c).user);
  return c.json(listActivity(trip.id, c.req.valid("query").limit ?? 50), 200);
});
