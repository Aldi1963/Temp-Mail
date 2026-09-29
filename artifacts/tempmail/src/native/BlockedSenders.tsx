// Kelola blokir pengirim: daftar, tambah manual inline (email/domain), hapus.
// Pesan dari pengirim terblokir tidak muncul di inbox.
import { useCallback, useEffect, useState } from "react";
import { Plus, ShieldX } from "lucide-react";
import { cn } from "@/lib/utils";
import { nativeFetch } from "./api";
import { useNativeAuth } from "./useNativeAuth";
import { useToast } from "@/hooks/use-toast";
import {
  DangerConfirm,
  ErrorBox,
  Field,
  LoadingBlock,
  fmtDateTime,
  inputCls,
} from "./AdminShared";

interface BlockedSender {
  id: string | number;
  address?: string | null;
  value: string;
  type: "email" | "domain";
  createdAt?: string | null;
}

const TYPES: { key: "email" | "domain"; label: string; hint: string }[] = [
  { key: "email", label: "Email", hint: "spam@contoh.com" },
  { key: "domain", label: "Domain", hint: "contoh.com (tanpa @)" },
];

function normalize(raw: any): BlockedSender[] {
  const arr = Array.isArray(raw) ? raw : (raw?.blocked ?? raw?.items ?? []);
  if (!Array.isArray(arr)) return [];
  return arr.map((b: any, i: number) => ({
    id: b?.id ?? `row-${i}`,
    address: b?.address ?? null,
    value: String(b?.value ?? b?.pattern ?? ""),
    type: b?.type === "domain" ? "domain" : "email",
    createdAt: b?.createdAt ?? null,
  }));
}

export function BlockedSenders({ onOpenLogin }: { onOpenLogin: () => void }) {
  const { user } = useNativeAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<BlockedSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newValue, setNewValue] = useState("");
  const [newType, setNewType] = useState<"email" | "domain">("email");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await nativeFetch("/api/user/blocked-senders");
      setItems(normalize(res));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat daftar blokir.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const err = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan.");

  const add = async () => {
    const value = newValue.trim();
    if (!value || adding) return;
    setAdding(true);
    try {
      const res = await nativeFetch<{ value?: string; type?: "email" | "domain" }>(
        "/api/user/blocked-senders",
        { method: "POST", body: JSON.stringify({ value, type: newType }) }
      );
      setNewValue("");
      toast({ title: "Pengirim diblokir", description: res?.value ?? value });
      void load();
    } catch (e) {
      toast({ title: "Gagal menambah blokir", description: err(e), variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const remove = async (b: BlockedSender) => {
    setBusyId(b.id);
    try {
      await nativeFetch(`/api/user/blocked-senders/${encodeURIComponent(String(b.id))}`, {
        method: "DELETE",
      });
      setItems((prev) => prev.filter((x) => x.id !== b.id));
      toast({ title: "Blokir dihapus", description: b.value });
    } catch (e) {
      toast({ title: "Gagal menghapus", description: err(e), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  if (!user) {
    return (
      <div className="p-4">
        <div className="rounded-3xl border border-border/60 bg-card p-5 text-center">
          <span className="w-14 h-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-3">
            <ShieldX className="h-6 w-6" />
          </span>
          <p className="text-[14px] font-extrabold">Masuk dulu untuk memblokir pengirim</p>
          <p className="text-[12.5px] text-muted-foreground mt-1.5 leading-relaxed">
            Daftar blokir pengirim tersimpan di akun Anda dan berlaku untuk semua alamat.
          </p>
          <button
            type="button"
            onClick={onOpenLogin}
            className="mt-4 rounded-2xl bg-primary text-primary-foreground text-[13.5px] font-bold px-6 py-2.5 active:scale-[0.97]"
          >
            Masuk / Daftar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3">
      <div className="rounded-3xl border border-border/60 bg-card p-4 space-y-3">
        <Field label="Blokir pengirim baru" hint="Blokir berlaku untuk semua alamat di akun Anda.">
          <div className="flex gap-1.5 mb-2.5">
            {TYPES.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setNewType(t.key)}
                className={cn(
                  "rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold active:scale-95",
                  newType === t.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border/70 text-muted-foreground"
                )}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void add();
              }}
              placeholder={TYPES.find((t) => t.key === newType)?.hint}
              autoCapitalize="none"
              autoCorrect="off"
              inputMode="email"
              className={cn(inputCls, "flex-1 min-w-0 font-mono")}
            />
            <button
              type="button"
              disabled={adding || !newValue.trim()}
              onClick={() => void add()}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-bold px-4 active:scale-[0.97] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {adding ? "…" : "Blokir"}
            </button>
          </div>
        </Field>
      </div>

      {loading ? (
        <LoadingBlock label="Memuat daftar blokir..." />
      ) : error ? (
        <ErrorBox message={error} onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center text-center py-12 px-6">
          <span className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <ShieldX className="h-7 w-7 text-muted-foreground" />
          </span>
          <p className="text-[14px] font-bold">Tidak ada pengirim terblokir</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            Tambahkan di atas bila ada pengirim yang mengganggu.
          </p>
        </div>
      ) : (
        items.map((b) => (
          <div key={String(b.id)} className="rounded-3xl border border-border/60 bg-card p-4">
            <div className="flex items-center gap-2">
              <span className="flex-1 min-w-0 font-mono text-[13px] font-bold truncate">
                {b.value}
              </span>
              <span
                className={cn(
                  "shrink-0 text-[10px] font-extrabold uppercase tracking-wide px-2 py-1 rounded-md",
                  b.type === "domain"
                    ? "bg-violet-500/15 text-violet-500"
                    : "bg-sky-500/15 text-sky-500"
                )}
              >
                {b.type === "domain" ? "Domain" : "Email"}
              </span>
              <DangerConfirm
                label="Buka blokir"
                confirmLabel="Ketuk lagi untuk buka"
                onConfirm={() => void remove(b)}
                disabled={busyId === b.id}
              />
            </div>
            {(b.address || b.createdAt) && (
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {b.address ? <span className="font-mono">{b.address}</span> : null}
                {b.address && b.createdAt ? " · " : ""}
                {b.createdAt ? `Diblokir ${fmtDateTime(b.createdAt)}` : ""}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
