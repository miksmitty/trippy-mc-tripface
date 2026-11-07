import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const DB_PATH = process.env.TMT_DB ?? resolve(here, "../../data/tmt.db");
mkdirSync(dirname(DB_PATH), { recursive: true });

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

const DDL = `
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, name TEXT NOT NULL, password_hash TEXT NOT NULL, avatar_color TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS api_keys (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, key_hash TEXT NOT NULL UNIQUE, prefix TEXT NOT NULL, last_used_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS trips (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL, description TEXT, start_date TEXT, end_date TEXT, emoji TEXT NOT NULL DEFAULT '🧳', color TEXT NOT NULL DEFAULT '#0ea5e9', home_currency TEXT NOT NULL DEFAULT 'GBP', home_tz TEXT NOT NULL DEFAULT 'Europe/London', owner_id TEXT NOT NULL REFERENCES users(id), created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS trip_members (trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, role TEXT NOT NULL, color TEXT NOT NULL, created_at TEXT NOT NULL, PRIMARY KEY (trip_id, user_id));
CREATE TABLE IF NOT EXISTS trip_invites (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, email TEXT NOT NULL, role TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS share_links (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, token TEXT NOT NULL UNIQUE, label TEXT, show_confirmations INTEGER NOT NULL DEFAULT 0, show_costs INTEGER NOT NULL DEFAULT 0, expires_at TEXT, created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS items (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, type TEXT NOT NULL, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'planned', start_at TEXT NOT NULL, end_at TEXT, tz TEXT NOT NULL, end_tz TEXT, cost_amount REAL, cost_currency TEXT, confirmation_code TEXT, url TEXT, notes TEXT, tags TEXT NOT NULL DEFAULT '[]', location TEXT, end_location TEXT, details TEXT NOT NULL DEFAULT '{}', sort_order REAL NOT NULL DEFAULT 0, created_by_kind TEXT NOT NULL, created_by_id TEXT, created_by_label TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS items_trip_start ON items(trip_id, start_at);
CREATE TABLE IF NOT EXISTS traveler_locations (trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, lat REAL NOT NULL, lng REAL NOT NULL, accuracy REAL, heading REAL, speed REAL, label TEXT, recorded_at TEXT NOT NULL, PRIMARY KEY (trip_id, user_id));
CREATE TABLE IF NOT EXISTS activity_log (id TEXT PRIMARY KEY, trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE, actor_kind TEXT NOT NULL, actor_id TEXT, actor_label TEXT NOT NULL, action TEXT NOT NULL, entity TEXT NOT NULL, entity_id TEXT, summary TEXT NOT NULL, diff TEXT, created_at TEXT NOT NULL);
CREATE INDEX IF NOT EXISTS activity_trip_created ON activity_log(trip_id, created_at);
`;
sqlite.exec(DDL);

export const db = drizzle(sqlite, { schema });
export { schema };
export type DB = typeof db;
