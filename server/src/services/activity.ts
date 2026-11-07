import { desc, eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, schema } from "../db/index.js";
import { now } from "../auth.js";
import type { Activity, Actor } from "@tmt/shared";

export function logActivity(tripId: string, actor: Actor, action: Activity["action"], entity: string, entityId: string | null, summary: string, diff: Record<string, unknown> | null = null): Activity {
  const row = { id: nanoid(12), tripId, actorKind: actor.kind, actorId: actor.id, actorLabel: actor.label, action, entity, entityId, summary, diff, createdAt: now() };
  db.insert(schema.activityLog).values(row).run();
  return toActivity(row);
}

export function listActivity(tripId: string, limit = 50): Activity[] {
  return db.select().from(schema.activityLog).where(eq(schema.activityLog.tripId, tripId)).orderBy(desc(schema.activityLog.createdAt)).limit(limit).all().map(toActivity);
}

function toActivity(r: typeof schema.activityLog.$inferSelect): Activity {
  return { id: r.id, tripId: r.tripId, actor: { kind: r.actorKind as Actor["kind"], id: r.actorId, label: r.actorLabel }, action: r.action as Activity["action"], entity: r.entity, entityId: r.entityId, summary: r.summary, diff: r.diff ?? null, createdAt: r.createdAt };
}
