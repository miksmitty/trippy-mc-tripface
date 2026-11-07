import { sqliteTable, text, integer, real, primaryKey, index } from "drizzle-orm/sqlite-core";

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name").notNull(),
  passwordHash: text("password_hash").notNull(),
  avatarColor: text("avatar_color").notNull(),
  createdAt: text("created_at").notNull(),
});

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: text("expires_at").notNull(),
});

export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  prefix: text("prefix").notNull(),
  lastUsedAt: text("last_used_at"),
  createdAt: text("created_at").notNull(),
});

export const trips = sqliteTable("trips", {
  id: text("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description"),
  startDate: text("start_date"),
  endDate: text("end_date"),
  emoji: text("emoji").notNull().default("🧳"),
  color: text("color").notNull().default("#0ea5e9"),
  homeCurrency: text("home_currency").notNull().default("GBP"),
  homeTz: text("home_tz").notNull().default("Europe/London"),
  ownerId: text("owner_id").notNull().references(() => users.id),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
});

export const tripMembers = sqliteTable("trip_members", {
  tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull(),
  color: text("color").notNull(),
  createdAt: text("created_at").notNull(),
}, (t) => [primaryKey({ columns: [t.tripId, t.userId] })]);

export const tripInvites = sqliteTable("trip_invites", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  email: text("email").notNull(),
  role: text("role").notNull(),
  createdAt: text("created_at").notNull(),
});

export const shareLinks = sqliteTable("share_links", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  token: text("token").notNull().unique(),
  label: text("label"),
  showConfirmations: integer("show_confirmations", { mode: "boolean" }).notNull().default(false),
  showCosts: integer("show_costs", { mode: "boolean" }).notNull().default(false),
  expiresAt: text("expires_at"),
  createdAt: text("created_at").notNull(),
});

export const items = sqliteTable("items", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  status: text("status").notNull().default("planned"),
  startAt: text("start_at").notNull(),
  endAt: text("end_at"),
  tz: text("tz").notNull(),
  endTz: text("end_tz"),
  costAmount: real("cost_amount"),
  costCurrency: text("cost_currency"),
  confirmationCode: text("confirmation_code"),
  url: text("url"),
  notes: text("notes"),
  tags: text("tags", { mode: "json" }).$type<string[]>().notNull().default([]),
  location: text("location", { mode: "json" }).$type<Record<string, unknown> | null>(),
  endLocation: text("end_location", { mode: "json" }).$type<Record<string, unknown> | null>(),
  details: text("details", { mode: "json" }).$type<Record<string, unknown>>().notNull().default({}),
  sortOrder: real("sort_order").notNull().default(0),
  createdByKind: text("created_by_kind").notNull(),
  createdById: text("created_by_id"),
  createdByLabel: text("created_by_label").notNull(),
  createdAt: text("created_at").notNull(),
  updatedAt: text("updated_at").notNull(),
}, (t) => [index("items_trip_start").on(t.tripId, t.startAt)]);

export const travelerLocations = sqliteTable("traveler_locations", {
  tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  accuracy: real("accuracy"),
  heading: real("heading"),
  speed: real("speed"),
  label: text("label"),
  recordedAt: text("recorded_at").notNull(),
}, (t) => [primaryKey({ columns: [t.tripId, t.userId] })]);

export const activityLog = sqliteTable("activity_log", {
  id: text("id").primaryKey(),
  tripId: text("trip_id").notNull().references(() => trips.id, { onDelete: "cascade" }),
  actorKind: text("actor_kind").notNull(),
  actorId: text("actor_id"),
  actorLabel: text("actor_label").notNull(),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  summary: text("summary").notNull(),
  diff: text("diff", { mode: "json" }).$type<Record<string, unknown> | null>(),
  createdAt: text("created_at").notNull(),
}, (t) => [index("activity_trip_created").on(t.tripId, t.createdAt)]);
