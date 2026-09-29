// Kelola webhook developer: daftar, tambah inline (URL + event), uji,
// putar secret, aktif/nonaktif, hapus.
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, FlaskConical, KeyRound, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { nativeFetch } from "./api";
import { useToast } from "@/hooks/use-toast";
import { copyText } from "./clipboard";
import {
  AdminToggle,
  DangerConfirm,
  ErrorBox,
  Field,
  LoadingBlock,
  fmtDateTime,
  inputCls,
} from "./AdminShared";

interface Webhook {
  id: number;
  url: string;
  events: string[];
  active: boolean;
  lastTriggeredAt: string | null;
  failCount: number;
  createdAt: string;
}

const EVENTS: { key: string; label: string }[] = [
  { key: "new_message", label: "Pesan baru" },
  { key: "inbox_expired", label: "Alamat kedaluwarsa" },
];

export function DeveloperWebhooks() {
  const { toast } = useToast();
  const [hooks, setHooks] = useState<Webhook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newEvents, setNewEvents] = useState<string[]>(["new_message"]);
  const [adding, setAdding] = useState(false);
  const [freshSecret, setFreshSecret] = useState<{ id: number; secret: string } | null>(null);
  const [showSecretId, setShowSecretId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [testingId, setTestingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await nativeFetch<{ webhooks?: Webhook[] }>("/api/developer/webhooks");
      setHooks(res?.webhooks ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat webhook.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const err = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan.");

  const doCopy = async (text: string) => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast({ title: "Disalin." });
    } else {
      toast({ title: "Gagal menyalin.", variant: "destructive" });
    }
  };

  const toggleEvent = (key: string) => {
    setNewEvents((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const add = async () => {
    const url = newUrl.trim();
    if (!url || adding) return;
    setAdding(true);
    try {
      const res = await nativeFetch<{ id: number; url: string; events: string[]; secret: string; active: boolean; createdAt: string }>(
        "/api/developer/webhooks",
        { method: "POST", body: JSON.stringify({ url, events: newEvents.length ? newEvents : ["new_message"] }) }
      );
      setHooks((prev) => [
        { id: res.id, url: res.url, events: res.events, active: res.active, lastTriggeredAt: null, failCount: 0, createdAt: res.createdAt },
        ...prev,
      ]);
      setNewUrl("");
      setNewEvents(["new_message"]);
      if (res.secret) setFreshSecret({ id: res.id, secret: res.secret });
      toast({ title: "Webhook ditambahkan", description: "Simpan secret yang ditampilkan sekali ini." });
    } catch (e) {
      toast({ title: "Gagal menambah webhook", description: err(e), variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const toggleActive = async (h: Webhook) => {
    try {
      await nativeFetch(`/api/developer/webhooks/${h.id}`, {
        method: "PATCH",
        body: JSON.stringify({ active: !h.active }),
      });
      setHooks((prev) => prev.map((x) => (x.id === h.id ? { ...x, active: !x.active } : x)));
    } catch (e) {
      toast({ title: "Gagal mengubah status", description: err(e), variant: "destructive" });
    }
  };

  const test = async (h: Webhook) => {
    setTestingId(h.id);
    try {
      await nativeFetch(`/api/developer/webhooks/${h.id}/test`, { method: "POST" });
      toast({ title: "Tes terkirim", description: "Cek log di server penerima Anda." });
    } catch (e) {
      toast({ title: "Tes gagal", description: err(e), variant: "destructive" });
    } finally {
      setTestingId(null);
    }
  };

  const rotate = async (h: Webhook) => {
    try {
      const res = await nativeFetch<{ secret?: string }>(`/api/developer/webhooks/${h.id}/rotate-secret`, {
        method: "POST",
      });
      if (res?.secret) {
        setFreshSecret({ id: h.id, secret: res.secret });
        setShowSecretId(null);
        toast({ title: "Secret baru dibuat", description: "Secret lama langsung tidak berlaku." });
      } else {
        toast({ title: "Secret diputar", description: "Server tidak mengembalikan secret baru." });
      }
    } catch (e) {
      toast({ title: "Gagal memutar secret", description: err(e), variant: "destructive" });
    }
  };

  const remove = async (h: Webhook) => {
    try {
      await nativeFetch(`/api/developer/webhooks/${h.id}`, { method: "DELETE" });
      setHooks((prev) => prev.filter((x) => x.id !== h.id));
      toast({ title: "Webhook dihapus." });
    } catch (e) {
      toast({ title: "Gagal menghapus", description: err(e), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-3">
      <p className="text-[13.5px] font-extrabold px-1">Webhook</p>

      <div className="rounded-3xl border border-border/60 bg-card p-4 space-y-3">
        <Field label="Tambah webhook" hint="Contoh: https://api.anda.com/hook — maks. 1 webhook per akun.">
          <input
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
            }}
            placeholder="https://…"
            autoCapitalize="none"
            autoCorrect="off"
            inputMode="url"
            className={cn(inputCls, "font-mono")}
          />
        </Field>
        <div>
          <p className="text-[12px] font-bold text-muted-foreground mb-1.5">Event</p>
          <div className="flex flex-wrap gap-1.5">
            {EVENTS.map((ev) => {
              const on = newEvents.includes(ev.key);
              return (
                <button
                  key={ev.key}
                  type="button"
                  onClick={() => toggleEvent(ev.key)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[12px] font-bold active:scale-95",
                    on ? "bg-primary text-primary-foreground border-primary" : "border-border/70 text-muted-foreground"
                  )}
                >
                  {ev.label}
                </button>
              );
            })}
          </div>
        </div>
        <button
          type="button"
          disabled={adding || !newUrl.trim()}
          onClick={() => void add()}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl bg-primary text-primary-foreground text-[13.5px] font-extrabold py-2.5 active:scale-[0.99] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {adding ? "Menambahkan…" : "Tambah webhook"}
        </button>
        {freshSecret && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/[0.07] p-3 space-y-2">
            <p className="text-[12px] font-extrabold text-amber-700 dark:text-amber-400">
              Secret webhook — ditampilkan sekali, salin sekarang
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 font-mono text-[11px] break-all bg-background rounded-lg px-2.5 py-2 border border-border/60">
                {freshSecret.secret}
              </code>
              <button
                type="button"
                onClick={() => void doCopy(freshSecret.secret)}
                aria-label="Salin secret"
                className="shrink-0 w-9 h-9 rounded-xl bg-muted flex items-center justify-center active:scale-95"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setFreshSecret(null)}
              className="text-[12px] font-bold text-muted-foreground"
            >
              Saya sudah menyimpan
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <LoadingBlock label="Memuat webhook..." />
      ) : error ? (
        <ErrorBox message={error} onRetry={() => void load()} />
      ) : hooks.length === 0 ? (
        <p className="text-center text-[13px] text-muted-foreground py-8">
          Belum ada webhook. Tambahkan di atas untuk menerima event secara realtime.
        </p>
      ) : (
        hooks.map((h) => (
          <div key={h.id} className="rounded-3xl border border-border/60 bg-card p-4 space-y-3">
            <div className="flex items-start gap-2">
              <code className="flex-1 min-w-0 font-mono text-[12px] break-all leading-relaxed">
                {h.url}
              </code>
              <AdminToggle on={h.active} onChange={() => void toggleActive(h)} label="Webhook aktif" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {h.events.map((ev) => (
                <span
                  key={ev}
                  className="text-[10.5px] font-extrabold uppercase tracking-wide px-2 py-1 rounded-md bg-primary/10 text-primary"
                >
                  {EVENTS.find((e) => e.key === ev)?.label ?? ev}
                </span>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Dibuat {fmtDateTime(h.createdAt)}
              {h.lastTriggeredAt ? ` · terakhir dipicu ${fmtDateTime(h.lastTriggeredAt)}` : ""}
              {h.failCount > 0 ? ` · ${h.failCount}x gagal` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={testingId === h.id}
                onClick={() => void test(h)}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-bold rounded-xl px-3.5 py-2 bg-primary/10 text-primary active:scale-[0.97] disabled:opacity-50"
              >
                <FlaskConical className="h-3.5 w-3.5" />
                {testingId === h.id ? "Mengirim…" : "Kirim tes"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSecretId((s) => (s === h.id ? null : h.id));
                }}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-bold rounded-xl px-3.5 py-2 bg-muted text-foreground active:scale-[0.97]"
              >
                <KeyRound className="h-3.5 w-3.5" />
                Secret
              </button>
              <DangerConfirm
                label="Hapus"
                confirmLabel="Ketuk lagi untuk hapus"
                onConfirm={() => void remove(h)}
              />
            </div>
            {showSecretId === h.id && (
              <div className="rounded-2xl bg-muted/60 p-3 space-y-2">
                <p className="text-[12px] font-extrabold flex items-center gap-1.5">
                  {h.failCount >= 0 && <Eye className="h-3.5 w-3.5" />}
                  Putar secret untuk menampilkan yang baru
                </p>
                <p className="text-[11.5px] text-muted-foreground leading-relaxed">
                  Secret hanya ditampilkan saat dibuat/diubah. Putar untuk mengganti yang lama
                  dengan yang baru.
                </p>
                <button
                  type="button"
                  onClick={() => void rotate(h)}
                  className="inline-flex items-center gap-1.5 text-[12.5px] font-bold rounded-xl px-3.5 py-2 bg-amber-500/15 text-amber-600 dark:text-amber-400 active:scale-[0.97]"
                >
                  <EyeOff className="h-3.5 w-3.5" />
                  Putar secret baru
                </button>
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
