import { OpenAPIHono, z } from "@hono/zod-openapi";
import { getCookie } from "hono/cookie";
import { userFromApiKey, userFromSession, principalForAgent, principalForUser, type Principal } from "../auth.js";
import { HttpError } from "../services/errors.js";

export type Env = { Variables: { principal: Principal | null } };
export const COOKIE = "tmt_session";

export function makeApp() {
  return new OpenAPIHono<Env>({
    defaultHook: (result, c) => {
      if (!result.success) return c.json({ error: "Validation failed", issues: result.error.issues }, 400);
    },
  });
}

/** Resolve the principal from a session cookie or a Bearer API key. Sets null when anonymous. */
export async function resolvePrincipal(c: { req: { header(n: string): string | undefined; raw: Request }; set: (k: "principal", v: Principal | null) => void }, next: () => Promise<void>) {
  let p: Principal | null = null;
  const auth = c.req.header("authorization");
  if (auth?.toLowerCase().startsWith("bearer tmt_")) {
    const r = userFromApiKey(auth.slice(7).trim());
    if (r) p = principalForAgent(r.user, r.keyName);
  }
  if (!p) {
    const sid = getCookie(c as any, COOKIE);
    if (sid) { const u = userFromSession(sid); if (u) p = principalForUser(u); }
  }
  c.set("principal", p);
  await next();
}

export function requirePrincipal(c: { get(k: "principal"): Principal | null }): Principal {
  const p = c.get("principal");
  if (!p) throw new HttpError(401, "Sign in or provide a Bearer API key");
  return p;
}

export const ErrorSchema = z.object({ error: z.string(), issues: z.any().optional() });
export const jsonBody = <T extends z.ZodTypeAny>(schema: T) => ({ content: { "application/json": { schema } }, required: true });
export const jsonRes = <T extends z.ZodTypeAny>(schema: T, description = "OK") => ({ description, content: { "application/json": { schema } } });
export const errors = { 400: jsonRes(ErrorSchema, "Validation error"), 401: jsonRes(ErrorSchema, "Unauthenticated"), 403: jsonRes(ErrorSchema, "Forbidden"), 404: jsonRes(ErrorSchema, "Not found") };
export { z };
