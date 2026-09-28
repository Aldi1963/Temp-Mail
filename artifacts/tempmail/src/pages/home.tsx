import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Inbox, Mail, LogIn, Zap } from "lucide-react";
import { useAuth, userFetch } from "@/hooks/use-auth";
import { getManageToken } from "@/lib/manage-token";
import { Header } from "@/components/header";
import { EmailPane } from "@/components/email-pane";
import { InboxList } from "@/components/inbox-list";
import { MessageViewer } from "@/components/message-viewer";
import { InboxSwitcher } from "@/components/inbox-switcher";
import { PinLock } from "@/components/pin-lock";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useSound } from "@/hooks/use-sound";
import { useToast } from "@/hooks/use-toast";
import { usePin } from "@/hooks/use-pin";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import {
  useGetInbox,
  useMarkMessageRead,
  useResetInbox,
  getGetInboxQueryKey,
  getGetEmailStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface InboxEntry {
  email: string;
  addedAt: string;
}

const MAX_INBOXES = 5;

export default function Home() {
  const [activeEmail, setActiveEmailRaw] = useLocalStorage<string | null>("tempmail_active_email", null);
  const [inboxList, setInboxList] = useLocalStorage<InboxEntry[]>("tempmail_inbox_list", []);
  // Email milik akun (diambil dari server) — bertahan lintas perangkat/browser
  const [serverEmails, setServerEmails] = useState<string[]>([]);
  // Counter permintaan generate eksplisit (tombol "+" di switcher)
  const [generateRequest, setGenerateRequest] = useState(0);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const { playChime } = useSound();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const prevTotalRef = useRef<number>(0);

  const [notifPermission, setNotifPermission] = useState<NotificationPermission | "unsupported">(
    () => {
      if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
      return Notification.permission;
    }
  );

  const requestNotifPermission = useCallback(async () => {
    if (!("Notification" in window)) return;
    const perm = await Notification.requestPermission();
    setNotifPermission(perm);
    if (perm === "granted") {
      toast({ title: "Notifikasi diaktifkan!", description: "Anda akan mendapat pemberitahuan saat email baru masuk." });
    }
  }, [toast]);

  const { hasPin, isUnlocked, setupPin, removePin, verifyPin, lock } = usePin();
  const markReadMutation = useMarkMessageRead();
  const resetInboxMutation = useResetInbox();

  const setActiveEmail = useCallback((email: string) => {
    setActiveEmailRaw(email);
    setInboxList((prev) => {
      const exists = prev.some((e) => e.email === email);
      if (exists) return prev;
      const updated = [{ email, addedAt: new Date().toISOString() }, ...prev];
      return updated.slice(0, MAX_INBOXES);
    });
  }, [setActiveEmailRaw, setInboxList]);

  const removeFromList = useCallback((email: string) => {
    const ownedByServer = user != null && serverEmails.includes(email);
    setInboxList((prev) => prev.filter((e) => e.email !== email));
    setServerEmails((prev) => prev.filter((e) => e !== email));
    // Hapus kepemilikan di server agar email tidak muncul lagi setelah reload/login
    if (ownedByServer) {
      userFetch("/api/user/emails", {
        method: "DELETE",
        body: JSON.stringify({ email }),
      }).catch(() => {
        toast({ title: "Gagal menghapus permanen", description: "Email bisa muncul lagi setelah reload." });
      });
    }
    if (activeEmail === email) {
      const remaining = inboxList.filter((e) => e.email !== email);
      setActiveEmailRaw(remaining.length > 0 ? remaining[0].email : null);
    }
  }, [activeEmail, inboxList, setActiveEmailRaw, setInboxList, user, serverEmails, toast]);

  // Bersihkan entri lokal yang sudah pasti kedaluwarsa (>31 hari dari addedAt)
  // agar alamat "hantu" tidak muncul/hilang sendiri di switcher.
  useEffect(() => {
    const MAX_AGE_MS = 31 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    setInboxList((prev) => {
      const kept = prev.filter((e) => {
        const t = Date.parse(e?.addedAt ?? "");
        return Number.isNaN(t) || now - t <= MAX_AGE_MS;
      });
      return kept.length === prev.length ? prev : kept;
    });
  }, [setInboxList]);

  const switchToInbox = useCallback((email: string) => {
    setActiveEmailRaw(email);
  }, [setActiveEmailRaw]);

  // Ambil daftar email milik akun dari server saat login
  useEffect(() => {
    if (!user) {
      setServerEmails([]);
      return;
    }
    let cancelled = false;
    userFetch("/api/user/emails")
      .then((d) => {
        if (cancelled) return;
        const list = ((d?.emails || []) as any[])
          .filter((e) => !e.isExpired)
          .map((e) => e.email as string);
        setServerEmails(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Kalau login tapi belum ada email aktif, pakai alamat terbaru milik akun
  useEffect(() => {
    if (user && !activeEmail && serverEmails.length > 0) {
      setActiveEmail(serverEmails[0]);
    }
  }, [user, activeEmail, serverEmails, setActiveEmail]);

  // Saat login: klaim alamat guest (localStorage) ke akun agar permanen
  const claimedRef = useRef(false);
  useEffect(() => {
    if (!user) {
      claimedRef.current = false;
      return;
    }
    if (claimedRef.current) return;
    claimedRef.current = true;
    (async () => {
      let claimed = 0;
      try {
        const raw = localStorage.getItem("tempmail_inbox_list");
        const locals = raw ? JSON.parse(raw) : [];
        for (const entry of locals) {
          const em = entry?.email;
          if (!em) continue;
          const token = getManageToken(em);
          if (!token) continue;
          try {
            const r = await userFetch("/api/user/emails/claim", {
              method: "POST",
              body: JSON.stringify({ email: em, manageToken: token }),
            });
            if (r?.claimed) claimed++;
          } catch {
            /* bukan milik browser ini / sudah diklaim / kedaluwarsa */
          }
        }
      } catch {
        /* abaikan */
      }
      if (claimed > 0) {
        toast({ title: `${claimed} email ditautkan ke akun`, description: "Email & riwayat Anda kini tersimpan permanen di akun." });
        try {
          const d = await userFetch("/api/user/emails");
          const list = ((d?.emails || []) as any[])
            .filter((e) => !e.isExpired)
            .map((e) => e.email as string);
          setServerEmails(list);
        } catch {
          /* abaikan */
        }
      }
    })();
  }, [user, toast]);

  // Gabungan email server + lokal untuk switcher (tanpa duplikat)
  const mergedInboxList = useMemo(() => {
    const seen = new Set<string>();
    const out: InboxEntry[] = [];
    for (const em of serverEmails) {
      if (!seen.has(em)) {
        seen.add(em);
        out.push({ email: em, addedAt: new Date().toISOString() });
      }
    }
    for (const e of inboxList) {
      if (!seen.has(e.email)) {
        seen.add(e.email);
        out.push(e);
      }
    }
    return out;
  }, [serverEmails, inboxList]);

  const INBOX_REFETCH_INTERVAL_MS = 5000;
  const { data: inbox, isLoading, isFetching: isFetchingInbox, dataUpdatedAt: inboxUpdatedAt, refetch: refetchInbox } = useGetInbox(
    { email: activeEmail! },
    {
      query: {
        enabled: !!activeEmail && isUnlocked,
        refetchInterval: INBOX_REFETCH_INTERVAL_MS,
        queryKey: getGetInboxQueryKey({ email: activeEmail! }),
      },
    }
  );

  const unreadCount = useMemo(() => inbox?.messages?.filter((m) => !m.isRead).length ?? 0, [inbox]);

  // Tab title badge
  useEffect(() => {
    document.title = unreadCount > 0 ? `(${unreadCount}) TempMail` : "TempMail";
    return () => { document.title = "TempMail"; };
  }, [unreadCount]);

  // New mail notifications
  useEffect(() => {
    if (inbox && inbox.total > prevTotalRef.current) {
      if (prevTotalRef.current > 0) {
        playChime();
        // Haptic feedback for mobile phones (vibrate)
        if (typeof window !== "undefined" && "vibrate" in navigator) {
          try {
            navigator.vibrate([100, 50, 100]);
          } catch {}
        }
        toast({ title: "Email Baru Masuk", description: "Ada pesan baru di inbox Anda." });

        if ("Notification" in window && Notification.permission === "granted") {
          const newCount = inbox.total - prevTotalRef.current;
          new Notification("TempMail — Email Baru!", {
            body: newCount === 1 ? "Ada 1 email baru di inbox Anda." : `Ada ${newCount} email baru di inbox Anda.`,
            icon: "/favicon.ico",
            tag: "tempmail-new-email",
          });
        }
      }
      prevTotalRef.current = inbox.total;
    } else if (inbox && inbox.total < prevTotalRef.current) {
      prevTotalRef.current = inbox.total;
    }
  }, [inbox?.total, playChime, toast]);

  // Reset selected message when email changes
  useEffect(() => {
    setSelectedMessageId(null);
    prevTotalRef.current = 0;
  }, [activeEmail]);

  const handleRefreshInbox = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey({ email: activeEmail! }) });
    refetchInbox();
  }, [queryClient, activeEmail, refetchInbox]);

  const handleMarkAllRead = useCallback(() => {
    if (!activeEmail || !inbox?.messages) return;
    const unread = inbox.messages.filter((m) => !m.isRead);
    if (unread.length === 0) return;
    unread.forEach((m) => {
      markReadMutation.mutate({ data: { id: m.id, email: activeEmail } });
    });
    setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey({ email: activeEmail }) });
      queryClient.invalidateQueries({ queryKey: getGetEmailStatsQueryKey({ email: activeEmail }) });
    }, 200);
    toast({ title: `${unread.length} pesan ditandai dibaca` });
  }, [activeEmail, inbox?.messages, markReadMutation, queryClient, toast]);

  const handleClearInbox = useCallback(() => {
    if (!activeEmail || !inbox?.messages || inbox.messages.length === 0) return;
    if (window.confirm("Yakin ingin menghapus semua pesan di kotak masuk ini?")) {
      resetInboxMutation.mutate(
        { params: { email: activeEmail } },
        {
          onSuccess: () => {
            setSelectedMessageId(null);
            queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey({ email: activeEmail }) });
            queryClient.invalidateQueries({ queryKey: getGetEmailStatsQueryKey({ email: activeEmail }) });
            toast({ title: "Kotak masuk dikosongkan" });
          },
          onError: () => {
            toast({ title: "Gagal mengosongkan inbox", variant: "destructive" });
          },
        }
      );
    }
  }, [activeEmail, inbox?.messages, resetInboxMutation, queryClient, toast]);

  // Keyboard shortcuts
  useKeyboardShortcuts(
    useMemo(() => ({
      "r": () => handleRefreshInbox(),
      "ctrl+shift+c": () => {
        if (activeEmail) {
          navigator.clipboard.writeText(activeEmail);
          toast({ title: "Disalin!", description: activeEmail, duration: 2000 });
        }
      },
      "escape": () => setSelectedMessageId(null),
    }), [handleRefreshInbox, activeEmail, toast])
  );

  const handleSelectMessage = useCallback((id: string) => {
    setSelectedMessageId(id);
  }, []);

  const handleBackFromMessage = useCallback(() => {
    setSelectedMessageId(null);
  }, []);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      {/* Subtle top gradient */}
      <div className="fixed inset-x-0 top-0 h-64 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none z-0" />

      {/* PIN Lock Screen */}
      {hasPin && !isUnlocked && (
        <PinLock onVerify={verifyPin} />
      )}

      <Header
        rightSlot={
          <div className="hidden sm:block">
            <InboxSwitcher
              activeEmail={activeEmail}
              inboxList={mergedInboxList}
              onSwitch={switchToInbox}
              onAdd={() => setGenerateRequest((n) => n + 1)}
              onRemove={removeFromList}
            />
          </div>
        }
        mobileSlot={
          <div className="sm:hidden">
            <InboxSwitcher
              compact
              activeEmail={activeEmail}
              inboxList={mergedInboxList}
              onSwitch={switchToInbox}
              onAdd={() => setGenerateRequest((n) => n + 1)}
              onRemove={removeFromList}
            />
          </div>
        }
      />

      {/* ── MOBILE LAYOUT (< lg) ── */}
      <div className="lg:hidden flex-1 flex flex-col relative w-full md:max-w-3xl md:mx-auto">

        {/* Mobile: message viewer — compact bottom-sheet modal / dialog (sentuh luar untuk tutup) */}
        {selectedMessageId && (
          <div
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end sm:justify-center p-0 sm:p-4 cursor-pointer"
            onClick={handleBackFromMessage}
          >
            <div
              className="bg-card w-full sm:max-w-2xl sm:rounded-2xl rounded-t-2xl border border-border shadow-2xl flex flex-col overflow-hidden overscroll-contain max-h-[88vh] sm:max-h-[82vh] animate-in slide-in-from-bottom-4 duration-200 cursor-default pb-[env(safe-area-inset-bottom)]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Drag handle pill bar on top of modal */}
              <div className="w-full flex justify-center pt-2 pb-1 sm:hidden">
                <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
              </div>
              <MessageViewer
                messageId={selectedMessageId}
                email={activeEmail!}
                onBack={handleBackFromMessage}
              />
            </div>
          </div>
        )}

        {/* Mobile: single scrollable page — email pane + inbox stacked */}
        <div className="flex-1 overflow-y-auto pb-6">
          {/* Email / Generate section */}
          <div className="p-3 pb-0 w-full max-w-full box-border" id="section-email">
            <EmailPane
              activeEmail={activeEmail}
              setActiveEmail={setActiveEmail}
              hasPin={hasPin}
              onSetupPin={setupPin}
              onRemovePin={removePin}
              onLock={lock}
              generateRequest={generateRequest}
              hideTopStatus
            />
          </div>

          {/* Inbox list */}
          <div className="pt-1 pb-3 w-full max-w-full box-border overflow-hidden" id="section-inbox">
            <InboxList
              email={activeEmail || ""}
              onDeselectMessage={handleBackFromMessage}
              messages={inbox?.messages || []}
              isLoading={isLoading && !!activeEmail}
              isFetching={isFetchingInbox}
              dataUpdatedAt={inboxUpdatedAt}
              refetchIntervalMs={INBOX_REFETCH_INTERVAL_MS}
              isAutoRefreshEnabled={!!activeEmail && isUnlocked}
              selectedMessageId={selectedMessageId}
              onSelectMessage={handleSelectMessage}
              onRefresh={handleRefreshInbox}
              onMarkAllRead={handleMarkAllRead}
              notifPermission={notifPermission}
              onRequestNotif={requestNotifPermission}
            />
          </div>
        </div>
      </div>

      {/* Sticky CTA mobile: Buat Email Baru selalu terjangkau saat scroll */}
      {!activeEmail && (
        <div
          className="lg:hidden sticky bottom-0 z-20 px-4 bg-gradient-to-t from-background via-background/95 to-transparent"
          style={{ paddingTop: "0.75rem", paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))" }}
        >
          <button
            type="button"
            onClick={() => setGenerateRequest((n) => n + 1)}
            className="w-full h-12 rounded-2xl bg-primary text-primary-foreground text-sm font-bold shadow-lg active:scale-[0.98] transition-transform flex items-center justify-center gap-2 cursor-pointer"
          >
            <Zap className="h-4 w-4" />
            Buat Email Baru
          </button>
        </div>
      )}

      {/* ── DESKTOP LAYOUT (≥ lg) ── */}
      <main className="relative z-10 flex-1 container max-w-7xl mx-auto p-4 md:p-5 hidden lg:grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* Left: Address + Stats + Security */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-3">
          <EmailPane
            activeEmail={activeEmail}
            setActiveEmail={setActiveEmail}
            hasPin={hasPin}
            onSetupPin={setupPin}
            onRemovePin={removePin}
            onLock={lock}
            generateRequest={generateRequest}
          />
        </div>

        {/* Right: Inbox list + Viewer */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col lg:flex-row gap-4 min-h-[500px]">

          <div className={`w-full lg:w-[340px] xl:w-[380px] flex-shrink-0 flex flex-col ${selectedMessageId ? "hidden lg:flex" : "flex"}`}>
            <InboxList
              email={activeEmail || ""}
              onDeselectMessage={handleBackFromMessage}
              messages={inbox?.messages || []}
              isLoading={isLoading && !!activeEmail}
              isFetching={isFetchingInbox}
              dataUpdatedAt={inboxUpdatedAt}
              refetchIntervalMs={INBOX_REFETCH_INTERVAL_MS}
              isAutoRefreshEnabled={!!activeEmail && isUnlocked}
              selectedMessageId={selectedMessageId}
              onSelectMessage={setSelectedMessageId}
              onRefresh={handleRefreshInbox}
              onMarkAllRead={handleMarkAllRead}
              onClearInbox={handleClearInbox}
              notifPermission={notifPermission}
              onRequestNotif={requestNotifPermission}
            />
          </div>

          <div className={`w-full flex-1 flex flex-col ${!selectedMessageId ? "hidden lg:flex" : "flex"}`}>
            {selectedMessageId ? (
              <MessageViewer
                messageId={selectedMessageId}
                email={activeEmail!}
                onBack={() => setSelectedMessageId(null)}
              />
            ) : (
              <div className="hidden lg:flex flex-col items-center justify-center h-full rounded-2xl border border-dashed border-border/60 bg-card/30 text-center p-10 gap-5">
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/10 rounded-full blur-xl" />
                  <div className="relative bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-5 rounded-2xl">
                    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                      <rect width="20" height="16" x="2" y="4" rx="2" />
                      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                    </svg>
                  </div>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-foreground">Pilih pesan untuk dibaca</h3>
                  <p className="text-muted-foreground mt-1 text-sm max-w-xs">
                    Inbox aktif dan siap menerima email. Pesan masuk akan muncul otomatis di sisi kiri.
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground pt-1 border-t border-border/40 w-full max-w-sm">
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">R</kbd>
                    Refresh
                  </span>
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">Ctrl+Shift+C</kbd>
                    Salin email
                  </span>
                  <span className="flex items-center gap-1.5">
                    <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono text-[10px]">Esc</kbd>
                    Tutup pesan
                  </span>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>

      <footer className="relative z-10 border-t border-border/60 py-4 px-6 mt-auto bg-background/80 backdrop-blur hidden lg:block">
        <div className="container max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} TempMail — Layanan email sementara gratis.</span>
          <div className="flex items-center gap-4">
            <Link href="/tentang" className="hover:text-foreground transition-colors">Tentang</Link>
            <Link href="/status" className="hover:text-foreground transition-colors inline-flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Status
            </Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Kebijakan Privasi</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Syarat Layanan</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
