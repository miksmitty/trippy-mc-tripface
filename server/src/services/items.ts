import { and, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, schema } from "../db/index.js";
import { now, type User } from "../auth.js";
import { badRequest, notFound } from "./errors.js";
import { logActivity } from "./activity.js";
import { airportByIata } from "./geo.js";
import { requireAccess } from "./trips.js";
import { DETAILS_BY_TYPE, TYPE_META, type Actor, type Item, type ItemCreate, type ItemUpdate, type Location } from "@tmt/shared";
import { hub } from "../ws.js";

type Row = typeof schema.items.$inferSelect;

export function toItem(r: Row): Item {
  return {
    id: r.id, tripId: r.tripId, type: r.type as Item["type"], title: r.title, status: r.status as Item["status"], startAt: r.startAt, endAt: r.endAt, tz: r.tz, endTz: r.endTz,
    costAmount: r.costAmount, costCurrency: r.costCurrency, confirmationCode: r.confirmationCode, url: r.url, notes: r.notes, tags: r.tags ?? [],
    location: (r.location as Location | null) ?? null, endLocation: (r.endLocation as Location | null) ?? null, details: r.details ?? {}, sortOrder: r.sortOrder,
    createdBy: { kind: r.createdByKind as Actor["kind"], id: r.createdById, label: r.createdByLabel }, createdAt: r.createdAt, updatedAt: r.updatedAt,
  };
}

export function listItems(tripId: string): Item[] {
  return db.select().from(schema.items).where(eq(schema.items.tripId, tripId)).all().map(toItem)
    .sort((a, b) => a.startAt.localeCompare(b.startAt) || a.sortOrder - b.sortOrder);
}

export function getItem(user: User, tripIdOrSlug: string, itemId: string): Item {
  const { trip } = requireAccess(tripIdOrSlug, user);
  const r = db.select().from(schema.items).where(and(eq(schema.items.id, itemId), eq(schema.items.tripId, trip.id))).get();
  if (!r) throw notFound("Item not found");
  return toItem(r);
}

/** Fill in airport-derived fields for flights and infer tz from the ISO offset when nothing better exists. */
function enrich(input: Partial<ItemCreate> & { type: Item["type"] }, existing?: Item): { tz: string; endTz: string | null; location: Location | null; endLocation: Location | null; details: Record<string, unknown>; title: string } {
  const details: Record<string, unknown> = { ...(existing?.details ?? {}), ...(input.details ?? {}) };
  let tz = input.tz ?? existing?.tz;
  let endTz = input.endTz ?? existing?.endTz ?? null;
  let location = input.location ?? existing?.location ?? null;
  let endLocation = input.endLocation ?? existing?.endLocation ?? null;
  let title = input.title ?? existing?.title ?? "";

  if (input.type === "flight") {
    const d = details as { from?: { iata: string; name?: string; city?: string; tz?: string }; to?: { iata: string; name?: string; city?: string; tz?: string }; airlineCode?: string; flightNumber?: string };
    const from = d.from ? airportByIata(d.from.iata) : null;
    const to = d.to ? airportByIata(d.to.iata) : null;
    if (d.from && from) { d.from = { ...d.from, iata: from.iata, name: d.from.name ?? from.name, city: d.from.city ?? from.city, tz: from.tz }; }
    if (d.to && to) { d.to = { ...d.to, iata: to.iata, name: d.to.name ?? to.name, city: d.to.city ?? to.city, tz: to.tz }; }
    if (!input.tz && from) tz = from.tz;
    if (!input.endTz && to) endTz = to.tz;
    if (!input.location && from) location = { name: `${from.city} (${from.iata})`, address: from.name, lat: from.lat, lng: from.lng };
    if (!input.endLocation && to) endLocation = { name: `${to.city} (${to.iata})`, address: to.name, lat: to.lat, lng: to.lng };
    if (!title && d.from && d.to) {
      const fn = d.flightNumber ?? "";
      const code = d.airlineCode && !fn.toUpperCase().startsWith(d.airlineCode.toUpperCase()) ? d.airlineCode : "";
      title = `${code}${fn} ${d.from.iata} → ${d.to.iata}`.trim();
    }
  }
  if (!tz) {
    // Last resort: derive a fixed-offset zone from the ISO offset so display still works
    const m = /([+-]\d{2}):(\d{2})$/.exec(input.startAt ?? "");
    tz = m ? `Etc/GMT${m[1][0] === "+" ? "-" : "+"}${parseInt(m[1].slice(1), 10)}` : "UTC";
    if (!input.startAt?.endsWith("Z") && !m) tz = "UTC";
  }
  if (!title) title = TYPE_META[input.type].label;
  return { tz, endTz: endTz ?? (input.type === "flight" ? null : tz), location, endLocation, details, title };
}

