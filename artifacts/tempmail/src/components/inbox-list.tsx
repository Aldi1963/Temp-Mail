import { format } from "date-fns";
import { Search, Mail, MailOpen, AlertCircle } from "lucide-react";
import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { EmailMessageSummary } from "@workspace/api-client-react";

interface InboxListProps {
  messages: EmailMessageSummary[];
  isLoading: boolean;
  selectedMessageId: string | null;
  onSelectMessage: (id: string) => void;
}

type FilterType = "all" | "unread" | "read";

export function InboxList({ messages, isLoading, selectedMessageId, onSelectMessage }: InboxListProps) {
  const [filter, setFilter] = useState<FilterType>("all");
  const [search, setSearch] = useState("");

  const filteredMessages = useMemo(() => {
    return messages.filter((msg) => {
      // Apply read/unread filter
      if (filter === "unread" && msg.isRead) return false;
      if (filter === "read" && !msg.isRead) return false;
      
      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        return (
          msg.from.toLowerCase().includes(searchLower) ||
          msg.subject.toLowerCase().includes(searchLower) ||
          msg.preview.toLowerCase().includes(searchLower)
        );
      }
      
      return true;
    });
  }, [messages, filter, search]);

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border shadow-sm overflow-hidden flex-1 min-h-[400px] sm:min-h-0">
      <div className="p-4 border-b border-border space-y-4 bg-muted/20">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search emails..."
            className="pl-9 bg-background"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="input-search"
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={filter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("all")}
            className="flex-1"
            data-testid="filter-all"
          >
            All
          </Button>
          <Button
            variant={filter === "unread" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("unread")}
            className="flex-1"
            data-testid="filter-unread"
          >
            Unread
          </Button>
          <Button
            variant={filter === "read" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilter("read")}
            className="flex-1"
            data-testid="filter-read"
          >
            Read
          </Button>
        </div>
      </div>

      <ScrollArea className="flex-1">
        {isLoading ? (
          <div className="p-4 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="animate-pulse flex flex-col gap-2 p-4 rounded-lg border border-border">
                <div className="flex justify-between">
                  <div className="h-4 bg-muted rounded w-1/3"></div>
                  <div className="h-3 bg-muted rounded w-1/4"></div>
                </div>
                <div className="h-5 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-full"></div>
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
              {search || filter !== "all" ? "No matches found" : "Your inbox is empty"}
            </h3>
            <p className="text-sm text-muted-foreground mt-1 max-w-[250px]">
              {search || filter !== "all" 
                ? "Try adjusting your filters or search query." 
                : "Waiting for incoming emails. They will appear here automatically."}
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
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary"></div>
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
                  {msg.subject || "(No Subject)"}
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
