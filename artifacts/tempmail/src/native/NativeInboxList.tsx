import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Copy, Search, Trash2, X } from "lucide-react";
import { getGetInboxQueryKey } from "@aldi1963/temp-mail-api-client";
import { cn } from "@/lib/utils";
import { nativeFetch, manageHeaders } from "./api";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { buzz, cleanSnippet, extractQuickOtp, senderMeta, timeAgo } from "./otp";
import { copyText } from "./clipboard";

export interface NativeMsg {
  id: string;
  from: string;
  subject?: string | null;
  preview?: string | null;
  receivedAt: string;
  isRead?: boolean | null;
  hasAttachments?: boolean | null;
}

type MsgFilter = "semua" | "unread" | "otp" | "attachment";

const FILTERS: { key: MsgFilter; label: string }[] = [
  { key: "semua", label: "Semua" },
  { key: "unread", label: "Belum dibaca" },
  { key: "otp", label: "OTP" },
  { key: "attachment", label: "Lampiran" },
];

interface Props {
  messages: NativeMsg[];
  loading: boolean;
  email: string;
  onSelect: (id: string) => void;
}

export function NativeInboxList({ messages, loading, email, onSelect }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();
  const [copiedEmail, setCopiedEmail] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<MsgFilter>("semua");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const deleteTimer = useRef<number | null>(null);

  useEffect(
    () => () => {
      if (deleteTimer.current) window.clearTimeout(deleteTimer.current);
    },
    []
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return messages.filter((m) => {
      if (filter === "unread" && m.isRead) return false;
      if (filter === "otp" && !extractQuickOtp(`${m.subject ?? ""} ${m.preview ?? ""}`))
        return false;
      if (filter === "attachment" && !m.hasAttachments) return false;
      if (q) {
        const hay = `${m.from ?? ""} ${m.subject ?? ""} ${m.preview ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [messages, query, filter]);

  const copyOtp = async (e: React.MouseEvent, id: string, otp: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(otp);
    } catch {
      /* abaikan */
    }
    buzz(15);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
  };

  const copyActiveEmail = async () => {
    const ok = await copyText(email);
    buzz(15);
    if (ok) {
      setCopiedEmail(true);
      window.setTimeout(() => setCopiedEmail(false), 1500);
    }
  };

  // Hapus pesan per item — two-tap confirm inline, tanpa popup.
  const tryDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      if (deleteTimer.current) window.clearTimeout(deleteTimer.current);
      deleteTimer.current = window.setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    setConfirmDeleteId(null);
    if (deleteTimer.current) window.clearTimeout(deleteTimer.current);
    setDeletingId(id);
    try {
      await nativeFetch(
        `/api/email/message?id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`,
        { method: "DELETE", headers: manageHeaders(email) }
      );
      queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey({ email }) });
      toast({
        title: "Pesan dipindah ke sampah",
        action: (
          <ToastAction
            altText="Urungkan"
            onClick={() => {
              nativeFetch("/api/email/message/restore", {
                method: "POST",
                headers: manageHeaders(email),
                body: JSON.stringify({ id, email }),
              })
                .then(() => {
                  queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey({ email }) });
                  toast({ title: "Pesan dikembalikan" });
                })
                .catch(() => {
                  toast({ title: "Gagal mengurungkan", variant: "destructive" });
                });
            }}
          >
            Urungkan
          </ToastAction>
        ),
      });
    } catch {
      /* abaikan — daftar akan tetap tampil */
    } finally {
      setDeletingId(null);
    }
  };

  if (loading && messages.length === 0) {
    return (
      <div className="px-4 py-2 space-y-4" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 rounded bg-muted w-2/3" />
              <div className="h-3 rounded bg-muted w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center text-center px-8 py-10">
        {/* Ilustrasi amplop kosong — SVG inline, tanpa aset eksternal */}
        <svg
          width="112"
          height="88"
          viewBox="0 0 112 88"
          fill="none"
          aria-hidden
          className="text-primary mb-4"
        >
          <rect x="10" y="14" width="92" height="62" rx="12" fill="currentColor" opacity="0.12" />
          <path
            d="M17 24 L56 52 L95 24"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.55"
          />
          <rect
            x="10"
            y="14"
            width="92"
            height="62"
            rx="12"
            stroke="currentColor"
            strokeWidth="4"
            opacity="0.35"
          />
          <circle cx="88" cy="64" r="15" fill="currentColor" opacity="0.9" />
          <path
            d="M88 58 v12 M82 64 h12"
            stroke="#fff"
            strokeWidth="3.5"
            strokeLinecap="round"
          />
        </svg>
        <p className="text-sm font-bold">Kotak masuk kosong</p>
        <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">
          Alamat ini siap menerima email. Bagikan alamatmu dan pesan baru akan muncul otomatis di
          sini.
        </p>
        {email && (
          <button
            type="button"
            onClick={copyActiveEmail}
            className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-bold bg-primary text-primary-foreground rounded-full px-5 py-2.5 active:scale-[0.97]"
          >
            {copiedEmail ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiedEmail ? "Tersalin!" : "Salin Alamat Email"}
          </button>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="px-4 pt-1 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari pengirim, subjek, isi…"
            className="w-full rounded-xl bg-muted/60 border border-transparent focus:border-primary/40 outline-none pl-9 pr-9 py-2 text-[13px] placeholder:text-muted-foreground"
          />
          {query !== "" && (
            <button
              aria-label="Hapus pencarian"
              onClick={() => setQuery("")}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground active:bg-muted"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <div className="flex gap-1.5 mt-2 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-[12px] font-bold border active:scale-95",
                filter === f.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-muted-foreground border-border/70"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>
      {filtered.length === 0 ? (
        <p className="text-center text-[13px] text-muted-foreground px-8 py-10">
          Tidak ada pesan yang cocok.
        </p>
      ) : (
        filtered.map((m) => {
        const meta = senderMeta(m.from);
        const otp = extractQuickOtp(`${m.subject ?? ""} ${m.preview ?? ""}`);
        const unread = !m.isRead;
        const armed = confirmDeleteId === m.id;
        return (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className="w-full flex gap-3 px-4 py-3 text-left border-b border-border/50 active:bg-muted/70"
          >
            <span
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[15px] font-extrabold shrink-0"
              style={{ background: meta.color }}
            >
              {meta.letter}
            </span>
            <span className="flex-1 min-w-0">
              <span className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    "text-[13px] truncate",
                    unread ? "font-bold text-foreground" : "font-medium text-muted-foreground"
                  )}
                >
                  {meta.name}
                </span>
                <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(m.receivedAt)}</span>
              </span>
              <span
                className={cn(
                  "block text-[13px] truncate mt-0.5",
                  unread ? "font-semibold text-foreground" : "text-muted-foreground"
                )}
              >
                {m.subject || "(tanpa subjek)"}
              </span>
              <span className="flex items-center gap-2 mt-1">
                <span className="text-[12px] text-muted-foreground truncate flex-1 min-w-0">
                  {cleanSnippet(m.preview)}
                </span>
                {otp && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => copyOtp(e, m.id, otp)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") copyOtp(e as unknown as React.MouseEvent, m.id, otp);
                    }}
                    className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 border border-primary/30 rounded-lg px-2 py-1"
                  >
                    {copiedId === m.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {otp}
                  </span>
                )}
              </span>
            </span>
            <span className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5">
              {unread && <span className="w-2 h-2 rounded-full bg-primary" />}
              <span
                role="button"
                tabIndex={0}
                aria-label={armed ? "Ketuk lagi untuk menghapus" : "Hapus pesan"}
                onClick={(e) => void tryDelete(e, m.id)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    void tryDelete(e as unknown as React.MouseEvent, m.id);
                }}
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center active:bg-muted",
                  armed ? "text-destructive bg-destructive/10" : "text-muted-foreground/60"
                )}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </span>
              {deletingId === m.id && (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" />
              )}
            </span>
          </button>
        );
        }))}
    </div>
  );
}
