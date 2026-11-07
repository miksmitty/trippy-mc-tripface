import { and, eq, inArray, sql } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, schema } from "../db/index.js";
import { now, type User } from "../auth.js";
import { forbidden, notFound } from "./errors.js";
import { logActivity } from "./activity.js";
import { slugify, type Actor, type MemberRole, type Trip, type TripCreate, type TripDetail } from "@tmt/shared";
import { listItems } from "./items.js";
import { z } from "zod";
import { TripUpdateSchema } from "@tmt/shared";

type TripRow = typeof schema.trips.$inferSelect;

export function toTrip(r: TripRow, myRole: MemberRole | null, itemCount?: number): Trip {
  return { id: r.id, slug: r.slug, name: r.name, description: r.description, startDate: r.startDate, endDate: r.endDate, emoji: r.emoji, color: r.color, homeCurrency: r.homeCurrency, homeTz: r.homeTz, ownerId: r.ownerId, myRole, itemCount, createdAt: r.createdAt, updatedAt: r.updatedAt };
}

export function roleFor(tripId: string, userId: string): MemberRole | null {
  const m = db.select().from(schema.tripMembers).where(and(eq(schema.tripMembers.tripId, tripId), eq(schema.tripMembers.userId, userId))).get();
  return (m?.role as MemberRole) ?? null;
}

export function requireTrip(idOrSlug: string): TripRow {
  const t = db.select().from(schema.trips).where(eq(schema.trips.id, idOrSlug)).get() ?? db.select().from(schema.trips).where(eq(schema.trips.slug, idOrSlug)).get();
  if (!t) throw notFound("Trip not found");
  return t;
}

export function requireAccess(idOrSlug: string, user: User, minRole: MemberRole = "viewer"): { trip: TripRow; role: MemberRole } {
  const trip = requireTrip(idOrSlug);
  const role = roleFor(trip.id, user.id);
  if (!role) throw notFound("Trip not found");
  const rank: Record<MemberRole, number> = { viewer: 0, editor: 1, owner: 2 };
  if (rank[role] < rank[minRole]) throw forbidden(`Requires ${minRole} role`);
  return { trip, role };
}

export function listTrips(user: User): Trip[] {
  const rows = db.select({ trip: schema.trips, role: schema.tripMembers.role, count: sql<number>`(select count(*) from items where items.trip_id = ${schema.trips.id})` })
    .from(schema.tripMembers).innerJoin(schema.trips, eq(schema.tripMembers.tripId, schema.trips.id))
    .where(eq(schema.tripMembers.userId, user.id)).all();
  return rows.map((r) => toTrip(r.trip, r.role as MemberRole, Number(r.count))).sort((a, b) => (b.startDate ?? "").localeCompare(a.startDate ?? "") || b.createdAt.localeCompare(a.createdAt));
}

export function createTrip(user: User, actor: Actor, input: TripCreate): Trip {
  const id = nanoid(10);
  let slug = slugify(input.name);
  if (db.select().from(schema.trips).where(eq(schema.trips.slug, slug)).get()) slug = `${slug}-${nanoid(4).toLowerCase()}`;
  const ts = now();
  const row: TripRow = { id, slug, name: input.name, description: input.description ?? null, startDate: input.startDate ?? null, endDate: input.endDate ?? null, emoji: input.emoji ?? "🧳", color: input.color ?? "#0ea5e9", homeCurrency: input.homeCurrency ?? "GBP", homeTz: input.homeTz ?? "Europe/London", ownerId: user.id, createdAt: ts, updatedAt: ts };
  db.insert(schema.trips).values(row).run();
  db.insert(schema.tripMembers).values({ tripId: id, userId: user.id, role: "owner", color: user.avatarColor, createdAt: ts }).run();
  logActivity(id, actor, "create", "trip", id, `created trip "${input.name}"`);
  return toTrip(row, "owner", 0);
}

export function updateTrip(user: User, actor: Actor, idOrSlug: string, patch: z.infer<typeof TripUpdateSchema>): Trip {
  const { trip, role } = requireAccess(idOrSlug, user, "editor");
  const set: Partial<TripRow> = { updatedAt: now() };
  for (const k of ["name", "description", "startDate", "endDate", "emoji", "color", "homeCurrency", "homeTz"] as const) if (patch[k] !== undefined) (set as any)[k] = patch[k];
  db.update(schema.trips).set(set).where(eq(schema.trips.id, trip.id)).run();
  logActivity(trip.id, actor, "update", "trip", trip.id, `updated trip settings`, patch as Record<string, unknown>);
  return toTrip({ ...trip, ...set }, role);
}

export function deleteTrip(user: User, idOrSlug: string) {
  const { trip } = requireAccess(idOrSlug, user, "owner");
  db.delete(schema.trips).where(eq(schema.trips.id, trip.id)).run();
}

