import { useState } from "react";
import { Bot, Check, Copy, Link2, Navigation, Radio, Trash2, UserPlus, X } from "lucide-react";
import type { Activity, TravelerLocation, TripDetail } from "@tmt/shared";
import { useActivity, useMembers, useShareLinks, useTripMutations, type Me } from "../lib/api";
import { relTime } from "../lib/time";
import { Avatar } from "./Shell";
import { useLocationShare } from "../hooks/useLocationShare";
import { useTripUI } from "../lib/tripui";

export function Panel({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-ink/30 backdrop-blur-[2px]" onClick={onClose}>
      <div className="w-full max-w-md h-full bg-paper shadow-pop flex flex-col fade-up" onClick={(e) => e.stopPropagation()}>
        <header className="px-5 py-3 border-b border-line flex items-center gap-3 bg-white"><h2 className="font-display font-bold text-lg flex-1">{title}</h2><button onClick={onClose} className="btn-ghost"><X size={18} /></button></header>
        <div className="flex-1 overflow-auto p-5 space-y-5 scrollbar-thin">{children}</div>
      </div>
    </div>
  );
}

function CopyBtn({ text, label = "Copy" }: { text: string; label?: string }) {
  const [ok, setOk] = useState(false);
  return <button className="btn-soft text-xs" onClick={() => { navigator.clipboard.writeText(text); setOk(true); setTimeout(() => setOk(false), 1200); }}>{ok ? <Check size={13} /> : <Copy size={13} />} {ok ? "Copied" : label}</button>;
}

