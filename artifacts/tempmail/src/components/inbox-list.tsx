import { format } from "date-fns";
import {
  Search, Mail, MailOpen, AlertCircle, RefreshCw, CheckCheck,
  ArrowUpDown, Bell, BellOff, KeyRound, Copy, Check, Star, Trash2,
  Archive, ArchiveRestore, X
} from "lucide-react";
import { useState, useMemo, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmailMessageSummary } from "@aldi1963/temp-mail-api-client";
import { userFetch } from "@/hooks/use-auth";
import { getManageToken } from "@/lib/manage-token";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface InboxListProps {
  messages: EmailMessageSummary[];
  isLoading: boolean;
  isFetching?: boolean;
  dataUpdatedAt?: number;
  refetchIntervalMs?: number;
  isAutoRefreshEnabled?: boolean;
  selectedMessageId: string | null;
  onSelectMessage: (id: string) => void;
  onRefresh?: () => void;
  onMarkAllRead?: () => void;
  onClearInbox?: () => void;
  notifPermission?: NotificationPermission | "unsupported";
  onRequestNotif?: () => void;
  email: string;
  onDeselectMessage?: () => void;
}

type FilterType = "all" | "unread" | "read";
type SortType = "newest" | "oldest" | "sender";

import { extractOtpFromSummary } from "@/lib/otp";
import { OtpHistory } from "@/components/otp-history";

// Clean preview snippet from MIME junk
function cleanPreviewText(raw: string): string {
  if (!raw) return "";

  let cleaned = raw;

  // Strip headers like "-Content-Type: ...", "Content-Transfer-Encoding: ...", "Received: ...", etc.
  cleaned = cleaned.replace(/^-?Content-Type:[^\n\r]*[\r\n]*/gim, "");
  cleaned = cleaned.replace(/^Content-Transfer-Encoding:[^\n\r]*[\r\n]*/gim, "");
  cleaned = cleaned.replace(/^Received:[^\n\r]*[\r\n]*/gim, "");
  cleaned = cleaned.replace(/^ARC-[^\n\r]*[\r\n]*/gim, "");
  cleaned = cleaned.replace(/^DKIM-[^\n\r]*[\r\n]*/gim, "");
  cleaned = cleaned.replace(/^--[^\n\r]*[\r\n]*/gim, "");

  // If still contains inline Content-Type / Content-Transfer-Encoding in single line preview
  cleaned = cleaned.replace(/--?Content-Type:[^;]+;\s*charset=[^\s]+/gi, "");
  cleaned = cleaned.replace(/Content-Transfer-Encoding:\s*[a-z0-9_-]+/gi, "");
  cleaned = cleaned.replace(/Â\s*/g, ""); // strip non-breaking space artifacts
  cleaned = cleaned.replace(/â\u0080\u008C/g, ""); // strip zero-width non-joiner mojibake (ZWNJ)
  cleaned = cleaned.replace(/[\u200B-\u200D\uFEFF\u00A0]/g, ""); // strip zero-width spaces / preheader padding

  // Collapse whitespaces
  cleaned = cleaned.replace(/\s+/g, " ").trim();

  return cleaned || "Tidak ada cuplikan teks";
}

// Format date exact like Gmail Android app: "26 Sep", "25 Sep", "07:34"
function formatGmailDate(dateStr: string): string {
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    return isToday ? format(d, "HH:mm") : format(d, "d MMM");
  } catch {
    return "";
  }
}

