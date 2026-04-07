import { useState } from "react";
import { Plus, X, Check, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
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
}

function InboxBadge({ email }: { email: string }) {
  const { data } = useGetInbox(
    { email },
    { query: { enabled: !!email, refetchInterval: 10000 } }
  );
  const unread = data?.unreadCount ?? 0;
  if (!unread) return null;
  return (
    <Badge className="ml-auto h-5 min-w-5 text-xs bg-primary text-primary-foreground px-1.5">
      {unread > 9 ? "9+" : unread}
    </Badge>
  );
}

export function InboxSwitcher({ activeEmail, inboxList, onSwitch, onAdd, onRemove }: InboxSwitcherProps) {
  const [open, setOpen] = useState(false);

  const truncate = (email: string) => {
    if (email.length <= 24) return email;
    const [user, domain] = email.split("@");
    return `${user.slice(0, 10)}...@${domain}`;
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-8 text-xs relative">
          <Inbox className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Inboxes</span>
          {inboxList.length > 0 && (
            <Badge variant="secondary" className="h-4 min-w-4 text-[10px] px-1">
              {inboxList.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
          Active Inboxes ({inboxList.length})
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        {inboxList.length === 0 && (
          <div className="px-2 py-3 text-xs text-muted-foreground text-center">
            No saved inboxes yet.
          </div>
        )}

        {inboxList.map((entry) => (
          <DropdownMenuItem
            key={entry.email}
            className="flex items-center gap-2 cursor-pointer pr-1 group"
            onClick={() => {
              onSwitch(entry.email);
              setOpen(false);
            }}
          >
            <div className="flex items-center gap-2 flex-1 min-w-0">
              {activeEmail === entry.email ? (
                <Check className="h-3.5 w-3.5 text-primary shrink-0" />
              ) : (
                <div className="h-3.5 w-3.5 shrink-0" />
              )}
              <span
                className={`text-xs font-mono truncate ${
                  activeEmail === entry.email ? "text-primary font-semibold" : ""
                }`}
                title={entry.email}
              >
                {truncate(entry.email)}
              </span>
            </div>
            <InboxBadge email={entry.email} />
            <Button
              variant="ghost"
              size="icon"
              className="h-5 w-5 shrink-0 opacity-0 group-hover:opacity-100 hover:bg-destructive/10 hover:text-destructive ml-1"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(entry.email);
              }}
            >
              <X className="h-3 w-3" />
            </Button>
          </DropdownMenuItem>
        ))}

        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="flex items-center gap-2 cursor-pointer text-primary"
          onClick={() => {
            onAdd();
            setOpen(false);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="text-xs">Generate new inbox</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
