import { Check, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { buzz, timeAgo } from "./otp";
import type { NativeMailbox } from "./useNativeMailbox";

export function AlamatTab({ mailbox }: { mailbox: NativeMailbox }) {
  const { mergedInboxList, activeEmail, setActiveEmail, removeFromList, generateEmail, isGenerating } =
    mailbox;

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/60">
        <div className="flex items-center gap-1 pl-2 pr-1 h-14">
          <span className="text-[17px] font-extrabold tracking-tight flex-1 ml-2">Alamat Saya</span>
          <button
            aria-label="Buat alamat baru"
            onClick={() => generateEmail()}
            disabled={isGenerating}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mr-2 active:scale-95 disabled:opacity-60"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="p-3 space-y-2">
        {mergedInboxList.length === 0 && (
          <div className="text-center py-12 px-6">
            <p className="text-sm font-bold">Belum ada alamat</p>
            <p className="text-xs text-muted-foreground mt-1">
              Buat alamat pertama dengan tombol + di atas.
            </p>
          </div>
        )}
        {mergedInboxList.map((e) => {
          const on = e.email === activeEmail;
          return (
            <div
              key={e.email}
              className={cn(
                "flex items-center gap-2 rounded-2xl border p-2.5",
                on ? "bg-primary/[0.08] border-primary/30" : "bg-card border-border/70"
              )}
            >
              <button
                onClick={() => {
                  setActiveEmail(e.email);
                  buzz(10);
                }}
                className="flex items-center gap-3 flex-1 min-w-0 text-left p-1"
              >
                <span
                  className={cn(
                    "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0",
                    on ? "border-primary bg-primary" : "border-muted-foreground/40"
                  )}
                >
                  {on && <Check className="h-3 w-3 text-primary-foreground" strokeWidth={3.5} />}
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-[13.5px] font-bold truncate">{e.email}</span>
                  <span className="block text-[11px] text-muted-foreground mt-0.5">
                    {on ? "Aktif · " : ""}ditambahkan {timeAgo(e.addedAt)}
                  </span>
                </span>
              </button>
              <button
                aria-label={`Hapus ${e.email}`}
                onClick={() => removeFromList(e.email)}
                className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground active:bg-destructive/10 active:text-destructive shrink-0"
              >
                <Trash2 className="h-[18px] w-[18px]" />
              </button>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground text-center px-8 pb-6">
        Ketuk alamat untuk mengaktifkannya.
        <br />
        Ikon sampah menghapus alamat dari daftar.
      </p>
    </div>
  );
}
