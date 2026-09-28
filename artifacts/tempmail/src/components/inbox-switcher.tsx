import { useState } from "react";
import { Plus, Check, Inbox, Trash2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useGetInbox } from "@workspace/api-client-react";

interface InboxEntry {
  email: string;
  addedAt: string;
}

interface InboxSwitcherProps {
  activeEmail: string | null;
  inboxList: InboxEntry[];
  onSwitch: (email: string) => void;
  onAdd: () => void;
  onRemove: (email: string) => void;
  className?: string;
  flat?: boolean;
  /** Ikon ringkas + badge jumlah untuk dipasang di header mobile */
  compact?: boolean;
}

function InboxBadge({ email }: { email: string }) {
  const { data } = useGetInbox(
    { email },
    { query: { queryKey: ["getInbox", email], enabled: !!email, refetchInterval: 10000 } }
  );
  const unread = data?.unreadCount ?? 0;
  if (!unread) return null;
  return (
    <Badge className="ml-auto h-5 min-w-5 text-xs bg-primary text-primary-foreground px-1.5">
      {unread > 9 ? "9+" : unread}
    </Badge>
  );
}

export function InboxSwitcher({ activeEmail, inboxList = [], onSwitch, onAdd, onRemove, className, flat, compact }: InboxSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState<string | null>(null);
  const safeList = Array.isArray(inboxList) ? inboxList : [];

  return (
    <>
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        {compact ? (
          <Button
            variant="ghost"
            size="icon"
            title="Ganti alamat email"
            aria-label="Ganti alamat email"
            className={`relative h-10 w-10 text-muted-foreground hover:text-foreground shrink-0 ${className ?? ""}`}
          >
            <Inbox className="h-5 w-5" />
            {safeList.length > 0 && (
              <span className="absolute top-1 right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-[18px] text-center">
                {safeList.length > 9 ? "9+" : safeList.length}
              </span>
            )}
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className={`gap-1.5 h-10 sm:h-8 px-3 sm:px-2.5 text-xs relative font-medium ${flat ? "border-transparent bg-transparent shadow-none hover:bg-muted/60" : "border-border/80 bg-background/80 hover:bg-muted"} ${className ?? ""}`}
          >
            <Inbox className="h-3.5 w-3.5 text-primary" />
            <span className="inline text-xs">Email ({safeList.length})</span>
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        className="w-[300px] sm:w-[320px] max-w-[90vw] p-2 bg-card border border-border/80 shadow-2xl rounded-2xl z-[100]"
      >
        <DropdownMenuLabel className="px-2.5 py-1.5 flex items-center justify-between font-normal">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5 text-primary" />
            Daftar Email ({safeList.length})
          </span>
          <span className="text-[10px] text-muted-foreground bg-muted/60 px-2 py-0.5 rounded-full font-medium">
            Aktif 30 Hari
          </span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="my-1.5 bg-border/60" />

        {safeList.length === 0 ? (
          <div className="px-3 py-6 text-xs text-muted-foreground text-center">
            Belum ada kotak masuk tersimpan.
          </div>
        ) : (
          <div className="space-y-1 max-h-[260px] overflow-y-auto pr-0.5">
            {safeList.map((entry) => (
              <DropdownMenuItem
                key={entry.email}
                onSelect={(e) => {
                  e.preventDefault();
                  onSwitch(entry.email);
                  setOpen(false);
                }}
                className={`flex items-center justify-between gap-2.5 px-3 py-2 rounded-xl text-xs cursor-pointer transition-all border ${
                  activeEmail === entry.email
                    ? "bg-primary/10 border-primary/30 text-primary font-medium shadow-xs"
                    : "bg-muted/20 hover:bg-muted/60 border-transparent text-foreground"
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {activeEmail === entry.email ? (
                    <div className="h-2 w-2 rounded-full bg-primary shrink-0 animate-pulse" />
                  ) : (
                    <div className="h-2 w-2 rounded-full bg-muted-foreground/30 shrink-0" />
                  )}
                  <span
                    className="font-mono text-xs truncate select-all"
                    title={entry.email}
                  >
                    {entry.email}
                  </span>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <InboxBadge email={entry.email} />
                  <span
                    role="button"
                    tabIndex={0}
                    title="Hapus email ini dari daftar"
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                      setConfirmEmail(entry.email);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.stopPropagation();
                        e.preventDefault();
                        setConfirmEmail(entry.email);
                      }
                    }}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 active:scale-95 transition-all cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </div>
        )}

        <DropdownMenuSeparator className="my-1.5 bg-border/60" />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault();
            onAdd();
            setOpen(false);
          }}
          className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
        >
          <Plus className="h-3.5 w-3.5" />
          Buat Alamat Email Baru
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
    <AlertDialog open={!!confirmEmail} onOpenChange={(o) => { if (!o) setConfirmEmail(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Hapus dari daftar?</AlertDialogTitle>
          <AlertDialogDescription>
            <span className="font-mono font-semibold text-foreground break-all">{confirmEmail}</span>{" "}
            akan dilepas dari daftar alamat. Pesan di server tetap ada, tetapi alamat ini tidak lagi tampil di sini.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (confirmEmail) onRemove(confirmEmail);
              setConfirmEmail(null);
            }}
          >
            Ya, Hapus
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
}
