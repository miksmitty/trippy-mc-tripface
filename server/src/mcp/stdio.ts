// MCP over stdio. Auth: TMT_API_KEY=tmt_... (preferred) or TMT_USER_EMAIL for local single-user use.
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { buildMcpServer } from "./server.js";
import { findUserByEmail, principalForAgent, userFromApiKey } from "../auth.js";

const key = process.env.TMT_API_KEY;
const email = process.env.TMT_USER_EMAIL;
let principal = null as ReturnType<typeof principalForAgent> | null;
if (key) { const r = userFromApiKey(key); if (r) principal = principalForAgent(r.user, r.keyName); }
else if (email) { const u = findUserByEmail(email); if (u) principal = principalForAgent(u, "local MCP"); }
if (!principal) { console.error("Set TMT_API_KEY (tmt_...) or TMT_USER_EMAIL to run the MCP server"); process.exit(1); }

const server = buildMcpServer(principal);
await server.connect(new StdioServerTransport());
