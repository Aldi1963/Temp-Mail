import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import {
  Key, Webhook, Plus, Trash2, Copy, CheckCircle2, XCircle, ToggleLeft, ToggleRight,
  PlayCircle, Eye, EyeOff, ChevronLeft, RefreshCw, Code2
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

function NewKeyModal({ onCreated }: { onCreated: (key: string) => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const create = async () => {
    if (!name.trim()) return;
    setLoading(true);
    const r = await api("/developer/keys", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) { toast({ title: "Gagal", description: data.message, variant: "destructive" }); return; }
    setOpen(false);
    setName("");
    onCreated(data.key);
  };

  if (!open) return (
    <Button size="sm" onClick={() => setOpen(true)} className="gap-1.5">
      <Plus className="h-4 w-4" /> Buat API Key
    </Button>
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
      <div className="bg-background rounded-xl shadow-2xl p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-lg mb-4">Buat API Key Baru</h3>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Nama Key</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contoh: Proyek Website Saya"
              className="mt-1"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && create()}
            />
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Batal</Button>
            <Button onClick={create} disabled={loading || !name.trim()}>
              {loading ? "Membuat..." : "Buat Key"}
            </Button>
          </div>
        </div>
      </div>
    </div>
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

function NewWebhookModal({ onCreated }: { onCreated: (secret: string) => void }) {
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

  if (!open) return (
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

  const fmt = (date: string | null) => {
    if (!date) return "—";
    return new Date(date).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      {revealKey && <RevealKeyModal rawKey={revealKey} onClose={() => { setRevealKey(null); load(); }} />}
      {revealSecret && <RevealSecretModal secret={revealSecret} onClose={() => { setRevealSecret(null); load(); }} />}

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
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">API Keys</h2>
              <Badge variant="secondary" className="text-xs">{keys.length}/10</Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={load}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
              <NewKeyModal onCreated={(k) => setRevealKey(k)} />
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground text-center py-8">Memuat...</div>
          ) : keys.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed p-8 text-center">
              <Key className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Belum ada API key. Buat satu untuk mulai.</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              {keys.map((k, i) => (
                <div key={k.id} className={`flex items-center gap-3 px-4 py-3 ${i < keys.length - 1 ? "border-b" : ""}`}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm truncate">{k.name}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                        {k.keyPrefix}•••
                      </code>
                      <span className="text-xs text-muted-foreground">Dibuat {fmt(k.createdAt)}</span>
                      {k.lastUsedAt && (
                        <span className="text-xs text-muted-foreground">· Dipakai {fmt(k.lastUsedAt)}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteKey(k.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Webhooks ── */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Webhook className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Webhooks</h2>
              <Badge variant="secondary" className="text-xs">{webhooks.length}/5</Badge>
            </div>
            <NewWebhookModal onCreated={(s) => setRevealSecret(s)} />
          </div>

          {loading ? (
            <div className="text-sm text-muted-foreground text-center py-8">Memuat...</div>
          ) : webhooks.length === 0 ? (
            <div className="rounded-xl border-2 border-dashed p-8 text-center">
              <Webhook className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Belum ada webhook. Tambah satu untuk mendapat notifikasi.</p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden">
              {webhooks.map((w, i) => (
                <div key={w.id} className={`px-4 py-3 ${i < webhooks.length - 1 ? "border-b" : ""}`}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <code className="text-xs font-mono text-foreground truncate max-w-xs">{w.url}</code>
                        <div className={`h-2 w-2 rounded-full flex-shrink-0 ${w.active ? "bg-green-500" : "bg-muted-foreground"}`} />
                      </div>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {w.events.map((ev) => (
                          <Badge key={ev} variant="outline" className="text-[10px] px-1.5 py-0 h-4">
                            {ev}
                          </Badge>
                        ))}
                        {w.failCount > 0 && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-4">
                            {w.failCount} gagal
                          </Badge>
                        )}
                      </div>
                      {w.lastTriggeredAt && (
                        <p className="text-xs text-muted-foreground mt-0.5">Terakhir dipicu: {fmt(w.lastTriggeredAt)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title="Test webhook"
                        disabled={testLoading === w.id}
                        onClick={() => testWebhook(w.id)}
                      >
                        {testLoading === w.id
                          ? <RefreshCw className="h-4 w-4 animate-spin" />
                          : <PlayCircle className="h-4 w-4" />
                        }
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        title={w.active ? "Nonaktifkan" : "Aktifkan"}
                        onClick={() => toggleWebhook(w.id, !w.active)}
                      >
                        {w.active
                          ? <ToggleRight className="h-4 w-4 text-green-500" />
                          : <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                        }
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => deleteWebhook(w.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
