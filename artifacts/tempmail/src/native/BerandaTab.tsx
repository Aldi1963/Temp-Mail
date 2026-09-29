import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  CheckCheck,
  Clock,
  Copy,
  Flame,
  Inbox,
  KeyRound,
  LogIn,
  Mail,
  Moon,
  Pencil,
  QrCode,
  RefreshCw,
  Search,
  Sun,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useTheme } from "@/components/theme-provider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useNativeAuth } from "./useNativeAuth";
import type { NativeMailbox } from "./useNativeMailbox";
import { NativeInboxList } from "./NativeInboxList";
import type { NativeMsg } from "./NativeInboxList";
import { OtpSection } from "./OtpSection";
import { OtpBanner } from "./OtpBanner";
import { CustomAddressForm } from "./CustomAddressForm";
import { nativeFetch, manageHeaders } from "./api";

interface Props {
  mailbox: NativeMailbox;
  onSelectMessage: (id: string) => void;
  onOpenAccount: () => void;
  onOpenAddresses: () => void;
  onOpenPin: () => void;
}

function StatIconBtn({
  label,
  onClick,
  danger,
  armed,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  danger?: boolean;
  armed?: boolean;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 active:scale-90 disabled:opacity-50",
        armed
          ? "bg-destructive/15 text-destructive animate-pulse"
          : danger
            ? "text-destructive/70 active:bg-destructive/10"
            : "text-muted-foreground active:bg-muted"
      )}
    >
      {children}
    </button>
  );
}

