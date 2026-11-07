import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Copy, Trash2 } from "lucide-react";
import { api, useKeys } from "../lib/api";
import { TopBar } from "../components/Shell";
import { relTime } from "../lib/time";

export default function SettingsPage() {
  const keys = useKeys();
  const qc = useQueryClient();
  const [name, setName] = useState("Claude");
  const [fresh, setFresh] = useState<string | null>(null);
  const create = useMutation({ mutationFn: () => api<{ key: string }>("/me/keys", { method: "POST", json: { name } }), onSuccess: (r) => { setFresh(r.key); qc.invalidateQueries({ queryKey: ["keys"] }); } });
  const del = useMutation({ mutationFn: (id: string) => api(`/me/keys/${id}`, { method: "DELETE" }), onSuccess: () => qc.invalidateQueries({ queryKey: ["keys"] }) });
  const origin = window.location.origin;
  const keyShown = fresh ?? "tmt_…";
  const mcpConfig = JSON.stringify({ mcpServers: { trippy: { type: "http", url: `${origin}/mcp`, headers: { Authorization: `Bearer ${keyShown}` } } } }, null, 2);

  return (
    <div className="h-full flex flex-col">
      <TopBar />
      <main className="flex-1 overflow-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          <div><h1 className="font-display text-3xl font-bold tracking-tight">Agents & API keys</h1><p className="text-ink-2 text-sm mt-1">Give your AI agent a key. Everything it changes is attributed to that key in each trip's activity log.</p></div>

          <section className="card p-5">
            <h2 className="font-semibold mb-3">Create a key</h2>
            <div className="flex gap-2"><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name, e.g. Claude" /><button className="btn-primary shrink-0" onClick={() => create.mutate()} disabled={!name || create.isPending}>Create</button></div>
            {fresh && (
              <div className="mt-4 rounded-xl bg-amber-50 border border-amber-200 p-4">
                <div className="text-xs font-semibold text-amber-800 uppercase tracking-wider mb-1">Copy it now, it won't be shown again</div>
                <div className="flex items-center gap-2"><code className="mono bg-white rounded-lg px-2 py-1 border border-amber-200 flex-1 overflow-auto">{fresh}</code><button className="btn-soft" onClick={() => navigator.clipboard.writeText(fresh)}><Copy size={14} /> Copy</button></div>
              </div>
            )}
          </section>

          <section className="card p-5">
            <h2 className="font-semibold mb-3">Your keys</h2>
            {keys.data?.length === 0 && <div className="text-sm text-ink-3">No keys yet.</div>}
            <ul className="divide-y divide-line">
              {keys.data?.map((k) => (
                <li key={k.id} className="py-2.5 flex items-center gap-3">
                  <div className="flex-1 min-w-0"><div className="font-medium text-sm">{k.name}</div><div className="text-xs text-ink-3 mono">tmt_{k.prefix}_•••• · {k.lastUsedAt ? `used ${relTime(k.lastUsedAt)}` : "never used"}</div></div>
                  <button className="btn-ghost text-rose-600" onClick={() => { if (confirm(`Revoke key "${k.name}"?`)) del.mutate(k.id); }}><Trash2 size={15} /></button>
                </li>
              ))}
            </ul>
          </section>

          <section className="card p-5 space-y-4">
            <h2 className="font-semibold">Connect an agent</h2>
            <div>
              <div className="label">MCP (Claude Code / Claude Desktop / any MCP client) — HTTP</div>
              <pre className="mono bg-paper-2 rounded-xl p-3 overflow-auto text-[11.5px] leading-relaxed">{mcpConfig}</pre>
              <div className="text-xs text-ink-3 mt-1">Claude Code: <code className="mono">claude mcp add --transport http trippy {origin}/mcp --header "Authorization: Bearer {keyShown}"</code></div>
            </div>
            <div>
              <div className="label">MCP — stdio (same machine)</div>
              <pre className="mono bg-paper-2 rounded-xl p-3 overflow-auto text-[11.5px] leading-relaxed">{`TMT_API_KEY=${keyShown} npm run mcp --prefix /path/to/trippy-mc-tripface`}</pre>
            </div>
            <div>
              <div className="label">REST</div>
              <pre className="mono bg-paper-2 rounded-xl p-3 overflow-auto text-[11.5px] leading-relaxed">{`curl -H "Authorization: Bearer ${keyShown}" ${origin}/api/trips\ncurl -H "Authorization: Bearer ${keyShown}" ${origin}/api/trips/<slug>/summary.md`}</pre>
              <div className="text-xs text-ink-3 mt-1">Interactive docs: <a className="underline" href="/api/docs" target="_blank">{origin}/api/docs</a> · OpenAPI: <a className="underline" href="/api/openapi.json" target="_blank">/api/openapi.json</a></div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
