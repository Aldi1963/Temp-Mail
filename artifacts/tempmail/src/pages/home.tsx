import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Link } from "wouter";
import { Inbox, Mail } from "lucide-react";
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
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"inbox" | "email">("inbox");

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
    setInboxList((prev) => prev.filter((e) => e.email !== email));
    if (activeEmail === email) {
      const remaining = inboxList.filter((e) => e.email !== email);
      setActiveEmailRaw(remaining.length > 0 ? remaining[0].email : null);
    }
  }, [activeEmail, inboxList, setActiveEmailRaw, setInboxList]);

  const switchToInbox = useCallback((email: string) => {
    setActiveEmailRaw(email);
  }, [setActiveEmailRaw]);

  const { data: inbox, isLoading, refetch: refetchInbox } = useGetInbox(
    { email: activeEmail! },
    {
      query: {
        enabled: !!activeEmail && isUnlocked,
        refetchInterval: 5000,
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
          <InboxSwitcher
            activeEmail={activeEmail}
            inboxList={inboxList}
            onSwitch={switchToInbox}
            onAdd={() => setActiveEmailRaw(null)}
            onRemove={removeFromList}
          />
        }
      />

      {/* ── MOBILE LAYOUT (< lg) ── */}
      <div className="lg:hidden flex-1 flex flex-col relative">

        {/* Mobile: message viewer — full-screen overlay when message selected */}
        {selectedMessageId && (
          <div className="absolute inset-0 z-20 bg-background flex flex-col pb-16">
            <MessageViewer
              messageId={selectedMessageId}
              email={activeEmail!}
              onBack={handleBackFromMessage}
            />
          </div>
        )}

        {/* Mobile: tab content area */}
        <div className="flex-1 overflow-y-auto pb-20">
          {mobileTab === "inbox" ? (
            <div className="p-3 h-full min-h-[60vh]">
              <InboxList
                messages={inbox?.messages || []}
                isLoading={isLoading && !!activeEmail}
                selectedMessageId={selectedMessageId}
                onSelectMessage={handleSelectMessage}
                onRefresh={handleRefreshInbox}
                onMarkAllRead={handleMarkAllRead}
                notifPermission={notifPermission}
                onRequestNotif={requestNotifPermission}
              />
            </div>
          ) : (
            <div className="p-3">
              <EmailPane
                activeEmail={activeEmail}
                setActiveEmail={setActiveEmail}
                hasPin={hasPin}
                onSetupPin={setupPin}
                onRemovePin={removePin}
                onLock={lock}
              />
            </div>
          )}
        </div>

        {/* Mobile Bottom Navigation */}
        <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 safe-area-pb">
          <div className="flex h-16">
            <button
              className={`flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors relative ${
                mobileTab === "inbox"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMobileTab("inbox")}
            >
              {mobileTab === "inbox" && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-10 rounded-full bg-primary" />
              )}
              <div className="relative">
                <Inbox className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-2 h-4 min-w-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </div>
              <span>Inbox</span>
            </button>

            <button
              className={`flex-1 flex flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors relative ${
                mobileTab === "email"
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => setMobileTab("email")}
            >
              {mobileTab === "email" && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-10 rounded-full bg-primary" />
              )}
              <Mail className="h-5 w-5" />
              <span>Alamat</span>
            </button>
          </div>
        </nav>
      </div>

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
          />
        </div>

        {/* Right: Inbox list + Viewer */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col lg:flex-row gap-4 min-h-[500px]">

          <div className={`w-full lg:w-[340px] xl:w-[380px] flex-shrink-0 flex flex-col ${selectedMessageId ? "hidden lg:flex" : "flex"}`}>
            <InboxList
              messages={inbox?.messages || []}
              isLoading={isLoading && !!activeEmail}
              selectedMessageId={selectedMessageId}
              onSelectMessage={setSelectedMessageId}
              onRefresh={handleRefreshInbox}
              onMarkAllRead={handleMarkAllRead}
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
            <Link href="/privacy" className="hover:text-foreground transition-colors">Kebijakan Privasi</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Syarat Layanan</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
