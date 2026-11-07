import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createNodeWebSocket } from "@hono/node-ws";
import { Scalar } from "@scalar/hono-api-reference";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { getCookie } from "hono/cookie";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { makeApp, resolvePrincipal, type Env, COOKIE } from "./routes/common.js";
import { authApp } from "./routes/auth.js";
import { tripsApp } from "./routes/trips.js";
import { miscApp } from "./routes/misc.js";
import { HttpError } from "./services/errors.js";
import { hub } from "./ws.js";
import { requireAccess } from "./services/trips.js";
import { userFromApiKey, userFromSession } from "./auth.js";
import { buildMcpServer, } from "./mcp/server.js";
import { principalForAgent } from "./auth.js";
import { ZodError } from "zod";

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.TMT_PORT ?? 8787);

const app = new Hono<Env>();
const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

app.use("*", logger((s) => { if (!s.includes("/api/trips/") || process.env.TMT_VERBOSE) console.log(s); }));
app.use("/api/*", cors({ origin: (o) => o, credentials: true }));
app.use("*", resolvePrincipal as any);

app.onError((err, c) => {
  if (err instanceof HttpError) return c.json({ error: err.message, issues: err.details }, err.status as 400);
  if (err instanceof ZodError) return c.json({ error: "Validation failed", issues: err.issues }, 400);
  console.error(err);
  return c.json({ error: err.message || "Internal error" }, 500);
});

// ---- API ----
const api = makeApp();
api.route("/", authApp);
api.route("/", tripsApp);
api.route("/", miscApp);
api.doc31("/openapi.json", (c) => ({
  openapi: "3.1.0",
  info: { title: "Trippy McTripface API", version: "0.1.0", description: "Agent-friendly trip planner. Authenticate with `Authorization: Bearer tmt_…` (API key from /settings) or the browser session cookie.\n\nAll datetimes are ISO-8601 with a UTC offset; `tz` fields are IANA zone names." },
  servers: [{ url: new URL(c.req.url).origin + "/api" }],
  security: [{ bearerAuth: [] }],
}));
api.openAPIRegistry.registerComponent("securitySchemes", "bearerAuth", { type: "http", scheme: "bearer", description: "API key tmt_…" });
api.get("/docs", Scalar({ url: "/api/openapi.json", theme: "kepler", pageTitle: "Trippy McTripface API" }));
app.route("/api", api);

// ---- MCP over HTTP (stateless, Bearer API key) ----
app.all("/mcp", async (c) => {
  const auth = c.req.header("authorization") ?? "";
  const r = auth.toLowerCase().startsWith("bearer ") ? userFromApiKey(auth.slice(7).trim()) : null;
  if (!r) return c.json({ error: "MCP requires Authorization: Bearer tmt_<api key>" }, 401);
  const server = buildMcpServer(principalForAgent(r.user, r.keyName));
  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  const res = await transport.handleRequest(c.req.raw);
  return res;
});

// ---- WebSocket per trip ----
app.get("/ws/trips/:trip", upgradeWebSocket((c) => {
  const sid = getCookie(c, COOKIE);
  const key = c.req.query("key");
  const user = key ? userFromApiKey(key)?.user ?? null : sid ? userFromSession(sid) : null;
  let tripId: string | null = null;
  let client: { ws: any; userId: string; name: string; color: string } | null = null;
  return {
    onOpen(_evt, ws) {
      if (!user) { ws.send(JSON.stringify({ type: "error", error: "unauthenticated" })); ws.close(); return; }
      try {
        const { trip } = requireAccess(c.req.param("trip")!, user);
        tripId = trip.id;
        client = { ws, userId: user.id, name: user.name, color: user.avatarColor };
        hub.join(tripId, client);
        ws.send(JSON.stringify({ type: "hello", tripId }));
      } catch { ws.close(); }
    },
    onClose() { if (tripId && client) hub.leave(tripId, client); },
  };
}));

// ---- Static web build (production) ----
const dist = resolve(here, "../../web/dist");
if (existsSync(dist)) {
  app.use("/assets/*", serveStatic({ root: dist, rewriteRequestPath: (p) => p }));
  app.get("*", (c) => c.html(readFileSync(resolve(dist, "index.html"), "utf8")));
} else {
  app.get("/", (c) => c.text("API is up. Web dev server runs separately (npm run dev). Docs at /api/docs"));
}

const server = serve({ fetch: app.fetch, port: PORT }, () => console.log(`🧳 trippy-mc-tripface on http://localhost:${PORT}  (docs: /api/docs, mcp: /mcp)`));
injectWebSocket(server);
