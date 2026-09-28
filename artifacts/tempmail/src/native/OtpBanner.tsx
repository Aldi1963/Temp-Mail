import { useEffect, useMemo, useState } from "react";
import { KeyRound, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNativeSettings } from "./settings";
import { buzz, extractQuickOtp, senderMeta } from "./otp";
import { copyText } from "./clipboard";
import { markOtpAutoCopied, wasOtpAutoCopied } from "./otpSeen";
import type { NativeMsg } from "./NativeInboxList";

interface Props {
  messages: NativeMsg[];
}

// Banner material untuk OTP yang belum dibaca: kode besar + tombol "Salin".
// Tampil di atas daftar inbox; hilang setelah pesan dibaca / kode disalin.
export function OtpBanner({ messages }: Props) {
  const { settings } = useNativeSettings();
  const { toast } = useToast();
  const [handled, setHandled] = useState<string[]>([]);

  // Pesan belum dibaca terbaru yang mengandung kode OTP.
  const target = useMemo(() => {
    for (const m of messages) {
      if (m.isRead) continue;
      if (handled.includes(m.id)) continue;
      const otp = extractQuickOtp(`${m.subject ?? ""} ${m.preview ?? ""}`);
      if (otp) return { id: m.id, from: m.from, otp };
    }
    return null;
  }, [messages, handled]);

  // Salin otomatis saat banner muncul (setting "Salin OTP otomatis").
  // Registri bersama mencegah dobel salin dengan hook mailbox.
  useEffect(() => {
    if (!target || !settings.autoCopyOtp) return;
    if (wasOtpAutoCopied(target.id)) return;
    markOtpAutoCopied(target.id);
    void (async () => {
      const ok = await copyText(target.otp);
      if (ok) {
        buzz(15);
        toast({ title: "Kode OTP disalin" });
      }
    })();
  }, [target, settings.autoCopyOtp, toast]);

  if (!target) return null;
  const meta = senderMeta(target.from);

  const copy = async () => {
    const ok = await copyText(target.otp);
    buzz(15);
    toast(
      ok
        ? { title: "Kode OTP disalin" }
        : { title: "Gagal menyalin", variant: "destructive" }
    );
    setHandled((h) => [...h, target.id]);
  };

  const dismiss = () => setHandled((h) => [...h, target.id]);

  return (
    <div className="mx-4 mt-5 rounded-[20px] bg-primary text-primary-foreground shadow-[0_14px_30px_-12px_rgba(0,0,0,0.55)] overflow-hidden">
      <div className="flex items-center gap-2.5 px-4 pt-3.5">
        <span className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center shrink-0">
          <KeyRound className="h-4 w-4" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-[12px] font-extrabold uppercase tracking-wide opacity-90">
            Kode OTP belum dibaca
          </span>
          <span className="block text-[11px] opacity-70 truncate">
            {meta.name}
          </span>
        </span>
        <button
          type="button"
          aria-label="Tutup banner OTP"
          onClick={dismiss}
          className="w-8 h-8 rounded-full flex items-center justify-center active:bg-primary-foreground/20 shrink-0"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center gap-3 px-4 pt-1 pb-4">
        <span className="flex-1 min-w-0 font-mono text-[32px] leading-none font-extrabold tracking-[5px] truncate">
          {target.otp}
        </span>
        <button
          type="button"
          onClick={copy}
          className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-primary-foreground text-primary text-[14px] font-extrabold px-6 py-2.5 active:scale-95 shadow"
        >
          Salin
        </button>
      </div>
    </div>
  );
}
