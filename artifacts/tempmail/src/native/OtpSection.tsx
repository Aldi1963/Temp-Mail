import { useMemo, useState } from "react";
import { Check, ChevronDown, Copy } from "lucide-react";
import { cn } from "@/lib/utils";
import { buzz, extractQuickOtp, senderMeta, timeAgo } from "./otp";
import type { NativeMsg } from "./NativeInboxList";

interface OtpEntry {
  id: string;
  from: string;
  otp: string;
  receivedAt: string;
}

export function OtpSection({ messages }: { messages: NativeMsg[] }) {
  const [copied, setCopied] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const otps = useMemo(() => {
    const out: { id: string; from: string; otp: string }[] = [];
    for (const m of messages.slice(0, 15)) {
      const otp = extractQuickOtp(`${m.subject ?? ""} ${m.preview ?? ""}`);
      if (otp && !out.some((o) => o.otp === otp)) out.push({ id: m.id, from: m.from, otp });
      if (out.length >= 6) break;
    }
    return out;
  }, [messages]);

  const history = useMemo(() => {
    const out: OtpEntry[] = [];
    const seen = new Set<string>();
    const sorted = [...messages].sort(
      (a, b) => Date.parse(b.receivedAt) - Date.parse(a.receivedAt)
    );
    for (const m of sorted) {
      const otp = extractQuickOtp(`${m.subject ?? ""} ${m.preview ?? ""}`);
      if (otp && !seen.has(otp)) {
        seen.add(otp);
        out.push({ id: m.id, from: m.from, otp, receivedAt: m.receivedAt });
      }
    }
    return out;
  }, [messages]);

  if (otps.length === 0 && history.length === 0) return null;

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
    <section aria-label="Kode OTP">
      {otps.length > 0 && (
        <>
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
        </>
      )}

      {history.length > 0 && (
        <div className={otps.length > 0 ? "mt-3" : ""}>
          <button
            onClick={() => setShowHistory((v) => !v)}
            aria-expanded={showHistory}
            className="inline-flex items-center gap-1 text-[12px] font-bold text-primary active:opacity-70 px-1"
          >
            {showHistory ? "Sembunyikan riwayat" : `Lihat riwayat (${history.length})`}
            <ChevronDown
              className={cn("h-4 w-4 transition-transform", showHistory && "rotate-180")}
            />
          </button>
          {showHistory && (
            <div className="mt-2 rounded-2xl border border-border/60 divide-y divide-border/50 overflow-hidden">
              {history.map((h) => {
                const meta = senderMeta(h.from);
                const done = copied === h.id;
                return (
                  <div key={h.id} className="flex items-center gap-2.5 px-3 py-2.5 bg-card">
                    <span
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[12px] font-extrabold shrink-0"
                      style={{ background: meta.color }}
                    >
                      {meta.letter}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-[12px] font-bold truncate">{meta.name}</span>
                      <span className="block text-[11px] text-muted-foreground">
                        {timeAgo(h.receivedAt)}
                      </span>
                    </span>
                    <span className="text-[15px] font-extrabold tracking-[1.5px] text-primary shrink-0">
                      {h.otp}
                    </span>
                    <button
                      onClick={() => copy(h.id, h.otp)}
                      aria-label={`Salin OTP ${h.otp}`}
                      className="w-9 h-9 rounded-full flex items-center justify-center text-primary bg-primary/10 active:scale-95 shrink-0"
                    >
                      {done ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
