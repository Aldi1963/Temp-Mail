// Pengaturan Telegram: tautkan akun Telegram agar pesan baru diteruskan
// otomatis ke Telegram. Seluruh alur inline, tanpa popup.
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, ExternalLink, RefreshCw, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { nativeFetch } from "./api";
import { useNativeAuth } from "./useNativeAuth";
import { useToast } from "@/hooks/use-toast";
import { copyText } from "./clipboard";
import { DangerConfirm, ErrorBox, LoadingBlock } from "./AdminShared";

interface TelegramStatus {
  linked: boolean;
  username?: string | null;
}

export function TelegramSettings({ onOpenLogin }: { onOpenLogin: () => void }) {
  const { user } = useNativeAuth();
  const { toast } = useToast();
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [linkUrl, setLinkUrl] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const s = await nativeFetch<TelegramStatus>("/api/user/telegram");
      setStatus(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat status Telegram.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) void load();
  }, [user, load]);

  const err = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan.");

  // Minta URL tautan dari backend lalu buka bot Telegram.
  const link = async () => {
    setLinking(true);
    try {
      const res = await nativeFetch<{ url?: string }>("/api/user/telegram/link", {
        method: "POST",
      });
      if (!res?.url) throw new Error("Backend tidak mengembalikan URL tautan.");
      setLinkUrl(res.url);
      // Buka di browser eksternal agar sesi aplikasi tidak hilang.
      try {
        window.open(res.url, "_blank", "noopener");
      } catch {
        /* abaikan — pengguna bisa menyalin URL */
      }
      toast({ title: "Tautan Telegram siap", description: "Selesaikan di Telegram, lalu ketuk Segarkan." });
    } catch (e) {
      toast({ title: "Gagal membuat tautan", description: err(e), variant: "destructive" });
    } finally {
      setLinking(false);
    }
  };

  const unlink = async () => {
    setUnlinking(true);
    try {
      await nativeFetch("/api/user/telegram", { method: "DELETE" });
      setStatus({ linked: false });
      setLinkUrl(null);
      toast({ title: "Telegram diputus", description: "Penerusan pesan dihentikan." });
    } catch (e) {
      toast({ title: "Gagal memutuskan", description: err(e), variant: "destructive" });
    } finally {
      setUnlinking(false);
    }
  };

  const doCopy = async () => {
    if (!linkUrl) return;
    const ok = await copyText(linkUrl);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      toast({ title: "Tautan disalin" });
    } else {
      toast({ title: "Gagal menyalin.", variant: "destructive" });
    }
  };

  if (!user) {
    return (
      <div className="p-4">
        <div className="rounded-3xl border border-border/60 bg-card p-5 text-center">
          <span className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
            <Send className="h-6 w-6" />
          </span>
          <p className="text-[14px] font-extrabold">Masuk dulu untuk menghubungkan Telegram</p>
          <p className="text-[12.5px] text-muted-foreground mt-1.5 leading-relaxed">
            Penerusan pesan ke Telegram hanya tersedia untuk akun yang sudah masuk.
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
      <div className="rounded-3xl border border-border/60 bg-card p-4">
        <div className="flex items-center gap-3">
          <span className="w-12 h-12 rounded-2xl bg-sky-500/15 text-sky-500 flex items-center justify-center shrink-0">
            <Send className="h-5 w-5" />
          </span>
          <div className="flex-1 min-w-0">
            <p className="text-[14px] font-extrabold">Penerusan Telegram</p>
            <p className="text-[12px] text-muted-foreground leading-snug mt-0.5">
              Pesan baru diteruskan otomatis ke Telegram setelah akun ditautkan.
            </p>
          </div>
        </div>

        {loading ? (
          <LoadingBlock label="Memuat status..." />
        ) : error ? (
          <div className="mt-3">
            <ErrorBox message={error} onRetry={() => void load()} />
          </div>
        ) : (
          <div className="mt-3">
            <div
              className={cn(
                "flex items-center gap-2.5 rounded-2xl px-3.5 py-3",
                status?.linked ? "bg-emerald-500/10" : "bg-muted/70"
              )}
            >
              <span
                className={cn(
                  "w-2.5 h-2.5 rounded-full shrink-0",
                  status?.linked ? "bg-emerald-500" : "bg-muted-foreground/50"
                )}
              />
              <span className="flex-1 min-w-0 text-[13px] font-bold">
                {status?.linked ? (
                  <>
                    Tertaut{status.username ? " ke " : ""}
                    {status.username ? (
                      <span className="font-mono text-primary">@{status.username}</span>
                    ) : null}
                  </>
                ) : (
                  "Belum ditautkan"
                )}
              </span>
              {status?.linked ? (
                <DangerConfirm
                  label="Putuskan"
                  confirmLabel="Ketuk lagi untuk putuskan"
                  onConfirm={() => void unlink()}
                  disabled={unlinking}
                />
              ) : (
                <button
                  type="button"
                  disabled={linking}
                  onClick={() => void link()}
                  className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground text-[12.5px] font-bold px-4 py-2 active:scale-[0.97] disabled:opacity-50"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  {linking ? "Menyiapkan…" : "Hubungkan"}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {linkUrl && !status?.linked && (
        <div className="rounded-3xl border border-primary/30 bg-primary/[0.05] p-4 space-y-3">
          <p className="text-[13px] font-extrabold">Selesaikan penautan</p>
          <p className="text-[12.5px] text-muted-foreground leading-relaxed">
            Tautan sudah dibuka di browser. Bila belum terbuka, salin dan buka manual di Telegram.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 min-w-0 font-mono text-[11px] break-all bg-background rounded-xl px-3 py-2.5 border border-border/60">
              {linkUrl}
            </code>
            <button
              type="button"
              onClick={() => void doCopy()}
              aria-label="Salin tautan Telegram"
              className="shrink-0 w-10 h-10 rounded-xl bg-muted flex items-center justify-center active:scale-95"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4 text-muted-foreground" />
              )}
            </button>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void link()}
              disabled={linking}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-primary text-primary-foreground text-[12.5px] font-bold py-2.5 active:scale-[0.98] disabled:opacity-50"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Buka Telegram
            </button>
            <button
              type="button"
              onClick={() => void load()}
              className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl border border-border/70 text-[12.5px] font-bold py-2.5 active:scale-[0.98]"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Saya sudah menautkan
            </button>
          </div>
        </div>
      )}

      <p className="text-[11.5px] text-muted-foreground leading-relaxed px-1">
        Setiap pesan yang masuk ke semua alamat Anda akan diteruskan ke chat Telegram yang
        ditautkan. Putuskan kapan saja untuk menghentikan penerusan.
      </p>
    </div>
  );
}
