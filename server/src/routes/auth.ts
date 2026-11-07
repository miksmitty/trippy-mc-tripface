import { createRoute } from "@hono/zod-openapi";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { COOKIE, errors, jsonBody, jsonRes, makeApp, requirePrincipal, z } from "./common.js";
import { createApiKey, createSession, createUser, deleteApiKey, destroySession, findUserByEmail, listApiKeys, verifyPassword } from "../auth.js";
import { HttpError } from "../services/errors.js";

export const authApp = makeApp();

const UserOut = z.object({ id: z.string(), email: z.string(), name: z.string(), avatarColor: z.string(), actorKind: z.enum(["user", "agent"]) }).openapi("User");
const Creds = z.object({ email: z.string().email(), password: z.string().min(8) });

function setSession(c: any, userId: string) {
  setCookie(c, COOKIE, createSession(userId), { httpOnly: true, sameSite: "Lax", path: "/", maxAge: 60 * 60 * 24 * 90, secure: c.req.url.startsWith("https://") });
}

authApp.openapi(createRoute({ method: "post", path: "/auth/signup", tags: ["auth"], summary: "Create an account", request: { body: jsonBody(Creds.extend({ name: z.string().min(1) })) }, responses: { 200: jsonRes(UserOut), ...errors } }), async (c) => {
  const b = c.req.valid("json");
  if (findUserByEmail(b.email)) throw new HttpError(400, "An account with that email already exists");
  const u = await createUser(b.email, b.name, b.password);
  setSession(c, u.id);
  return c.json({ id: u.id, email: u.email, name: u.name, avatarColor: u.avatarColor, actorKind: "user" as const }, 200);
});

authApp.openapi(createRoute({ method: "post", path: "/auth/login", tags: ["auth"], summary: "Sign in with email + password (sets a cookie)", request: { body: jsonBody(Creds) }, responses: { 200: jsonRes(UserOut), ...errors } }), async (c) => {
  const b = c.req.valid("json");
  const u = findUserByEmail(b.email);
  if (!u || !verifyPassword(b.password, u.passwordHash)) throw new HttpError(401, "Wrong email or password");
  setSession(c, u.id);
  return c.json({ id: u.id, email: u.email, name: u.name, avatarColor: u.avatarColor, actorKind: "user" as const }, 200);
});

authApp.openapi(createRoute({ method: "post", path: "/auth/logout", tags: ["auth"], summary: "Sign out", responses: { 200: jsonRes(z.object({ ok: z.boolean() })) } }), async (c) => {
  const sid = getCookie(c, COOKIE);
  if (sid) destroySession(sid);
  deleteCookie(c, COOKIE, { path: "/" });
  return c.json({ ok: true }, 200);
});

authApp.openapi(createRoute({ method: "get", path: "/me", tags: ["auth"], summary: "Who am I (works with cookie or API key)", responses: { 200: jsonRes(UserOut), ...errors } }), async (c) => {
  const p = requirePrincipal(c);
  return c.json({ id: p.user.id, email: p.user.email, name: p.user.name, avatarColor: p.user.avatarColor, actorKind: p.actor.kind as "user" | "agent" }, 200);
});

const KeyOut = z.object({ id: z.string(), name: z.string(), prefix: z.string(), lastUsedAt: z.string().nullable(), createdAt: z.string() }).openapi("ApiKey");
authApp.openapi(createRoute({ method: "get", path: "/me/keys", tags: ["auth"], summary: "List my API keys", responses: { 200: jsonRes(z.array(KeyOut)), ...errors } }), async (c) => c.json(listApiKeys(requirePrincipal(c).user.id), 200));
authApp.openapi(createRoute({ method: "post", path: "/me/keys", tags: ["auth"], summary: "Create an API key for an agent. The full key is returned once.", request: { body: jsonBody(z.object({ name: z.string().min(1).max(60) })) }, responses: { 200: jsonRes(KeyOut.extend({ key: z.string() })), ...errors } }), async (c) => {
  const p = requirePrincipal(c);
  if (p.actor.kind !== "user") throw new HttpError(403, "Agents cannot mint keys");
  const { key, id, prefix } = createApiKey(p.user.id, c.req.valid("json").name);
  return c.json({ id, name: c.req.valid("json").name, prefix, lastUsedAt: null, createdAt: new Date().toISOString(), key }, 200);
});
authApp.openapi(createRoute({ method: "delete", path: "/me/keys/{id}", tags: ["auth"], summary: "Revoke an API key", request: { params: z.object({ id: z.string() }) }, responses: { 200: jsonRes(z.object({ ok: z.boolean() })), ...errors } }), async (c) => {
  deleteApiKey(requirePrincipal(c).user.id, c.req.valid("param").id);
  return c.json({ ok: true }, 200);
});
