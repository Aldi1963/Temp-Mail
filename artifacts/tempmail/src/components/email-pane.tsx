import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Copy, RefreshCw, Trash2, Clock, Inbox, ChevronDown, Mail,
  Timer, Pencil, Check, X, Lock, Unlock, Shield, ShieldOff, KeyRound, Minus, QrCode,
  Zap, ArrowRight, Send, ChevronRight, Shuffle, Flame
} from "lucide-react";
import { useBranding } from "@/hooks/use-branding";
import { useAuth, userFetch } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { saveManageToken, getManageToken, clearManageToken } from "@/lib/manage-token";
import { QRCodeSVG } from "qrcode.react";
import {
  useGenerateEmail,
  useGetAvailableDomains,
  useGetEmailStats,
  useResetInbox,
  useExtendEmail,
  useGetBlacklist,
  useRemoveFromBlacklist,
  getGetEmailStatsQueryKey,
  getGetInboxQueryKey,
  getGetBlacklistQueryKey,
} from "@workspace/api-client-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Separator } from "@/components/ui/separator";

interface EmailPaneProps {
  activeEmail: string | null;
  setActiveEmail: (email: string) => void;
  hasPin: boolean;
  onSetupPin: (pin: string) => Promise<void>;
  onRemovePin: () => void;
  onLock: () => void;
  generateRequest?: number;
  /** Sembunyikan status bar atas; info tanggal berakhir pindah ke footer */
  hideTopStatus?: boolean;
}

