import type { Config } from "drizzle-kit";
export default { schema: "./src/db/schema.ts", dialect: "sqlite", dbCredentials: { url: process.env.TMT_DB ?? "./data/tmt.db" } } satisfies Config;
