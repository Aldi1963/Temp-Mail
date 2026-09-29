import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft } from "lucide-react";
import { Capacitor, type PluginListenerHandle } from "@capacitor/core";
import { App } from "@capacitor/app";
import { useToast } from "@/hooks/use-toast";
import { useNativeMailbox } from "./useNativeMailbox";
import { useNativeSettings } from "./settings";
import { NativeAuthProvider, useNativeAuth } from "./useNativeAuth";
import { NativeLogin } from "./NativeLogin";
import { NativeAccountPage } from "./NativeAccountPage";
import { PinGate } from "./PinGate";
import { TabBar } from "./TabBar";
import type { NativeTab } from "./TabBar";
import { BerandaTab } from "./BerandaTab";
import { AlamatTab } from "./AlamatTab";
import { LainnyaTab } from "./LainnyaTab";
import { AdminTab } from "./AdminTab";
import { MessagePage } from "./MessagePage";
import { NativeApiDocsPage } from "./NativeApiDocsPage";
import { NativeStatusPage } from "./NativeStatusPage";
import { NativeAboutPage } from "./NativeAboutPage";
import { NativePrivacyPage } from "./NativePrivacyPage";
import { TrashPage } from "./TrashPage";
import { TelegramSettings } from "./TelegramSettings";
import { NativeDeveloperPage } from "./NativeDeveloperPage";
import { BlockedSenders } from "./BlockedSenders";
import { initPushNotifications, refreshPushRegistration } from "./push";

export type NativePage =
  | "api-docs"
  | "status"
  | "tentang"
  | "privacy"
  | "trash"
  | "telegram"
  | "developer"
  | "blocked-senders";

const PAGE_TITLES: Record<NativePage, string> = {
  "api-docs": "Dokumentasi API",
  status: "Status Server",
  tentang: "Tentang",
  privacy: "Privasi",
  trash: "Tong Sampah",
  telegram: "Telegram",
  developer: "Developer",
  "blocked-senders": "Blokir Pengirim",
};

