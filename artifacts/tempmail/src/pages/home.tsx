import { useState, useEffect, useRef, useCallback, useMemo } from "react";
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

  const { playChime } = useSound();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const prevTotalRef = useRef<number>(0);

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

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
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

      <main className="flex-1 container max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">

        {/* Left: Address + Stats + Security */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-4">
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
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col lg:flex-row gap-6 min-h-[500px]">

          <div className={`w-full lg:w-[350px] xl:w-[400px] flex-shrink-0 flex flex-col ${selectedMessageId ? "hidden lg:flex" : "flex"}`}>
            <InboxList
              messages={inbox?.messages || []}
              isLoading={isLoading && !!activeEmail}
              selectedMessageId={selectedMessageId}
              onSelectMessage={setSelectedMessageId}
              onRefresh={handleRefreshInbox}
              onMarkAllRead={handleMarkAllRead}
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
              <div className="hidden lg:flex flex-col items-center justify-center h-full bg-card/50 rounded-lg border border-border/50 text-center p-8">
                <div className="bg-muted p-6 rounded-full mb-6">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-foreground">Belum ada pesan dipilih</h3>
                <p className="text-muted-foreground mt-2 max-w-sm text-sm">
                  Pilih pesan dari daftar untuk membacanya. Email sementara Anda aktif dan siap menerima pesan.
                </p>
                <div className="mt-6 flex flex-wrap justify-center gap-3 text-xs text-muted-foreground">
                  <kbd className="px-2 py-1 rounded bg-muted border border-border font-mono">R</kbd>
                  <span>Refresh inbox</span>
                  <span className="mx-2">·</span>
                  <kbd className="px-2 py-1 rounded bg-muted border border-border font-mono">Ctrl+Shift+C</kbd>
                  <span>Salin email</span>
                  <span className="mx-2">·</span>
                  <kbd className="px-2 py-1 rounded bg-muted border border-border font-mono">Esc</kbd>
                  <span>Tutup pesan</span>
                </div>
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
