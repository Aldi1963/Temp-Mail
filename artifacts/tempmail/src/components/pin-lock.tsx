import { useState, useRef, useEffect, KeyboardEvent } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface PinLockProps {
  onVerify: (pin: string) => Promise<boolean>;
}

export function PinLock({ onVerify }: PinLockProps) {
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [isChecking, setIsChecking] = useState(false);
  const [shakeError, setShakeError] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const handleChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = digit;
    setDigits(next);
    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus();
    }
    if (next.every((d) => d !== "") && next[3] !== "") {
      handleSubmit(next.join(""));
    }
  };

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleSubmit = async (pin: string) => {
    setIsChecking(true);
    const ok = await onVerify(pin);
    if (!ok) {
      setShakeError(true);
      setDigits(["", "", "", ""]);
      setTimeout(() => {
        setShakeError(false);
        inputRefs.current[0]?.focus();
      }, 500);
      toast({ title: "PIN salah", description: "Coba lagi.", variant: "destructive" });
    }
    setIsChecking(false);
  };

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="bg-primary/10 p-4 rounded-full">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">Inbox Terkunci</h2>
        <p className="text-muted-foreground text-sm max-w-xs">
          Masukkan PIN 4 digit untuk mengakses inbox Anda.
        </p>
      </div>

      <div className={`flex gap-3 ${shakeError ? "animate-shake" : ""}`}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => { inputRefs.current[i] = el; }}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={isChecking}
            className="w-14 h-14 text-center text-2xl font-bold border-2 border-border rounded-xl bg-background focus:outline-none focus:border-primary transition-colors"
          />
        ))}
      </div>

      <Button
        className="gap-2"
        disabled={digits.some((d) => !d) || isChecking}
        onClick={() => handleSubmit(digits.join(""))}
      >
        <ShieldCheck className="h-4 w-4" />
        Buka Kunci
      </Button>
    </div>
  );
}
