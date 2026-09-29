// Blokir domain global (admin): daftar domain + alasan, tambah inline, hapus.
import { useCallback, useEffect, useState } from "react";
import { Ban, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { nativeFetch } from "./api";
import { useToast } from "@/hooks/use-toast";
import {
  DangerConfirm,
  ErrorBox,
  Field,
  LoadingBlock,
  fmtDateTime,
  inputCls,
} from "./AdminShared";

interface BlockedDomain {
  id: number;
  domain: string;
  reason: string | null;
  createdBy: number | null;
  createdAt: string;
}

export function AdminBlockedDomains() {
  const { toast } = useToast();
  const [domains, setDomains] = useState<BlockedDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [newReason, setNewReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await nativeFetch<{ blockedDomains?: BlockedDomain[] }>(
        "/api/admin/blocked-domains"
      );
      setDomains(res?.blockedDomains ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat domain terblokir.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const err = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan.");

  const add = async () => {
    const domain = newDomain.trim().toLowerCase();
    if (!domain || adding) return;
    setAdding(true);
    try {
      const res = await nativeFetch<{ id: number; domain: string }>("/api/admin/blocked-domains", {
        method: "POST",
        body: JSON.stringify({ domain, reason: newReason.trim() || undefined }),
      });
      setNewDomain("");
      setNewReason("");
      toast({ title: "Domain diblokir", description: res?.domain ?? domain });
      void load();
    } catch (e) {
      toast({ title: "Gagal memblokir domain", description: err(e), variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const remove = async (d: BlockedDomain) => {
    setBusyId(d.id);
    try {
      await nativeFetch(`/api/admin/blocked-domains/${d.id}`, { method: "DELETE" });
      setDomains((prev) => prev.filter((x) => x.id !== d.id));
      toast({ title: "Blokir domain dihapus", description: d.domain });
    } catch (e) {
      toast({ title: "Gagal menghapus", description: err(e), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="px-4 pt-3 pb-6 space-y-3">
      <div className="rounded-3xl border border-border/60 bg-card p-4 space-y-3">
        <Field
          label="Blokir domain baru"
          hint="Alamat dari domain ini tidak bisa dibuat. Contoh: spamdomain.com"
        >
          <input
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
            }}
            placeholder="domain.com"
            autoCapitalize="none"
            autoCorrect="off"
            className={cn(inputCls, "font-mono")}
          />
        </Field>
        <Field label="Alasan (opsional)">
          <input
            value={newReason}
            onChange={(e) => setNewReason(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
            }}
            placeholder="Mis. sumber spam"
            className={inputCls}
          />
        </Field>
        <button
          type="button"
          disabled={adding || !newDomain.trim()}
          onClick={() => void add()}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl bg-destructive text-destructive-foreground text-[13.5px] font-extrabold py-2.5 active:scale-[0.99] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {adding ? "Memblokir…" : "Blokir domain"}
        </button>
      </div>

      {loading ? (
        <LoadingBlock label="Memuat domain terblokir..." />
      ) : error ? (
        <ErrorBox message={error} onRetry={() => void load()} />
      ) : domains.length === 0 ? (
        <div className="flex flex-col items-center text-center py-12 px-6">
          <span className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Ban className="h-7 w-7 text-muted-foreground" />
          </span>
          <p className="text-[14px] font-bold">Tidak ada domain terblokir</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            Domain yang diblokir tidak bisa dipakai membuat alamat.
          </p>
        </div>
      ) : (
        domains.map((d) => (
          <div key={d.id} className="rounded-3xl border border-border/60 bg-card p-4">
            <div className="flex items-center gap-2">
              <span className="flex-1 min-w-0 font-mono text-[13.5px] font-extrabold truncate">
                {d.domain}
              </span>
              <DangerConfirm
                label="Buka blokir"
                confirmLabel="Ketuk lagi untuk buka"
                onConfirm={() => void remove(d)}
                disabled={busyId === d.id}
              />
            </div>
            {(d.reason || d.createdAt) && (
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {d.reason ? <span className="font-semibold">{d.reason}</span> : null}
                {d.reason && d.createdAt ? " · " : ""}
                {d.createdAt ? `Diblokir ${fmtDateTime(d.createdAt)}` : ""}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
