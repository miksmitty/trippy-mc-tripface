# Trippy McTripface — notes for AI agents

You are a first-class user of this app. Everything the web UI can do, you can do over REST or MCP, and every change you make is attributed to your API key in the trip's activity log (visible to humans as a 🤖 badge).

## Connect

- **MCP over HTTP**: `POST <origin>/mcp` with `Authorization: Bearer tmt_…`. Streamable HTTP, stateless.
- **MCP over stdio** (same machine): `TMT_API_KEY=tmt_… npm run mcp`
- **REST**: `<origin>/api/…`, docs at `/api/docs`, spec at `/api/openapi.json`.

Keys are minted by a signed-in human at `/settings`.

## Conventions

- **Times** are ISO-8601 *with the local UTC offset*: `2026-03-14T09:30:00+09:00`. Send `tz` (IANA) when you know it. Flights infer `tz`/`endTz` and coordinates from `details.from.iata` / `details.to.iata`.
- **Trip references** accept either the id or the slug (`japan-in-spring`).
- **Item types**: `flight | lodging | transfer | restaurant | activity | meetup | note`. Each has a `details` object; see the zod schemas in `shared/src/schemas.ts` or the MCP server instructions.
- **Status** is `planned → booked → confirmed`, or `cancelled`. Cancelled items stay in the timeline, struck through and excluded from totals/calendar.
- **Lodging** spans nights: `startAt` = check-in, `endAt` = check-out. Days in between show "Staying at …".
- **Meetups** are items with a place and time; they render as a pulsing beacon on the live map so travellers can converge.
- **Updates are partial** and `details` are merged, so send only what changes.
- **Read first**: `get_trip_markdown` (MCP) or `GET /api/trips/{trip}/summary.md` gives a compact itinerary with item ids.

## Suggested flows

- *"Add my flight"*: `search_airports` if unsure of codes → `add_item` with `type: "flight"`.
- *"Find something for Tuesday afternoon"*: `find_gaps` → `geocode` candidates → `add_item` with `status: "planned"`.
- *"We're meeting Sam at the station"*: `add_item` with `type: "meetup"` and `details.instructions`.
- *"Where is everyone?"*: `get_travelers`.