export function listMembers(tripId: string) {
  return db.select({ userId: schema.users.id, name: schema.users.name, email: schema.users.email, role: schema.tripMembers.role, color: schema.tripMembers.color })
    .from(schema.tripMembers).innerJoin(schema.users, eq(schema.tripMembers.userId, schema.users.id)).where(eq(schema.tripMembers.tripId, tripId)).all()
    .map((m) => ({ ...m, role: m.role as MemberRole }));
}

export function getTripDetail(user: User, idOrSlug: string): TripDetail {
  const { trip, role } = requireAccess(idOrSlug, user);
  return { ...toTrip(trip, role), items: listItems(trip.id), members: listMembers(trip.id) };
}

export function invite(user: User, actor: Actor, idOrSlug: string, email: string, role: "editor" | "viewer") {
  const { trip } = requireAccess(idOrSlug, user, "editor");
  const target = db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase().trim())).get();
  if (target) {
    db.insert(schema.tripMembers).values({ tripId: trip.id, userId: target.id, role, color: target.avatarColor, createdAt: now() })
      .onConflictDoUpdate({ target: [schema.tripMembers.tripId, schema.tripMembers.userId], set: { role } }).run();
    logActivity(trip.id, actor, "join", "member", target.id, `added ${target.name} as ${role}`);
    return { status: "added" as const, member: { userId: target.id, name: target.name, email: target.email, role, color: target.avatarColor } };
  }
  db.insert(schema.tripInvites).values({ id: nanoid(10), tripId: trip.id, email: email.toLowerCase().trim(), role, createdAt: now() }).run();
  logActivity(trip.id, actor, "join", "invite", null, `invited ${email} as ${role}`);
  return { status: "invited" as const };
}

export function listInvites(tripId: string) { return db.select().from(schema.tripInvites).where(eq(schema.tripInvites.tripId, tripId)).all(); }

export function removeMember(user: User, actor: Actor, idOrSlug: string, userId: string) {
  const { trip } = requireAccess(idOrSlug, user, user.id === userId ? "viewer" : "owner");
  if (trip.ownerId === userId) throw forbidden("Cannot remove the owner");
  db.delete(schema.tripMembers).where(and(eq(schema.tripMembers.tripId, trip.id), eq(schema.tripMembers.userId, userId))).run();
  logActivity(trip.id, actor, "update", "member", userId, `removed a member`);
}

export function setMemberRole(user: User, actor: Actor, idOrSlug: string, userId: string, role: "editor" | "viewer") {
  const { trip } = requireAccess(idOrSlug, user, "owner");
  if (trip.ownerId === userId) throw forbidden("Owner role is fixed");
  db.update(schema.tripMembers).set({ role }).where(and(eq(schema.tripMembers.tripId, trip.id), eq(schema.tripMembers.userId, userId))).run();
  logActivity(trip.id, actor, "update", "member", userId, `changed a member's role to ${role}`);
}

// ---- share links ----
export function createShareLink(user: User, actor: Actor, idOrSlug: string, input: { showConfirmations: boolean; showCosts: boolean; expiresAt?: string; label?: string }) {
  const { trip } = requireAccess(idOrSlug, user, "editor");
  const row = { id: nanoid(10), tripId: trip.id, token: nanoid(21), label: input.label ?? null, showConfirmations: input.showConfirmations, showCosts: input.showCosts, expiresAt: input.expiresAt ?? null, createdAt: now() };
  db.insert(schema.shareLinks).values(row).run();
  logActivity(trip.id, actor, "share", "share_link", row.id, `created a share link${input.label ? ` "${input.label}"` : ""}`);
  return row;
}
export function listShareLinks(user: User, idOrSlug: string) {
  const { trip } = requireAccess(idOrSlug, user, "editor");
  return db.select().from(schema.shareLinks).where(eq(schema.shareLinks.tripId, trip.id)).all();
}
export function deleteShareLink(user: User, idOrSlug: string, id: string) {
  const { trip } = requireAccess(idOrSlug, user, "editor");
  db.delete(schema.shareLinks).where(and(eq(schema.shareLinks.id, id), eq(schema.shareLinks.tripId, trip.id))).run();
}
export function resolveShareToken(token: string) {
  const link = db.select().from(schema.shareLinks).where(eq(schema.shareLinks.token, token)).get();
  if (!link) throw notFound("Share link not found");
  if (link.expiresAt && link.expiresAt < now()) throw notFound("Share link expired");
  const trip = db.select().from(schema.trips).where(eq(schema.trips.id, link.tripId)).get()!;
  let items = listItems(trip.id);
  if (!link.showConfirmations) items = items.map((i) => ({ ...i, confirmationCode: null }));
  if (!link.showCosts) items = items.map((i) => ({ ...i, costAmount: null, costCurrency: null }));
  const members = listMembers(trip.id).map((m) => ({ ...m, email: "" }));
  return { link, detail: { ...toTrip(trip, null), items, members } as TripDetail };
}

export function tripIdsForUser(userId: string): string[] {
  return db.select({ id: schema.tripMembers.tripId }).from(schema.tripMembers).where(eq(schema.tripMembers.userId, userId)).all().map((r) => r.id);
}
export { inArray };
