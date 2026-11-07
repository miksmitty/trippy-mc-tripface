import { useParams } from "react-router-dom";
import { useShared } from "../lib/api";
import { TripView } from "./TripPage";

export default function SharePage() {
  const { token = "" } = useParams();
  const q = useShared(token);
  if (q.isLoading) return <div className="h-full grid place-items-center text-ink-3">Loading…</div>;
  if (q.isError || !q.data) return <div className="h-full grid place-items-center text-ink-2">This share link is invalid or has expired.</div>;
  const { share, ...trip } = q.data;
  return <TripView trip={trip} me={{ id: "", name: "Guest", avatarColor: "#aaa", email: "", actorKind: "user" }} travelers={[]} presence={[]} connected={false} shareMode={share} />;
}
