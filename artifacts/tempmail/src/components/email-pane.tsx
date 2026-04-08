import { useEffect, useState } from "react";
import {
  Copy, RefreshCw, Trash2, Clock, Inbox, ChevronDown, Mail,
  Timer, Pencil, Check, X, Lock, Unlock, Shield, ShieldOff, KeyRound, Minus, QrCode,
  Zap, ArrowRight
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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
import { Skeleton } from "@/components/ui/skeleton";
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
import { Separator } from "@/components/ui/separator";

interface EmailPaneProps {
  activeEmail: string | null;
  setActiveEmail: (email: string) => void;
  hasPin: boolean;
  onSetupPin: (pin: string) => Promise<void>;
  onRemovePin: () => void;
  onLock: () => void;
}

export function EmailPane({
  activeEmail,
  setActiveEmail,
  hasPin,
  onSetupPin,
  onRemovePin,
  onLock,
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

  const { data: domainsData } = useGetAvailableDomains();
  const resetMutation = useResetInbox();
  const extendMutation = useExtendEmail();
  const removeFromBlacklistMutation = useRemoveFromBlacklist();

  const { data: stats, refetch: refetchStats } = useGetEmailStats(
    { email: activeEmail ?? "" },
    { query: { enabled: !!activeEmail, refetchInterval: 5000 } }
  );

  const { data: blacklistData, refetch: refetchBlacklist } = useGetBlacklist(
    { email: activeEmail ?? "" },
    { query: { enabled: !!activeEmail } }
  );

  const { data: generatedEmailData, isFetching: isGenerating } = useGenerateEmail(
    { domain: pendingDomain || selectedDomain, username: pendingUsername },
    { query: { enabled: generateTrigger > 0, staleTime: 0, gcTime: 0 } }
  );

  useEffect(() => {
    if (generatedEmailData?.email) {
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

  const handleGenerate = (domain?: string, username?: string) => {
    if (domain) setPendingDomain(domain);
    if (username !== undefined) setPendingUsername(username || undefined);
    setGenerateTrigger((t) => t + 1);
  };

  const handleCustomUsername = () => {
    const trimmed = usernameInput.trim();
    if (!trimmed) return;
    if (!/^[a-z0-9._-]{1,30}$/.test(trimmed)) {
      toast({
        title: "Username tidak valid",
        description: "Gunakan huruf kecil, angka, titik, underscore atau dash (maks. 30 karakter).",
        variant: "destructive",
      });
      return;
    }
    handleGenerate(selectedDomain, trimmed);
    setEditingUsername(false);
    setUsernameInput("");
  };

  useEffect(() => {
    if (!activeEmail && domains.length > 0 && !isGenerating && generateTrigger === 0) {
      handleGenerate(domains[0]);
    }
  }, [activeEmail, domains.length]);

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

  const handleExtend = (minutes: number) => {
    if (!activeEmail) return;
    extendMutation.mutate(
      { data: { email: activeEmail, extraMinutes: minutes } },
      {
        onSuccess: (data) => {
          toast({
            title: `Diperpanjang +${minutes} menit`,
            description: `Email aktif hingga ${new Date(data.newExpiresAt).toLocaleTimeString("id-ID")}`,
          });
          queryClient.invalidateQueries({ queryKey: getGetEmailStatsQueryKey({ email: activeEmail }) });
          refetchStats();
        },
        onError: () => {
          toast({ title: "Gagal memperpanjang", variant: "destructive" });
        },
      }
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

  return (
    <div className="flex flex-col gap-3">

      {/* ── Hero Email Card ── */}
      <div className="relative rounded-2xl overflow-hidden border border-primary/20 bg-gradient-to-br from-primary/5 via-background to-background shadow-sm">
        {/* Decorative glow */}
        <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-primary/5 rounded-full blur-2xl pointer-events-none" />

        <div className="relative p-5 space-y-4">
          {/* Label */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
                Inbox Aktif
              </span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setQrOpen(true)}
              disabled={!activeEmail}
              className="h-7 w-7 hover:bg-primary/10 hover:text-primary"
              title="QR Code"
            >
              <QrCode className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Email address — hero display */}
          <div className="space-y-2">
            {activeEmail ? (
              <div
                className="font-mono font-bold text-lg sm:text-xl leading-tight break-all text-foreground cursor-pointer select-all"
                data-testid="text-active-email"
                onClick={copyToClipboard}
                title="Klik untuk menyalin"
              >
                <span className="text-primary">{activeEmail.split("@")[0]}</span>
                <span className="text-muted-foreground/70 text-base">@{activeEmail.split("@")[1]}</span>
              </div>
            ) : (
              <Skeleton className="h-8 w-full" />
            )}
          </div>

          {/* Copy button — prominent */}
          <Button
            onClick={copyToClipboard}
            disabled={!activeEmail}
            variant={copied ? "default" : "outline"}
            className={`w-full h-9 gap-2 text-sm font-medium transition-all ${copied ? "bg-green-500 hover:bg-green-500 border-green-500 text-white" : "border-primary/30 hover:bg-primary/10 hover:text-primary hover:border-primary"}`}
            data-testid="button-copy-email"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "Tersalin!" : "Salin Alamat Email"}
          </Button>

          {/* Custom username */}
          {editingUsername ? (
            <div className="flex gap-2">
              <div className="flex-1 flex items-center border border-primary/40 rounded-lg overflow-hidden bg-background focus-within:ring-1 focus-within:ring-primary">
                <Input
                  autoFocus
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value.toLowerCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCustomUsername();
                    if (e.key === "Escape") setEditingUsername(false);
                  }}
                  placeholder="username-kustom"
                  className="border-0 focus-visible:ring-0 h-8 text-sm font-mono"
                />
                <span className="text-[11px] text-muted-foreground pr-2 whitespace-nowrap">
                  @{selectedDomain || (domains[0] ?? "domain")}
                </span>
              </div>
              <Button size="icon" className="h-8 w-8 shrink-0" onClick={handleCustomUsername}>
                <Check className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={() => { setEditingUsername(false); setUsernameInput(""); }}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          ) : (
            <button
              onClick={() => setEditingUsername(true)}
              className="w-full flex items-center justify-center gap-1.5 text-[11px] text-muted-foreground hover:text-primary transition-colors py-0.5"
            >
              <Pencil className="h-3 w-3" />
              Buat username kustom
            </button>
          )}

          {/* Generate + Domain */}
          <div className="flex gap-2">
            <Button
              onClick={() => handleGenerate()}
              disabled={isGenerating}
              className="flex-1 h-9 gap-2 bg-primary hover:bg-primary/90 text-sm"
              data-testid="button-generate-email"
            >
              <Zap className={`h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
              Generate Baru
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="h-9 px-3 text-xs gap-1 shrink-0" disabled={domains.length === 0}>
                  @{selectedDomain || (domains.length > 0 ? domains[0] : "domain")}
                  <ChevronDown className="h-3 w-3 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[180px]">
                {domains.map((domain) => (
                  <DropdownMenuItem
                    key={domain}
                    onClick={() => setSelectedDomain(domain)}
                    className={`text-xs ${selectedDomain === domain ? "bg-accent" : ""}`}
                  >
                    @{domain}
                    {selectedDomain === domain && <Check className="ml-auto h-3.5 w-3.5" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      {/* ── Stats + Timer Row ── */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border border-border/50 bg-card p-3 flex flex-col items-center gap-1">
          <Inbox className="h-4 w-4 text-muted-foreground" />
          <span className="text-xl font-bold" data-testid="text-stats-total">
            {stats?.totalMessages ?? "0"}
          </span>
          <span className="text-[10px] text-muted-foreground">Total</span>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 flex flex-col items-center gap-1">
          <Mail className="h-4 w-4 text-primary" />
          <span className="text-xl font-bold text-primary" data-testid="text-stats-unread">
            {stats?.unreadCount ?? "0"}
          </span>
          <span className="text-[10px] text-primary/70 font-medium">Baru</span>
        </div>

        <div className={`rounded-xl border p-3 flex flex-col items-center gap-1 ${isExpired ? "border-destructive/30 bg-destructive/5" : "border-border/50 bg-card"}`}>
          <Clock className={`h-4 w-4 ${isExpired ? "text-destructive" : "text-muted-foreground"}`} />
          <span className={`text-sm font-bold font-mono tabular-nums ${isExpired ? "text-destructive" : "text-foreground"}`}>
            {timeLeft}
          </span>
          <span className="text-[10px] text-muted-foreground">Sisa Waktu</span>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="flex gap-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1.5 h-8 text-xs hover:border-primary hover:text-primary"
              disabled={!activeEmail || extendMutation.isPending}
            >
              <Timer className="h-3.5 w-3.5" />
              Perpanjang
              <ChevronDown className="h-3 w-3 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-36">
            {[10, 30, 60].map((min) => (
              <DropdownMenuItem key={min} className="text-xs cursor-pointer" onClick={() => handleExtend(min)}>
                +{min} menit
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 gap-1.5 h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
              disabled={!activeEmail || !stats?.totalMessages}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Kosongkan
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
      </div>

      {/* ── Security Card ── */}
      <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
        <div className="flex items-center gap-2 mb-1">
          <Shield className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Keamanan & Privasi</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <KeyRound className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <div>
              <p className="text-xs font-medium">PIN Proteksi</p>
              <p className="text-[10px] text-muted-foreground">
                {hasPin ? "Inbox dilindungi" : "Belum diaktifkan"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {hasPin ? (
              <>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" title="Kunci" onClick={onLock}>
                  <Lock className="h-3.5 w-3.5" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" title="Hapus PIN">
                      <ShieldOff className="h-3.5 w-3.5" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Hapus proteksi PIN?</AlertDialogTitle>
                      <AlertDialogDescription>Inbox tidak lagi terlindungi setelah ini.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Batal</AlertDialogCancel>
                      <AlertDialogAction onClick={onRemovePin} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Hapus PIN</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1 border-dashed" onClick={openPinDialog}>
                <Unlock className="h-3 w-3" />
                Aktifkan
              </Button>
            )}
          </div>
        </div>

        {blockedList.length > 0 && (
          <>
            <Separator />
            <div>
              <p className="text-[11px] font-medium mb-2 flex items-center gap-1.5 text-muted-foreground">
                <ShieldOff className="h-3 w-3" />
                Daftar Blokir
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{blockedList.length}</Badge>
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
          </>
        )}
      </div>

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
          <DialogFooter>
            <Button variant="outline" onClick={() => setQrOpen(false)} className="w-full">
              Tutup
            </Button>
          </DialogFooter>
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
    </div>
  );
}
