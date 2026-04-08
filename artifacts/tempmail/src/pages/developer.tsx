import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import {
  Key, Webhook, Trash2, Copy, CheckCircle2, ToggleLeft, ToggleRight,
  PlayCircle, Eye, EyeOff, ChevronLeft, RefreshCw, Code2, RotateCcw, AlertTriangle, Zap, Plus
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const api = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}/api${path}`, { credentials: "include", ...opts });

interface ApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

interface Webhook {
  id: number;
  url: string;
  events: string[];
  active: boolean;
  lastTriggeredAt: string | null;
  failCount: number;
  createdAt: string;
}

function ConfirmDialog({
  open, title, description, confirmLabel, onConfirm, onCancel, loading,
}: {
  open: boolean; title: string; description: string; confirmLabel: string;
  onConfirm: () => void; onCancel: () => void; loading?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onCancel}>
      <div className="bg-background rounded-xl shadow-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <h3 className="font-semibold text-lg">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-5">{description}</p>
        <div className="flex gap-2 justify-end">
          <Button variant="outline" onClick={onCancel} disabled={loading}>Batal</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={copy}>
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </Button>
  );
}


function RevealKeyModal({ rawKey, onClose }: { rawKey: string; onClose: () => void }) {
  const [show, setShow] = useState(false);
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-2xl p-6 w-full max-w-md">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <h3 className="font-semibold text-lg">API Key Berhasil Dibuat</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Simpan key ini sekarang. Key tidak akan ditampilkan lagi setelah dialog ini ditutup.
        </p>
        <div className="bg-muted rounded-lg p-3 flex items-center gap-2 mb-4">
          <code className="flex-1 text-xs break-all font-mono">
            {show ? rawKey : rawKey.substring(0, 8) + "•".repeat(rawKey.length - 8)}
          </code>
          <Button variant="ghost" size="icon" className="h-7 w-7 flex-shrink-0" onClick={() => setShow(!show)}>
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
          <CopyButton value={rawKey} />
        </div>
        <Button className="w-full" onClick={onClose}>Selesai — Sudah Saya Simpan</Button>
      </div>
    </div>
  );
}

function NewWebhookModal({ onCreated, rowTrigger }: { onCreated: (secret: string) => void; rowTrigger?: boolean }) {
  const [open, setOpen] = useState(false);
  const [url, setUrl] = useState("");
  const [events, setEvents] = useState<string[]>(["new_message"]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const toggleEvent = (ev: string) => {
    setEvents((prev) => prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]);
  };

  const create = async () => {
    if (!url.trim()) return;
    setLoading(true);
    const r = await api("/developer/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, events }),
    });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) { toast({ title: "Gagal", description: data.message, variant: "destructive" }); return; }
    setOpen(false);
    setUrl("");
    setEvents(["new_message"]);
    onCreated(data.secret);
  };

  if (!open) return rowTrigger ? (
    <button
      onClick={() => setOpen(true)}
      className="flex items-center gap-1.5 px-4 h-full bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors shrink-0"
    >
      <Plus className="h-3.5 w-3.5" /> Tambah Webhook
    </button>
  ) : (
    <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
      <Plus className="h-4 w-4" /> Tambah Webhook
    </Button>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
      <div className="bg-background rounded-xl shadow-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-lg mb-4">Tambah Webhook Baru</h3>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">URL Endpoint</label>
            <Input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://your-server.com/webhook"
              className="mt-1"
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-2 block">Events</label>
            <div className="space-y-2">
              {["new_message", "inbox_expired"].map((ev) => (
                <label key={ev} className="flex items-center gap-2 cursor-pointer text-sm">
                  <input
                    type="checkbox"
                    checked={events.includes(ev)}
                    onChange={() => toggleEvent(ev)}
                    className="rounded"
                  />
                  <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{ev}</code>
                </label>
              ))}
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={create} disabled={loading || !url.trim()}>
              {loading ? "Menyimpan..." : "Tambah Webhook"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function RevealSecretModal({ secret, onClose }: { secret: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-xl shadow-2xl p-6 w-full max-w-md">
        <div className="flex items-center gap-2 mb-1">
          <CheckCircle2 className="h-5 w-5 text-green-500" />
          <h3 className="font-semibold text-lg">Webhook Berhasil Ditambah</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Simpan Signing Secret ini untuk memverifikasi payload webhook. Tidak akan ditampilkan lagi.
        </p>
        <div className="bg-muted rounded-lg p-3 flex items-center gap-2 mb-4">
          <code className="flex-1 text-xs break-all font-mono">{secret}</code>
          <CopyButton value={secret} />
        </div>
        <Button className="w-full" onClick={onClose}>Selesai</Button>
      </div>
    </div>
  );
}

export default function DeveloperPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [webhooks, setWebhooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealKey, setRevealKey] = useState<string | null>(null);
  const [revealSecret, setRevealSecret] = useState<string | null>(null);
  const [testLoading, setTestLoading] = useState<number | null>(null);
  const [confirmRegen, setConfirmRegen] = useState<{ type: "key" | "secret"; id: number } | null>(null);
  const [regenLoading, setRegenLoading] = useState(false);
  const [genKeyLoading, setGenKeyLoading] = useState(false);

  const generateKey = async () => {
    setGenKeyLoading(true);
    const r = await api("/developer/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "API Key" }),
    });
    const data = await r.json();
    setGenKeyLoading(false);
    if (!r.ok) { toast({ title: "Gagal", description: data.message, variant: "destructive" }); return; }
    await load();
    setRevealKey(data.key);
  };

  const load = async () => {
    setLoading(true);
    const [kr, wr] = await Promise.all([
      api("/developer/keys"),
      api("/developer/webhooks"),
    ]);
    if (kr.ok) { const d = await kr.json(); setKeys(d.keys); }
    if (wr.ok) { const d = await wr.json(); setWebhooks(d.webhooks); }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const deleteKey = async (id: number) => {
    const r = await api(`/developer/keys/${id}`, { method: "DELETE" });
    if (r.ok) {
      setKeys((prev) => prev.filter((k) => k.id !== id));
      toast({ title: "API key dihapus" });
    }
  };

  const deleteWebhook = async (id: number) => {
    const r = await api(`/developer/webhooks/${id}`, { method: "DELETE" });
    if (r.ok) {
      setWebhooks((prev) => prev.filter((w) => w.id !== id));
      toast({ title: "Webhook dihapus" });
    }
  };

  const toggleWebhook = async (id: number, active: boolean) => {
    const r = await api(`/developer/webhooks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (r.ok) {
      setWebhooks((prev) => prev.map((w) => w.id === id ? { ...w, active } : w));
    }
  };

  const testWebhook = async (id: number) => {
    setTestLoading(id);
    const r = await api(`/developer/webhooks/${id}/test`, { method: "POST" });
    const data = await r.json();
    setTestLoading(null);
    if (data.success) {
      toast({ title: "Test berhasil!", description: `HTTP ${data.statusCode}` });
    } else {
      toast({ title: "Test gagal", description: data.error ?? `HTTP ${data.statusCode}`, variant: "destructive" });
    }
  };

  const handleRegen = async () => {
    if (!confirmRegen) return;
    setRegenLoading(true);
    if (confirmRegen.type === "key") {
      const r = await api(`/developer/keys/${confirmRegen.id}/regenerate`, { method: "POST" });
      const data = await r.json();
      if (r.ok) {
        setConfirmRegen(null);
        await load();
        setRevealKey(data.key);
      } else {
        toast({ title: "Gagal regenerate", description: data.message, variant: "destructive" });
      }
    } else {
      const r = await api(`/developer/webhooks/${confirmRegen.id}/rotate-secret`, { method: "POST" });
      const data = await r.json();
      if (r.ok) {
        setConfirmRegen(null);
        setRevealSecret(data.secret);
      } else {
        toast({ title: "Gagal rotate secret", description: data.message, variant: "destructive" });
      }
    }
    setRegenLoading(false);
  };

  const fmt = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      {revealKey && <RevealKeyModal rawKey={revealKey} onClose={() => { setRevealKey(null); load(); }} />}
      {revealSecret && <RevealSecretModal secret={revealSecret} onClose={() => { setRevealSecret(null); load(); }} />}

      <ConfirmDialog
        open={!!confirmRegen}
        title={confirmRegen?.type === "key" ? "Regenerate API Key?" : "Rotate Webhook Secret?"}
        description={
          confirmRegen?.type === "key"
            ? "API key lama akan langsung tidak berfungsi dan tidak bisa dikembalikan. Key baru akan ditampilkan setelah konfirmasi."
            : "Signing secret lama akan langsung tidak berfungsi. Secret baru harus diupdate di semua integrasi yang menggunakan webhook ini."
        }
        confirmLabel={confirmRegen?.type === "key" ? "Ya, Regenerate" : "Ya, Rotate Secret"}
        onConfirm={handleRegen}
        onCancel={() => setConfirmRegen(null)}
        loading={regenLoading}
      />

      <main className="flex-1 max-w-3xl mx-auto w-full px-4 py-8 space-y-8 overflow-x-hidden">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Code2 className="h-6 w-6 text-primary" />
              Developer Tools
            </h1>
            <p className="text-sm text-muted-foreground">Kelola API key dan webhook untuk integrasi eksternal</p>
          </div>
        </div>

        {/* ── Dokumentasi API Singkat ── */}
        <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
          <p className="text-sm font-medium">Cara Pakai API</p>
          <div className="bg-background rounded-lg p-3 font-mono text-xs text-muted-foreground space-y-1 overflow-x-auto">
            <div><span className="text-primary">GET</span>  /api/email/generate <span className="text-muted-foreground/60">X-API-Key: tmk_xxx...</span></div>
            <div><span className="text-primary">GET</span>  /api/email/inbox?email=... <span className="text-muted-foreground/60">X-API-Key: tmk_xxx...</span></div>
            <div><span className="text-primary">GET</span>  /api/email/message?id=&email=... <span className="text-muted-foreground/60">X-API-Key: tmk_xxx...</span></div>
          </div>
        </div>

        {/* ── API Keys ── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="h-4.5 w-4.5 text-primary" />
              <h2 className="text-base font-semibold">API Key</h2>
              <Badge variant="secondary" className="text-[11px] h-5 px-1.5">{keys.length}/1</Badge>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={load}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {loading ? (
            <div className="flex items-center rounded-xl border border-border/60 bg-card h-11 px-3 gap-2">
              <div className="h-4 w-16 bg-muted animate-pulse rounded" />
              <div className="flex-1 h-3 bg-muted animate-pulse rounded" />
            </div>
          ) : keys.length === 0 ? (
            /* Empty state — same inline row style, direct generate */
            <div className="flex items-center rounded-xl border border-border/60 bg-card overflow-hidden h-11">
              <div className="flex items-center gap-1.5 px-3 h-full bg-muted/50 border-r border-border/60 shrink-0">
                <Key className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">API Key</span>
              </div>
              <div className="flex-1 min-w-0 px-3">
                <span className="text-sm font-mono text-muted-foreground/50 tracking-widest">••••••••••••</span>
              </div>
              <button
                onClick={generateKey}
                disabled={genKeyLoading}
                className="flex items-center gap-1.5 px-4 h-full bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors shrink-0 disabled:opacity-60"
              >
                {genKeyLoading
                  ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  : <Zap className="h-3.5 w-3.5" />
                }
                Generate Baru
              </button>
            </div>
          ) : (
            keys.map((k) => (
              <div key={k.id} className="rounded-xl border border-border/60 bg-card overflow-hidden">
                {/* Inline row */}
                <div className="flex items-center h-11">
                  {/* Label */}
                  <div className="flex items-center gap-1.5 px-3 h-full bg-muted/50 border-r border-border/60 shrink-0">
                    <Key className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">API Key</span>
                  </div>
                  {/* Key value */}
                  <div className="flex-1 min-w-0 px-3">
                    <code className="text-sm font-mono font-medium text-foreground truncate block">
                      {k.keyPrefix}<span className="text-muted-foreground">•••</span>
                    </code>
                  </div>
                  {/* Copy */}
                  <CopyButton value={k.keyPrefix + "•••"} />
                  {/* Regenerate */}
                  <button
                    onClick={() => setConfirmRegen({ type: "key", id: k.id })}
                    className="flex items-center gap-1.5 px-4 h-full bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors shrink-0"
                    title="Regenerate API key baru"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Regenerate
                  </button>
                </div>
                {/* Meta row */}
                <div className="flex items-center justify-between px-3 py-1.5 border-t border-border/40 bg-muted/20">
                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="font-medium text-foreground/70">{k.name}</span>
                    <span>Dibuat {fmt(k.createdAt)}</span>
                    {k.lastUsedAt && <span>· Dipakai {fmt(k.lastUsedAt)}</span>}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteKey(k.id)}
                    title="Hapus API key"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </section>

        {/* ── Webhooks ── */}
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <Webhook className="h-4.5 w-4.5 text-primary" />
            <h2 className="text-base font-semibold">Webhook</h2>
            <Badge variant="secondary" className="text-[11px] h-5 px-1.5">{webhooks.length}/1</Badge>
          </div>

          {loading ? (
            <div className="flex items-center rounded-xl border border-border/60 bg-card h-11 px-3 gap-2">
              <div className="h-4 w-16 bg-muted animate-pulse rounded" />
              <div className="flex-1 h-3 bg-muted animate-pulse rounded" />
            </div>
          ) : webhooks.length === 0 ? (
            /* Empty state — same row style */
            <div className="flex items-center rounded-xl border border-dashed border-border bg-card overflow-hidden h-11">
              <div className="flex items-center gap-1.5 px-3 h-full bg-muted/40 border-r border-border shrink-0">
                <Webhook className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-semibold text-muted-foreground">Webhook</span>
              </div>
              <span className="flex-1 px-3 text-xs text-muted-foreground italic">Belum ada webhook</span>
              <NewWebhookModal onCreated={(s) => setRevealSecret(s)} rowTrigger />
            </div>
          ) : (
            webhooks.map((w) => (
              <div key={w.id} className="rounded-xl border border-border/60 bg-card overflow-hidden">
                {/* Inline row */}
                <div className="flex items-center h-11">
                  {/* Label + status dot */}
                  <div className="flex items-center gap-1.5 px-3 h-full bg-muted/50 border-r border-border/60 shrink-0">
                    <Webhook className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground whitespace-nowrap">Webhook</span>
                    <div className={`h-1.5 w-1.5 rounded-full ${w.active ? "bg-green-500" : "bg-muted-foreground/50"}`} />
                  </div>
                  {/* URL */}
                  <div className="flex-1 min-w-0 px-3">
                    <code className="text-sm font-mono font-medium text-foreground truncate block">{w.url}</code>
                  </div>
                  {/* Test */}
                  <button
                    onClick={() => testWebhook(w.id)}
                    disabled={testLoading === w.id}
                    className="px-2 h-full flex items-center text-muted-foreground hover:text-primary transition-colors shrink-0"
                    title="Test webhook"
                  >
                    {testLoading === w.id
                      ? <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      : <PlayCircle className="h-3.5 w-3.5" />
                    }
                  </button>
                  {/* Toggle */}
                  <button
                    onClick={() => toggleWebhook(w.id, !w.active)}
                    className="px-2 h-full flex items-center text-muted-foreground hover:text-primary transition-colors shrink-0"
                    title={w.active ? "Nonaktifkan" : "Aktifkan"}
                  >
                    {w.active
                      ? <ToggleRight className="h-4 w-4 text-green-500" />
                      : <ToggleLeft className="h-4 w-4" />
                    }
                  </button>
                  {/* Rotate Secret */}
                  <button
                    onClick={() => setConfirmRegen({ type: "secret", id: w.id })}
                    className="flex items-center gap-1.5 px-4 h-full bg-primary hover:bg-primary/90 text-primary-foreground text-sm font-semibold transition-colors shrink-0"
                    title="Rotate signing secret"
                  >
                    <RotateCcw className="h-3.5 w-3.5" />
                    Rotate Secret
                  </button>
                </div>
                {/* Meta row */}
                <div className="flex items-center justify-between px-3 py-1.5 border-t border-border/40 bg-muted/20">
                  <div className="flex items-center gap-2 flex-wrap">
                    {w.events.map((ev) => (
                      <Badge key={ev} variant="outline" className="text-[10px] px-1.5 py-0 h-4">{ev}</Badge>
                    ))}
                    {w.failCount > 0 && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">{w.failCount} gagal</Badge>
                    )}
                    {w.lastTriggeredAt && (
                      <span className="text-[11px] text-muted-foreground">Dipicu: {fmt(w.lastTriggeredAt)}</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteWebhook(w.id)}
                    title="Hapus webhook"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))
          )}

          {/* Verifikasi Signature */}
          <div className="rounded-xl border bg-muted/30 p-4 space-y-2">
            <p className="text-sm font-medium">Verifikasi Signature Webhook</p>
            <div className="bg-background rounded-lg p-3 font-mono text-xs text-muted-foreground overflow-x-auto">
              <div className="text-green-500 mb-1">{"// Node.js"}</div>
              <div>{`const sig = req.headers['x-tempmail-signature'];`}</div>
              <div>{`const expected = crypto.createHmac('sha256', YOUR_SECRET)`}</div>
              <div>{`  .update(JSON.stringify(req.body)).digest('hex');`}</div>
              <div>{`const valid = sig === expected;`}</div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
