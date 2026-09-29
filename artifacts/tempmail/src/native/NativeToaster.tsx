import * as ToastPrimitives from "@radix-ui/react-toast";
import { AlertCircle, CheckCircle2, X } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Toast bergaya notifikasi HP untuk aplikasi Android:
// kartu melayang rounded di bawah status bar, ikon bulat berwarna,
// judul + deskripsi ringkas, bisa di-swipe ke atas untuk menutup.
function ToastIcon({ variant }: { variant?: string | null }) {
  if (variant === "destructive") {
    return (
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/15 text-red-500">
        <AlertCircle className="h-5 w-5" />
      </span>
    );
  }
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500">
      <CheckCircle2 className="h-5 w-5" />
    </span>
  );
}

export function NativeToaster() {
  const { toasts } = useToast();

  return (
    <ToastPrimitives.Provider swipeDirection="up">
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <ToastPrimitives.Root
            key={id}
            {...props}
            className={cn(
              "pointer-events-auto flex w-full items-center gap-3 rounded-2xl border bg-card/95 p-3 pr-2.5",
              "shadow-[0_12px_32px_-8px_rgb(0_0_0/0.28)] backdrop-blur-xl",
              "data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:slide-in-from-top-8 data-[state=open]:duration-300",
              "data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:slide-out-to-top-8 data-[state=closed]:duration-200",
              "data-[swipe=move]:translate-y-[var(--radix-toast-swipe-move-y)] data-[swipe=move]:transition-none",
              "data-[swipe=cancel]:translate-y-0",
              "data-[swipe=end]:animate-out data-[swipe=end]:slide-out-to-top-full",
              variant === "destructive" && "border-red-500/40"
            )}
          >
            <ToastIcon variant={variant} />
            <div className="grid min-w-0 flex-1 gap-0.5">
              {title && (
                <ToastPrimitives.Title className="truncate text-[15px] font-semibold leading-tight">
                  {title}
                </ToastPrimitives.Title>
              )}
              {description && (
                <ToastPrimitives.Description className="line-clamp-2 text-[13px] leading-snug text-muted-foreground">
                  {description}
                </ToastPrimitives.Description>
              )}
            </div>
            {action}
            <ToastPrimitives.Close
              aria-label="Tutup"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground/70 transition-colors active:bg-muted"
            >
              <X className="h-4 w-4" />
            </ToastPrimitives.Close>
          </ToastPrimitives.Root>
        );
      })}
      <ToastPrimitives.Viewport className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex w-full flex-col items-center gap-2 px-4 pt-[max(env(safe-area-inset-top,0px)+10px,18px)]" />
    </ToastPrimitives.Provider>
  );
}
