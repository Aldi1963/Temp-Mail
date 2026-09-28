import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePin } from "@/hooks/use-pin";
import { PinLock } from "@/components/pin-lock";
import { useSound } from "@/hooks/use-sound";
import { useToast } from "@/hooks/use-toast";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import ApiDocsPage from "@/pages/api-docs";
import StatusPage from "@/pages/status";
import LandingPage from "@/pages/landing";
import PrivacyPage from "@/pages/privacy";
import { useNativeMailbox } from "./useNativeMailbox";
import { TabBar } from "./TabBar";
import type { NativeTab } from "./TabBar";
import { BerandaTab } from "./BerandaTab";
import { AlamatTab } from "./AlamatTab";
import { LainnyaTab } from "./LainnyaTab";
import { MessagePage } from "./MessagePage";

export type NativePage = "login" | "register" | "api-docs" | "status" | "tentang" | "privacy";

const PAGE_TITLES: Record<NativePage, string> = {
  login: "Masuk",
  register: "Daftar",
  "api-docs": "Dokumentasi API",
  status: "Status Server",
  tentang: "Tentang",
  privacy: "Privasi",
};

function SubPage({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="shrink-0 border-b border-border/60 bg-background/95 backdrop-blur z-20">
        <div className="flex items-center gap-1 px-2 h-14">
          <button
            aria-label="Kembali"
            onClick={onBack}
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-[16px] font-extrabold">{title}</span>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">{children}</div>
    </div>
  );
}

// Pengalaman khusus aplikasi Android: bottom nav + layar penuh, tanpa popup.
export function NativeApp() {
  const { user } = useAuth();
  const pin = usePin();
  const mailbox = useNativeMailbox(pin.isUnlocked);
  const [tab, setTab] = useState<NativeTab>("beranda");
  const [page, setPage] = useState<NativePage | null>(null);
  const [messageId, setMessageId] = useState<string | null>(null);
  const { toast } = useToast();
  const { playChime } = useSound();
  const prevTotal = useRef(0);

  const total = mailbox.inbox?.total ?? 0;

  // Pesan baru: bunyi + getar + toast
  useEffect(() => {
    if (total > prevTotal.current) {
      if (prevTotal.current > 0) {
        playChime();
        try {
          if ("vibrate" in navigator) navigator.vibrate([80, 40, 80]);
        } catch {
          /* abaikan */
        }
        toast({ title: "Email baru masuk", description: "Ada pesan baru di kotak masuk." });
      }
      prevTotal.current = total;
    } else if (total < prevTotal.current) {
      prevTotal.current = total;
    }
  }, [total, playChime, toast]);

  useEffect(() => {
    setMessageId(null);
    prevTotal.current = 0;
  }, [mailbox.activeEmail]);

  // Selesai login → kembali ke tab
  useEffect(() => {
    if ((page === "login" || page === "register") && user?.email) {
      setPage(null);
      setTab("lainnya");
      toast({ title: "Masuk berhasil", description: user.email });
    }
  }, [page, user, toast]);

  const openPage = useCallback((p: NativePage) => setPage(p), []);
  const closePage = useCallback(() => setPage(null), []);

  if (pin.hasPin && !pin.isUnlocked) {
    return <PinLock onVerify={pin.verifyPin} />;
  }

  return (
    <div
      className="min-h-[100dvh] flex flex-col bg-background text-foreground overflow-x-clip"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {page === null ? (
        <>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            {tab === "beranda" && (
              <BerandaTab
                mailbox={mailbox}
                onSelectMessage={setMessageId}
                onOpenAccount={() => setTab("lainnya")}
              />
            )}
            {tab === "alamat" && <AlamatTab mailbox={mailbox} />}
            {tab === "lainnya" && <LainnyaTab onOpenPage={openPage} />}
          </div>
          <TabBar tab={tab} onChange={setTab} unread={mailbox.unreadCount} />
        </>
      ) : (
        <SubPage title={PAGE_TITLES[page]} onBack={closePage}>
          {page === "login" && <LoginPage />}
          {page === "register" && <RegisterPage />}
          {page === "api-docs" && <ApiDocsPage />}
          {page === "status" && <StatusPage />}
          {page === "tentang" && <LandingPage />}
          {page === "privacy" && <PrivacyPage />}
        </SubPage>
      )}

      {messageId && mailbox.activeEmail && (
        <MessagePage messageId={messageId} email={mailbox.activeEmail} onBack={() => setMessageId(null)} />
      )}
    </div>
  );
}
