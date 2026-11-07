# Trippy McTripface — product spec (v1)

A self-hosted TripIt replacement with Wanderlog's map and collaboration, built so an AI agent is a first-class user.

## What TripIt does (and where it stalled)

TripIt is a *booking organiser*: forward confirmation emails, get a day-by-day itinerary.

- Itinerary of flights, lodging, car hire, rail, restaurants, activities, notes; manual entry via category menu
- Email forwarding to one inbox + Gmail inbox scanning
- Calendar feed, read-only share links, "followers" of a trip
- Pro: flight alerts, alternate flights, seat tracker, fare refund monitor, airport maps, check-in reminders
- Map: a dumb pin view, no filters, no routes. No collaboration beyond read-only. No budget. No public API worth using (the v1 API is OAuth-1 and effectively frozen).

## What Wanderlog does

Wanderlog is a *planner*: a Google-Docs-style shared itinerary glued to a map.

- Day-by-day itinerary with drag reorder, places, hotels, transit, notes, checklists
- Map with every stop pinned, colour by day or category, routes between stops, optimiser (Pro)
- Real-time multi-editor collaboration, invite by email, view-only links with per-section visibility
- Budget + expense splitting, document uploads, per-trip forwarding email
- Flight tracker; Pro alerts, offline, Google Maps export

## What we build: the union, agent-first

### Pillars

1. **Agent-friendly** — every operation is available over a typed REST API with an OpenAPI document, and over MCP (stdio and HTTP). Agents authenticate with per-user API keys and every change they make is recorded in a per-trip activity log with the actor shown in the UI.
2. **Slick booking cards** — flights, lodging, transfers and restaurant bookings each get a purpose-built card and form. Timezone-aware, status-aware (planned / booked / confirmed / cancelled), with confirmation codes one tap away.
3. **Feature-rich map** — every item on one map, colour by day or type, day routes, flight arcs, lodging "home base" markers, filter chips, click-to-focus, and **live traveller tracking** for meetups.
4. **Sharing** — members (owner / editor / viewer), invite by email, view-only share links that can hide confirmation codes and costs.

### Item types

| Type | Key fields |
|---|---|
| flight | airline, flight number, from/to airport (IATA), departure/arrival local time + tz, terminal, gate, seat, cabin, PNR |
| lodging | property name, address/geo, check-in/out, room, phone, booking ref |
| transfer | mode (taxi, rideshare, train, bus, ferry, car hire, shuttle, walk), provider, pickup/drop-off place + time, ref |
| restaurant | venue, address/geo, time, party size, cuisine, booking platform, ref |
| activity | name, place, start/end, ref |
| meetup | place, time, who is expected — appears as a beacon on the live map |
| note | free text pinned to a day |

Every item has: title, start/end (ISO with offset) + IANA tz, status, cost + currency, notes, URL, optional location(s), tags, created-by (user or agent).

### Map

- MapLibre GL with the free OpenFreeMap vector tiles (no API key)
- Pins per item location; colour scheme toggle: by day / by type
- Day polylines through the day's stops in order; great-circle arcs for flights
- Lodging shown as a "home" pin for the nights it covers
- Filter chips: days, types; "fit to day" / "fit to trip"
- Traveller layer: each member who turns on location sharing appears as an avatar marker with freshness; meetup items show a beacon ring
- Click pin → scroll timeline to card; hover card → pulse pin

### Live

WebSocket per trip. Broadcasts: item created/updated/deleted, traveller location updates, presence. The web app subscribes and refetches; agents can also poll the activity log.

### Agents

- `GET /api/openapi.json` + interactive docs at `/api/docs`
- MCP server exposing tools: list_trips, get_trip, create_trip, add_item, update_item, delete_item, move_item, geocode, search_airports, find_gaps, get_travellers, add_meetup, get_activity
- `AGENTS.md` at repo root documents conventions (timezones, IDs, status semantics)

### Out of scope for v1 (tracked)

Email parsing inbox, live flight-status alerts, offline mode, expense splitting, document uploads, route optimiser, native apps. The data model leaves room for all of them.
