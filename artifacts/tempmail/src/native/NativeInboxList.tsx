import { useState } from "react";
import { Check, Copy, Inbox } from "lucide-react";
import { cn } from "@/lib/utils";
import { buzz, cleanSnippet, extractQuickOtp, senderMeta, timeAgo } from "./otp";

export interface NativeMsg {
  id: string;
  from: string;
  subject?: string | null;
  preview?: string | null;
  receivedAt: string;
  isRead?: boolean | null;
}

interface Props {
  messages: NativeMsg[];
  loading: boolean;
  onSelect: (id: string) => void;
}

export function NativeInboxList({ messages, loading, onSelect }: Props) {
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyOtp = async (e: React.MouseEvent, id: string, otp: string) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(otp);
    } catch {
      /* abaikan */
    }
    buzz(15);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
  };

  if (loading && messages.length === 0) {
    return (
      <div className="px-4 py-2 space-y-4" aria-hidden>
        {[0, 1, 2].map((i) => (
          <div key={i} className="flex gap-3 animate-pulse">
            <div className="w-10 h-10 rounded-full bg-muted shrink-0" />
            <div className="flex-1 space-y-2 py-1">
              <div className="h-3 rounded bg-muted w-2/3" />
              <div className="h-3 rounded bg-muted w-full" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center text-center px-8 py-10">
        <span className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
          <Inbox className="h-7 w-7 text-primary" />
        </span>
        <p className="text-sm font-bold">Belum ada pesan</p>
        <p className="text-xs text-muted-foreground mt-1">
          Alamat ini siap menerima email. Pesan baru muncul otomatis di sini.
        </p>
      </div>
    );
  }

  return (
    <div>
      {messages.map((m) => {
        const meta = senderMeta(m.from);
        const otp = extractQuickOtp(`${m.subject ?? ""} ${m.preview ?? ""}`);
        const unread = !m.isRead;
        return (
          <button
            key={m.id}
            onClick={() => onSelect(m.id)}
            className="w-full flex gap-3 px-4 py-3 text-left border-b border-border/50 active:bg-muted/70"
          >
            <span
              className="w-10 h-10 rounded-full flex items-center justify-center text-white text-[15px] font-extrabold shrink-0"
              style={{ background: meta.color }}
            >
              {meta.letter}
            </span>
            <span className="flex-1 min-w-0">
              <span className="flex items-baseline justify-between gap-2">
                <span
                  className={cn(
                    "text-[13px] truncate",
                    unread ? "font-bold text-foreground" : "font-medium text-muted-foreground"
                  )}
                >
                  {meta.name}
                </span>
                <span className="text-[11px] text-muted-foreground shrink-0">{timeAgo(m.receivedAt)}</span>
              </span>
              <span
                className={cn(
                  "block text-[13px] truncate mt-0.5",
                  unread ? "font-semibold text-foreground" : "text-muted-foreground"
                )}
              >
                {m.subject || "(tanpa subjek)"}
              </span>
              <span className="flex items-center gap-2 mt-1">
                <span className="text-[12px] text-muted-foreground truncate flex-1 min-w-0">
                  {cleanSnippet(m.preview)}
                </span>
                {otp && (
                  <span
                    role="button"
                    tabIndex={0}
                    onClick={(e) => copyOtp(e, m.id, otp)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") copyOtp(e as unknown as React.MouseEvent, m.id, otp);
                    }}
                    className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-primary bg-primary/10 border border-primary/30 rounded-lg px-2 py-1"
                  >
                    {copiedId === m.id ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                    {otp}
                  </span>
                )}
              </span>
            </span>
            {unread && <span className="w-2 h-2 rounded-full bg-primary mt-2 shrink-0" />}
          </button>
        );
      })}
    </div>
  );
}
