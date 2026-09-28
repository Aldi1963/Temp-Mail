// State mailbox untuk aplikasi native — logika sama seperti halaman Home web,
// dikemas sebagai hook agar bisa dipakai tab Beranda/Alamat/Lainnya.
import { useState, useEffect, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, userFetch } from "@/hooks/use-auth";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useToast } from "@/hooks/use-toast";
import { saveManageToken } from "@/lib/manage-token";
import { API_BASE_URL } from "@/lib/api-base";
import {
  useGetInbox,
  useMarkMessageRead,
  useResetInbox,
  getGetInboxQueryKey,
  getGetEmailStatsQueryKey,
} from "@aldi1963/temp-mail-api-client";

export interface InboxEntry {
  email: string;
  addedAt: string;
}

// Normalisasi entri daftar alamat: terima objek {email, addedAt} maupun
// string polos / data rusak dari localStorage agar UI tidak pernah rusak.
function normalizeEntry(e: unknown): InboxEntry | null {
  if (typeof e === "string") {
    return e ? { email: e, addedAt: new Date().toISOString() } : null;
  }
  if (e && typeof (e as InboxEntry).email === "string" && (e as InboxEntry).email) {
    const ent = e as InboxEntry;
    return { email: ent.email, addedAt: ent.addedAt ?? new Date().toISOString() };
  }
  return null;
}

const MAX_INBOXES = 5;
const INBOX_REFETCH_INTERVAL_MS = 5000;

export function useNativeMailbox(isUnlocked: boolean) {
  const [activeEmail, setActiveEmailRaw] = useLocalStorage<string | null>("tempmail_active_email", null);
  const [inboxList, setInboxList] = useLocalStorage<InboxEntry[]>("tempmail_inbox_list", []);
  const [serverEmails, setServerEmails] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const markReadMutation = useMarkMessageRead();

  const setActiveEmail = useCallback(
    (email: string) => {
      setActiveEmailRaw(email);
      setInboxList((prev) => {
        if (prev.some((e) => e.email === email)) return prev;
        return [{ email, addedAt: new Date().toISOString() }, ...prev].slice(0, MAX_INBOXES);
      });
    },
    [setActiveEmailRaw, setInboxList]
  );

  // Bersihkan entri lokal yang kedaluwarsa (>31 hari)
  useEffect(() => {
    const MAX_AGE_MS = 31 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    setInboxList((prev) => {
      const kept: InboxEntry[] = [];
      for (const raw of prev) {
        const e = normalizeEntry(raw);
        if (!e) continue;
        const t = Date.parse(e.addedAt ?? "");
        if (Number.isNaN(t) || now - t <= MAX_AGE_MS) kept.push(e);
      }
      return kept.length === prev.length ? prev : kept;
    });
  }, [setInboxList]);

  // Email milik akun dari server
  useEffect(() => {
    if (!user) {
      setServerEmails([]);
      return;
    }
    let cancelled = false;
    userFetch("/api/user/emails")
      .then((d) => {
        if (cancelled) return;
        const list = ((d?.emails || []) as { isExpired?: boolean; email: string }[])
          .filter((e) => !e.isExpired)
          .map((e) => e.email as string);
        setServerEmails(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (user && !activeEmail && serverEmails.length > 0) {
      setActiveEmail(serverEmails[0]);
    }
  }, [user, activeEmail, serverEmails, setActiveEmail]);

  const mergedInboxList = useMemo(() => {
    const seen = new Set<string>();
    const out: InboxEntry[] = [];
    const push = (raw: unknown) => {
      const e = normalizeEntry(raw);
      if (e && !seen.has(e.email)) {
        seen.add(e.email);
        out.push(e);
      }
    };
    for (const em of serverEmails) push(em);
    for (const e of inboxList) push(e);
    return out;
  }, [serverEmails, inboxList]);

  const removeFromList = useCallback(
    (email: string) => {
      const ownedByServer = user != null && serverEmails.includes(email);
      setInboxList((prev) => prev.filter((e) => e.email !== email));
      setServerEmails((prev) => prev.filter((e) => e !== email));
      if (ownedByServer) {
        userFetch("/api/user/emails", {
          method: "DELETE",
          body: JSON.stringify({ email }),
        }).catch(() => {
          toast({ title: "Gagal menghapus permanen", description: "Email bisa muncul lagi setelah reload." });
        });
      }
      if (activeEmail === email) {
        const remaining = mergedInboxList.filter((e) => e.email !== email);
        setActiveEmailRaw(remaining.length > 0 ? remaining[0].email : null);
      }
      toast({ title: "Alamat dihapus dari daftar" });
    },
    [activeEmail, mergedInboxList, setActiveEmailRaw, setInboxList, user, serverEmails, toast]
  );

  const generateEmail = useCallback(
    async (domain?: string, username?: string) => {
      setIsGenerating(true);
      try {
        const params = new URLSearchParams();
        if (domain) params.append("domain", domain);
        if (username) params.append("username", username);
        const res = await fetch(`${API_BASE_URL}/api/email/generate?${params.toString()}`, {
          credentials: "include",
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
        if (data?.email) {
          saveManageToken(data.email, data.manageToken);
          setActiveEmail(data.email);
          try {
            await navigator.clipboard.writeText(data.email);
          } catch {
            /* abaikan */
          }
          toast({ title: "Email baru dibuat & disalin!", description: data.email });
        }
      } catch (err) {
        toast({
          title: "Gagal membuat email",
          description: err instanceof Error ? err.message : "Terjadi kesalahan",
          variant: "destructive",
        });
      } finally {
        setIsGenerating(false);
      }
    },
    [setActiveEmail, toast]
  );

  const {
    data: inbox,
    isLoading: inboxLoading,
    isFetching: inboxFetching,
    refetch: refetchInbox,
  } = useGetInbox(
    { email: activeEmail! },
    {
      query: {
        enabled: !!activeEmail && isUnlocked,
        refetchInterval: INBOX_REFETCH_INTERVAL_MS,
        queryKey: getGetInboxQueryKey({ email: activeEmail! }),
      },
    }
  );

  const unreadCount = useMemo(
    () => inbox?.messages?.filter((m) => !m.isRead).length ?? 0,
    [inbox]
  );

  const refreshInbox = useCallback(() => {
    if (!activeEmail) return;
    queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey({ email: activeEmail }) });
    refetchInbox();
  }, [queryClient, activeEmail, refetchInbox]);

  const markAllRead = useCallback(() => {
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
  }, [activeEmail, inbox?.messages, markReadMutation, queryClient]);

  return {
    activeEmail,
    mergedInboxList,
    setActiveEmail,
    removeFromList,
    generateEmail,
    isGenerating,
    inbox,
    inboxLoading,
    inboxFetching,
    unreadCount,
    refreshInbox,
    markAllRead,
    user,
  };
}

export type NativeMailbox = ReturnType<typeof useNativeMailbox>;
