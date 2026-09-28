import { useMemo, useState } from "react";
import { Check, Copy } from "lucide-react";
import { buzz, extractQuickOtp, senderMeta } from "./otp";
import type { NativeMsg } from "./NativeInboxList";

export function OtpSection({ messages }: { messages: NativeMsg[] }) {
  const [copied, setCopied] = useState<string | null>(null);

  const otps = useMemo(() => {
    const out: { id: string; from: string; otp: string }[] = [];
    for (const m of messages.slice(0, 15)) {
      const otp = extractQuickOtp(`${m.subject ?? ""} ${m.preview ?? ""}`);
      if (otp && !out.some((o) => o.otp === otp)) out.push({ id: m.id, from: m.from, otp });
      if (out.length >= 6) break;
    }
    return out;
  }, [messages]);

  if (otps.length === 0) return null;

  const copy = async (id: string, otp: string) => {
    try {
      await navigator.clipboard.writeText(otp);
    } catch {
      /* abaikan */
    }
    buzz(15);
    setCopied(id);
    window.setTimeout(() => setCopied((c) => (c === id ? null : c)), 1500);
  };

  return (
    <section aria-label="Kode OTP terbaru">
      <h3 className="text-[13px] font-extrabold px-1 mb-2">Kode OTP Terbaru</h3>
      <div className="flex gap-2.5 overflow-x-auto -mx-4 px-4 pb-1" style={{ scrollbarWidth: "none" }}>
        {otps.map((o) => {
          const meta = senderMeta(o.from);
          const done = copied === o.id;
          return (
            <div
              key={o.id}
              className="shrink-0 w-40 rounded-2xl border border-dashed border-primary/40 bg-primary/[0.07] p-3"
            >
              <div className="flex items-center gap-1.5 mb-1.5 min-w-0">
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[11px] font-extrabold shrink-0"
                  style={{ background: meta.color }}
                >
                  {meta.letter}
                </span>
                <span className="text-[11px] font-bold truncate">{meta.name}</span>
              </div>
              <div className="text-[22px] font-extrabold tracking-[2px] text-primary">{o.otp}</div>
              <button
                onClick={() => copy(o.id, o.otp)}
                className="mt-2 w-full inline-flex items-center justify-center gap-1.5 text-[12px] font-bold text-primary-foreground bg-primary rounded-xl py-2 active:scale-[0.98]"
              >
                {done ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {done ? "Tersalin!" : "Salin"}
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}
