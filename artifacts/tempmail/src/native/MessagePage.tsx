import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldBan, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { MessageViewer } from "@/components/message-viewer";
import { useGetMessage, getGetInboxQueryKey } from "@aldi1963/temp-mail-api-client";
import { useNativeSettings } from "./settings";
import { nativeFetch, manageHeaders } from "./api";
import { extractQuickOtp } from "./otp";

interface Props {
  messageId: string;
  email: string;
  onBack: () => void;
}

// Halaman baca pesan fullscreen — tanpa popup.
export function MessagePage({ messageId, email, onBack }: Props) {
  const { settings } = useNativeSettings();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [confirmBlock, setConfirmBlock] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const resetTimer = useRef<number | null>(null);

  // Berbagi cache dengan MessageViewer (queryKey sama) agar tidak fetch ganda.
  const { data: message } = useGetMessage(
    { id: messageId, email },
    { query: { enabled: !!messageId && !!email, queryKey: ["message", messageId, email] } }
  );

  const hasOtp = useMemo(() => {
    if (!message) return false;
    return extractQuickOtp(`${message.subject}\n${message.textBody ?? ""}`) !== null;
  }, [message]);

  useEffect(
    () => () => {
      if (resetTimer.current) window.clearTimeout(resetTimer.current);
    },
    []
  );

  const armReset = (setter: (v: boolean) => void) => {
    setter(true);
    if (resetTimer.current) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => {
      setConfirmBlock(false);
      setConfirmDelete(false);
    }, 4000);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey({ email }) });
  };

  const doBlock = async () => {
    const from = message?.from;
    if (!from || !email) return;
    setBusy(true);
    try {
      await nativeFetch("/api/email/blacklist", {
        method: "POST",
        headers: manageHeaders(email),
        body: JSON.stringify({ email, pattern: from }),
      });
      invalidate();
      toast({ title: "Pengirim diblokir", description: from });
      setConfirmBlock(false);
    } catch (e) {
      toast({
        title: "Gagal memblokir",
        description: e instanceof Error ? e.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  // Two-tap confirm: tap pertama mempersenjatai, tap kedua mengeksekusi.
  const armBlock = () => {
    if (confirmBlock) {
      void doBlock();
      return;
    }
    setConfirmDelete(false);
    armReset(setConfirmBlock);
  };

  const doDelete = async () => {
    if (!messageId || !email) return;
    setBusy(true);
    try {
      await nativeFetch(
        `/api/email/message?id=${encodeURIComponent(messageId)}&email=${encodeURIComponent(email)}`,
        { method: "DELETE", headers: manageHeaders(email) }
      );
      invalidate();
      toast({ title: "Pesan dihapus" });
      onBack();
    } catch (e) {
      toast({
        title: "Gagal menghapus",
        description: e instanceof Error ? e.message : "Coba lagi.",
        variant: "destructive",
      });
      setBusy(false);
    }
  };

  const armDelete = () => {
    if (confirmDelete) {
      void doDelete();
      return;
    }
    setConfirmBlock(false);
    armReset(setConfirmDelete);
  };

  const handleBack = () => {
    if (settings.autoDestroyOtp && hasOtp && messageId && email) {
      nativeFetch(
        `/api/email/message?id=${encodeURIComponent(messageId)}&email=${encodeURIComponent(email)}`,
        { method: "DELETE", headers: manageHeaders(email) }
      )
        .then(() => {
          invalidate();
          toast({ title: "Pesan OTP dihapus otomatis" });
        })
        .catch(() => {});
    }
    onBack();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-background flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
        <MessageViewer messageId={messageId} email={email} onBack={handleBack} />
      </div>
      <div
        className="shrink-0 border-t border-border/60 px-4 pt-2 flex gap-2"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <button
          type="button"
          onClick={armDelete}
          disabled={busy}
          className={cn(
            "flex-1 rounded-2xl py-3 mb-2 text-[13.5px] font-bold inline-flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50",
            confirmDelete ? "bg-destructive text-destructive-foreground" : "bg-muted text-foreground"
          )}
        >
          <Trash2 className="h-4 w-4" />
          {busy && confirmDelete ? "Menghapus…" : confirmDelete ? "Ketuk lagi untuk hapus" : "Hapus"}
        </button>
        <button
          type="button"
          onClick={armBlock}
          disabled={busy || !message}
          className={cn(
            "flex-1 rounded-2xl py-3 mb-2 text-[13.5px] font-bold inline-flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-50",
            confirmBlock ? "bg-destructive text-destructive-foreground" : "bg-destructive/10 text-destructive"
          )}
        >
          <ShieldBan className="h-4 w-4" />
          {busy && confirmBlock ? "Memblokir…" : confirmBlock ? "Ketuk lagi untuk blokir" : "Blokir pengirim"}
        </button>
      </div>
    </div>
  );
}
