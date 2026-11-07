import type { WSContext } from "hono/ws";
import type { WsEvent } from "@tmt/shared";

interface Client { ws: WSContext; userId: string; name: string; color: string }

class Hub {
  private rooms = new Map<string, Set<Client>>();
  join(tripId: string, c: Client) {
    let r = this.rooms.get(tripId);
    if (!r) { r = new Set(); this.rooms.set(tripId, r); }
    r.add(c);
    this.presence(tripId);
  }
  leave(tripId: string, c: Client) {
    const r = this.rooms.get(tripId);
    if (!r) return;
    r.delete(c);
    if (r.size === 0) this.rooms.delete(tripId); else this.presence(tripId);
  }
  broadcast(tripId: string, ev: WsEvent) {
    const r = this.rooms.get(tripId);
    if (!r) return;
    const msg = JSON.stringify(ev);
    for (const c of r) { try { c.ws.send(msg); } catch { /* dropped */ } }
  }
  presence(tripId: string) {
    const r = this.rooms.get(tripId);
    if (!r) return;
    const seen = new Map<string, { userId: string; name: string; color: string }>();
    for (const c of r) seen.set(c.userId, { userId: c.userId, name: c.name, color: c.color });
    this.broadcast(tripId, { type: "presence", tripId, users: [...seen.values()] });
  }
}
export const hub = new Hub();
