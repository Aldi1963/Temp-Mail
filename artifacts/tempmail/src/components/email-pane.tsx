import { useEffect, useState } from "react";
import {
  Copy, RefreshCw, Trash2, Clock, Inbox, ChevronDown, Mail,
  Timer, Pencil, Check, X, Lock, Unlock, Shield, ShieldOff, KeyRound, Minus
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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
      toast({ title: "Email baru dibuat", description: generatedEmailData.email });
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
    toast({ title: "Disalin!", description: "Alamat email berhasil disalin.", duration: 2000 });
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

  return (
    <div className="flex flex-col gap-4">
      {/* Address Card */}
      <Card className="border-primary/20 bg-card/50 backdrop-blur">
        <CardHeader className="pb-3">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            Alamat Sementara Anda
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Email display */}
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/40 to-primary/20 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-500" />
            <div className="relative flex items-center justify-between bg-background border border-border/50 rounded-lg px-3 py-2.5">
              {activeEmail ? (
                <span className="text-base sm:text-lg font-mono font-bold truncate select-all text-primary" data-testid="text-active-email">
                  {activeEmail}
                </span>
              ) : (
                <Skeleton className="h-7 w-full max-w-[220px]" />
              )}
              <Button
                size="icon"
                variant="ghost"
                onClick={copyToClipboard}
                disabled={!activeEmail}
                className="shrink-0 ml-2 h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors"
                data-testid="button-copy-email"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Custom username input */}
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
                  className="border-0 focus-visible:ring-0 h-9 text-sm font-mono"
                />
                <span className="text-xs text-muted-foreground pr-2 whitespace-nowrap">
                  @{selectedDomain || (domains[0] ?? "domain")}
                </span>
              </div>
              <Button size="icon" className="h-9 w-9 shrink-0" onClick={handleCustomUsername}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => { setEditingUsername(false); setUsernameInput(""); }}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              className="w-full text-xs text-muted-foreground hover:text-primary h-7 gap-1.5"
              onClick={() => setEditingUsername(true)}
            >
              <Pencil className="h-3 w-3" />
              Buat username kustom
            </Button>
          )}

          {/* Generate + Domain */}
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => handleGenerate()}
              disabled={isGenerating}
              className="flex-1 min-w-[120px] bg-primary text-primary-foreground hover:bg-primary/90 h-9"
              data-testid="button-generate-email"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isGenerating ? "animate-spin" : ""}`} />
              Generate Baru
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex-1 min-w-[100px] h-9 text-xs" disabled={domains.length === 0}>
                  @{selectedDomain || (domains.length > 0 ? domains[0] : "domain")}
                  <ChevronDown className="ml-1.5 h-3.5 w-3.5 opacity-50" />
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
        </CardContent>
      </Card>

      {/* Stats Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-accent/50">
              <Inbox className="h-5 w-5 text-muted-foreground mb-1.5" />
              <div className="text-2xl font-bold" data-testid="text-stats-total">
                {stats?.totalMessages ?? "0"}
              </div>
              <div className="text-xs text-muted-foreground">Total</div>
            </div>
            <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-primary/10 border border-primary/20">
              <Mail className="h-5 w-5 text-primary mb-1.5" />
              <div className="text-2xl font-bold text-primary" data-testid="text-stats-unread">
                {stats?.unreadCount ?? "0"}
              </div>
              <div className="text-xs text-primary/80 font-medium">Belum Dibaca</div>
            </div>
          </div>

          {/* Timer & Extend */}
          <div className="flex items-center justify-between border-t border-border pt-3 mb-3">
            <div className="flex items-center gap-1.5 text-sm">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className={`font-mono font-medium tabular-nums ${stats?.isExpired ? "text-destructive" : "text-foreground"}`}>
                {timeLeft}
              </span>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 h-7 text-xs hover:border-primary hover:text-primary"
                  disabled={!activeEmail || extendMutation.isPending}
                >
                  <Timer className="h-3.5 w-3.5" />
                  Perpanjang
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {[10, 30, 60].map((min) => (
                  <DropdownMenuItem key={min} className="text-xs cursor-pointer" onClick={() => handleExtend(min)}>
                    +{min} menit
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Clear inbox */}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 h-8 text-xs"
                disabled={!activeEmail || !stats?.totalMessages}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                Kosongkan Inbox
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
        </CardContent>
      </Card>

      {/* Security Card */}
      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardHeader className="pb-2 pt-3 px-4">
          <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Keamanan & Privasi
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {/* PIN Lock */}
          <div className="flex items-center justify-between py-1">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <div>
                <p className="text-xs font-medium">PIN Proteksi</p>
                <p className="text-[10px] text-muted-foreground">
                  {hasPin ? "Inbox terlindungi dengan PIN" : "Tambah PIN untuk keamanan"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {hasPin && (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-primary"
                    title="Kunci sekarang"
                    onClick={onLock}
                  >
                    <Lock className="h-3.5 w-3.5" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        title="Hapus PIN"
                      >
                        <ShieldOff className="h-3.5 w-3.5" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Hapus proteksi PIN?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Inbox Anda tidak akan lagi terlindungi dengan PIN setelah ini.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Batal</AlertDialogCancel>
                        <AlertDialogAction onClick={onRemovePin} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                          Hapus PIN
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </>
              )}
              {!hasPin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={openPinDialog}
                >
                  <Unlock className="h-3 w-3" />
                  Aktifkan
                </Button>
              )}
            </div>
          </div>

          {/* Blocked Senders */}
          {blockedList.length > 0 && (
            <>
              <Separator />
              <div>
                <p className="text-xs font-medium mb-2 flex items-center gap-1.5">
                  <ShieldOff className="h-3.5 w-3.5 text-muted-foreground" />
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
        </CardContent>
      </Card>

      {/* PIN Setup Dialog */}
      <Dialog open={pinDialogOpen} onOpenChange={(open) => { setPinDialogOpen(open); if (!open) { setPinInput(""); setPinConfirm(""); setPinStep("enter"); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5 text-primary" />
              {pinStep === "enter" ? "Buat PIN Baru" : "Konfirmasi PIN"}
            </DialogTitle>
            <DialogDescription>
              {pinStep === "enter"
                ? "Masukkan 4 digit angka sebagai PIN untuk melindungi inbox."
                : "Ulangi PIN yang sama untuk konfirmasi."}
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Input
              type="password"
              inputMode="numeric"
              maxLength={4}
              placeholder="••••"
              value={pinStep === "enter" ? pinInput : pinConfirm}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, "").slice(0, 4);
                if (pinStep === "enter") setPinInput(val);
                else setPinConfirm(val);
              }}
              className="text-center text-2xl tracking-[0.5em] h-12 font-mono"
              onKeyDown={(e) => { if (e.key === "Enter") handlePinSetup(); }}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setPinDialogOpen(false); setPinInput(""); setPinConfirm(""); setPinStep("enter"); }}>
              Batal
            </Button>
            <Button onClick={handlePinSetup} disabled={(pinStep === "enter" ? pinInput : pinConfirm).length !== 4}>
              {pinStep === "enter" ? "Lanjut" : "Simpan PIN"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
