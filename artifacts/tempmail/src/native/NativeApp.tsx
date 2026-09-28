import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import ApiDocsPage from "@/pages/api-docs";
import StatusPage from "@/pages/status";
import LandingPage from "@/pages/landing";
import PrivacyPage from "@/pages/privacy";
import { useNativeMailbox } from "./useNativeMailbox";
import { useNativeSettings } from "./settings";
import { NativeAuthProvider, useNativeAuth } from "./useNativeAuth";
import { NativeLogin } from "./NativeLogin";
import { PinGate } from "./PinGate";
import { TabBar } from "./TabBar";
import type { NativeTab } from "./TabBar";
import { BerandaTab } from "./BerandaTab";
import { AlamatTab } from "./AlamatTab";
import { LainnyaTab } from "./LainnyaTab";
import { MessagePage } from "./MessagePage";

export type NativePage = "api-docs" | "status" | "tentang" | "privacy";

const PAGE_TITLES: Record<NativePage, string> = {
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
  return (
    <NativeAuthProvider>
      <NativeAppInner />
    </NativeAuthProvider>
  );
}

function NativeAppInner() {
  const { user } = useNativeAuth();
  const { settings } = useNativeSettings();
  const [unlocked, setUnlocked] = useState(!settings.pinEnabled);
  const mailbox = useNativeMailbox(unlocked);
  const [tab, setTab] = useState<NativeTab>("beranda");
  const [page, setPage] = useState<NativePage | null>(null);
  const [messageId, setMessageId] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const { toast } = useToast();
  const loginToastShown = useRef(false);

  useEffect(() => {
    setMessageId(null);
  }, [mailbox.activeEmail]);

  // Selesai login native → toast sekali lalu kembali ke tab Lainnya.
  useEffect(() => {
    if (!loginOpen && user?.email && !loginToastShown.current) {
      loginToastShown.current = true;
      setTab("lainnya");
      toast({ title: "Masuk berhasil", description: user.email });
    }
    if (!user?.email) loginToastShown.current = false;
  }, [loginOpen, user, toast]);

  const openPage = useCallback((p: NativePage) => setPage(p), []);
  const closePage = useCallback(() => setPage(null), []);

  if (settings.pinEnabled && !unlocked) {
    return <PinGate onUnlock={() => setUnlocked(true)} />;
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
            {tab === "lainnya" && (
              <LainnyaTab onOpenPage={openPage} onOpenLogin={() => setLoginOpen(true)} />
            )}
          </div>
          <TabBar tab={tab} onChange={setTab} unread={mailbox.unreadCount} />
        </>
      ) : (
        <SubPage title={PAGE_TITLES[page]} onBack={closePage}>
          {page === "api-docs" && <ApiDocsPage />}
          {page === "status" && <StatusPage />}
          {page === "tentang" && <LandingPage />}
          {page === "privacy" && <PrivacyPage />}
        </SubPage>
      )}

      {messageId && mailbox.activeEmail && (
        <MessagePage messageId={messageId} email={mailbox.activeEmail} onBack={() => setMessageId(null)} />
      )}

      {loginOpen && (
        <div className="fixed inset-0 z-[90] bg-background">
          <NativeLogin onDone={() => setLoginOpen(false)} />
        </div>
      )}
    </div>
  );
}
