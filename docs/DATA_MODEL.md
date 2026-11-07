# Data model

SQLite via Drizzle. IDs are short random strings (nanoid). Timestamps are ISO-8601 strings.

- **users** — id, email (unique), name, password_hash, avatar_color, created_at
- **sessions** — id (token), user_id, expires_at
- **api_keys** — id, user_id, name, key_hash, prefix, last_used_at, created_at. Bearer `tmt_…` keys for agents.
- **trips** — id, slug, name, description, start_date, end_date, emoji, color, home_currency, owner_id, created_at, updated_at
- **trip_members** — trip_id, user_id, role (owner|editor|viewer), color, created_at
- **trip_invites** — id, trip_id, email, role, created_at
- **share_links** — id, trip_id, token, show_confirmations, show_costs, expires_at, created_at
- **items** — id, trip_id, type, title, status, start_at, end_at, tz, cost_amount, cost_currency, confirmation_code, url, notes, tags (JSON), location (JSON {name,address,lat,lng}), end_location (JSON), details (JSON, per-type), day_index (nullable override), sort_order, created_by_kind (user|agent|share), created_by_id, created_at, updated_at
- **traveler_locations** — trip_id+user_id PK, lat, lng, accuracy, heading, speed, label, recorded_at
- **activity_log** — id, trip_id, actor_kind, actor_id, actor_label, action, entity, entity_id, summary, diff (JSON), created_at

Per-type `details` shapes live in `shared/src/schemas.ts` as zod schemas and are also what the API and MCP validate against.