// ── Swipeable row ala Gmail: geser kanan = arsip/kembalikan, geser kiri = hapus ──
function SwipeableInboxRow({
  msg,
  isSelected,
  onSelect,
  onCopyOtp,
  isOtpCopied,
  isStarred,
  onToggleStar,
  onSwipeCommit,
  swipeRightMode,
}: {
  msg: EmailMessageSummary;
  isSelected: boolean;
  onSelect: () => void;
  onCopyOtp: (otp: string) => void;
  isOtpCopied: boolean;
  isStarred: boolean;
  onToggleStar: () => void;
  onSwipeCommit: (id: string, dir: 1 | -1) => void;
  swipeRightMode: "archive" | "unarchive";
}) {
  const [offset, setOffset] = useState(0);
  const [animating, setAnimating] = useState(false);
  const startX = useRef<number | null>(null);
  const startY = useRef<number | null>(null);
  const tracking = useRef(false);
  const suppressClick = useRef(false);
  const rowW = useRef(0);

  const { name, letter, colorClass } = getSenderInfo(msg.from);
  const inlineOtp = extractOtpFromSummary(msg.subject, msg.preview);
  const formattedDate = formatGmailDate(msg.receivedAt);
  const cleanPreview = cleanPreviewText(msg.preview);

  const THRESHOLD = 90;

  const resetTouch = () => {
    startX.current = null;
    startY.current = null;
    tracking.current = false;
  };

  const snapBack = () => {
    setAnimating(true);
    setOffset(0);
    resetTouch();
  };

  const commit = (dir: 1 | -1) => {
    // Balik dulu, lalu minta konfirmasi lewat dialog di parent
    snapBack();
    suppressClick.current = true;
    setTimeout(() => { suppressClick.current = false; }, 500);
    onSwipeCommit(msg.id, dir);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    startX.current = e.touches[0].clientX;
    startY.current = e.touches[0].clientY;
    tracking.current = false;
    rowW.current = (e.currentTarget as HTMLElement).offsetWidth || 300;
    setAnimating(false);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null || startY.current === null) return;
    const dx = e.touches[0].clientX - startX.current;
    const dy = e.touches[0].clientY - startY.current;
    if (!tracking.current) {
      if (Math.abs(dx) < 12) return;
      if (Math.abs(dy) > Math.abs(dx)) { resetTouch(); return; }
      tracking.current = true;
    }
    const w = rowW.current || 300;
    setOffset(Math.max(-w, Math.min(w, dx)));
  };

  const handleTouchEnd = () => {
    if (!tracking.current) { resetTouch(); return; }
    if (offset >= THRESHOLD) commit(1);
    else if (offset <= -THRESHOLD) commit(-1);
    else snapBack();
  };

  const handleClick = (e: React.MouseEvent) => {
    if (suppressClick.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    onSelect();
  };

  const revealLeft = offset > 12;
  const revealRight = offset < -12;
  const dragT = Math.min(Math.abs(offset), 120);

  return (
    <div className="relative overflow-hidden">
      {/* Latar kiri: arsip/kembalikan — terlihat saat geser ke kanan */}
      <div
        className="absolute inset-0 flex items-center bg-[#188038] text-white transition-opacity duration-150"
        style={{ opacity: revealLeft ? 1 : 0 }}
      >
        <div className="flex items-center gap-2 pl-5" style={{ transform: `translateX(${dragT * 0.35}px)` }}>
          {swipeRightMode === "archive" ? <Archive className="h-5 w-5" /> : <ArchiveRestore className="h-5 w-5" />}
          <span className="text-sm font-semibold">{swipeRightMode === "archive" ? "Arsipkan" : "Kembalikan"}</span>
        </div>
      </div>
      {/* Latar kanan: hapus — terlihat saat geser ke kiri */}
      <div
        className="absolute inset-0 flex items-center justify-end bg-[#d93025] text-white transition-opacity duration-150"
        style={{ opacity: revealRight ? 1 : 0 }}
      >
        <div className="flex items-center gap-2 pr-5" style={{ transform: `translateX(${-dragT * 0.35}px)` }}>
          <span className="text-sm font-semibold">Hapus</span>
          <Trash2 className="h-5 w-5" />
        </div>
      </div>

      {/* Baris pesan (foreground, bisa digeser) */}
      <div
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={snapBack}
        onClick={handleClick}
        style={{
          transform: `translateX(${offset}px)`,
          transition: animating ? "transform 0.2s ease-out" : "none",
        }}
        className="relative bg-background"
      >
      <div
        className={`w-full max-w-full box-border text-left px-3 sm:px-4 py-2.5 sm:py-3 min-h-[72px] hover:bg-muted/30 transition-colors flex items-start gap-3 relative cursor-pointer group ${
          isSelected ? "bg-muted/50" : ""
        } ${!msg.isRead ? "bg-primary/[0.03]" : ""}`}
      >
        {/* Gmail Solid Circular Avatar */}
        <div className={`shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm shadow-xs ${colorClass} mt-0.5`}>
          {letter}
        </div>

        {/* Gmail Message Body Grid: Ringkas, Bersih & Minimalis */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {/* Baris 1: Nama Pengirim + Waktu */}
          <div className="flex items-center justify-between gap-2 w-full">
            <span className={`text-xs sm:text-sm truncate flex-1 min-w-0 ${!msg.isRead ? "font-bold text-foreground" : "font-normal text-foreground/80"}`}>
              {name}
            </span>
            <span className={`text-xs whitespace-nowrap shrink-0 ${!msg.isRead ? "font-bold text-primary" : "text-muted-foreground"}`}>
              {formattedDate}
            </span>
          </div>

          {/* Baris 2: Subjek Pesan Saja (Ringkas & Terpotong Rapi) + Bintang */}
          <div className="flex items-center justify-between gap-2 mt-0.5 w-full">
            <p className={`text-xs truncate flex-1 min-w-0 ${!msg.isRead ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
              {msg.subject || "(tanpa subjek)"}
            </p>

            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar();
              }}
              className="p-1 text-muted-foreground hover:text-amber-400 transition-colors cursor-pointer shrink-0"
              title={isStarred ? "Bintang aktif" : "Tandai berbintang"}
            >
              <Star className={`h-3.5 w-3.5 ${isStarred ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30 hover:text-muted-foreground"}`} />
            </span>
          </div>

          {/* Baris 3 (Hanya jika ada OTP): Badge OTP Minimalis 1-Klik */}
          {inlineOtp && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] uppercase font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-md font-mono">
                OTP: {inlineOtp}
              </span>
              <button
                type="button"
                onClick={() => onCopyOtp(inlineOtp)}
                className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-1 py-0.5 px-2 bg-background rounded-md border border-border/80 shadow-2xs active:scale-95 cursor-pointer"
              >
                {isOtpCopied ? <Check className="h-2.5 w-2.5 text-green-500" /> : <Copy className="h-2.5 w-2.5" />}
                {isOtpCopied ? "Tersalin" : "Salin"}
              </button>
            </div>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

// Authentic Gmail Material Avatar Solid Colors (Matching Gmail Android App)
function getSenderInfo(fromStr: string) {
  let name = fromStr.split("<")[0].trim().replace(/['"]/g, "");
  let email = fromStr;
  const match = fromStr.match(/<([^>]+)>/);
  if (match) {
    email = match[1];
  }

  // Jika nama masih berupa email panjang atau hash SES (e.g. 010001a0dda... @mail.canva.com)
  if (!name || name === email || name.length > 25 || name.includes("@")) {
    const domainPart = email.split("@")[1] || "";
    if (domainPart.includes("canva.com")) name = "Canva";
    else if (domainPart.includes("google.com") || email.includes("google")) name = "Google";
    else if (domainPart.includes("tiktok.com")) name = "TikTok";
    else if (domainPart.includes("instagram.com")) name = "Instagram";
    else if (domainPart.includes("facebookmail.com")) name = "Facebook";
    else if (domainPart.includes("github.com")) name = "GitHub";
    else if (domainPart.includes("telegram.org")) name = "Telegram";
    else {
      // Ambil bagian depan sebelum titik/angka
      const rawUser = email.split("@")[0];
      name = rawUser.replace(/[^a-zA-Z\s]/g, " ").trim();
      if (!name) name = domainPart.split(".")[0];
    }
  }

  // Capitalize name
  name = name.charAt(0).toUpperCase() + name.slice(1);
  const letter = (name[0] || "E").toUpperCase();

  // Solid background colors identical to Gmail Android App
  const colors = [
    "bg-[#d93025] text-white", // Google Red
    "bg-[#1a73e8] text-white", // Google Blue
    "bg-[#188038] text-white", // Google Green
    "bg-[#e37400] text-white", // Google Orange
    "bg-[#a142f4] text-white", // Google Purple
    "bg-[#12b5cb] text-white", // Google Teal
    "bg-[#fa7b17] text-white", // Google Amber
    "bg-[#c2185b] text-white", // Pink
    "bg-[#00897b] text-white", // Emerald
  ];
  const charCode = letter.charCodeAt(0) || 0;
  const colorClass = colors[charCode % colors.length];

  return { name, email, letter, colorClass };
}

export function InboxList({
  messages,
  isLoading,
  isFetching,
  dataUpdatedAt,
  refetchIntervalMs,
  isAutoRefreshEnabled = true,
  selectedMessageId,
  onSelectMessage,
  onRefresh,
  onMarkAllRead,
  onClearInbox,
  notifPermission,
  onRequestNotif,
  email,
  onDeselectMessage,
}: InboxListProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("newest");
  const [search, setSearch] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState<number>(() => Date.now());

  // Only run the 1s ticker when there's actually a polling indicator to render.
  // Avoids redundant per-second re-renders in the hidden mobile/desktop variant
  // and when polling is paused (e.g., PIN-locked, no active inbox).
  const tickerActive =
    isAutoRefreshEnabled && !!refetchIntervalMs && !!dataUpdatedAt;

  useEffect(() => {
    if (!tickerActive) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [tickerActive]);

  const refreshStatus = useMemo(() => {
    if (!isAutoRefreshEnabled || !refetchIntervalMs || !dataUpdatedAt) return null;
    if (isFetching) {
      return { state: "fetching" as const, label: "Memperbarui inbox..." };
    }
    const elapsedMs = Math.max(0, now - dataUpdatedAt);
    const elapsedSec = Math.floor(elapsedMs / 1000);
    const remainingMs = refetchIntervalMs - elapsedMs;
    const remainingSec = Math.ceil(remainingMs / 1000);
    const elapsedMin = Math.floor(elapsedSec / 60);
    const elapsedHr = Math.floor(elapsedMin / 60);
    const lastSeen =
      elapsedSec < 5
        ? "baru saja"
        : elapsedSec < 60
        ? `${elapsedSec}d lalu`
        : elapsedMin < 60
        ? `${elapsedMin}m lalu`
        : `${elapsedHr}j lalu`;
    if (remainingSec <= 0) {
      // Past the scheduled refresh — likely tab in background / network throttled.
      return {
        state: "overdue" as const,
        label: `Diperbarui ${lastSeen} · refresh tertunda`,
      };
    }
    return {
      state: "idle" as const,
      label: `Diperbarui ${lastSeen} · refresh dalam ${remainingSec}d`,
    };
  }, [isFetching, dataUpdatedAt, refetchIntervalMs, isAutoRefreshEnabled, now]);

  const unreadCount = useMemo(() => messages.filter((m) => !m.isRead).length, [messages]);

  const [otpOnly, setOtpOnly] = useState(false);

  const filteredMessages = useMemo(() => {
    const sorted = [...messages].sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime());
    if (!otpOnly) return sorted;
    return sorted.filter((m) => extractOtpFromSummary(m.subject, m.preview));
  }, [messages, otpOnly]);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };


  const sortLabel = sort === "newest" ? "Terbaru" : sort === "oldest" ? "Terlama" : "Pengirim";

  const [copiedOtpId, setCopiedOtpId] = useState<string | null>(null);

  const handleCopyOtpInline = (e: React.MouseEvent | null, otp: string, msgId: string) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    navigator.clipboard.writeText(otp);
    setCopiedOtpId(msgId);
    setTimeout(() => setCopiedOtpId(null), 2000);
  };

  const [starredIds, setStarredIds] = useState<Record<string, boolean>>({});

  const toggleStar = (e: React.MouseEvent | null, id: string) => {
    if (e) {
      e.stopPropagation();
      e.preventDefault();
    }
    setStarredIds(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // ── Tab Arsip ala Gmail ──
  const [showArchived, setShowArchived] = useState(false);
  const [archivedMsgs, setArchivedMsgs] = useState<EmailMessageSummary[]>([]);
  const [archivedLoading, setArchivedLoading] = useState(false);
  const { toast } = useToast();

  const visibleMessages = showArchived ? archivedMsgs : filteredMessages;
  const visibleLoading = showArchived ? archivedLoading : isLoading;

  const fetchArchived = async () => {
    if (!email) return;
    setArchivedLoading(true);
    try {
      const data = await userFetch(`/api/email/inbox?email=${encodeURIComponent(email)}&archived=true`);
      const list: EmailMessageSummary[] = Array.isArray(data?.messages) ? data.messages : [];
      setArchivedMsgs([...list].sort((a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()));
    } catch {
      /* abaikan, tampilkan kosong */
    } finally {
      setArchivedLoading(false);
    }
  };

  useEffect(() => {
    if (showArchived) void fetchArchived();
  }, [showArchived]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Cari pesan: kirim q ke endpoint kontrak, fallback filter lokal ──
  const messagesRef = useRef(messages);
  messagesRef.current = messages;
  const archivedRef = useRef(archivedMsgs);
  archivedRef.current = archivedMsgs;
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<EmailMessageSummary[] | null>(null);

  const toSummary = (m: any): EmailMessageSummary => ({
    id: String(m.id ?? ""),
    from: String(m.from ?? m.fromAddress ?? ""),
    subject: String(m.subject ?? ""),
    preview: String(m.preview ?? ""),
    receivedAt: String(m.receivedAt ?? m.received_at ?? new Date().toISOString()),
    isRead: !!m.isRead,
    hasAttachments: !!m.hasAttachments,
  });

  useEffect(() => {
    const q = search.trim();
    if (!q) {
      setSearchResults(null);
      setSearching(false);
      return;
    }
    setSearching(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        if (email) {
          const params = new URLSearchParams({ email, q });
          if (showArchived) params.set("archived", "true");
          const data = await userFetch(`/api/email/inbox?${params.toString()}`);
          const raw = Array.isArray(data)
            ? data
            : Array.isArray((data as any)?.messages)
              ? (data as any).messages
              : null;
          if (!cancelled && raw) {
            setSearchResults(raw.map(toSummary));
            return;
          }
        }
        throw new Error("pakai filter lokal");
      } catch {
        if (cancelled) return;
        const pool = showArchived ? archivedRef.current : messagesRef.current;
        const lq = q.toLowerCase();
        setSearchResults(
          pool.filter(
            (m) =>
              (m.subject || "").toLowerCase().includes(lq) ||
              (m.from || "").toLowerCase().includes(lq) ||
              (m.preview || "").toLowerCase().includes(lq)
          )
        );
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, showArchived, email]);

  const pruneSearch = (id: string) =>
    setSearchResults((prev) => (prev ? prev.filter((m) => m.id !== id) : prev));

  const searchActive = searchResults !== null;
  const listMessages = searchActive ? (searchResults as EmailMessageSummary[]) : visibleMessages;
  const listLoading = searching ? true : visibleLoading;

  // Aksi swipe menunggu konfirmasi dialog dulu
  const [pendingAction, setPendingAction] = useState<{ id: string; dir: 1 | -1 } | null>(null);

  const handleSwipeCommit = (id: string, dir: 1 | -1) => {
    setPendingAction({ id, dir });
  };

  const pendingMsg = pendingAction ? listMessages.find((m) => m.id === pendingAction.id) ?? null : null;
  const pendingKind: "archive" | "unarchive" | "delete" | null = !pendingAction
    ? null
    : pendingAction.dir === 1
      ? (showArchived ? "unarchive" : "archive")
      : "delete";

  const manageHeaders = (): Record<string, string> => {
    const t = email ? getManageToken(email) : null;
    return t ? { "X-Manage-Token": t } : {};
  };

  const requireEmail = (): boolean => {
    if (email) return true;
    toast({ title: "Gagal", description: "Tidak ada alamat aktif.", variant: "destructive" });
    return false;
  };

  const doArchive = async (id: string, toArchived: boolean): Promise<void> => {
    if (!requireEmail()) return;
    try {
      await userFetch("/api/email/message/archive", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...manageHeaders() },
        body: JSON.stringify({ id, email, archived: toArchived }),
      });
      if (showArchived) {
        setArchivedMsgs((prev) => prev.filter((m) => m.id !== id));
      } else {
        onRefresh?.();
      }
      pruneSearch(id);
      if (id === selectedMessageId) onDeselectMessage?.();
      toast({
        title: toArchived ? "Pesan diarsipkan" : "Pesan dikembalikan",
        action: (
          <ToastAction altText="Urungkan" onClick={() => { void doArchive(id, !toArchived); }}>
            Urungkan
          </ToastAction>
        ),
      });
    } catch (e) {
      toast({ title: "Gagal", description: e instanceof Error ? e.message : "Tidak bisa mengarsipkan. Coba lagi.", variant: "destructive" });
    }
  };

  const doDelete = async (id: string): Promise<void> => {
    if (!requireEmail()) return;
    try {
      await userFetch(
        `/api/email/message?id=${encodeURIComponent(id)}&email=${encodeURIComponent(email)}`,
        { method: "DELETE", headers: manageHeaders() }
      );
      if (showArchived) {
        setArchivedMsgs((prev) => prev.filter((m) => m.id !== id));
      } else {
        onRefresh?.();
      }
      pruneSearch(id);
      if (id === selectedMessageId) onDeselectMessage?.();
      toast({ title: "Pesan dihapus" });
    } catch (e) {
      toast({ title: "Gagal", description: e instanceof Error ? e.message : "Tidak bisa menghapus. Coba lagi.", variant: "destructive" });
    }
  };

  const confirmPendingAction = () => {
    if (!pendingAction || !pendingKind) return;
    const { id } = pendingAction;
    setPendingAction(null);
    if (pendingKind === "delete") void doDelete(id);
    else void doArchive(id, pendingKind === "archive");
  };



  return (
    <div
      className="flex flex-col h-full w-full max-w-full overscroll-contain flex-1"
    >
      {/* Header bar: Kotak Masuk ala Gmail */}
      <div className="relative px-4 py-2 flex items-center justify-between">
        {/* Live Radar Sync Bar: bergerak berdenyut saat polling aktif */}
        {isAutoRefreshEnabled && (
          <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-muted/30 overflow-hidden">
            <div className={`h-full bg-primary/80 transition-all ${isFetching ? "w-full animate-pulse" : "w-1/3 animate-[shimmer_2s_infinite]"}`} />
          </div>
        )}

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-full bg-muted/70 p-1">
            <button
              type="button"
              onClick={() => { setShowArchived(false); setOtpOnly(false); }}
              className={`px-3 h-7 rounded-full text-xs font-bold transition-colors cursor-pointer ${!showArchived && !otpOnly ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Kotak Masuk
            </button>
            <button
              type="button"
              onClick={() => { setShowArchived(false); setOtpOnly(true); }}
              className={`px-3 h-7 rounded-full text-xs font-bold transition-colors cursor-pointer ${otpOnly ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              title="Hanya pesan berisi kode OTP"
            >
              OTP
            </button>
            <button
              type="button"
              onClick={() => { setShowArchived(true); setOtpOnly(false); }}
              className={`px-3 h-7 rounded-full text-xs font-bold transition-colors cursor-pointer ${showArchived ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
            >
              Arsip
            </button>
          </div>
          {!showArchived && unreadCount > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary/20 text-primary font-bold">
              {unreadCount} baru
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {!showArchived && unreadCount > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 sm:h-7 sm:w-7 text-muted-foreground hover:text-primary"
              title="Tandai semua dibaca"
              onClick={onMarkAllRead}
            >
              <CheckCheck className="h-3.5 w-3.5" />
            </Button>
          )}

          {!showArchived && messages.length > 0 && onClearInbox && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 sm:h-7 sm:w-7 text-muted-foreground hover:text-destructive"
              title="Kosongkan semua pesan"
              onClick={onClearInbox}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 sm:h-7 sm:w-7 text-muted-foreground hover:text-primary"
            title="Muat ulang inbox (R)"
            onClick={handleRefresh}
          >
            <RefreshCw className={`h-3.5 w-3.5 transition-transform ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
          {!showArchived && messages.length > 0 && (
            <OtpHistory messages={messages} />
          )}
        </div>
      </div>

      {/* Cari pesan */}
      <div className="px-3 sm:px-4 pt-1 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pesan..."
            className="h-8 pl-8 pr-8 text-xs"
            aria-label="Cari pesan"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch("")}
              title="Hapus pencarian"
              aria-label="Hapus pencarian"
              className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
        {searchActive && (
          <p className="text-[11px] text-muted-foreground mt-1.5 px-0.5 truncate">
            {searching ? (
              "Mencari..."
            ) : (
              <>Hasil untuk <span className="font-semibold text-foreground">"{search.trim()}"</span> — {listMessages.length} pesan</>
            )}
          </p>
        )}
      </div>

      <ScrollArea className="flex-1 w-full max-w-full overflow-hidden">
        {listLoading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse flex items-center gap-3 py-2">
                <div className="h-10 w-10 rounded-full bg-muted shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                </div>
              </div>
            ))}
          </div>
        ) : listMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[260px] text-center px-4">
            <div className="bg-primary/10 p-4 rounded-full mb-3 text-primary border border-primary/20">
              {searchActive ? <Search className="h-7 w-7" /> : showArchived ? <Archive className="h-7 w-7" /> : <Mail className="h-7 w-7 animate-pulse" />}
            </div>
            <h3 className="text-sm font-semibold text-foreground">
              {searchActive ? "Tidak ada hasil" : showArchived ? "Arsip kosong" : "Menunggu email masuk..."}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
              {searchActive
                ? <>Tidak ada pesan yang cocok dengan <span className="font-semibold text-foreground">"{search.trim()}"</span>.</>
                : showArchived
                  ? "Geser pesan ke kanan untuk mengarsipkannya."
                  : "Email yang dikirim ke alamat di atas akan muncul otomatis di sini tanpa reload."}
            </p>
            {searchActive && (
              <Button size="sm" variant="outline" className="mt-3" onClick={() => setSearch("")}>
                Hapus pencarian
              </Button>
            )}
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {listMessages.map((msg) => (
              <SwipeableInboxRow
                key={msg.id}
                msg={msg}
                isSelected={selectedMessageId === msg.id}
                onSelect={() => onSelectMessage(msg.id)}
                onCopyOtp={(otp) => handleCopyOtpInline(null, otp, msg.id)}
                isOtpCopied={copiedOtpId === msg.id}
                isStarred={!!starredIds[msg.id]}
                onToggleStar={() => toggleStar(null, msg.id)}
                onSwipeCommit={handleSwipeCommit}
                swipeRightMode={showArchived ? "unarchive" : "archive"}
              />
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Dialog konfirmasi arsip/hapus ala Gmail */}
      <AlertDialog open={!!pendingAction} onOpenChange={(o) => { if (!o) setPendingAction(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingKind === "delete" ? "Hapus pesan ini?" : pendingKind === "archive" ? "Arsipkan pesan ini?" : "Kembalikan pesan?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingKind === "delete" && (
                <>Pesan dari <b>{pendingMsg ? getSenderInfo(pendingMsg.from).name : ""}</b> akan dihapus permanen dan tidak bisa dikembalikan.</>
              )}
              {pendingKind === "archive" && (
                <>Pesan dari <b>{pendingMsg ? getSenderInfo(pendingMsg.from).name : ""}</b> akan dipindah ke tab Arsip.</>
              )}
              {pendingKind === "unarchive" && (
                <>Pesan dari <b>{pendingMsg ? getSenderInfo(pendingMsg.from).name : ""}</b> akan kembali ke Kotak Masuk.</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmPendingAction}
              className={pendingKind === "delete" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              {pendingKind === "delete" ? "Hapus" : pendingKind === "archive" ? "Arsipkan" : "Kembalikan"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