function generateRandomUsername(length = 8): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function EmailPane({
  activeEmail,
  setActiveEmail,
  hasPin,
  onSetupPin,
  onRemovePin,
  onLock,
  generateRequest,
  hideTopStatus,
}: EmailPaneProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDomain, setSelectedDomain] = useState<string | undefined>();
  const [generateTrigger, setGenerateTrigger] = useState(0);
  const [pendingDomain, setPendingDomain] = useState<string | undefined>();
  const [pendingUsername, setPendingUsername] = useState<string | undefined>();

  const [editingUsername, setEditingUsername] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [qrOpen, setQrOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  // PIN dialog state
  const [pinDialogOpen, setPinDialogOpen] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [pinStep, setPinStep] = useState<"enter" | "confirm">("enter");

  const [, navigate] = useLocation();
  const { branding } = useBranding();
  const { user, refetch: refetchUser } = useAuth();
  const [telegramDialogOpen, setTelegramDialogOpen] = useState(false);
  const [telegramChatInput, setTelegramChatInput] = useState("");
  const [savingTelegram, setSavingTelegram] = useState(false);

  const openTelegramModal = () => {
    if (!user) {
      toast({
        title: "Mengarahkan ke Login",
        description: "Silakan login terlebih dahulu untuk menghubungkan notifikasi Telegram.",
      });
      navigate("/login");
      return;
    }
    setTelegramChatInput(user.telegramChatId || "");
    setTelegramDialogOpen(true);
  };

  const handleSaveTelegramChatId = async () => {
    setSavingTelegram(true);
    try {
      const data = await userFetch("/api/user/telegram", {
        method: "PATCH",
        body: JSON.stringify({ chatId: telegramChatInput.trim() }),
      });
      await refetchUser();
      setTelegramDialogOpen(false);
      toast({ title: "Berhasil!", description: data.message });
    } catch (err: any) {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    } finally {
      setSavingTelegram(false);
    }
  };

  const { data: domainsData } = useGetAvailableDomains({
    query: {
      queryKey: ["getAvailableDomains"],
      refetchOnWindowFocus: true,
      staleTime: 5000,
    },
  });
  const resetMutation = useResetInbox();
  const manageToken = activeEmail ? getManageToken(activeEmail) : null;
  const tokenRequest = manageToken ? { headers: { "X-Manage-Token": manageToken } } : {};
  const extendMutation = useExtendEmail({ request: tokenRequest });
  const removeFromBlacklistMutation = useRemoveFromBlacklist({ request: tokenRequest });

  const { data: stats, refetch: refetchStats } = useGetEmailStats(
    { email: activeEmail ?? "" },
    { query: { queryKey: ["getEmailStats", activeEmail], enabled: !!activeEmail, refetchInterval: 5000 } }
  );

  const { data: blacklistData, refetch: refetchBlacklist } = useGetBlacklist(
    { email: activeEmail ?? "" },
    { query: { queryKey: ["getBlacklist", activeEmail], enabled: !!activeEmail } }
  );

  const { data: generatedEmailData, isFetching: isGenerating } = useGenerateEmail(
    { domain: pendingDomain || selectedDomain, username: pendingUsername },
    {
      query: {
        enabled: generateTrigger > 0,
        staleTime: 0,
        gcTime: 0,
        queryKey: ["/api/email/generate", { domain: pendingDomain || selectedDomain, username: pendingUsername }, generateTrigger],
      },
    }
  );

  useEffect(() => {
    if (generatedEmailData?.email) {
      saveManageToken(generatedEmailData.email, (generatedEmailData as any).manageToken);
      setActiveEmail(generatedEmailData.email);
      navigator.clipboard.writeText(generatedEmailData.email).catch(() => {});
      toast({
        title: "Email baru dibuat & disalin!",
        description: generatedEmailData.email,
      });
    }
  }, [generatedEmailData?.email]);

  const [timeLeft, setTimeLeft] = useState<string>("--:--");

  useEffect(() => {
    if (!stats?.expiresAt) {
      setTimeLeft("--:--");
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(stats.expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft("Kadaluarsa");
        return;
      }

      const h = Math.floor(diff / (1000 * 60 * 60));
      const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const s = Math.floor((diff % (1000 * 60)) / 1000);
      setTimeLeft(h > 0 ? `${h}j ${m}m ${s}d` : `${m}m ${s}d`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [stats?.expiresAt]);

  const domains = domainsData?.domains || [];

  const [isBurning, setIsBurning] = useState(false);
  const [burnConfirmOpen, setBurnConfirmOpen] = useState(false);
  const [isGeneratingManual, setIsGeneratingManual] = useState(false);

  const handleBurnEmail = async () => {
    if (!activeEmail) return;
    setBurnConfirmOpen(false);
    setIsBurning(true);
    try {
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const manageToken = getManageToken(activeEmail);
      const res = await fetch(`${base}/api/email/destroy?email=${encodeURIComponent(activeEmail)}`, {
        method: "DELETE",
        headers: manageToken ? { "X-Manage-Token": manageToken } : {},
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Gagal memusnahkan email");
      clearManageToken(activeEmail);
      toast({ title: "Email Dimusnahkan!", description: data.message });
      // Buat email acak baru segera
      handleGenerate();
    } catch (err: any) {
      toast({ title: "Gagal", description: err.message, variant: "destructive" });
    } finally {
      setIsBurning(false);
    }
  };

  const handleGenerate = async (domain?: string, username?: string) => {
    setIsGeneratingManual(true);
    const dom = domain || selectedDomain || (domains.length > 0 ? domains[0] : undefined);
    const params = new URLSearchParams();
    if (dom) params.append("domain", dom);
    if (username) params.append("username", username);

    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    const url = `${base}/api/email/generate?${params.toString()}`;

    try {
      const res = await fetch(url, { credentials: "include" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.message || `HTTP ${res.status}`);
      }
      if (data?.email) {
        saveManageToken(data.email, data.manageToken);
        setActiveEmail(data.email);
        navigator.clipboard.writeText(data.email).catch(() => {});
        toast({
          title: "Email baru dibuat & disalin!",
          description: data.email,
        });
      }
    } catch (err: unknown) {
      toast({
        title: "Gagal membuat email",
        description: err instanceof Error ? err.message : "Terjadi kesalahan",
        variant: "destructive",
      });
    } finally {
      setIsGeneratingManual(false);
    }
  };

  const [customModalOpen, setCustomModalOpen] = useState(false);
  const [customUsernameOnly, setCustomUsernameOnly] = useState("");
  const [customDomainChoice, setCustomDomainChoice] = useState<string>("");
  const [domainDropOpen, setDomainDropOpen] = useState(false);
  const domainDropRef = useRef<HTMLDivElement>(null);

  // Tutup dropdown domain saat klik di luar
  useEffect(() => {
    if (!domainDropOpen) return;
    const onDown = (e: MouseEvent) => {
      if (domainDropRef.current && !domainDropRef.current.contains(e.target as Node)) {
        setDomainDropOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDomainDropOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [domainDropOpen]);

  const openCustomModal = () => {
    setDomainDropOpen(false);
    setCustomUsernameOnly("");
    setCustomDomainChoice(selectedDomain || (domains.length > 0 ? domains[0] : "bakmi.my.id"));
    setCustomModalOpen(true);
  };

  const handleApplyCustomModal = () => {
    let input = customUsernameOnly.trim().toLowerCase();
    let targetDom = customDomainChoice || (domains.length > 0 ? domains[0] : "bakmi.my.id");

    // Jika input kosong saat klik tanda >, otomatis buat username acak
    let targetUser = input || generateRandomUsername();

    if (input.includes("@")) {
      const parts = input.split("@");
      targetUser = parts[0];
      if (parts[1]) targetDom = parts[1];
    }

    if (!/^[a-z0-9._-]{1,30}$/.test(targetUser)) {
      toast({
        title: "Username tidak valid",
        description: "Gunakan huruf kecil, angka, titik, underscore atau dash (maks. 30 karakter).",
        variant: "destructive",
      });
      return;
    }

    setCustomModalOpen(false);
    setCustomUsernameOnly("");
    // Buat beneran di server lewat /api/email/generate (dulu cuma setActiveEmail
    // lokal sehingga alamat tidak terdaftar dan email masuk ditolak webhook)
    handleGenerate(targetDom, targetUser);
  };

  // Email HANYA dibuat atas aksi eksplisit user (tombol "Buat Email Baru"
  // atau "+" di switcher) — tidak lagi otomatis setiap halaman dibuka.
  const lastGenReqRef = useRef(0);
  useEffect(() => {
    const req = generateRequest ?? 0;
    if (req > lastGenReqRef.current) {
      lastGenReqRef.current = req;
      handleGenerate();
    }
  }, [generateRequest]);

  const copyToClipboard = () => {
    if (!activeEmail) return;
    navigator.clipboard.writeText(activeEmail);
    setCopied(true);
    toast({ title: "Disalin!", description: "Alamat email berhasil disalin.", duration: 2000 });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    if (!activeEmail) return;
    resetMutation.mutate({ params: { email: activeEmail } }, {
      onSuccess: () => {
        toast({ title: "Inbox dikosongkan", description: "Semua pesan telah dihapus." });
        queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey({ email: activeEmail }) });
        queryClient.invalidateQueries({ queryKey: getGetEmailStatsQueryKey({ email: activeEmail }) });
      },
    });
  };

  const [extendPulse, setExtendPulse] = useState(false);

  const handleExtend = (minutes: number) => {
    if (!activeEmail) return;
    extendMutation.mutate(
      { data: { email: activeEmail, extraMinutes: minutes } },
      {
        onSuccess: (data) => {
          const applied = data.appliedMinutes ?? minutes;
          const expiryStr = new Date(data.newExpiresAt).toLocaleTimeString(
            "id-ID",
            { hour: "2-digit", minute: "2-digit" },
          );
          if (data.capped) {
            toast({
              title: `Diperpanjang +${applied} menit (maksimum tercapai)`,
              description: `Email aktif sampai ${expiryStr} — batas 24 jam dari pembuatan.`,
            });
          } else {
            toast({
              title: `Diperpanjang +${applied} menit`,
              description: `Email aktif sampai ${expiryStr}.`,
            });
          }
          setExtendPulse(true);
          setTimeout(() => setExtendPulse(false), 900);
          queryClient.invalidateQueries({
            queryKey: getGetEmailStatsQueryKey({ email: activeEmail }),
          });
          refetchStats();
        },
        onError: (err: unknown) => {
          // The api client throws an ApiError with `.status` and `.data`
          // (not the axios-style `.response.status`). Read both for safety
          // in case the underlying transport ever changes.
          const e = err as {
            status?: number;
            data?: { message?: string };
            response?: { status?: number; data?: { message?: string } };
          };
          const status = e?.status ?? e?.response?.status;
          const message = e?.data?.message ?? e?.response?.data?.message;
          if (status === 409) {
            toast({
              title: "Sudah maksimum 24 jam",
              description:
                message || "Silakan buat email baru untuk memulai sesi baru.",
            });
            return;
          }
          toast({ title: "Gagal memperpanjang", variant: "destructive" });
        },
      },
    );
  };

  const handleRemoveBlocked = (pattern: string) => {
    if (!activeEmail) return;
    removeFromBlacklistMutation.mutate(
      { params: { email: activeEmail, pattern } },
      {
        onSuccess: () => {
          toast({ title: "Blokir dihapus", description: `${pattern} dilepas dari daftar blokir.` });
          queryClient.invalidateQueries({ queryKey: getGetBlacklistQueryKey({ email: activeEmail }) });
          queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey({ email: activeEmail }) });
          refetchBlacklist();
        },
        onError: () => {
          toast({ title: "Gagal menghapus blokir", variant: "destructive" });
        },
      }
    );
  };

  const openPinDialog = () => {
    setPinInput("");
    setPinConfirm("");
    setPinStep("enter");
    setPinDialogOpen(true);
  };

  const handlePinSetup = async () => {
    if (pinInput.length !== 4 || !/^\d{4}$/.test(pinInput)) {
      toast({ title: "PIN harus 4 digit angka", variant: "destructive" });
      return;
    }
    if (pinStep === "enter") {
      setPinStep("confirm");
      return;
    }
    if (pinInput !== pinConfirm) {
      toast({ title: "PIN tidak cocok", description: "Silakan ulangi.", variant: "destructive" });
      setPinConfirm("");
      return;
    }
    await onSetupPin(pinInput);
    setPinDialogOpen(false);
    toast({ title: "PIN berhasil diaktifkan", description: "Inbox Anda sekarang terlindungi." });
  };

  const blockedList = blacklistData?.blocked ?? [];
  const isExpired = stats?.isExpired;

  // Peringatan hampir kadaluarsa — sisa < 5 menit
  const timeLeftMs = stats?.expiresAt ? new Date(stats.expiresAt).getTime() - Date.now() : Infinity;
  const expiryDateLabel = stats?.expiresAt
    ? new Date(stats.expiresAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })
    : "30 hari";
  const isNearExpiry = !isExpired && timeLeftMs > 0 && timeLeftMs < 5 * 60 * 1000;

  // ── Cap-aware extend logic ──
  // Hard cap = 24 jam dari pembuatan email. Tombol perpanjang harus tahu
  // berapa jatah yang masih tersedia agar tidak menampilkan opsi yang
  // pasti akan ditolak server.
  const expiresAtMs = stats?.expiresAt ? new Date(stats.expiresAt).getTime() : 0;
  const maxExpiresAtMs = stats?.maxExpiresAt
    ? new Date(stats.maxExpiresAt).getTime()
    : 0;
  // Headroom = berapa lama lagi yang masih bisa ditambahkan ke expiry.
  // Berbasis expiry sekarang, bukan now, supaya hasilnya konsisten dengan
  // perilaku server (yang memakai max(expiresAt, now) sebagai base).
  const baseMs = Math.max(expiresAtMs, Date.now());
  const headroomMinutes = maxExpiresAtMs
    ? Math.max(0, Math.floor((maxExpiresAtMs - baseMs) / 60000))
    : Infinity;
  const isAtCap = !!stats?.maxExpiresAt && headroomMinutes <= 0;
  const formatHeadroom = (m: number) => {
    if (!Number.isFinite(m)) return "";
    if (m < 60) return `${m} menit`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem ? `${h}j ${rem}m` : `${h} jam`;
  };

  // Opsi perpanjang dengan jumlah menit + label.
  // Setiap opsi dihitung apakah masuk dalam headroom; kalau tidak, tetap
  // ditampilkan tetapi disabled supaya pengguna tahu pilihan tsb sudah
  // bukan pilihan valid (UX > sembunyikan diam-diam).
  const EXTEND_OPTIONS: { minutes: number; label: string }[] = [
    { minutes: 10, label: "+10 menit" },
    { minutes: 30, label: "+30 menit" },
    { minutes: 60, label: "+1 jam" },
    { minutes: 360, label: "+6 jam" },
    { minutes: 1440, label: "+24 jam" },
  ];
  const previewTime = (addMinutes: number) => {
    const target = Math.min(baseMs + addMinutes * 60_000, maxExpiresAtMs || Infinity);
    return new Date(target).toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="flex flex-col gap-3">

      {/* ── Hero Email Card (All-in-One Compact Bar) ── */}
      <div>
        {/* Status bar atas: info ringkas satu baris (disembunyikan bila hideTopStatus) */}
        {!hideTopStatus && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 px-1 pt-1 pb-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5 font-bold uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
            Inbox Siap
          </span>
          <span aria-hidden="true">•</span>
          <span>Aktif s/d{" "}{expiryDateLabel}</span>
        </div>
        )}

        <div className="px-1 pb-2 space-y-2.5">
          {/* Baris Email + Tombol Salin Utama */}
          <div className="flex items-center rounded-xl border border-primary/25 bg-primary/[0.06] overflow-hidden h-12">
            <div className="flex items-center pl-3 pr-1 text-muted-foreground shrink-0">
              <Mail className="h-4 w-4 text-primary" />
            </div>

            {/* Email display */}
            {activeEmail ? (
              <button
                className="flex-1 min-w-0 px-2 h-full text-left hover:bg-muted/20 transition-colors group flex items-center"
                onClick={copyToClipboard}
                title={activeEmail ? `${activeEmail} — klik untuk menyalin` : "Klik untuk menyalin"}
              >
                <span className="block w-full text-sm sm:text-base font-mono font-bold tracking-tight text-foreground truncate select-all">
                  <span className="text-foreground">{activeEmail.split("@")[0]}</span>
                  <span className="text-primary font-semibold">@{activeEmail.split("@")[1]}</span>
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleGenerate()}
                disabled={isGeneratingManual}
                className="flex-1 min-w-0 px-2 h-full flex items-center justify-center gap-2 text-sm font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer disabled:opacity-60"
              >
                <Zap className={`h-4 w-4 ${isGeneratingManual ? "animate-spin" : ""}`} />
                <span>{isGeneratingManual ? "Membuat email..." : "Buat Email Baru"}</span>
              </button>
            )}

            {/* Tombol Salin Cyan Utama dengan Morf Animasi */}
            <button
              onClick={copyToClipboard}
              disabled={!activeEmail}
              className={`h-full px-4 flex items-center gap-1.5 font-semibold text-xs sm:text-sm transition-all duration-300 shrink-0 active:scale-95 cursor-pointer shadow-xs ${
                copied 
                  ? "bg-emerald-600 text-white hover:bg-emerald-700" 
                  : "bg-primary hover:bg-primary/90 text-primary-foreground"
              }`}
              title="Salin Alamat"
            >
              {copied ? <Check className="h-4 w-4 animate-in zoom-in-75 duration-200" /> : <Copy className="h-4 w-4" />}
              <span>{copied ? "✓ Tersalin!" : "Salin"}</span>
            </button>
          </div>

          {/* Hint login saat belum ada email */}
          {!activeEmail && !user && (
            <div className="rounded-xl border border-dashed border-border/70 bg-muted/30 px-3 py-2.5 text-center">
              <p className="text-xs text-muted-foreground">
                💡 <Link href="/login" className="text-primary font-semibold hover:underline">Login</Link> untuk menyimpan email &amp; riwayat di semua perangkat.
              </p>
            </div>
          )}

          {/* Baris Aksi: otomatis wrap ke baris baru bila sempit */}
          <div className="flex flex-wrap items-center gap-2">
              {/* Tombol Acak Baru */}
              <Button
                type="button"
                size="sm"
                onClick={() => handleGenerate()}
                disabled={isGeneratingManual}
                className="h-10 sm:h-8 px-3.5 sm:px-3 text-xs gap-1.5 font-semibold shadow-xs active:scale-95"
              >
                <Zap className={`h-3.5 w-3.5 ${isGeneratingManual ? "animate-spin" : ""}`} />
                <span>Acak Baru</span>
              </Button>

              {/* Tombol Kustom (Membuka dialog popup rapi) */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={openCustomModal}
                className="h-10 sm:h-8 px-3.5 sm:px-3 text-xs gap-1.5 font-medium border-border/80 hover:border-primary/50 hover:bg-primary/10 hover:text-primary active:scale-95"
              >
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                <span>Kustom</span>
              </Button>

              {/* Tombol Kunci PIN (Icon Lucide di dekat kustom email) */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={hasPin ? onLock : openPinDialog}
                className={`h-8 px-2.5 text-xs gap-1 font-medium transition-all active:scale-95 ${
                  hasPin 
                    ? "border-green-500/40 text-green-600 dark:text-green-400 bg-green-500/10 hover:bg-green-500/20" 
                    : "border-border/80 text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
                title={hasPin ? "PIN Aktif (Klik untuk mengunci)" : "Pasang PIN Proteksi"}
              >
                {hasPin ? <Lock className="h-3.5 w-3.5 text-green-500" /> : <KeyRound className="h-3.5 w-3.5 text-muted-foreground" />}
                <span className="hidden sm:inline">{hasPin ? "Terkunci" : "PIN"}</span>
              </Button>
            {/* Tombol QR Code */}
            <Button
              size="icon"
              variant="outline"
              onClick={() => setQrOpen(true)}
              disabled={!activeEmail}
              className="h-8 w-8 border-border/80 hover:bg-primary/10 hover:text-primary shrink-0"
              title="Tampilkan QR Code"
            >
              <QrCode className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
    
      {/* ── Status ringkas + aksi destruktif ── */}
      <div className="border-t border-border/60 px-1 pt-2.5 pb-1 flex items-center justify-between gap-2 text-xs">
        {/* Message count pills */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground text-xs">
          <span className="flex items-center gap-1">
            <Inbox className="h-3 w-3" />
            <strong className="text-foreground font-bold">{stats?.totalMessages ?? "0"}</strong> total
          </span>
          <span>•</span>
          <span className="flex items-center gap-1 text-primary font-bold">
            <Mail className="h-3 w-3" />
            {stats?.unreadCount ?? "0"} baru
          </span>
          {hideTopStatus && (
            <>
              <span>•</span>
              <span>Aktif s/d{" "}{expiryDateLabel}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Perpanjang masa aktif */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                disabled={!activeEmail || isAtCap || extendMutation.isPending}
                className="h-8 px-2.5 text-xs gap-1.5 border-border/80 hover:bg-primary/10 hover:text-primary shrink-0 active:scale-95"
                title={isAtCap ? "Sudah mencapai batas maksimum masa aktif" : "Perpanjang masa aktif"}
              >
                <Clock className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Perpanjang</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60">
              <div className="px-2 py-1.5 text-xs font-semibold">Perpanjang masa aktif</div>
              {EXTEND_OPTIONS.map((opt) => {
                const over = opt.minutes > headroomMinutes;
                return (
                  <DropdownMenuItem
                    key={opt.minutes}
                    disabled={over || extendMutation.isPending}
                    onClick={() => handleExtend(opt.minutes)}
                    className="flex items-center justify-between gap-2 text-xs"
                    title={over ? "Melebihi batas maksimum" : `Aktif sampai ${previewTime(opt.minutes)}`}
                  >
                    <span>{opt.label}</span>
                    <span className="text-muted-foreground font-mono text-[11px]">
                      {over ? "melebihi batas" : `→ ${previewTime(opt.minutes)}`}
                    </span>
                  </DropdownMenuItem>
                );
              })}
              <div className="px-2 py-1.5 text-[11px] text-muted-foreground border-t border-border/60 mt-1">
                Sisa jatah: {formatHeadroom(headroomMinutes)}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
          {/* Hancurkan alamat (destruktif) — konfirmasi via AlertDialog */}
          <AlertDialog open={burnConfirmOpen} onOpenChange={setBurnConfirmOpen}>
            <AlertDialogTrigger asChild>
              <Button
                size="icon"
                variant="outline"
                disabled={!activeEmail || isBurning}
                className="h-8 w-8 border-destructive/40 text-destructive hover:bg-destructive/10 hover:border-destructive shrink-0 active:scale-95"
                title="Hancurkan / Musnahkan Email Ini"
              >
                <Flame className={`h-3.5 w-3.5 ${isBurning ? "animate-bounce" : ""}`} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Musnahkan alamat ini?</AlertDialogTitle>
                <AlertDialogDescription>
                  <span className="font-mono font-semibold text-foreground break-all">{activeEmail}</span>{" "}
                  beserta seluruh pesannya akan dihapus permanen dan tidak dapat dikembalikan.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Batal</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleBurnEmail}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Ya, Musnahkan
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Clear inbox action */}
          {!activeEmail || !stats?.totalMessages ? (
            <span title="Inbox masih kosong — belum ada pesan untuk dihapus">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground shrink-0"
                disabled
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </span>
          ) : (
          <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
              title="Kosongkan inbox"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Yakin ingin mengosongkan?</AlertDialogTitle>
              <AlertDialogDescription>
                Semua pesan di inbox ini akan dihapus permanen dan tidak bisa dikembalikan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                Hapus Semua
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
          )}
        </div>
      </div>
      </div>

          {blockedList.length > 0 && (
            <div className="rounded-xl border border-border/60 bg-card p-3 space-y-2">
              <p className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                <ShieldOff className="h-3 w-3" />
                Daftar Blokir
                <Badge variant="secondary" className="text-xs h-5 px-2">{blockedList.length}</Badge>
              </p>
              <div className="space-y-1">
                {blockedList.map((entry) => (
                  <div key={entry.id} className="flex items-center justify-between py-1 px-2 rounded-md bg-muted/30 group">
                    <span className="text-xs font-mono text-foreground/80 truncate flex-1">{entry.pattern}</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-destructive shrink-0"
                      onClick={() => handleRemoveBlocked(entry.pattern)}
                      disabled={removeFromBlacklistMutation.isPending}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

      {/* QR Code Dialog */}
      <Dialog open={qrOpen} onOpenChange={setQrOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <QrCode className="h-5 w-5 text-primary" />
              Scan QR Code
            </DialogTitle>
            <DialogDescription>
              Scan dengan kamera HP untuk menyalin alamat email.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            {activeEmail && (
              <div className="p-4 bg-white rounded-xl shadow-inner border border-border">
                <QRCodeSVG
                  value={activeEmail}
                  size={200}
                  level="M"
                  includeMargin={false}
                />
              </div>
            )}
            <p className="text-xs font-mono text-center text-muted-foreground break-all px-2">
              {activeEmail}
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Modal Dialog Kustom Email Persis Gambar Referensi ── */}
      <Dialog open={customModalOpen} onOpenChange={(o) => { setCustomModalOpen(o); if (!o) setDomainDropOpen(false); }}>
        <DialogContent className="max-w-md p-4 bg-card text-card-foreground border border-border shadow-2xl rounded-2xl">
          <DialogTitle className="sr-only">Kustom Alamat Email</DialogTitle>
          <div className="space-y-3">
            {/* Kotak Berbingkai Dashed Border Mengikuti Tema Web */}
            <div className="border border-dashed border-primary/30 dark:border-primary/20 rounded-xl p-3 bg-muted/40 flex items-stretch gap-2.5">
              {/* Kolom Kiri: 2 Input Bertumpuk (Username + Domain Select) */}
              <div className="flex-1 flex flex-col gap-2 min-w-0">
                <input
                  type="text"
                  autoFocus
                  placeholder="Enter Username"
                  value={customUsernameOnly}
                  onChange={(e) => setCustomUsernameOnly(e.target.value.toLowerCase())}
                  onKeyDown={(e) => e.key === "Enter" && handleApplyCustomModal()}
                  className="h-10 px-3 rounded-lg bg-background border border-border/80 text-foreground placeholder:text-muted-foreground text-xs sm:text-sm font-sans focus:outline-none focus:ring-1 focus:ring-primary w-full shadow-xs"
                />

                {/* Dropdown Domain Kustom (inline, bukan popup native) */}
                <div className="relative" ref={domainDropRef}>
                  <button
                    type="button"
                    onClick={() => setDomainDropOpen((o) => !o)}
                    className="h-10 px-3 rounded-lg bg-background border border-border/80 text-foreground text-xs sm:text-sm font-sans w-full flex items-center justify-between gap-2 cursor-pointer shadow-xs focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <span className="truncate">@{customDomainChoice || domains[0] || ""}</span>
                    <ChevronDown className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${domainDropOpen ? "rotate-180" : ""}`} />
                  </button>
                  {domainDropOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1.5 z-50 rounded-lg border border-border bg-popover text-popover-foreground shadow-xl overflow-hidden max-h-60 overflow-y-auto">
                      {domains.map((dom) => {
                        const active = (customDomainChoice || domains[0]) === dom;
                        return (
                          <button
                            key={dom}
                            type="button"
                            onClick={() => { setCustomDomainChoice(dom); setDomainDropOpen(false); }}
                            className={`w-full px-3 py-2.5 text-left text-xs sm:text-sm font-sans flex items-center justify-between gap-2 cursor-pointer transition-colors ${active ? "bg-primary/10 text-primary font-semibold" : "hover:bg-muted text-foreground"}`}
                          >
                            <span className="truncate">@{dom}</span>
                            {active && <Check className="h-4 w-4 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Tombol Lanjut Panah Kanan (Cyan/Teal Theme Accent) */}
              <button
                type="button"
                onClick={handleApplyCustomModal}
                className="w-12 sm:w-14 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 shadow-xs"
                title="Lanjut / Buat"
              >
                <ChevronRight className="h-6 w-6 stroke-[2.5]" />
              </button>

              {/* Pemisah Garis Putus-putus Vertikal */}
              <div className="w-[1px] border-r border-dashed border-border my-2 self-stretch shrink-0" />

              {/* Tombol Shuffle / Acak */}
              <button
                type="button"
                onClick={() => {
                  setCustomUsernameOnly(generateRandomUsername());
                  if (domains.length > 0) {
                    const randomDom = domains[Math.floor(Math.random() * domains.length)];
                    setCustomDomainChoice(randomDom);
                  }
                }}
                className="w-12 sm:w-14 rounded-lg bg-background hover:bg-muted border border-border/80 text-foreground flex items-center justify-center transition-all cursor-pointer shrink-0 active:scale-95 shadow-xs"
                title="Acak Username & Domain"
              >
                <Shuffle className="h-5 w-5 text-muted-foreground" />
              </button>
            </div>

            {/* Tombol Cancel Penuh Selebar Kontainer di Bawah */}
            <button
              type="button"
              onClick={() => setCustomModalOpen(false)}
              className="w-full h-11 rounded-xl bg-muted/60 hover:bg-muted border border-border/80 text-foreground text-sm font-semibold transition-all cursor-pointer active:scale-98 shadow-xs"
            >
              Cancel
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* PIN Setup Dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={setPinDialogOpen}>
        <DialogContent className="max-w-xs">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              {pinStep === "enter" ? "Buat PIN Baru" : "Konfirmasi PIN"}
            </DialogTitle>
            <DialogDescription>
              {pinStep === "enter"
                ? "Masukkan 4 digit PIN untuk melindungi inbox Anda."
                : "Masukkan ulang PIN untuk konfirmasi."}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Input
              type="password"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={4}
              placeholder="••••"
              className="text-center text-2xl tracking-widest font-mono h-14"
              value={pinStep === "enter" ? pinInput : pinConfirm}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                if (pinStep === "enter") setPinInput(val);
                else setPinConfirm(val);
              }}
              onKeyDown={(e) => e.key === "Enter" && handlePinSetup()}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPinDialogOpen(false)}>Batal</Button>
            <Button onClick={handlePinSetup} className="flex-1">
              {pinStep === "enter" ? (
                <>Lanjut <ArrowRight className="ml-1 h-4 w-4" /></>
              ) : (
                <>Simpan PIN <Check className="ml-1 h-4 w-4" /></>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Telegram User ID Dialog */}
      <Dialog open={telegramDialogOpen} onOpenChange={setTelegramDialogOpen}>
        <DialogContent className="max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-[#229ED9]" />
              Notifikasi Telegram Pribadi
            </DialogTitle>
            <DialogDescription className="text-xs">
              Masukkan Chat ID / User ID Telegram kamu untuk menerima setiap email masuk & kode OTP secara otomatis.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Telegram Chat ID / User ID</Label>
              <Input
                placeholder="Contoh: 5606826328"
                value={telegramChatInput}
                onChange={(e) => setTelegramChatInput(e.target.value.trim())}
                onKeyDown={(e) => e.key === "Enter" && handleSaveTelegramChatId()}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Dapatkan ID kamu dengan mengirim pesan ke{" "}
                <a
                  href="https://t.me/userinfobot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline font-medium"
                >
                  @userinfobot
                </a>{" "}
                di Telegram.
              </p>
            </div>

            {branding.telegram_bot_username && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-xs text-muted-foreground space-y-1.5">
                <p className="font-semibold text-foreground">Pastikan sudah tekan Start di Bot:</p>
                <p>
                  Kunjungi bot kami di{" "}
                  <a
                    href={`https://t.me/${branding.telegram_bot_username.replace(/^@/, "")}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[#229ED9] font-bold underline"
                  >
                    @{branding.telegram_bot_username.replace(/^@/, "")}
                  </a>{" "}
                  lalu klik <strong>Start</strong> agar bot diizinkan mengirim pesan.
                </p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setTelegramDialogOpen(false)} className="rounded-xl">
              Batal
            </Button>
            <Button
              onClick={handleSaveTelegramChatId}
              disabled={savingTelegram}
              className="bg-[#229ED9] hover:bg-[#229ED9]/90 text-white rounded-xl gap-1.5"
            >
              <Send className="h-3.5 w-3.5" />
              {savingTelegram ? "Menyimpan..." : "Simpan ID"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
