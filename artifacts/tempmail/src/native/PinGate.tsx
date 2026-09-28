// Gerbang PIN fullscreen untuk aplikasi native Android.
import { useState } from "react";
import { Delete, LockKeyhole } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNativeSettings, hashPin } from "./settings";

// Pad angka 6 digit yang bisa dipakai ulang (inline maupun fullscreen).
export function PinPad({ onComplete, hint }: { onComplete: (pin: string) => void; hint?: string }) {
  const [pin, setPin] = useState("");
  const len = 6;

  const press = (d: string) => {
    if (pin.length >= len) return;
    const next = pin + d;
    if (next.length === len) {
      setPin("");
      onComplete(next);
    } else {
      setPin(next);
    }
  };
  const back = () => setPin((p) => p.slice(0, -1));

  const keyCls =
    "w-16 h-16 rounded-full bg-muted text-[20px] font-bold flex items-center justify-center active:bg-primary active:text-primary-foreground";

  return (
    <div className="flex flex-col items-center gap-5">
      <div className="flex gap-3" aria-hidden>
        {Array.from({ length: len }).map((_, i) => (
          <span
            key={i}
            className={cn(
              "w-3.5 h-3.5 rounded-full border-2",
              i < pin.length ? "bg-primary border-primary" : "border-muted-foreground/40"
            )}
          />
        ))}
      </div>
      {hint && <p className="text-[12px] text-muted-foreground text-center">{hint}</p>}
      <div className="grid grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
          <button key={d} type="button" onClick={() => press(d)} className={keyCls} aria-label={d}>
            {d}
          </button>
        ))}
        <span />
        <button type="button" onClick={() => press("0")} className={keyCls} aria-label="0">
          0
        </button>
        <button type="button" onClick={back} className={keyCls} aria-label="Hapus">
          <Delete className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

// Overlay fullscreen: muncul saat aplikasi dibuka dan PIN aktif.
export function PinGate({ onUnlock }: { onUnlock: () => void }) {
  const { settings } = useNativeSettings();
  const [error, setError] = useState("");

  const verify = async (pin: string) => {
    try {
      const h = await hashPin(pin);
      if (settings.pinHash && h === settings.pinHash) {
        setError("");
        onUnlock();
      } else {
        setError("PIN salah, coba lagi");
      }
    } catch {
      setError("PIN salah, coba lagi");
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center gap-6 px-8"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <span className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
        <LockKeyhole className="h-7 w-7" />
      </span>
      <div className="text-center">
        <p className="text-[17px] font-extrabold">TempMail terkunci</p>
        <p className="text-[12px] text-muted-foreground mt-1">Masukkan PIN 6 digit</p>
      </div>
      <PinPad onComplete={verify} />
      {error ? (
        <p className="text-[13px] font-bold text-destructive">{error}</p>
      ) : (
        <p className="text-[13px] text-transparent select-none">.</p>
      )}
    </div>
  );
}
