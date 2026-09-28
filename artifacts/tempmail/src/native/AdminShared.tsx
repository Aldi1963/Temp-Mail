// Komponen bantu bersama untuk layar admin native (tanpa dialog sistem).
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { RefreshCw, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Saklar gaya native, konsisten dengan LainnyaTab.
export function AdminToggle({
  on,
  onChange,
  label,
  disabled,
}: {
  on: boolean;
  onChange: () => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "w-11 h-6 rounded-full p-0.5 transition-colors shrink-0",
        on ? "bg-primary" : "bg-muted",
        disabled && "opacity-50"
      )}
    >
      <span
        className={cn(
          "block w-5 h-5 rounded-full bg-white shadow transition-transform",
          on && "translate-x-5"
        )}
      />
    </button>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-[12px] font-bold text-muted-foreground mb-1.5">
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-[11px] text-muted-foreground mt-1.5">{hint}</span>
      )}
    </label>
  );
}

export const inputCls =
  "w-full rounded-xl bg-muted px-3 py-2.5 text-[14px] text-foreground placeholder:text-muted-foreground/60 outline-none focus:ring-2 focus:ring-primary/40";

export function ErrorBox({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/[0.06] p-4 text-center">
      <p className="text-[13px] text-destructive font-semibold">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-2.5 inline-flex items-center gap-1.5 text-[13px] font-bold text-primary bg-primary/10 rounded-xl px-4 py-2 active:scale-[0.97]"
      >
        <RefreshCw className="h-3.5 w-3.5" /> Coba lagi
      </button>
    </div>
  );
}

export function LoadingBlock({ label = "Memuat..." }: { label?: string }) {
  return (
    <div className="py-10 flex flex-col items-center gap-2 text-muted-foreground">
      <span className="w-6 h-6 rounded-full border-2 border-muted-foreground/30 border-t-primary animate-spin" />
      <span className="text-[12px] font-semibold">{label}</span>
    </div>
  );
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Tombol hapus dua ketuk (tanpa dialog sistem): ketuk pertama mempersenjatai,
// ketuk kedua mengeksekusi. Otomatis kembali aman setelah 4 detik.
export function DangerConfirm({
  label = "Hapus",
  confirmLabel = "Ketuk lagi untuk hapus",
  onConfirm,
  disabled,
}: {
  label?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 4000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 text-[12.5px] font-bold rounded-xl px-3.5 py-2 active:scale-[0.97] transition-colors",
        armed ? "bg-destructive text-white" : "text-destructive bg-destructive/10",
        disabled && "opacity-50"
      )}
    >
      <Trash2 className="h-3.5 w-3.5" />
      {armed ? confirmLabel : label}
    </button>
  );
}
