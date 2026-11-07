import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Activity, Item, ItemCreate, ItemUpdate, Member, ShareLink, TravelerLocation, Trip, TripCreate, TripDetail, Airport, GeocodeResult } from "@tmt/shared";

export class ApiError extends Error { constructor(public status: number, message: string, public issues?: unknown) { super(message); } }

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`/api${path}`, { credentials: "include", ...rest, headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...(rest.headers ?? {}) }, body: json !== undefined ? JSON.stringify(json) : rest.body });
  const ct = res.headers.get("content-type") ?? "";
  const body = ct.includes("json") ? await res.json() : await res.text();
  if (!res.ok) throw new ApiError(res.status, (body as { error?: string })?.error ?? res.statusText, (body as { issues?: unknown })?.issues);
  return body as T;
}

export interface Me { id: string; email: string; name: string; avatarColor: string; actorKind: "user" | "agent" }

export const useMe = () => useQuery({ queryKey: ["me"], queryFn: () => api<Me>("/me"), retry: false, staleTime: 5 * 60_000 });
export const useTrips = () => useQuery({ queryKey: ["trips"], queryFn: () => api<Trip[]>("/trips") });
export const useTrip = (slug: string) => useQuery({ queryKey: ["trip", slug], queryFn: () => api<TripDetail>(`/trips/${slug}`) });
export const useShared = (token: string) => useQuery({ queryKey: ["share", token], queryFn: () => api<TripDetail & { share: { label: string | null; showConfirmations: boolean; showCosts: boolean } }>(`/share/${token}`) });
export const useActivity = (slug: string, enabled = true) => useQuery({ queryKey: ["activity", slug], queryFn: () => api<Activity[]>(`/trips/${slug}/activity?limit=100`), enabled, refetchInterval: 30_000 });
export const useTravelers = (slug: string) => useQuery({ queryKey: ["travelers", slug], queryFn: () => api<TravelerLocation[]>(`/trips/${slug}/travelers`), refetchInterval: 60_000 });
export const useMembers = (slug: string) => useQuery({ queryKey: ["members", slug], queryFn: () => api<{ members: Member[]; invites: { id: string; email: string; role: string }[] }>(`/trips/${slug}/members`) });
export const useShareLinks = (slug: string) => useQuery({ queryKey: ["share-links", slug], queryFn: () => api<ShareLink[]>(`/trips/${slug}/share`) });
export const useKeys = () => useQuery({ queryKey: ["keys"], queryFn: () => api<{ id: string; name: string; prefix: string; lastUsedAt: string | null; createdAt: string }[]>("/me/keys") });

export function useTripMutations(slug: string) {
  const qc = useQueryClient();
  const inv = () => { qc.invalidateQueries({ queryKey: ["trip", slug] }); qc.invalidateQueries({ queryKey: ["activity", slug] }); qc.invalidateQueries({ queryKey: ["trips"] }); };
  const createItem = useMutation({ mutationFn: (input: ItemCreate) => api<Item>(`/trips/${slug}/items`, { method: "POST", json: input }), onSuccess: inv });
  const updateItem = useMutation({ mutationFn: ({ id, patch }: { id: string; patch: ItemUpdate }) => api<Item>(`/trips/${slug}/items/${id}`, { method: "PATCH", json: patch }), onSuccess: inv });
  const deleteItem = useMutation({ mutationFn: (id: string) => api(`/trips/${slug}/items/${id}`, { method: "DELETE" }), onSuccess: inv });
  const updateTrip = useMutation({ mutationFn: (patch: Partial<TripCreate>) => api<Trip>(`/trips/${slug}`, { method: "PATCH", json: patch }), onSuccess: inv });
  const invite = useMutation({ mutationFn: (b: { email: string; role: "editor" | "viewer" }) => api(`/trips/${slug}/members`, { method: "POST", json: b }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["members", slug] }); inv(); } });
  const removeMember = useMutation({ mutationFn: (userId: string) => api(`/trips/${slug}/members/${userId}`, { method: "DELETE" }), onSuccess: () => { qc.invalidateQueries({ queryKey: ["members", slug] }); inv(); } });
  const setRole = useMutation({ mutationFn: ({ userId, role }: { userId: string; role: "editor" | "viewer" }) => api(`/trips/${slug}/members/${userId}`, { method: "PATCH", json: { role } }), onSuccess: () => qc.invalidateQueries({ queryKey: ["members", slug] }) });
  const createShare = useMutation({ mutationFn: (b: { label?: string; showConfirmations: boolean; showCosts: boolean }) => api<ShareLink>(`/trips/${slug}/share`, { method: "POST", json: b }), onSuccess: () => qc.invalidateQueries({ queryKey: ["share-links", slug] }) });
  const deleteShare = useMutation({ mutationFn: (id: string) => api(`/trips/${slug}/share/${id}`, { method: "DELETE" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["share-links", slug] }) });
  const ping = useMutation({ mutationFn: (b: { lat: number; lng: number; accuracy?: number; heading?: number | null; speed?: number | null; label?: string }) => api<TravelerLocation>(`/trips/${slug}/travelers/me`, { method: "PUT", json: b }), onSuccess: () => qc.invalidateQueries({ queryKey: ["travelers", slug] }) });
  const stopSharing = useMutation({ mutationFn: () => api(`/trips/${slug}/travelers/me`, { method: "DELETE" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["travelers", slug] }) });
  return { createItem, updateItem, deleteItem, updateTrip, invite, removeMember, setRole, createShare, deleteShare, ping, stopSharing };
}

export const searchAirports = (q: string) => api<Airport[]>(`/geo/airports?q=${encodeURIComponent(q)}`);
export const geocode = (q: string, near?: { lat: number; lng: number }) => api<GeocodeResult[]>(`/geo/search?q=${encodeURIComponent(q)}${near ? `&lat=${near.lat}&lng=${near.lng}` : ""}`);
