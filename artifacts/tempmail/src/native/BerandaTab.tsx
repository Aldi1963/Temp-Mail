import { useState } from "react";
import type { ReactNode } from "react";
import { CheckCheck, Copy, Dices, LogIn, Mail, Moon, Pencil, QrCode, RefreshCw, Sun, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useTheme } from "@/components/theme-provider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useNativeAuth } from "./useNativeAuth";
import type { NativeMailbox } from "./useNativeMailbox";
import { NativeInboxList } from "./NativeInboxList";
import type { NativeMsg } from "./NativeInboxList";
import { OtpSection } from "./OtpSection";
import { CustomAddressForm } from "./CustomAddressForm";

interface Props {
  mailbox: NativeMailbox;
  onSelectMessage: (id: string) => void;
  onOpenAccount: () => void;
  onOpenAddresses: () => void;
}

function HeroBtn({
  label,
  onClick,
  disabled,
  active,
  primary,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
  primary?: boolean;
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
        "inline-flex flex-col items-center justify-center gap-1 rounded-2xl py-2.5 text-[12px] font-bold active:scale-[0.97] disabled:opacity-50 min-w-0",
        primary
          ? "bg-primary text-primary-foreground"
          : active
            ? "bg-primary/15 text-primary border border-primary/40"
            : "bg-background border border-border/70 text-foreground"
      )}
    >
      {children}
    </button>
  );
}

export function BerandaTab({ mailbox, onSelectMessage, onOpenAccount }: Props) {
  const { theme, setTheme } = useTheme();
  const { user } = useNativeAuth();
  const { toast } = useToast();
  const [justCopied, setJustCopied] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const dark = theme === "dark";
  const messages = (mailbox.inbox?.messages ?? []) as unknown as NativeMsg[];

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

      {/* Hero alamat aktif */}
      <div className="px-3 pt-3">
        <div className="rounded-3xl bg-primary/[0.08] border border-primary/20 p-4">
          <div className="text-[10px] font-bold tracking-[1.5px] text-primary mb-1.5">
            ALAMAT AKTIF
          </div>
          {mailbox.activeEmail ? (
            <>
              <button type="button" onClick={copyEmail} className="w-full text-left active:opacity-70">
                <span className="block text-[16px] font-extrabold truncate">
                  {mailbox.activeEmail}
                </span>
                <span className="block text-[11px] text-muted-foreground mt-0.5">
                  {justCopied ? "Disalin!" : "Ketuk untuk menyalin"}
                </span>
              </button>
              <div className="grid grid-cols-4 gap-2 mt-3">
                <HeroBtn label="Salin alamat" primary onClick={copyEmail}>
                  <Copy className="h-[18px] w-[18px]" />
                  Salin
                </HeroBtn>
                <HeroBtn
                  label="Buat alamat acak baru"
                  onClick={() => mailbox.generateEmail()}
                  disabled={mailbox.isGenerating}
                >
                  <Dices className="h-[18px] w-[18px]" />
                  {mailbox.isGenerating ? "…" : "Acak"}
                </HeroBtn>
                <HeroBtn label="Buat alamat kustom" active={customOpen} onClick={toggleCustom}>
                  {customOpen ? <X className="h-[18px] w-[18px]" /> : <Pencil className="h-[18px] w-[18px]" />}
                  Kustom
                </HeroBtn>
                <HeroBtn label="Tampilkan QR alamat" active={qrOpen} onClick={toggleQr}>
                  <QrCode className="h-[18px] w-[18px]" />
                  QR
                </HeroBtn>
              </div>
              {customOpen && (
                <CustomAddressForm
                  mailbox={mailbox}
                  onDone={() => setCustomOpen(false)}
                  className="mt-2 bg-background"
                />
              )}
              {qrOpen && (
                <div className="mt-2 rounded-2xl border border-border/70 bg-background p-4 flex flex-col items-center gap-3">
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
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => mailbox.generateEmail()}
                disabled={mailbox.isGenerating}
                className="w-full rounded-2xl bg-primary text-primary-foreground text-[14px] font-extrabold py-3 active:scale-[0.99] disabled:opacity-60"
              >
                {mailbox.isGenerating ? "Membuat…" : "Buat alamat email"}
              </button>
              <button
                type="button"
                onClick={toggleCustom}
                className={cn(
                  "w-full mt-2 rounded-2xl border-2 px-4 py-2.5 text-[13px] font-extrabold flex items-center justify-center gap-2 active:scale-[0.99]",
                  customOpen
                    ? "border-primary bg-primary/[0.08] text-primary"
                    : "border-primary/50 text-primary"
                )}
              >
                {customOpen ? <X className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
                {customOpen ? "Tutup form kustom" : "Buat alamat kustom"}
              </button>
              {customOpen && (
                <CustomAddressForm
                  mailbox={mailbox}
                  onDone={() => setCustomOpen(false)}
                  className="mt-2 bg-background"
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Kode OTP terbaru */}
      <div className="px-4 mt-5">
        <OtpSection messages={messages} />
      </div>

      {/* Pesan masuk */}
      <div className="mt-5 pb-6">
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
          messages={messages}
          loading={mailbox.inboxLoading}
          email={mailbox.activeEmail ?? ""}
          onSelect={onSelectMessage}
        />
      </div>
    </div>
  );
}
