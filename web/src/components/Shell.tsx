import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { KeyRound, LogOut } from "lucide-react";
import { api, useMe } from "../lib/api";

export function Avatar({ name, color, size = 28, title }: { name: string; color: string; size?: number; title?: string }) {
  return <span title={title ?? name} style={{ width: size, height: size, background: color, fontSize: size * 0.42 }} className="inline-grid place-items-center rounded-full text-white font-bold ring-2 ring-white shrink-0">{name.slice(0, 1).toUpperCase()}</span>;
}

export function TopBar({ children }: { children?: React.ReactNode }) {
  const me = useMe();
  const qc = useQueryClient();
  const nav = useNavigate();
  const logout = async () => { await api("/auth/logout", { method: "POST" }); qc.clear(); nav("/login"); };
  return (
    <header className="h-14 shrink-0 border-b border-line bg-paper/80 backdrop-blur flex items-center gap-3 px-4">
      <Link to="/" className="font-display font-bold text-lg tracking-tight flex items-center gap-2"><span>🧳</span><span className="hidden sm:inline">Trippy McTripface</span></Link>
      <div className="flex-1 min-w-0 flex items-center gap-2">{children}</div>
      {me.data && (
        <div className="flex items-center gap-1">
          <Link to="/settings" className="btn-ghost hidden sm:inline-flex" title="API keys & agents"><KeyRound size={16} /><span className="hidden md:inline">Agents</span></Link>
          <button onClick={logout} className="btn-ghost hidden sm:inline-flex" title="Sign out"><LogOut size={16} /></button>
          <Avatar name={me.data.name} color={me.data.avatarColor} />
        </div>
      )}
    </header>
  );
}
