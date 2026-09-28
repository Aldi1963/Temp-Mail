import { useState } from "react";
import { CheckCheck, Copy, Dices, LogIn, Mail, Moon, RefreshCw, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { useNativeAuth } from "./useNativeAuth";
import type { NativeMailbox } from "./useNativeMailbox";
import { NativeInboxList } from "./NativeInboxList";
import type { NativeMsg } from "./NativeInboxList";
import { OtpSection } from "./OtpSection";

interface Props {
  mailbox: NativeMailbox;
  onSelectMessage: (id: string) => void;
  onOpenAccount: () => void;
  onOpenAddresses: () => void;
}

export function BerandaTab({ mailbox, onSelectMessage, onOpenAccount, onOpenAddresses }: Props) {
  const { theme, setTheme } = useTheme();
  const { user } = useNativeAuth();
  const { toast } = useToast();
  const [justCopied, setJustCopied] = useState(false);
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
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={copyEmail}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl bg-primary text-primary-foreground text-[13px] font-bold py-2.5 active:scale-[0.98]"
                >
                  <Copy className="h-4 w-4" /> Salin
                </button>
                <button
                  type="button"
                  onClick={() => mailbox.generateEmail()}
                  disabled={mailbox.isGenerating}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-2xl border border-primary/40 text-primary text-[13px] font-bold py-2.5 active:scale-[0.98] disabled:opacity-50"
                >
                  <Dices className="h-4 w-4" /> {mailbox.isGenerating ? "Membuat…" : "Alamat baru"}
                </button>
                <button
                  type="button"
                  onClick={onOpenAddresses}
                  className="inline-flex items-center justify-center rounded-2xl bg-muted text-foreground text-[13px] font-bold px-4 py-2.5 active:scale-[0.98]"
                >
                  Kelola
                </button>
              </div>
            </>
          ) : (
            <button
              type="button"
              onClick={() => mailbox.generateEmail()}
              disabled={mailbox.isGenerating}
              className="w-full rounded-2xl bg-primary text-primary-foreground text-[14px] font-extrabold py-3 active:scale-[0.99] disabled:opacity-60"
            >
              {mailbox.isGenerating ? "Membuat…" : "Buat alamat email"}
            </button>
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
