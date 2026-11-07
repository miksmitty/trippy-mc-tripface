import { randomBytes, scryptSync, timingSafeEqual, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import { nanoid } from "nanoid";
import { db, schema } from "./db/index.js";
import type { Actor } from "@tmt/shared";

export const AVATAR_COLORS = ["#0ea5e9", "#f43f5e", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"];
export const now = () => new Date().toISOString();

export function hashPassword(pw: string): string {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(pw, salt, 64).toString("hex")}`;
}
export function verifyPassword(pw: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, "hex"), b = scryptSync(pw, salt, 64);
  return a.length === b.length && timingSafeEqual(a, b);
}

export type User = typeof schema.users.$inferSelect;

export async function createUser(email: string, name: string, password: string): Promise<User> {
  const u: User = { id: nanoid(10), email: email.toLowerCase().trim(), name: name.trim(), passwordHash: hashPassword(password), avatarColor: AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)], createdAt: now() };
  db.insert(schema.users).values(u).run();
  // Accept pending invites
  const invites = db.select().from(schema.tripInvites).where(eq(schema.tripInvites.email, u.email)).all();
  for (const inv of invites) {
    db.insert(schema.tripMembers).values({ tripId: inv.tripId, userId: u.id, role: inv.role, color: u.avatarColor, createdAt: now() }).onConflictDoNothing().run();
    db.delete(schema.tripInvites).where(eq(schema.tripInvites.id, inv.id)).run();
  }
  return u;
}

export function findUserByEmail(email: string) {
  return db.select().from(schema.users).where(eq(schema.users.email, email.toLowerCase().trim())).get() ?? null;
}
export function findUserById(id: string) {
  return db.select().from(schema.users).where(eq(schema.users.id, id)).get() ?? null;
}

export function createSession(userId: string): string {
  const id = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 90).toISOString();
  db.insert(schema.sessions).values({ id, userId, expiresAt }).run();
  return id;
}
export function destroySession(id: string) { db.delete(schema.sessions).where(eq(schema.sessions.id, id)).run(); }
export function userFromSession(id: string): User | null {
  const s = db.select().from(schema.sessions).where(eq(schema.sessions.id, id)).get();
  if (!s || s.expiresAt < now()) return null;
  return findUserById(s.userId);
}

// API keys: tmt_<prefix>_<secret>
export function createApiKey(userId: string, name: string): { key: string; id: string; prefix: string } {
  const prefix = nanoid(6), secret = randomBytes(24).toString("base64url");
  const key = `tmt_${prefix}_${secret}`;
  const id = nanoid(10);
  db.insert(schema.apiKeys).values({ id, userId, name, keyHash: sha256(key), prefix, createdAt: now() }).run();
  return { key, id, prefix };
}
export function sha256(s: string) { return createHash("sha256").update(s).digest("hex"); }
export function userFromApiKey(key: string): { user: User; keyName: string } | null {
  const row = db.select().from(schema.apiKeys).where(eq(schema.apiKeys.keyHash, sha256(key))).get();
  if (!row) return null;
  db.update(schema.apiKeys).set({ lastUsedAt: now() }).where(eq(schema.apiKeys.id, row.id)).run();
  const user = findUserById(row.userId);
  return user ? { user, keyName: row.name } : null;
}
export function listApiKeys(userId: string) {
  return db.select({ id: schema.apiKeys.id, name: schema.apiKeys.name, prefix: schema.apiKeys.prefix, lastUsedAt: schema.apiKeys.lastUsedAt, createdAt: schema.apiKeys.createdAt }).from(schema.apiKeys).where(eq(schema.apiKeys.userId, userId)).all();
}
export function deleteApiKey(userId: string, id: string) {
  const row = db.select().from(schema.apiKeys).where(eq(schema.apiKeys.id, id)).get();
  if (row && row.userId === userId) db.delete(schema.apiKeys).where(eq(schema.apiKeys.id, id)).run();
}

export interface Principal { user: User; actor: Actor }
export function principalForUser(user: User): Principal { return { user, actor: { kind: "user", id: user.id, label: user.name } }; }
export function principalForAgent(user: User, keyName: string): Principal { return { user, actor: { kind: "agent", id: user.id, label: `${keyName} (agent for ${user.name})` } }; }