// Pola scroll: dokumen yang scroll (bukan container bersarang) agar mulus
// di WebView Android. Header tiap layar memakai sticky top-0.
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
    <div className="flex-1">
      <div
        className="sticky top-0 z-20 border-b border-border/60 bg-background/95 backdrop-blur"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
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
      <div className="pb-8">{children}</div>
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
  const isAdmin = user?.role === "admin";
  const { settings } = useNativeSettings();
  const [unlocked, setUnlocked] = useState(!settings.pinEnabled);
  const mailbox = useNativeMailbox(unlocked);
  const [tab, setTab] = useState<NativeTab>("beranda");
  const [pinFlash, setPinFlash] = useState(0);
  const [page, setPage] = useState<NativePage | null>(null);
  const [messageId, setMessageId] = useState<string | null>(null);
  const [loginOpen, setLoginOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const { toast } = useToast();
  const loginToastShown = useRef(false);
  const mailboxRef = useRef(mailbox);
  mailboxRef.current = mailbox;
  // Dilewati sekali saat alamat aktif berganti akibat ketukan notifikasi,
  // supaya pembaca pesan yang baru dibuka tidak langsung ditutup.
  const notifNavGuard = useRef(false);

  useEffect(() => {
    if (notifNavGuard.current) {
      notifNavGuard.current = false;
      return;
    }
    setMessageId(null);
  }, [mailbox.activeEmail]);

  // Push notification: inisialisasi sekali saat aplikasi dibuka.
  // Graceful: bila plugin/FCM belum tersedia, aplikasi tetap jalan normal.
  useEffect(() => {
    void initPushNotifications({
      getActiveEmail: () => mailboxRef.current.activeEmail,
      onOpenMessage: (id, email) => {
        notifNavGuard.current = true;
        mailboxRef.current.setActiveEmail(email);
        setTab("beranda");
        setMessageId(id);
      },
    });
  }, []);

  // Token push didaftarkan dengan alamat aktif; kirim ulang bila alamat berganti.
  useEffect(() => {
    if (!mailbox.activeEmail) return;
    const t = window.setTimeout(() => {
      void refreshPushRegistration(mailbox.activeEmail);
    }, 3000);
    return () => window.clearTimeout(t);
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

  // Tab admin hanya untuk admin: bila peran berubah (mis. logout),
  // kembalikan ke beranda agar layar admin tak bisa diintip.
  useEffect(() => {
    if (!isAdmin && tab === "admin") setTab("beranda");
  }, [isAdmin, tab]);

  const openPage = useCallback((p: NativePage) => setPage(p), []);
  const closePage = useCallback(() => setPage(null), []);

  // Sub-menu lokal (mis. di tab Lainnya) yang harus ditutup dulu oleh tombol
  // back HP sebelum pindah tab. Komponen anak mendaftarkan fungsi penutupnya
  // lewat prop registerSubMenuCloser; fungsi mengembalikan true bila menangani.
  const subMenuCloserRef = useRef<(() => boolean) | null>(null);
  const registerSubMenuCloser = useCallback((fn: (() => boolean) | null) => {
    subMenuCloserRef.current = fn;
  }, []);

  // Kunci scroll dokumen saat overlay fullscreen terbuka.
  const overlayOpen = !!messageId || loginOpen || accountOpen;
  useEffect(() => {
    if (!overlayOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [overlayOpen]);

  // Tombol back HP: jangan langsung keluar aplikasi.
  // Prioritas: pesan → login/akun → halaman → sub-menu → tab beranda → tekan 2x untuk keluar.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let lastBack = 0;
    let handle: PluginListenerHandle | undefined;
    App.addListener("backButton", () => {
      if (messageId) {
        setMessageId(null);
        return;
      }
      if (loginOpen) {
        setLoginOpen(false);
        return;
      }
      if (accountOpen) {
        setAccountOpen(false);
        return;
      }
      if (page) {
        setPage(null);
        return;
      }
      if (subMenuCloserRef.current?.()) {
        return;
      }
      if (tab !== "beranda") {
        setTab("beranda");
        return;
      }
      const now = Date.now();
      if (now - lastBack < 2000) {
        void App.exitApp();
        return;
      }
      lastBack = now;
      toast({ title: "Tekan sekali lagi untuk keluar" });
    }).then((h) => {
      handle = h;
    });
    return () => {
      handle?.remove();
    };
  }, [messageId, loginOpen, accountOpen, page, tab, toast]);

  if (settings.pinEnabled && !unlocked) {
    return <PinGate onUnlock={() => setUnlocked(true)} />;
  }

  return (
    <div className="min-h-dvh flex flex-col bg-background text-foreground overflow-x-clip">
      <div className="flex-1">
        {page === null ? (
          <>
            {tab === "beranda" && (
              <BerandaTab
                mailbox={mailbox}
                onSelectMessage={setMessageId}
                onOpenAccount={() => (user?.email ? setAccountOpen(true) : setLoginOpen(true))}
                onOpenAddresses={() => setTab("alamat")}
                onOpenPin={() => {
                  setPinFlash((k) => k + 1);
                  setTab("lainnya");
                }}
              />
            )}
            {tab === "alamat" && <AlamatTab mailbox={mailbox} />}
            {tab === "lainnya" && (
              <LainnyaTab onOpenPage={openPage} onOpenLogin={() => setLoginOpen(true)} pinFlash={pinFlash} registerSubMenuCloser={registerSubMenuCloser} />
            )}
            {tab === "admin" && isAdmin && <AdminTab />}
          </>
        ) : (
          <SubPage title={PAGE_TITLES[page]} onBack={closePage}>
            {page === "api-docs" && <NativeApiDocsPage />}
            {page === "status" && <NativeStatusPage />}
            {page === "tentang" && <NativeAboutPage />}
            {page === "privacy" && <NativePrivacyPage />}
            {page === "trash" && mailbox.activeEmail && <TrashPage email={mailbox.activeEmail} />}
            {page === "telegram" && <TelegramSettings onOpenLogin={() => setLoginOpen(true)} />}
            {page === "developer" && (
              <NativeDeveloperPage onOpenLogin={() => setLoginOpen(true)} />
            )}
            {page === "blocked-senders" && (
              <BlockedSenders onOpenLogin={() => setLoginOpen(true)} />
            )}
          </SubPage>
        )}
      </div>
      {page === null && <TabBar tab={tab} onChange={setTab} unread={mailbox.unreadCount} showAdmin={isAdmin} />}

      {messageId && mailbox.activeEmail && (
        <MessagePage messageId={messageId} email={mailbox.activeEmail} onBack={() => setMessageId(null)} />
      )}

      {loginOpen && (
        <div className="fixed inset-0 z-[90] bg-background flex flex-col">
          <NativeLogin onDone={() => setLoginOpen(false)} />
        </div>
      )}

      {accountOpen && (
        <div className="fixed inset-0 z-[90] bg-background flex flex-col">
          <NativeAccountPage
            onBack={() => setAccountOpen(false)}
            onSwitchAccount={() => {
              setAccountOpen(false);
              setLoginOpen(true);
            }}
          />
        </div>
      )}
    </div>
  );
}
