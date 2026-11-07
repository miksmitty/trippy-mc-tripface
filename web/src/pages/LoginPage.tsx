import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { api, ApiError } from "../lib/api";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();
  const loc = useLocation() as { state?: { from?: string } };
  const qc = useQueryClient();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      await api(mode === "login" ? "/auth/login" : "/auth/signup", { method: "POST", json: mode === "login" ? { email, password } : { email, password, name } });
      await qc.invalidateQueries({ queryKey: ["me"] });
      nav(loc.state?.from ?? "/", { replace: true });
    } catch (e) { setErr(e instanceof ApiError ? e.message : "Something went wrong"); }
    finally { setBusy(false); }
  };

  return (
    <div className="min-h-full grid place-items-center p-6 bg-[radial-gradient(ellipse_at_top,_#fde68a33,_transparent_60%),radial-gradient(ellipse_at_bottom_right,_#38bdf833,_transparent_50%)]">
      <form onSubmit={submit} className="card w-full max-w-sm p-7 fade-up">
        <div className="text-4xl mb-3">🧳</div>
        <h1 className="font-display text-2xl font-bold tracking-tight">Trippy McTripface</h1>
        <p className="text-sm text-ink-2 mt-1 mb-6">Your trips, your map, your agent.</p>
        {mode === "signup" && <><label className="label">Name</label><input className="input mb-3" value={name} onChange={(e) => setName(e.target.value)} required /></>}
        <label className="label">Email</label>
        <input className="input mb-3" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        <label className="label">Password</label>
        <input className="input mb-4" type="password" value={password} onChange={(e) => setPassword(e.target.value)} minLength={8} required />
        {err && <div className="text-sm text-rose-600 mb-3">{err}</div>}
        <button className="btn-primary w-full justify-center py-2.5" disabled={busy}>{busy ? "…" : mode === "login" ? "Sign in" : "Create account"}</button>
        <button type="button" onClick={() => setMode(mode === "login" ? "signup" : "login")} className="w-full text-center text-sm text-ink-2 mt-4 hover:text-ink">
          {mode === "login" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
