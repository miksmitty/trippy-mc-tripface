import { eq, and } from "drizzle-orm";
import { db, schema } from "../db/index.js";
import { now, type User } from "../auth.js";
import { requireAccess } from "./trips.js";
import type { Actor, TravelerLocation } from "@tmt/shared";
import { hub } from "../ws.js";

export function listTravelerLocations(user: User, tripIdOrSlug: string): TravelerLocation[] {
  const { trip } = requireAccess(tripIdOrSlug, user);
  return rawList(trip.id);
}
export function rawList(tripId: string): TravelerLocation[] {
  return db.select({ l: schema.travelerLocations, name: schema.users.name, color: schema.tripMembers.color })
    .from(schema.travelerLocations)
    .innerJoin(schema.users, eq(schema.travelerLocations.userId, schema.users.id))
    .innerJoin(schema.tripMembers, and(eq(schema.tripMembers.tripId, schema.travelerLocations.tripId), eq(schema.tripMembers.userId, schema.travelerLocations.userId)))
    .where(eq(schema.travelerLocations.tripId, tripId)).all()
    .map(({ l, name, color }) => ({ tripId: l.tripId, userId: l.userId, name, color, lat: l.lat, lng: l.lng, accuracy: l.accuracy, heading: l.heading, speed: l.speed, label: l.label, recordedAt: l.recordedAt }));
}

export function pingLocation(user: User, actor: Actor, tripIdOrSlug: string, p: { lat: number; lng: number; accuracy?: number; heading?: number | null; speed?: number | null; label?: string }): TravelerLocation {
  const { trip } = requireAccess(tripIdOrSlug, user);
  const row = { tripId: trip.id, userId: user.id, lat: p.lat, lng: p.lng, accuracy: p.accuracy ?? null, heading: p.heading ?? null, speed: p.speed ?? null, label: p.label ?? null, recordedAt: now() };
  db.insert(schema.travelerLocations).values(row).onConflictDoUpdate({ target: [schema.travelerLocations.tripId, schema.travelerLocations.userId], set: row }).run();
  const loc = rawList(trip.id).find((l) => l.userId === user.id)!;
  hub.broadcast(trip.id, { type: "traveler.location", tripId: trip.id, location: loc });
  return loc;
}

export function clearLocation(user: User, tripIdOrSlug: string) {
  const { trip } = requireAccess(tripIdOrSlug, user);
  db.delete(schema.travelerLocations).where(and(eq(schema.travelerLocations.tripId, trip.id), eq(schema.travelerLocations.userId, user.id))).run();
  hub.broadcast(trip.id, { type: "trip.updated", tripId: trip.id });
}
