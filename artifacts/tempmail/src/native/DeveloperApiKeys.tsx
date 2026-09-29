// Kelola API key developer: daftar, buat baru (tampilkan sekali + salin),
// hapus/revoke, regenerate.
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { nativeFetch } from "./api";
import { useToast } from "@/hooks/use-toast";
import { copyText } from "./clipboard";
import {
  DangerConfirm,
  ErrorBox,
  Field,
  LoadingBlock,
  fmtDateTime,
  inputCls,
} from "./AdminShared";

interface ApiKey {
  id: number;
  name: string;
  keyPrefix: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export function DeveloperApiKeys() {
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [freshKey, setFreshKey] = useState<{ id: number; key: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await nativeFetch<{ keys?: ApiKey[] }>("/api/developer/keys");
      setKeys(res?.keys ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat API key.");
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
      toast({ title: "API key disalin." });
    } else {
      toast({ title: "Gagal menyalin.", variant: "destructive" });
    }
  };

  const create = async () => {
    const name = newName.trim();
    if (!name || creating) return;
    setCreating(true);
    try {
      const res = await nativeFetch<{ key: string; id: number; name: string; keyPrefix: string; createdAt: string }>(
        "/api/developer/keys",
        { method: "POST", body: JSON.stringify({ name }) }
      );
      setKeys((prev) => [
        {
          id: res.id,
          name: res.name,
          keyPrefix: res.keyPrefix,
          lastUsedAt: null,
          expiresAt: null,
          createdAt: res.createdAt,
        },
        ...prev,
      ]);
      setNewName("");
      if (res.key) setFreshKey({ id: res.id, key: res.key });
      toast({ title: "API key dibuat", description: "Salin key yang ditampilkan sekali ini." });
    } catch (e) {
      toast({ title: "Gagal membuat API key", description: err(e), variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const regenerate = async (k: ApiKey) => {
    setBusyId(k.id);
    try {
      const res = await nativeFetch<{ key?: string }>(`/api/developer/keys/${k.id}/regenerate`, {
        method: "POST",
      });
      if (res?.key) {
        setFreshKey({ id: k.id, key: res.key });
        toast({ title: "API key diregenerasi", description: "Key lama langsung tidak berlaku." });
      } else {
        toast({ title: "Gagal", description: "Backend tidak mengembalikan key baru." });
      }
    } catch (e) {
      toast({ title: "Gagal meregenerasi", description: err(e), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const revoke = async (k: ApiKey) => {
    setBusyId(k.id);
    try {
      await nativeFetch(`/api/developer/keys/${k.id}`, { method: "DELETE" });
      setKeys((prev) => prev.filter((x) => x.id !== k.id));
      toast({ title: "API key dicabut." });
    } catch (e) {
      toast({ title: "Gagal mencabut", description: err(e), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-3 mt-6">
      <p className="text-[13.5px] font-extrabold px-1">API Key</p>

      <div className="rounded-3xl border border-border/60 bg-card p-4 space-y-3">
        <Field label="Buat API key baru" hint="Hanya boleh 1 API key per akun.">
          <div className="flex gap-2">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void create();
              }}
              placeholder="Nama key, mis. bot-telegram"
              className={cn(inputCls, "flex-1 min-w-0")}
            />
            <button
              type="button"
              disabled={creating || !newName.trim()}
              onClick={() => void create()}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-bold px-4 active:scale-[0.97] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {creating ? "…" : "Buat"}
            </button>
          </div>
        </Field>
        {freshKey && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/[0.07] p-3 space-y-2">
            <p className="text-[12px] font-extrabold text-amber-700 dark:text-amber-400">
              Key ditampilkan sekali — salin sekarang
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 min-w-0 font-mono text-[11px] break-all bg-background rounded-lg px-2.5 py-2 border border-border/60">
                {freshKey.key}
              </code>
              <button
                type="button"
                onClick={() => void doCopy(freshKey.key)}
                aria-label="Salin API key"
                className="shrink-0 w-9 h-9 rounded-xl bg-muted flex items-center justify-center active:scale-95"
              >
                {copied ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
              </button>
            </div>
            <button
              type="button"
              onClick={() => setFreshKey(null)}
              className="text-[12px] font-bold text-muted-foreground"
            >
              Saya sudah menyimpan
            </button>
          </div>
        )}
      </div>

      {loading ? (
        <LoadingBlock label="Memuat API key..." />
      ) : error ? (
        <ErrorBox message={error} onRetry={() => void load()} />
      ) : keys.length === 0 ? (
        <p className="text-center text-[13px] text-muted-foreground py-8">
          Belum ada API key. Buat di atas untuk mengakses API secara programatik.
        </p>
      ) : (
        keys.map((k) => (
          <div key={k.id} className="rounded-3xl border border-border/60 bg-card p-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="flex-1 min-w-0 text-[14px] font-extrabold truncate">{k.name}</span>
              <code className="shrink-0 font-mono text-[11px] bg-muted rounded-lg px-2 py-1">
                {k.keyPrefix}…
              </code>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Dibuat {fmtDateTime(k.createdAt)}
              {k.lastUsedAt ? ` · terakhir dipakai ${fmtDateTime(k.lastUsedAt)}` : " · belum pernah dipakai"}
              {k.expiresAt ? ` · kedaluwarsa ${fmtDateTime(k.expiresAt)}` : ""}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busyId === k.id}
                onClick={() => void regenerate(k)}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-bold rounded-xl px-3.5 py-2 bg-primary/10 text-primary active:scale-[0.97] disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", busyId === k.id && "animate-spin")} />
                {busyId === k.id ? "Memproses…" : "Regenerate"}
              </button>
              <DangerConfirm
                label="Cabut"
                confirmLabel="Ketuk lagi untuk cabut"
                onConfirm={() => void revoke(k)}
                disabled={busyId === k.id}
              />
            </div>
          </div>
        ))
      )}
    </div>
  );
}
