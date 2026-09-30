import { useMemo, useState } from "react";
import { KeyRound, Copy, Check, History } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import {
  scanInboxOtps,
  normalizeOtp,
  isOtpUsed,
  setOtpUsed,
  type OtpInfo,
} from "@/lib/otp";
import { OtpCountdown } from "@/components/otp-countdown";
import { cn } from "@/lib/utils";

interface OtpHistoryProps {
  messages: Array<{ id: string; from: string; subject: string; preview: string; receivedAt: string }>;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - Date.parse(iso);
  if (Number.isNaN(diff) || diff < 0) return "baru saja";
  const m = Math.floor(diff / 60000);
  if (m < 1) return "baru saja";
  if (m < 60) return `${m}m lalu`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}j lalu`;
  return `${Math.floor(h / 24)}h lalu`;
}

function OtpRow({ otp, onToggleUsed, usedTick }: { otp: OtpInfo; onToggleUsed: () => void; usedTick: number }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const used = isOtpUsed(otp.messageId, otp.code);
  // re-evaluate on usedTick change
  void usedTick;

  const copy = () => {
    const normalized = normalizeOtp(otp.code);
    navigator.clipboard.writeText(normalized).then(() => {
      setCopied(true);
      toast({ title: "Kode OTP Tersalin!", description: normalized, duration: 2000 });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className={cn("flex items-center gap-3 px-3 py-2.5 rounded-lg border", used ? "opacity-60 border-border" : "border-primary/20 bg-primary/[0.03]")}>
      <button
        type="button"
        onClick={copy}
        className="font-mono text-sm font-extrabold tracking-widest px-2.5 py-1 rounded bg-background border border-primary/30 cursor-pointer active:scale-95 select-all"
        title="Klik untuk salin"
      >
        {otp.code}
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate">{otp.from || "Pengirim tak dikenal"}</p>
        <p className="text-[11px] text-muted-foreground truncate">{otp.subject || "(tanpa subjek)"} · {timeAgo(otp.receivedAt)}</p>
      </div>
      <OtpCountdown receivedAt={otp.receivedAt} />
      <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={copy} title="Salin kode">
        {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-7 w-7 shrink-0"
        onClick={onToggleUsed}
        title={used ? "Batalkan tanda terpakai" : "Tandai terpakai"}
      >
        <Check className={cn("h-3.5 w-3.5", used ? "text-green-500" : "text-muted-foreground")} />
      </Button>
    </div>
  );
}

export function OtpHistory({ messages }: OtpHistoryProps) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [usedTick, setUsedTick] = useState(0);
  const otps = useMemo(() => scanInboxOtps(messages), [messages, open]);

  const toggleUsed = (otp: OtpInfo) => {
    const next = !isOtpUsed(otp.messageId, otp.code);
    setOtpUsed(otp.messageId, otp.code, next);
    setUsedTick((t) => t + 1);
    toast({ title: next ? "Ditandai terpakai" : "Tanda terpakai dihapus", duration: 1500 });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 sm:h-7 sm:w-7 text-muted-foreground hover:text-primary"
          title="Riwayat kode OTP"
        >
          <History className="h-3.5 w-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            <KeyRound className="h-4 w-4 text-primary" />
            Riwayat Kode OTP
          </DialogTitle>
        </DialogHeader>
        {otps.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            Belum ada kode OTP terdeteksi di inbox ini.
          </p>
        ) : (
          <ScrollArea className="max-h-[50vh] pr-1">
            <div className="flex flex-col gap-2">
              {otps.map((otp) => (
                <OtpRow key={`${otp.messageId}:${otp.code}`} otp={otp} onToggleUsed={() => toggleUsed(otp)} usedTick={usedTick} />
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