export function SharePanel({ trip, me, onClose }: { trip: TripDetail; me: Me; onClose: () => void }) {
  const members = useMembers(trip.slug);
  const links = useShareLinks(trip.slug);
  const m = useTripMutations(trip.slug);
  const [email, setEmail] = useState(""); const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [label, setLabel] = useState(""); const [conf, setConf] = useState(false); const [costs, setCosts] = useState(false);
  const isOwner = trip.myRole === "owner";
  const origin = window.location.origin;
  return (
    <Panel title="Share & members" onClose={onClose}>
      <section>
        <h3 className="label">Members</h3>
        <ul className="divide-y divide-line card px-4">
          {members.data?.members.map((mb) => (
            <li key={mb.userId} className="py-2.5 flex items-center gap-3">
              <Avatar name={mb.name} color={mb.color} />
              <div className="flex-1 min-w-0"><div className="text-sm font-medium">{mb.name}{mb.userId === me.id && <span className="text-ink-3"> (you)</span>}</div><div className="text-xs text-ink-3 truncate">{mb.email}</div></div>
              {mb.role === "owner" ? <span className="chip">owner</span> : isOwner ? <select className="input w-24 shrink-0 py-1 text-xs" value={mb.role} onChange={(e) => m.setRole.mutate({ userId: mb.userId, role: e.target.value as "editor" | "viewer" })}><option value="editor">editor</option><option value="viewer">viewer</option></select> : <span className="chip">{mb.role}</span>}
              {(isOwner || mb.userId === me.id) && mb.role !== "owner" && <button className="btn-ghost px-1.5 text-rose-600" onClick={() => m.removeMember.mutate(mb.userId)}><Trash2 size={14} /></button>}
            </li>
          ))}
          {members.data?.invites.map((i) => <li key={i.id} className="py-2.5 flex items-center gap-3 text-sm text-ink-2"><span className="w-7 h-7 rounded-full bg-paper-2 grid place-items-center text-xs">✉️</span><span className="flex-1 truncate">{i.email}</span><span className="chip">invited · {i.role}</span></li>)}
        </ul>
        {trip.myRole !== "viewer" && (
          <form className="flex gap-2 mt-3" onSubmit={(e) => { e.preventDefault(); if (email) m.invite.mutate({ email, role }, { onSuccess: () => setEmail("") }); }}>
            <input className="input" type="email" placeholder="friend@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <select className="input w-auto" value={role} onChange={(e) => setRole(e.target.value as "editor" | "viewer")}><option value="editor">can edit</option><option value="viewer">can view</option></select>
            <button className="btn-primary shrink-0"><UserPlus size={15} /></button>
          </form>
        )}
        <p className="text-xs text-ink-3 mt-2">People without an account are added automatically when they sign up with that email.</p>
      </section>

      {trip.myRole !== "viewer" && (
        <section>
          <h3 className="label">View-only links</h3>
          <ul className="space-y-2">
            {links.data?.map((l) => (
              <li key={l.id} className="card p-3 flex items-center gap-2">
                <Link2 size={15} className="text-ink-3 shrink-0" />
                <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{l.label || "Share link"}</div><div className="text-[11px] text-ink-3">{l.showConfirmations ? "shows refs" : "hides refs"} · {l.showCosts ? "shows costs" : "hides costs"}</div></div>
                <CopyBtn text={`${origin}/s/${l.token}`} label="Copy link" />
                <CopyBtn text={`${origin}/api/share/${l.token}/calendar.ics`} label="Calendar" />
                <button className="btn-ghost px-1.5 text-rose-600" onClick={() => m.deleteShare.mutate(l.id)}><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
          <form className="card p-3 mt-2 space-y-2" onSubmit={(e) => { e.preventDefault(); m.createShare.mutate({ label: label || undefined, showConfirmations: conf, showCosts: costs }, { onSuccess: () => setLabel("") }); }}>
            <input className="input" placeholder="Label (e.g. for Mum)" value={label} onChange={(e) => setLabel(e.target.value)} />
            <div className="flex items-center gap-4 text-sm"><label className="flex items-center gap-1.5"><input type="checkbox" checked={conf} onChange={(e) => setConf(e.target.checked)} /> Show confirmation codes</label><label className="flex items-center gap-1.5"><input type="checkbox" checked={costs} onChange={(e) => setCosts(e.target.checked)} /> Show costs</label></div>
            <button className="btn-soft w-full justify-center">Create link</button>
          </form>
          <p className="text-xs text-ink-3 mt-2">The calendar link subscribes any calendar app (Apple, Google, Outlook) to this trip.</p>
        </section>
      )}
    </Panel>
  );
}

export function ActivityPanel({ trip, onClose }: { trip: TripDetail; onClose: () => void }) {
  const act = useActivity(trip.slug);
  const ui = useTripUI();
  const icon = (a: Activity) => a.actor.kind === "agent" ? <Bot size={14} /> : a.actor.label.slice(0, 1);
  return (
    <Panel title="Activity" onClose={onClose}>
      <ul className="space-y-2">
        {act.data?.map((a) => (
          <li key={a.id} className={`card p-3 flex gap-3 ${a.entityId && a.entity === "item" ? "cursor-pointer hover:shadow-pop" : ""}`} onClick={() => a.entity === "item" && a.entityId && a.action !== "delete" && (ui.setSelectedId(a.entityId), onClose())}>
            <span className={`w-7 h-7 rounded-full grid place-items-center text-xs font-bold shrink-0 ${a.actor.kind === "agent" ? "bg-violet-100 text-violet-700" : "bg-paper-2 text-ink-2"}`}>{icon(a)}</span>
            <div className="min-w-0 flex-1"><div className="text-sm"><span className="font-medium">{a.actor.label.split(" (")[0]}</span>{a.actor.kind === "agent" && <span className="text-violet-700 text-xs"> (agent)</span>} {a.summary}</div><div className="text-[11px] text-ink-3">{relTime(a.createdAt)}</div></div>
          </li>
        ))}
        {act.data?.length === 0 && <li className="text-sm text-ink-3">No activity yet.</li>}
      </ul>
    </Panel>
  );
}

export function LivePanel({ trip, me, travelers, onClose }: { trip: TripDetail; me: Me; travelers: TravelerLocation[]; onClose: () => void }) {
  const m = useTripMutations(trip.slug);
  const ui = useTripUI();
  const [on, setOn] = useState<boolean>(() => localStorage.getItem(`share:${trip.id}`) === "1");
  const [label, setLabel] = useState("");
  const { error, last } = useLocationShare(on, label, (p) => m.ping.mutate(p));
  const toggle = (v: boolean) => { setOn(v); localStorage.setItem(`share:${trip.id}`, v ? "1" : "0"); if (!v) m.stopSharing.mutate(); };
  const meetups = trip.items.filter((i) => i.type === "meetup" && i.status !== "cancelled");
  const mine = travelers.find((t) => t.userId === me.id);
  const dist = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => { const R = 6371e3, φ1 = (a.lat * Math.PI) / 180, φ2 = (b.lat * Math.PI) / 180, dφ = φ2 - φ1, dλ = ((b.lng - a.lng) * Math.PI) / 180; const h = Math.sin(dφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(dλ / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  const fmtDist = (d: number) => d < 1000 ? `${Math.round(d)} m` : `${(d / 1000).toFixed(1)} km`;
  return (
    <Panel title="Live" onClose={onClose}>
      <section className="card p-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <span className={`relative w-11 h-6 rounded-full transition-colors ${on ? "bg-emerald-500" : "bg-stone-300"}`}><span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} /></span>
          <input type="checkbox" className="hidden" checked={on} onChange={(e) => toggle(e.target.checked)} />
          <div><div className="font-medium text-sm flex items-center gap-1.5"><Radio size={14} className={on ? "text-emerald-600" : "text-ink-3"} /> Share my location with this trip</div><div className="text-xs text-ink-3">Updates every ~20 s while this tab is open. Only trip members can see it.</div></div>
        </label>
        {on && <input className="input mt-3" placeholder="Status, e.g. 'on the train, 10 min away'" value={label} onChange={(e) => setLabel(e.target.value)} onBlur={() => last && m.ping.mutate({ lat: last.lat, lng: last.lng, label: label || undefined })} />}
        {error && <div className="text-xs text-rose-600 mt-2">{error}</div>}
        {on && last && <div className="text-xs text-emerald-700 mt-2">Sharing · last fix {relTime(new Date(last.at).toISOString())}</div>}
      </section>

      <section>
        <h3 className="label">Travellers</h3>
        {travelers.length === 0 && <div className="text-sm text-ink-3">Nobody is sharing a location right now.</div>}
        <ul className="space-y-2">{travelers.map((t) => (
          <li key={t.userId} className="card p-3 flex items-center gap-3">
            <Avatar name={t.name} color={t.color} />
            <div className="flex-1 min-w-0"><div className="text-sm font-medium">{t.name}{t.userId === me.id && " (you)"}</div><div className="text-xs text-ink-3 truncate">{relTime(t.recordedAt)}{t.label && ` · ${t.label}`}{mine && t.userId !== me.id && ` · ${fmtDist(dist(mine, t))} from you`}</div></div>
            <button className="btn-soft px-2" onClick={() => ui.flyTo(t.lng, t.lat)} title="Show on map"><Navigation size={14} /></button>
          </li>
        ))}</ul>
      </section>

      <section>
        <h3 className="label">Meetups</h3>
        {meetups.length === 0 && <div className="text-sm text-ink-3">No meetups yet — add one from the + menu and it becomes a beacon on the map.</div>}
        <ul className="space-y-2">{meetups.map((mu) => (
          <li key={mu.id} className="card p-3 flex items-center gap-3 cursor-pointer hover:shadow-pop" onClick={() => { ui.setSelectedId(mu.id); if (mu.location?.lat != null) ui.flyTo(mu.location.lng!, mu.location.lat); onClose(); }}>
            <span className="text-xl">📍</span>
            <div className="flex-1 min-w-0"><div className="text-sm font-medium truncate">{mu.title}</div><div className="text-xs text-ink-3 truncate">{new Date(mu.startAt).toLocaleString("en-GB", { timeZone: mu.tz, weekday: "short", hour: "2-digit", minute: "2-digit" })} · {mu.location?.name}{mine && mu.location?.lat != null && ` · ${fmtDist(dist(mine, { lat: mu.location.lat, lng: mu.location.lng! }))} away`}</div></div>
          </li>
        ))}</ul>
      </section>
    </Panel>
  );
}
