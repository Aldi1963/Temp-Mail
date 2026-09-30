import { useEffect, useState } from "react";
import { Timer } from "lucide-react";
import { getOtpRemainingMs, formatOtpCountdown } from "@/lib/otp";
import { cn } from "@/lib/utils";

/** Lencana hitung mundur kedaluwarsa OTP (estimasi 10 menit dari diterima). */
export function OtpCountdown({ receivedAt, className }: { receivedAt: string; className?: string }) {
  const [remaining, setRemaining] = useState(() => getOtpRemainingMs(receivedAt));

  useEffect(() => {
    setRemaining(getOtpRemainingMs(receivedAt));
    const t = setInterval(() => setRemaining(getOtpRemainingMs(receivedAt)), 1000);
    return () => clearInterval(t);
  }, [receivedAt]);

  const expired = remaining <= 0;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-medium tabular-nums",
        expired ? "text-muted-foreground line-through" : "text-amber-600 dark:text-amber-400",
        className
      )}
      title={expired ? "Perkiraan masa berlaku habis" : "Perkiraan sisa masa berlaku"}
    >
      <Timer className="h-3 w-3" />
      {formatOtpCountdown(remaining)}
    </span>
  );
}
