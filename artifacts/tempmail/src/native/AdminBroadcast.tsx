// Broadcast admin: form judul + isi, riwayat broadcast.
import { useCallback, useEffect, useState } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { nativeFetch } from "./api";
import { useToast } from "@/hooks/use-toast";
import { ErrorBox, Field, LoadingBlock, fmtDateTime, inputCls } from "./AdminShared";

interface Broadcast {
  id: number;
  title: string;
  body: string;
  createdBy: number | null;
  createdAt: string;
  fcmSent: boolean;
}

const MAX_TITLE = 100;
const MAX_BODY = 500;

export function AdminBroadcast() {
  const { toast } = useToast();
  const [items, setItems] = useState<Broadcast[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await nativeFetch<Broadcast[]>("/api/admin/broadcasts");
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat riwayat broadcast.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const send = async () => {
    const t = title.trim();
    const b = body.trim();
    if (!t) {
      setFormError("Judul wajib diisi.");
      return;
    }
    if (t.length > MAX_TITLE) {
      setFormError(`Judul maksimal ${MAX_TITLE} karakter.`);
      return;
    }
    if (!b) {
      setFormError("Isi pesan wajib diisi.");
      return;
    }
    if (b.length > MAX_BODY) {
      setFormError(`Isi pesan maksimal ${MAX_BODY} karakter.`);
      return;
    }
    setFormError("");
    setSending(true);
    try {
      await nativeFetch("/api/admin/broadcast", {
        method: "POST",
        body: JSON.stringify({ title: t, body: b }),
      });
      toast({ title: "Broadcast tersimpan.", description: "Push FCM belum aktif." });
      setTitle("");
      setBody("");
      const rows = await nativeFetch<Broadcast[]>("/api/admin/broadcasts");
      setItems(rows);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Gagal menyimpan broadcast.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="px-4 pt-3 pb-6 space-y-3">
      <div className="rounded-2xl border border-border/60 bg-card p-3.5 space-y-3">
        <p className="text-[13.5px] font-extrabold">Broadcast baru</p>
        <Field label={`Judul (${title.length}/${MAX_TITLE})`}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={MAX_TITLE}
            placeholder="Judul pengumuman"
            className={inputCls}
          />
        </Field>
        <Field label={`Isi pesan (${body.length}/${MAX_BODY})`}>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            maxLength={MAX_BODY}
            rows={4}
            placeholder="Tulis isi pengumuman..."
            className={cn(inputCls, "resize-none leading-relaxed")}
          />
        </Field>
        {formError && (
          <p className="text-[12px] text-destructive font-semibold">{formError}</p>
        )}
        <button
          type="button"
          disabled={sending}
          onClick={() => void send()}
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary text-primary-foreground text-[14px] font-bold py-3 active:scale-[0.99] disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
          {sending ? "Menyimpan..." : "Kirim Broadcast"}
        </button>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Catatan: push FCM belum aktif — broadcast hanya tersimpan sebagai riwayat.
        </p>
      </div>

      <p className="text-[13.5px] font-extrabold pt-1">Riwayat</p>
      {loading ? (
        <LoadingBlock label="Memuat riwayat..." />
      ) : error ? (
        <ErrorBox message={error} onRetry={() => void load()} />
      ) : items.length === 0 ? (
        <p className="text-center text-[13px] text-muted-foreground py-8">
          Belum ada broadcast.
        </p>
      ) : (
        items.map((it) => (
          <div key={it.id} className="rounded-2xl border border-border/60 bg-card p-3.5">
            <p className="text-[13.5px] font-extrabold">{it.title}</p>
            <p className="text-[12.5px] text-muted-foreground mt-1 leading-relaxed whitespace-pre-wrap">
              {it.body}
            </p>
            <div className="flex items-center justify-between mt-2.5">
              <span className="text-[11px] text-muted-foreground">
                {fmtDateTime(it.createdAt)}
              </span>
              <span className="text-[10px] font-extrabold uppercase tracking-wide px-2 py-1 rounded-md bg-amber-500/15 text-amber-500">
                {it.fcmSent ? "FCM terkirim" : "FCM belum terkirim"}
              </span>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
