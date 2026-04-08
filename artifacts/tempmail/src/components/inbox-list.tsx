import { format } from "date-fns";
import { Search, Mail, MailOpen, AlertCircle, RefreshCw, CheckCheck, ArrowUpDown, Bell, BellOff } from "lucide-react";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmailMessageSummary } from "@workspace/api-client-react";

interface InboxListProps {
  messages: EmailMessageSummary[];
  isLoading: boolean;
  selectedMessageId: string | null;
  onSelectMessage: (id: string) => void;
  onRefresh?: () => void;
  onMarkAllRead?: () => void;
  notifPermission?: NotificationPermission | "unsupported";
  onRequestNotif?: () => void;
}

type FilterType = "all" | "unread" | "read";
type SortType = "newest" | "oldest" | "sender";

export function InboxList({
  messages,
  isLoading,
  selectedMessageId,
  onSelectMessage,
  onRefresh,
  onMarkAllRead,
  notifPermission,
  onRequestNotif,
}: InboxListProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("newest");
  const [search, setSearch] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);

  const unreadCount = useMemo(() => messages.filter((m) => !m.isRead).length, [messages]);

  const filteredMessages = useMemo(() => {
    let result = messages.filter((msg) => {
      if (filter === "unread" && msg.isRead) return false;
      if (filter === "read" && !msg.isRead) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          msg.from.toLowerCase().includes(q) ||
          msg.subject.toLowerCase().includes(q) ||
          msg.preview.toLowerCase().includes(q)
        );
      }
      return true;
    });

    result = [...result].sort((a, b) => {
      if (sort === "oldest") {
        return new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
      }
      if (sort === "sender") {
        return a.from.localeCompare(b.from);
      }
      return new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime();
    });

    return result;
  }, [messages, filter, search, sort]);

  const handleRefresh = async () => {
    if (!onRefresh) return;
    setIsRefreshing(true);
    onRefresh();
    setTimeout(() => setIsRefreshing(false), 600);
  };

  const sortLabel = sort === "newest" ? "Terbaru" : sort === "oldest" ? "Terlama" : "Pengirim";

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border shadow-sm overflow-hidden flex-1 min-h-[400px] sm:min-h-0">
      <div className="p-4 border-b border-border space-y-3 bg-muted/20">
        {/* Search + action buttons */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Cari email, pengirim..."
              className="pl-9 bg-background h-9 text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="inbox-search"
            />
          </div>

          {/* Sort dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary"
                title={`Urutan: ${sortLabel}`}
              >
                <ArrowUpDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-40">
              <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">Urutkan berdasarkan</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className={`text-xs cursor-pointer ${sort === "newest" ? "font-semibold text-primary" : ""}`}
                onClick={() => setSort("newest")}
              >
                Terbaru dulu
              </DropdownMenuItem>
              <DropdownMenuItem
                className={`text-xs cursor-pointer ${sort === "oldest" ? "font-semibold text-primary" : ""}`}
                onClick={() => setSort("oldest")}
              >
                Terlama dulu
              </DropdownMenuItem>
              <DropdownMenuItem
                className={`text-xs cursor-pointer ${sort === "sender" ? "font-semibold text-primary" : ""}`}
                onClick={() => setSort("sender")}
              >
                Nama pengirim
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary"
              title="Tandai semua dibaca"
              onClick={onMarkAllRead}
              data-testid="btn-mark-all-read"
            >
              <CheckCheck className="h-4 w-4" />
            </Button>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 text-muted-foreground hover:text-primary"
            title="Refresh inbox (R)"
            onClick={handleRefresh}
            data-testid="btn-refresh-inbox"
          >
            <RefreshCw className={`h-4 w-4 transition-transform ${isRefreshing ? "animate-spin" : ""}`} />
          </Button>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-1.5">
          {(["all", "unread", "read"] as FilterType[]).map((f) => (
            <Button
              key={f}
              variant={filter === f ? "default" : "outline"}
              size="sm"
              className="flex-1 h-8 text-xs"
              onClick={() => setFilter(f)}
              data-testid={`filter-${f}`}
            >
              {f === "all" ? "Semua" : f === "unread" ? `Belum Dibaca${unreadCount > 0 ? ` (${unreadCount})` : ""}` : "Sudah Dibaca"}
            </Button>
          ))}
        </div>

        {/* Notification permission banner */}
        {notifPermission === "default" && onRequestNotif && (
          <button
            onClick={onRequestNotif}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 hover:bg-primary/10 transition-colors text-left"
          >
            <Bell className="h-4 w-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-primary">Aktifkan Notifikasi Browser</p>
              <p className="text-[11px] text-muted-foreground">Dapat pemberitahuan saat email baru masuk</p>
            </div>
          </button>
        )}
        {notifPermission === "denied" && (
          <div className="w-full flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 text-left">
            <BellOff className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <p className="text-[11px] text-muted-foreground">Notifikasi diblokir. Aktifkan di pengaturan browser.</p>
          </div>
        )}
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse flex flex-col gap-2 p-4 rounded-lg border border-border">
                <div className="flex justify-between">
                  <div className="h-4 bg-muted rounded w-1/3" />
                  <div className="h-3 bg-muted rounded w-1/4" />
                </div>
                <div className="h-5 bg-muted rounded w-3/4" />
                <div className="h-4 bg-muted rounded w-full" />
              </div>
            ))}
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[300px] text-center px-4">
            <div className="bg-muted/50 p-4 rounded-full mb-4">
              {search || filter !== "all" ? (
                <AlertCircle className="h-8 w-8 text-muted-foreground" />
              ) : (
                <Mail className="h-8 w-8 text-muted-foreground" />
              )}
            </div>
            <h3 className="text-lg font-medium text-foreground">
              {search || filter !== "all" ? "Tidak ada yang cocok" : "Inbox kosong"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-[250px]">
              {search || filter !== "all"
                ? "Coba ubah filter atau kata kunci pencarian."
                : "Menunggu email masuk. Akan muncul otomatis di sini."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredMessages.map((msg) => (
              <button
                key={msg.id}
                onClick={() => onSelectMessage(msg.id)}
                className={`w-full text-left p-4 hover:bg-accent/50 transition-colors flex flex-col gap-1 relative ${
                  selectedMessageId === msg.id ? "bg-accent" : ""
                } ${!msg.isRead ? "bg-primary/5" : ""}`}
                data-testid={`msg-item-${msg.id}`}
              >
                {!msg.isRead && (
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary" />
                )}

                <div className="flex items-center justify-between w-full mb-1">
                  <div className="flex items-center gap-2 truncate pr-4">
                    {msg.isRead ? (
                      <MailOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                    ) : (
                      <Mail className="h-4 w-4 text-primary shrink-0" />
                    )}
                    <span className={`text-sm truncate ${!msg.isRead ? "font-bold text-foreground" : "font-medium text-foreground/80"}`}>
                      {msg.from}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                    {format(new Date(msg.receivedAt), "HH:mm")}
                  </span>
                </div>

                <div className={`text-sm truncate ${!msg.isRead ? "font-semibold text-foreground" : "text-foreground/90"}`}>
                  {msg.subject || "(Tanpa Subjek)"}
                </div>

                <div className="text-xs text-muted-foreground line-clamp-2 mt-1">
                  {msg.preview}
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
