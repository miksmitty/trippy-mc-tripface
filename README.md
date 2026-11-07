# 🧳 Trippy McTripface

A self-hosted TripIt replacement with Wanderlog's map and collaboration, built so an AI agent is a first-class user.

- **Slick booking cards** for flights, stays, transfers and restaurant bookings, timezone-aware with status, confirmation codes and costs
- **One map for the whole trip**: pins coloured by day or type, day routes, flight arcs, transfer lines, filters, click-to-focus
- **Live**: WebSocket updates, presence, opt-in traveller location sharing and meetup beacons for finding each other
- **Sharing**: members (owner / editor / viewer), invite by email, view-only links that can hide references and costs, calendar subscription (ICS)
- **Agent-friendly**: typed REST API with OpenAPI docs, MCP server (HTTP + stdio), per-user API keys, activity log with attribution

See [docs/SPEC.md](docs/SPEC.md) for the product spec and [AGENTS.md](AGENTS.md) for how agents should use it.

## Run it

```bash
npm install
npm run seed      # demo users + sample trip; prints a login and an API key
npm run dev       # API on :8787, web on :5173 (proxied)
```

Open http://localhost:5173 and sign in with `mike@example.com` / `tripface123` (or `sam@example.com`).

Production: `npm run build && npm start` serves the built web app and the API from one port (`TMT_PORT`, default 8787). Data lives in `server/data/tmt.db` (SQLite, override with `TMT_DB`).

## Connect an agent

Create a key at **Agents** (`/settings`), then either:

```bash
claude mcp add --transport http trippy http://localhost:8787/mcp --header "Authorization: Bearer tmt_…"
```

or run the stdio server: `TMT_API_KEY=tmt_… npm run mcp`. REST docs live at `/api/docs`.

## Stack

TypeScript everywhere. Hono + Drizzle + better-sqlite3 on the server, `@hono/zod-openapi` for the spec, `@modelcontextprotocol/sdk` for MCP. React 19 + Vite + Tailwind v4 + MapLibre GL (OpenFreeMap tiles, no key) on the web. Geocoding via Photon (OpenStreetMap); airports from the `mwgg/Airports` dataset (MIT).

## Layout

```
shared/   zod schemas + helpers shared by server and web
server/   API, MCP, WebSocket hub, seed
web/      React app
docs/     spec and data model
```

## Not yet

Email-forwarding import, live flight status alerts, offline mode, expense splitting, document uploads, route optimiser. The data model leaves room for all of them.