export function createItem(user: User, actor: Actor, tripIdOrSlug: string, input: ItemCreate): Item {
  const { trip } = requireAccess(tripIdOrSlug, user, "editor");
  const e = enrich(input);
  const ts = now();
  const row: Row = {
    id: nanoid(10), tripId: trip.id, type: input.type, title: e.title, status: input.status ?? "planned", startAt: input.startAt, endAt: input.endAt ?? null, tz: e.tz, endTz: e.endTz,
    costAmount: input.costAmount ?? null, costCurrency: input.costCurrency?.toUpperCase() ?? (input.costAmount != null ? trip.homeCurrency : null), confirmationCode: input.confirmationCode ?? null, url: input.url ?? null, notes: input.notes ?? null,
    tags: input.tags ?? [], location: e.location as Record<string, unknown> | null, endLocation: e.endLocation as Record<string, unknown> | null, details: e.details, sortOrder: new Date(input.startAt).getTime() / 1e6,
    createdByKind: actor.kind, createdById: actor.id, createdByLabel: actor.label, createdAt: ts, updatedAt: ts,
  };
  db.insert(schema.items).values(row).run();
  db.update(schema.trips).set({ updatedAt: ts }).where(eq(schema.trips.id, trip.id)).run();
  const item = toItem(row);
  logActivity(trip.id, actor, "create", "item", item.id, `added ${TYPE_META[item.type].label.toLowerCase()} "${item.title}"`, { type: item.type });
  hub.broadcast(trip.id, { type: "item.created", tripId: trip.id, itemId: item.id, actor });
  return item;
}

export function updateItem(user: User, actor: Actor, tripIdOrSlug: string, itemId: string, patch: ItemUpdate): Item {
  const { trip } = requireAccess(tripIdOrSlug, user, "editor");
  const existing = getItem(user, trip.id, itemId);
  const type = patch.type ?? existing.type;
  if (patch.details !== undefined || patch.type !== undefined) {
    const merged = { ...existing.details, ...(patch.details ?? {}) };
    const r = DETAILS_BY_TYPE[type].safeParse(merged);
    if (!r.success) throw badRequest("Invalid details", r.error.issues);
  }
  const e = enrich({ ...patch, type, startAt: patch.startAt ?? existing.startAt } as Partial<ItemCreate> & { type: Item["type"] }, existing);
  const startAt = patch.startAt ?? existing.startAt;
  const endAt = patch.endAt === undefined ? existing.endAt : patch.endAt;
  if (endAt && new Date(endAt) < new Date(startAt)) throw badRequest("endAt must be after startAt");
  const set: Partial<Row> = {
    type, title: e.title, status: patch.status ?? existing.status, startAt, endAt, tz: e.tz, endTz: e.endTz,
    costAmount: patch.costAmount === undefined ? existing.costAmount : patch.costAmount,
    costCurrency: patch.costCurrency === undefined ? existing.costCurrency : patch.costCurrency?.toUpperCase() ?? null,
    confirmationCode: patch.confirmationCode === undefined ? existing.confirmationCode : patch.confirmationCode,
    url: patch.url === undefined ? existing.url : patch.url, notes: patch.notes === undefined ? existing.notes : patch.notes,
    tags: patch.tags ?? existing.tags, location: e.location as Record<string, unknown> | null, endLocation: e.endLocation as Record<string, unknown> | null, details: e.details,
    sortOrder: patch.sortOrder ?? (patch.startAt ? new Date(startAt).getTime() / 1e6 : existing.sortOrder), updatedAt: now(),
  };
  db.update(schema.items).set(set).where(eq(schema.items.id, itemId)).run();
  db.update(schema.trips).set({ updatedAt: set.updatedAt! }).where(eq(schema.trips.id, trip.id)).run();
  const item = getItem(user, trip.id, itemId);
  const changed = Object.keys(patch).filter((k) => k !== "type");
  logActivity(trip.id, actor, "update", "item", item.id, `updated ${changed.join(", ") || "item"} on "${item.title}"`, patch as Record<string, unknown>);
  hub.broadcast(trip.id, { type: "item.updated", tripId: trip.id, itemId: item.id, actor });
  return item;
}

export function deleteItem(user: User, actor: Actor, tripIdOrSlug: string, itemId: string) {
  const { trip } = requireAccess(tripIdOrSlug, user, "editor");
  const existing = getItem(user, trip.id, itemId);
  db.delete(schema.items).where(eq(schema.items.id, itemId)).run();
  logActivity(trip.id, actor, "delete", "item", itemId, `removed ${TYPE_META[existing.type].label.toLowerCase()} "${existing.title}"`, { snapshot: existing as unknown as Record<string, unknown> });
  hub.broadcast(trip.id, { type: "item.deleted", tripId: trip.id, itemId, actor });
}