export function BerandaTab({ mailbox, onSelectMessage, onOpenAccount, onOpenPin }: Props) {
  const { theme, setTheme } = useTheme();
  const { user } = useNativeAuth();
  const { toast } = useToast();
  const [justCopied, setJustCopied] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [confirmDestroy, setConfirmDestroy] = useState(false);
  const [extending, setExtending] = useState(false);
  const [q, setQ] = useState("");
  const [results, setResults] = useState<NativeMsg[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [addressId, setAddressId] = useState<string | number | null>(null);
  const dark = theme === "dark";
  const messages = (mailbox.inbox?.messages ?? []) as unknown as NativeMsg[];

  const activeEntry = useMemo(
    () => mailbox.mergedInboxList.find((e) => e.email === mailbox.activeEmail) ?? null,
    [mailbox.mergedInboxList, mailbox.activeEmail]
  );

  // Kedaluwarsa = 30 hari dari pembuatan (seperti web).
  const expiryLabel = useMemo(() => {
    if (!activeEntry) return "30 hari";
    const t = Date.parse(activeEntry.addedAt ?? "");
    if (Number.isNaN(t)) return "30 hari";
    return new Date(t + 30 * 24 * 60 * 60 * 1000).toLocaleDateString("id-ID", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }, [activeEntry]);

  const copyEmail = async () => {
    if (!mailbox.activeEmail) return;
    try {
      await navigator.clipboard.writeText(mailbox.activeEmail);
      setJustCopied(true);
      window.setTimeout(() => setJustCopied(false), 1500);
      toast({ title: "Alamat disalin" });
    } catch {
      toast({ title: "Gagal menyalin", variant: "destructive" });
    }
  };

  // Hanya satu panel yang terbuka dalam satu waktu.
  const toggleCustom = () => {
    setQrOpen(false);
    setCustomOpen((o) => !o);
  };
  const toggleQr = () => {
    setCustomOpen(false);
    setQrOpen((o) => !o);
  };

  const extend = async () => {
    if (!mailbox.activeEmail || extending) return;
    setExtending(true);
    try {
      const data = await nativeFetch<{ appliedMinutes?: number }>("/api/email/extend", {
        method: "POST",
        headers: manageHeaders(mailbox.activeEmail),
        body: JSON.stringify({ email: mailbox.activeEmail, extraMinutes: 60 }),
      });
      const mins = data?.appliedMinutes ?? 60;
      toast({ title: `Diperpanjang +${mins} menit`, description: "Masa aktif alamat bertambah." });
    } catch (e) {
      toast({
        title: "Gagal memperpanjang",
        description: e instanceof Error ? e.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setExtending(false);
    }
  };

  // Musnahkan permanen: ketuk dua kali (tanpa popup).
  const destroy = async () => {
    if (!mailbox.activeEmail) return;
    if (!confirmDestroy) {
      setConfirmDestroy(true);
      toast({ title: "Ketuk lagi untuk musnahkan permanen" });
      window.setTimeout(() => setConfirmDestroy(false), 4000);
      return;
    }
    setConfirmDestroy(false);
    try {
      await nativeFetch(`/api/email/destroy?email=${encodeURIComponent(mailbox.activeEmail)}`, {
        method: "DELETE",
        headers: manageHeaders(mailbox.activeEmail),
      });
      mailbox.removeFromList(mailbox.activeEmail);
      toast({ title: "Alamat dimusnahkan permanen" });
    } catch (e) {
      toast({
        title: "Gagal memusnahkan",
        description: e instanceof Error ? e.message : "Coba lagi.",
        variant: "destructive",
      });
    }
  };

  const removeActive = () => {
    if (!mailbox.activeEmail) return;
    mailbox.removeFromList(mailbox.activeEmail);
    toast({ title: "Alamat dihapus dari daftar" });
  };

  const [local, domain] = (mailbox.activeEmail ?? "").split("@");
  const total = messages.length;

  // Cari addressId alamat aktif (dibutuhkan endpoint pencarian server).
  useEffect(() => {
    if (!user || !mailbox.activeEmail) {
      setAddressId(null);
      return;
    }
    let cancelled = false;
    nativeFetch<{ emails?: { id?: number | string; addressId?: number | string; email: string }[] }>(
      "/api/user/emails"
    )
      .then((d) => {
        if (cancelled) return;
        const hit = (d?.emails ?? []).find((e) => e.email === mailbox.activeEmail);
        setAddressId(hit ? ((hit.id ?? hit.addressId) as number | string | undefined) ?? null : null);
      })
      .catch(() => {
        if (!cancelled) setAddressId(null);
      });
    return () => {
      cancelled = true;
    };
  }, [user, mailbox.activeEmail]);

  // Pencarian ter-debounce: server bila addressId ada, else filter lokal.
  useEffect(() => {
    const query = q.trim();
    if (!query) {
      setResults(null);
      setSearching(false);
      return;
    }
    if (!addressId) {
      const lq = query.toLowerCase();
      setResults(
        messages.filter((m) =>
          `${m.from ?? ""} ${m.subject ?? ""} ${m.preview ?? ""}`.toLowerCase().includes(lq)
        )
      );
      return;
    }
    setSearching(true);
    const t = window.setTimeout(() => {
      nativeFetch<{ messages?: any[] } | any[]>(
        `/api/user/addresses/${encodeURIComponent(String(addressId))}/messages?q=${encodeURIComponent(query)}`
      )
        .then((d) => {
          const arr = Array.isArray(d) ? d : (d?.messages ?? []);
          setResults(
            arr.map((m: any) => ({
              id: String(m?.id ?? ""),
              from: String(m?.from ?? m?.fromAddress ?? ""),
              subject: m?.subject ?? null,
              preview: m?.preview ?? null,
              receivedAt: m?.receivedAt ?? new Date().toISOString(),
              isRead: m?.isRead ?? true,
              hasAttachments: m?.hasAttachments ?? null,
            })) as NativeMsg[]
          );
        })
        .catch(() => setResults(null))
        .finally(() => setSearching(false));
    }, 400);
    return () => window.clearTimeout(t);
  }, [q, addressId, messages]);

  const shownMessages = results ?? messages;

  return (
    <div>
      {/* App bar */}
      <div
        className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/60"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center gap-1 pl-2 pr-1 h-14">
          <span className="w-8 h-8 rounded-[10px] bg-primary flex items-center justify-center ml-1 shrink-0">
            <Mail className="h-4 w-4 text-primary-foreground" />
          </span>
          <span className="text-[17px] font-extrabold tracking-tight flex-1 ml-1.5 min-w-0 truncate">
            TempMail
          </span>
          <button
            aria-label="Ganti tema"
            onClick={() => setTheme(dark ? "light" : "dark")}
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground active:bg-muted shrink-0"
          >
            {dark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <button
            aria-label="Akun"
            onClick={onOpenAccount}
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground active:bg-muted shrink-0 mr-1"
          >
            {user?.email ? (
              <span className="w-7 h-7 rounded-full bg-primary/15 text-primary text-[13px] font-extrabold flex items-center justify-center">
                {user.email[0].toUpperCase()}
              </span>
            ) : (
              <LogIn className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>

      {/* Hero: SATU card ala panel web */}
      <div className="px-3 pt-3">
        <div className="rounded-3xl bg-primary/[0.08] border border-primary/20 p-3 space-y-2.5">
          {mailbox.activeEmail ? (
            <>
              {/* Bar alamat + Salin */}
              <div className="flex items-stretch rounded-2xl border border-primary/25 bg-background overflow-hidden">
                <span className="pl-3 pr-1 flex items-center shrink-0">
                  <Mail className="h-4 w-4 text-primary" />
                </span>
                <button
                  type="button"
                  onClick={copyEmail}
                  title={`${mailbox.activeEmail} — ketuk untuk menyalin`}
                  className="flex-1 min-w-0 px-2 py-3 text-left active:opacity-70"
                >
                  <span className="block w-full font-mono text-[15px] font-extrabold tracking-tight truncate">
                    <span className="text-foreground">{local}</span>
                    <span className="text-primary font-semibold">@{domain}</span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={copyEmail}
                  className="px-4 flex items-center gap-1.5 bg-primary text-primary-foreground text-[13px] font-bold active:scale-[0.97] shrink-0"
                >
                  {justCopied ? (
                    <CheckCheck className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                  {justCopied ? "Disalin" : "Salin"}
                </button>
              </div>

              {/* Baris tombol ala web */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => mailbox.generateEmail()}
                  disabled={mailbox.isGenerating}
                  className="flex-[2] min-w-0 rounded-2xl bg-primary text-primary-foreground text-[13px] font-extrabold py-2.5 flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-60"
                >
                  <Zap className={cn("h-4 w-4", mailbox.isGenerating && "animate-spin")} />
                  {mailbox.isGenerating ? "Membuat…" : "Acak Baru"}
                </button>
                <button
                  type="button"
                  onClick={toggleCustom}
                  className={cn(
                    "flex-[1.4] min-w-0 rounded-2xl border text-[13px] font-extrabold py-2.5 flex items-center justify-center gap-1.5 active:scale-[0.98]",
                    customOpen
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/70 bg-background text-foreground"
                  )}
                >
                  {customOpen ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                  Kustom
                </button>
                <button
                  type="button"
                  aria-label="Pengaturan kunci PIN"
                  title="Pengaturan kunci PIN"
                  onClick={onOpenPin}
                  className="w-11 h-11 rounded-2xl border border-border/70 bg-background flex items-center justify-center active:scale-95 shrink-0"
                >
                  <KeyRound className="h-[18px] w-[18px]" />
                </button>
                <button
                  type="button"
                  aria-label="Tampilkan QR alamat"
                  title="Tampilkan QR alamat"
                  onClick={toggleQr}
                  className={cn(
                    "w-11 h-11 rounded-2xl border flex items-center justify-center active:scale-95 shrink-0",
                    qrOpen
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/70 bg-background text-foreground"
                  )}
                >
                  <QrCode className="h-[18px] w-[18px]" />
                </button>
              </div>

              {/* Panel inline: kustom / QR */}
              {customOpen && (
                <CustomAddressForm
                  mailbox={mailbox}
                  onDone={() => setCustomOpen(false)}
                  className="bg-background"
                />
              )}
              {qrOpen && (
                <div className="rounded-2xl border border-border/70 bg-background p-4 flex flex-col items-center gap-3">
                  <div className="bg-white p-3 rounded-2xl">
                    <QRCodeSVG value={mailbox.activeEmail} size={160} />
                  </div>
                  <p className="text-[12px] font-mono break-all text-center px-2">
                    {mailbox.activeEmail}
                  </p>
                  <button
                    type="button"
                    onClick={copyEmail}
                    className="inline-flex items-center gap-1.5 text-[12px] font-bold bg-primary text-primary-foreground rounded-xl px-4 py-2 active:scale-95"
                  >
                    <Copy className="h-3.5 w-3.5" /> Salin alamat
                  </button>
                </div>
              )}

              {/* Baris stats ala web */}
              <div className="flex items-center gap-2 px-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-muted-foreground min-w-0 flex-1">
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <Inbox className="h-3.5 w-3.5" />
                    <b className="text-foreground">{total}</b> total
                  </span>
                  <span aria-hidden="true">•</span>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <Mail className="h-3.5 w-3.5" />
                    <b className="text-primary">{mailbox.unreadCount}</b> baru
                  </span>
                  <span aria-hidden="true">•</span>
                  <span className="whitespace-nowrap">Aktif s/d {expiryLabel}</span>
                </div>
                <div className="flex items-center shrink-0">
                  <StatIconBtn
                    label={extending ? "Memperpanjang…" : "Perpanjang masa aktif"}
                    onClick={extend}
                    disabled={extending}
                  >
                    <Clock className={cn("h-[18px] w-[18px]", extending && "animate-spin")} />
                  </StatIconBtn>
                  <StatIconBtn
                    label={confirmDestroy ? "Ketuk lagi untuk musnahkan permanen" : "Musnahkan permanen"}
                    onClick={destroy}
                    danger
                    armed={confirmDestroy}
                  >
                    <Flame className="h-[18px] w-[18px]" />
                  </StatIconBtn>
                  <StatIconBtn label="Hapus dari daftar" onClick={removeActive}>
                    <Trash2 className="h-[18px] w-[18px]" />
                  </StatIconBtn>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Bar alamat: placeholder saat kosong */}
              <div className="flex items-stretch rounded-2xl border border-primary/25 bg-background overflow-hidden">
                <span className="pl-3 pr-1 flex items-center shrink-0">
                  <Mail className="h-4 w-4 text-primary" />
                </span>
                <span className="flex-1 min-w-0 px-2 py-3 text-[15px] font-extrabold tracking-tight truncate text-muted-foreground/60">
                  Belum ada alamat aktif
                </span>
              </div>

              {/* Baris tombol: sama seperti state aktif */}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => mailbox.generateEmail()}
                  disabled={mailbox.isGenerating}
                  className="flex-[2] min-w-0 rounded-2xl bg-primary text-primary-foreground text-[13px] font-extrabold py-2.5 flex items-center justify-center gap-1.5 active:scale-[0.98] disabled:opacity-60"
                >
                  <Zap className={cn("h-4 w-4", mailbox.isGenerating && "animate-spin")} />
                  {mailbox.isGenerating ? "Membuat…" : "Acak Baru"}
                </button>
                <button
                  type="button"
                  onClick={toggleCustom}
                  className={cn(
                    "flex-[1.4] min-w-0 rounded-2xl border text-[13px] font-extrabold py-2.5 flex items-center justify-center gap-1.5 active:scale-[0.98]",
                    customOpen
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border/70 bg-background text-foreground"
                  )}
                >
                  {customOpen ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                  Kustom
                </button>
                <button
                  type="button"
                  aria-label="Pengaturan kunci PIN"
                  title="Pengaturan kunci PIN"
                  onClick={onOpenPin}
                  className="w-11 h-11 rounded-2xl border border-border/70 bg-background flex items-center justify-center active:scale-95 shrink-0"
                >
                  <KeyRound className="h-[18px] w-[18px]" />
                </button>
                <button
                  type="button"
                  aria-label="Tampilkan QR alamat"
                  title="Tampilkan QR alamat"
                  onClick={() => toast({ title: "Buat alamat dulu" })}
                  className="w-11 h-11 rounded-2xl border border-border/70 bg-background flex items-center justify-center active:scale-95 shrink-0 text-foreground/30"
                >
                  <QrCode className="h-[18px] w-[18px]" />
                </button>
              </div>

              {/* Panel inline kustom */}
              {customOpen && (
                <CustomAddressForm
                  mailbox={mailbox}
                  onDone={() => setCustomOpen(false)}
                  className="bg-background"
                />
              )}

              {/* Baris stats: tanpa ikon aksi saat kosong */}
              <div className="flex items-center gap-2 px-1 pt-0.5">
                <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[12px] text-muted-foreground min-w-0 flex-1">
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <Inbox className="h-3.5 w-3.5" />
                    <b className="text-foreground">{total}</b> total
                  </span>
                  <span aria-hidden="true">•</span>
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    <Mail className="h-3.5 w-3.5" />
                    <b className="text-primary">{mailbox.unreadCount}</b> baru
                  </span>
                  <span aria-hidden="true">•</span>
                  <span className="whitespace-nowrap">Aktif s/d —</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Kode OTP terbaru */}
      <div className="px-4 mt-5">
        <OtpSection messages={messages} />
      </div>

      {/* Banner OTP untuk pesan yang belum dibaca (di atas daftar inbox) */}
      <OtpBanner messages={messages} />

      {/* Pesan masuk */}
      <div className="mt-5 pb-6">
        <div className="px-4 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={addressId ? "Cari pesan di server…" : "Cari pengirim, subjek, isi…"}
              className="w-full rounded-xl bg-muted/60 border border-transparent focus:border-primary/40 outline-none pl-9 pr-9 py-2 text-[13px] placeholder:text-muted-foreground"
            />
            {searching && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" />
            )}
            {!searching && q !== "" && (
              <button
                aria-label="Hapus pencarian"
                onClick={() => setQ("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground active:bg-muted"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {results !== null && (
            <p className="text-[11px] text-muted-foreground mt-1.5 px-0.5">
              {results.length} hasil{addressId ? " dari server" : ""} untuk &ldquo;{q.trim()}&rdquo;
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 pl-4 pr-2 mb-1">
          <h3 className="text-[14px] font-extrabold flex-1">Pesan Masuk</h3>
          {mailbox.unreadCount > 0 && (
            <span className="min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[11px] font-bold inline-flex items-center justify-center">
              {mailbox.unreadCount}
            </span>
          )}
          {mailbox.unreadCount > 0 && (
            <button
              aria-label="Tandai semua dibaca"
              onClick={mailbox.markAllRead}
              className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground active:bg-muted"
            >
              <CheckCheck className="h-[18px] w-[18px]" />
            </button>
          )}
          <button
            aria-label="Muat ulang"
            onClick={mailbox.refreshInbox}
            className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground active:bg-muted"
          >
            <RefreshCw className={cn("h-[18px] w-[18px]", mailbox.inboxFetching && "animate-spin")} />
          </button>
        </div>
        <NativeInboxList
          messages={shownMessages}
          loading={mailbox.inboxLoading}
          email={mailbox.activeEmail ?? ""}
          onSelect={onSelectMessage}
        />
      </div>
    </div>
  );
}
