import { LogIn, Mail, Moon, RefreshCw, Sun } from "lucide-react";
import { useTheme } from "@/components/theme-provider";
import { EmailPane } from "@/components/email-pane";
import { useAuth } from "@/hooks/use-auth";
import { usePin } from "@/hooks/use-pin";
import { cn } from "@/lib/utils";
import type { NativeMailbox } from "./useNativeMailbox";
import { NativeInboxList } from "./NativeInboxList";
import type { NativeMsg } from "./NativeInboxList";
import { OtpSection } from "./OtpSection";

interface Props {
  mailbox: NativeMailbox;
  onSelectMessage: (id: string) => void;
  onOpenAccount: () => void;
}

export function BerandaTab({ mailbox, onSelectMessage, onOpenAccount }: Props) {
  const { theme, setTheme } = useTheme();
  const { user } = useAuth();
  const pin = usePin();
  const dark = theme === "dark";
  const messages = ((mailbox.inbox?.messages ?? []) as unknown) as NativeMsg[];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      {/* App bar */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/60">
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

      {/* Hero alamat */}
      <div className="px-3 pt-3">
        <div className="rounded-3xl bg-primary/[0.08] border border-primary/20 p-3">
          <div className="text-[10px] font-bold tracking-[1.5px] text-primary px-1 mb-1">
            ALAMAT AKTIF
          </div>
          <EmailPane
            activeEmail={mailbox.activeEmail}
            setActiveEmail={mailbox.setActiveEmail}
            hasPin={pin.hasPin}
            onSetupPin={pin.setupPin}
            onRemovePin={pin.removePin}
            onLock={pin.lock}
            hideTopStatus
          />
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
          onSelect={onSelectMessage}
        />
      </div>
    </div>
  );
}
