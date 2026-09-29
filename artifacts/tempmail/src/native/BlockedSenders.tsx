// Kelola blokir pengirim: daftar, tambah manual inline, hapus.
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
  email: string;
  reason?: string | null;
  createdAt?: string | null;
}

// Normalisasi defensif: backend bisa mengembalikan {items} atau array langsung,
// dan field email bisa bernama email/sender/pattern.
function normalize(raw: any): BlockedSender[] {
  const arr = Array.isArray(raw) ? raw : (raw?.items ?? raw?.senders ?? raw?.blocked ?? []);
  if (!Array.isArray(arr)) return [];
  return arr.map((b: any, i: number) => ({
    id: b?.id ?? b?.email ?? b?.sender ?? b?.pattern ?? `row-${i}`,
    email: String(b?.email ?? b?.sender ?? b?.pattern ?? ""),
    reason: b?.reason ?? null,
    createdAt: b?.createdAt ?? null,
  }));
}

export function BlockedSenders({ onOpenLogin }: { onOpenLogin: () => void }) {
  const { user } = useNativeAuth();
  const { toast } = useToast();
  const [items, setItems] = useState<BlockedSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newReason, setNewReason] = useState("");
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
    const email = newEmail.trim().toLowerCase();
    if (!email || adding) return;
    setAdding(true);
    try {
      const res = await nativeFetch("/api/user/blocked-senders", {
        method: "POST",
        body: JSON.stringify({ email, reason: newReason.trim() || undefined }),
      });
      const added = normalize(res)[0] ?? { id: email, email, reason: newReason.trim() || null };
      setItems((prev) => [added, ...prev]);
      setNewEmail("");
      setNewReason("");
      toast({ title: "Pengirim diblokir", description: email });
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
      toast({ title: "Blokir dihapus", description: b.email });
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
            Daftar blokir pengirim tersimpan di akun Anda.
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
        <Field label="Blokir pengirim baru" hint="Alamat email atau domain diawali @ (mis. spam@contoh.com atau @contoh.com).">
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void add();
            }}
            placeholder="spam@contoh.com"
            autoCapitalize="none"
            autoCorrect="off"
            inputMode="email"
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
            placeholder="Mis. spam promo"
            className={inputCls}
          />
        </Field>
        <button
          type="button"
          disabled={adding || !newEmail.trim()}
          onClick={() => void add()}
          className="w-full inline-flex items-center justify-center gap-1.5 rounded-2xl bg-primary text-primary-foreground text-[13.5px] font-extrabold py-2.5 active:scale-[0.99] disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {adding ? "Menambahkan…" : "Blokir pengirim"}
        </button>
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
                {b.email}
              </span>
              <DangerConfirm
                label="Buka blokir"
                confirmLabel="Ketuk lagi untuk buka"
                onConfirm={() => void remove(b)}
                disabled={busyId === b.id}
              />
            </div>
            {(b.reason || b.createdAt) && (
              <p className="text-[11px] text-muted-foreground mt-1.5">
                {b.reason ? <span className="font-semibold">{b.reason}</span> : null}
                {b.reason && b.createdAt ? " · " : ""}
                {b.createdAt ? `Diblokir ${fmtDateTime(b.createdAt)}` : ""}
              </p>
            )}
          </div>
        ))
      )}
    </div>
  );
}
