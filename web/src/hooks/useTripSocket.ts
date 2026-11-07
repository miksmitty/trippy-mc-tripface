import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { WsEvent } from "@tmt/shared";

export function useTripSocket(slug: string | undefined, enabled = true) {
  const qc = useQueryClient();
  const [presence, setPresence] = useState<{ userId: string; name: string; color: string }[]>([]);
  const [connected, setConnected] = useState(false);
  const lastEvent = useRef<WsEvent | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!slug || !enabled) return;
    let ws: WebSocket | null = null, closed = false, retry = 1000, timer: ReturnType<typeof setTimeout> | undefined;
    const connect = () => {
      const proto = location.protocol === "https:" ? "wss" : "ws";
      ws = new WebSocket(`${proto}://${location.host}/ws/trips/${slug}`);
      ws.onopen = () => { setConnected(true); retry = 1000; };
      ws.onmessage = (m) => {
        let ev: WsEvent; try { ev = JSON.parse(m.data); } catch { return; }
        lastEvent.current = ev; setTick((t) => t + 1);
        if (ev.type === "presence") setPresence(ev.users);
        else if (ev.type.startsWith("item.") || ev.type === "trip.updated") { qc.invalidateQueries({ queryKey: ["trip", slug] }); qc.invalidateQueries({ queryKey: ["activity", slug] }); if (ev.type === "trip.updated") qc.invalidateQueries({ queryKey: ["travelers", slug] }); }
        else if (ev.type === "traveler.location") qc.invalidateQueries({ queryKey: ["travelers", slug] });
      };
      ws.onclose = () => { setConnected(false); if (!closed) { timer = setTimeout(connect, retry); retry = Math.min(retry * 2, 15000); } };
      ws.onerror = () => ws?.close();
    };
    connect();
    return () => { closed = true; clearTimeout(timer); ws?.close(); };
  }, [slug, enabled, qc]);

  return { presence, connected, lastEvent: lastEvent.current, tick };
}
