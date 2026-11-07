import { useEffect, useRef, useState } from "react";

/** Streams the browser's geolocation to the trip while enabled. Throttled to every 20s or 25m of movement. */
export function useLocationShare(enabled: boolean, label: string, ping: (p: { lat: number; lng: number; accuracy?: number; heading?: number | null; speed?: number | null; label?: string }) => void) {
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<{ lat: number; lng: number; at: number } | null>(null);
  const labelRef = useRef(label); labelRef.current = label;
  const pingRef = useRef(ping); pingRef.current = ping;

  useEffect(() => {
    if (!enabled) return;
    if (!navigator.geolocation) { setError("Geolocation not supported"); return; }
    let lastSent: { lat: number; lng: number; at: number } | null = null;
    const id = navigator.geolocation.watchPosition((pos) => {
      const { latitude: lat, longitude: lng, accuracy, heading, speed } = pos.coords;
      const now = Date.now();
      const moved = lastSent ? Math.hypot((lat - lastSent.lat) * 111_000, (lng - lastSent.lng) * 111_000 * Math.cos((lat * Math.PI) / 180)) : Infinity;
      if (lastSent && now - lastSent.at < 20_000 && moved < 25) return;
      lastSent = { lat, lng, at: now }; setLast(lastSent); setError(null);
      pingRef.current({ lat, lng, accuracy, heading, speed, label: labelRef.current || undefined });
    }, (e) => setError(e.message), { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 });
    return () => navigator.geolocation.clearWatch(id);
  }, [enabled]);

  return { error, last };
}
