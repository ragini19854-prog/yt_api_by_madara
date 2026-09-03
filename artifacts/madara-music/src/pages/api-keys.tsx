import { useState } from "react";
import { useOptionalAuth } from "../contexts/AuthContext";
import { Key, Plus, Trash2, Copy, Check, RefreshCw, Eye, EyeOff, AlertCircle, Zap, Shield, Code } from "lucide-react";

interface ApiKeyRecord {
  id: number;
  name: string;
  key: string;
  active: boolean;
  createdAt: string;
  lastUsedAt?: string;
  revealed?: boolean;
}

function fmt(date: string) {
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default function ApiKeysPage() {
  const { isSignedIn, getToken } = useOptionalAuth();
  const [keys, setKeys] = useState<ApiKeyRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [showNewKeyForm, setShowNewKeyForm] = useState(false);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [revealedId, setRevealedId] = useState<number | null>(null);
  const [error, setError] = useState("");

  async function authFetch(url: string, opts: RequestInit = {}) {
    const token = await getToken();
    return fetch(url, {
      ...opts,
      headers: { ...opts.headers, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    });
  }

  async function loadKeys() {
    setLoading(true);
    setError("");
    try {
      const res = await authFetch("/api/keys");
      if (!res.ok) throw new Error("Failed to load keys");
      const data = await res.json();
      setKeys(data);
      setLoaded(true);
    } catch (e) {
      setError("Could not load API keys. Make sure you are signed in.");
    } finally {
      setLoading(false);
    }
  }

  async function createKey() {
    if (!newKeyName.trim()) return;
    setCreating(true);
    setError("");
    try {
      const res = await authFetch("/api/keys", {
        method: "POST",
        body: JSON.stringify({ name: newKeyName.trim() }),
      });
      if (!res.ok) throw new Error("Failed to create key");
      const created: ApiKeyRecord = await res.json();
      setKeys((prev) => [...prev, created]);
      setRevealedId(created.id); // auto-reveal new key once
      setNewKeyName("");
      setShowNewKeyForm(false);
    } catch {
      setError("Could not create API key.");
    } finally {
      setCreating(false);
    }
  }

  async function deleteKey(id: number) {
    try {
      const res = await authFetch(`/api/keys/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setKeys((prev) => prev.filter((k) => k.id !== id));
    } catch {
      setError("Could not delete key.");
    }
  }

  async function copyKey(key: ApiKeyRecord) {
    await navigator.clipboard.writeText(key.key);
    setCopiedId(key.id);
    setTimeout(() => setCopiedId(null), 2500);
  }

  if (!isSignedIn) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center space-y-4">
        <Key className="w-12 h-12 text-primary mx-auto" />
        <h1 className="text-2xl font-bold text-white">API Keys</h1>
        <p className="text-white/50">Sign in to generate and manage your Madara Music API keys.</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-6 py-10 space-y-10">
      {/* Header */}
      <div className="space-y-3">
        <div className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary px-4 py-1.5 rounded-full text-sm font-medium">
          <Key className="w-4 h-4" />
          Developer Access
        </div>
        <h1 className="text-3xl font-bold text-white">API Keys</h1>
        <p className="text-white/50 text-base">
          Generate personal API keys to use the Madara Music API from your bots, scripts, and apps.
          Each key authenticates your requests to all <code className="bg-white/10 px-1 rounded text-sm">/api/*</code> endpoints.
        </p>
      </div>

      {/* Feature pills */}
      <div className="flex flex-wrap gap-3">
        {[
          { icon: <Zap className="w-3.5 h-3.5" />, label: "No rate limits on your own instance" },
          { icon: <Shield className="w-3.5 h-3.5" />, label: "Keys are scoped to your account" },
          { icon: <Code className="w-3.5 h-3.5" />, label: "Works with all /api endpoints" },
        ].map(({ icon, label }) => (
          <span key={label} className="flex items-center gap-1.5 bg-white/5 border border-white/10 text-white/60 px-3 py-1.5 rounded-full text-sm">
            {icon}{label}
          </span>
        ))}
      </div>

      {/* Usage example */}
      <div className="bg-white/3 border border-white/10 rounded-2xl p-6 space-y-3">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Code className="w-4 h-4 text-primary" /> How to use your key
        </h2>
        <p className="text-white/50 text-sm">Pass your key as the <code className="bg-white/10 px-1 rounded text-xs">Authorization</code> header:</p>
        <div className="bg-[hsl(240,10%,4%)] rounded-xl border border-white/10 p-4 font-mono text-sm text-green-400 overflow-x-auto">
          <span className="text-white/40"># Search example</span>
          <br />
          curl -H <span className="text-yellow-300">"Authorization: Bearer mm_yourkey..."</span>{" "}
          <span className="text-cyan-400">https://YOUR_DOMAIN/api/music/youtube/search?q=lofi</span>
          <br /><br />
          <span className="text-white/40"># Stream a song</span>
          <br />
          curl -H <span className="text-yellow-300">"Authorization: Bearer mm_yourkey..."</span>{" "}
          <span className="text-cyan-400">https://YOUR_DOMAIN/api/music/youtube/stream?videoId=VIDEO_ID</span>
        </div>
        <p className="text-white/40 text-xs">Set MADARA_API_URL in your bot's config to your deployed Madara Music domain.</p>
      </div>

      {/* Keys list */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-white font-semibold text-lg">Your Keys</h2>
          <div className="flex items-center gap-2">
            {loaded && (
              <button
                onClick={loadKeys}
                className="p-2 rounded-lg text-white/40 hover:text-white hover:bg-white/5 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </button>
            )}
            {!loaded ? (
              <button
                onClick={loadKeys}
                disabled={loading}
                className="flex items-center gap-2 bg-primary/90 hover:bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                {loading ? "Loading…" : "Load My Keys"}
              </button>
            ) : (
              <button
                onClick={() => setShowNewKeyForm((v) => !v)}
                className="flex items-center gap-2 bg-primary/90 hover:bg-primary text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" /> New Key
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-4 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}

        {/* New key form */}
        {showNewKeyForm && (
          <div className="bg-white/3 border border-primary/20 rounded-2xl p-5 space-y-4">
            <h3 className="text-white font-medium text-sm">Name your new key</h3>
            <input
              type="text"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              placeholder="e.g. Discord Bot, Telegram VC, My Script"
              className="w-full bg-white/5 border border-white/10 text-white placeholder:text-white/30 rounded-xl px-4 py-2.5 text-sm outline-none focus:border-primary/50"
              onKeyDown={(e) => e.key === "Enter" && createKey()}
              autoFocus
            />
            <div className="flex gap-2">
              <button
                onClick={createKey}
                disabled={creating || !newKeyName.trim()}
                className="flex items-center gap-2 bg-primary/90 hover:bg-primary disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-medium transition-colors"
              >
                {creating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {creating ? "Creating…" : "Generate Key"}
              </button>
              <button
                onClick={() => { setShowNewKeyForm(false); setNewKeyName(""); }}
                className="text-white/50 hover:text-white px-4 py-2 rounded-xl text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Key cards */}
        {loaded && keys.length === 0 && !showNewKeyForm && (
          <div className="text-center py-16 space-y-3">
            <Key className="w-10 h-10 text-white/20 mx-auto" />
            <p className="text-white/40">No API keys yet.</p>
            <button
              onClick={() => setShowNewKeyForm(true)}
              className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
            >
              Generate your first key →
            </button>
          </div>
        )}

        {keys.map((k) => {
          const isRevealed = k.revealed || revealedId === k.id;
          return (
            <div key={k.id} className="bg-white/3 border border-white/10 rounded-2xl p-5 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-white font-medium text-sm">{k.name}</p>
                  <p className="text-white/30 text-xs mt-0.5">Created {fmt(k.createdAt)}{k.lastUsedAt ? ` · Last used ${fmt(k.lastUsedAt)}` : ""}</p>
                </div>
                <button
                  onClick={() => deleteKey(k.id)}
                  className="p-2 rounded-lg text-white/30 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                  title="Revoke key"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 bg-[hsl(240,10%,4%)] border border-white/10 rounded-xl px-4 py-2.5 font-mono text-sm overflow-x-auto">
                  <span className={isRevealed ? "text-green-400" : "text-white/50 select-none"}>
                    {isRevealed ? k.key : k.key}
                  </span>
                </div>
                {k.revealed && (
                  <button
                    onClick={() => setRevealedId(isRevealed && revealedId === k.id ? null : k.id)}
                    className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                    title={isRevealed ? "Hide" : "Reveal (shown once)"}
                  >
                    {isRevealed && revealedId === k.id ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
                <button
                  onClick={() => copyKey(k)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    copiedId === k.id
                      ? "bg-green-500/20 text-green-400 border border-green-500/30"
                      : "bg-white/5 hover:bg-white/10 text-white/70 hover:text-white"
                  }`}
                >
                  {copiedId === k.id ? <><Check className="w-4 h-4" />Copied</> : <><Copy className="w-4 h-4" />Copy</>}
                </button>
              </div>

              {k.revealed && (
                <div className="flex items-center gap-2 bg-yellow-500/5 border border-yellow-500/15 rounded-xl px-4 py-2.5">
                  <AlertCircle className="w-4 h-4 text-yellow-400 shrink-0" />
                  <span className="text-yellow-300/80 text-xs">Copy this key now — it will only be shown in full once.</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
