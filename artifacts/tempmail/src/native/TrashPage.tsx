import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RotateCcw, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import { getGetInboxQueryKey } from "@aldi1963/temp-mail-api-client";
import { nativeFetch, manageHeaders } from "./api";
import { cn } from "@/lib/utils";

interface TrashItem {
  id: string;
  from: string;
  subject: string;
  preview?: string | null;
  receivedAt: string;
  deletedAt: string | null;
}

// Halaman Tong Sampah: pesan terhapus (soft-delete) bisa dikembalikan
// atau dihapus permanen. Dibuka dari tab Lainnya.
export function TrashPage({ email }: { email: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await nativeFetch<{ messages: TrashItem[] }>(
        `/api/email/trash?email=${encodeURIComponent(email)}`,
        { headers: manageHeaders(email) }
      );
      setItems(data.messages ?? []);
    } catch {
      /* abaikan — tampilkan kosong */
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    void load();
  }, [load]);

  const invalidateInbox = () => {
    queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey({ email }) });
  };

  const doRestore = async (id: string) => {
    setBusyId(id);
    try {
      await nativeFetch("/api/email/message/restore", {
        method: "POST",
        headers: manageHeaders(email),
        body: JSON.stringify({ id, email }),
      });
      setItems((xs) => xs.filter((x) => x.id !== id));
      invalidateInbox();
      toast({ title: "Pesan dikembalikan ke inbox" });
    } catch (e) {
      toast({
        title: "Gagal mengembalikan",
        description: e instanceof Error ? e.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  // Hapus permanen: two-tap confirm, tanpa popup.
  const tryPermanent = (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      window.setTimeout(() => setConfirmId((c) => (c === id ? null : c)), 4000);
      return;
    }
    setConfirmId(null);
    void doPermanent(id);
  };

  const doPermanent = async (id: string) => {
    setBusyId(id);
    try {
      await nativeFetch(
        `/api/email/message/permanent?id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`,
        { method: "DELETE", headers: manageHeaders(email) }
      );
      setItems((xs) => xs.filter((x) => x.id !== id));
      toast({ title: "Pesan dihapus permanen" });
    } catch (e) {
      toast({
        title: "Gagal menghapus",
        description: e instanceof Error ? e.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-3 space-y-3">
      <p className="text-[11.5px] text-muted-foreground px-1">
        Pesan di sini terhapus otomatis permanen setelah 24 jam.
      </p>

      {loading ? (
        <div className="space-y-3" aria-hidden>
          {[0, 1].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
              <div className="flex-1 space-y-2 py-1">
                <div className="h-3 rounded bg-muted w-2/3" />
                <div className="h-3 rounded bg-muted w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center text-center py-14 px-6">
          <span className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <Trash2 className="h-7 w-7 text-muted-foreground" />
          </span>
          <p className="text-[14px] font-bold">Tong sampah kosong</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            Pesan yang kamu hapus akan muncul di sini dan bisa dikembalikan.
          </p>
        </div>
      ) : (
        items.map((m) => (
          <div
            key={m.id}
            className="rounded-3xl bg-card border border-border/60 p-3.5"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-bold truncate">{m.from}</p>
                <p className="text-[12.5px] text-foreground/90 truncate">{m.subject}</p>
                {m.preview ? (
                  <p className="text-[11.5px] text-muted-foreground truncate mt-0.5">
                    {m.preview}
                  </p>
                ) : null}
                {m.deletedAt ? (
                  <p className="text-[10.5px] text-muted-foreground mt-1">
                    Dihapus {format(new Date(m.deletedAt), "d MMM HH:mm")}
                  </p>
                ) : null}
              </div>
            </div>
            <div className="flex gap-2 mt-3">
              <button
                type="button"
                onClick={() => void doRestore(m.id)}
                disabled={busyId === m.id}
                className="flex-1 rounded-2xl py-2.5 text-[12.5px] font-bold inline-flex items-center justify-center gap-1.5 bg-primary/10 text-primary active:scale-[0.99] disabled:opacity-50"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                {busyId === m.id ? "Memproses…" : "Pulihkan"}
              </button>
              <button
                type="button"
                onClick={() => tryPermanent(m.id)}
                disabled={busyId === m.id}
                className={cn(
                  "flex-1 rounded-2xl py-2.5 text-[12.5px] font-bold inline-flex items-center justify-center gap-1.5 active:scale-[0.99] disabled:opacity-50",
                  confirmId === m.id
                    ? "bg-destructive text-destructive-foreground"
                    : "bg-muted text-foreground"
                )}
              >
                <Trash2 className="h-3.5 w-3.5" />
                {confirmId === m.id ? "Ketuk lagi, yakin?" : "Hapus permanen"}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
