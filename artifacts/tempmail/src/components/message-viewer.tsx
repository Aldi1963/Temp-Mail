import { format } from "date-fns";
import { ArrowLeft, Download, FileText, Paperclip } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useGetMessage, useMarkMessageRead, getGetInboxQueryKey, getGetEmailStatsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";

interface MessageViewerProps {
  messageId: string;
  email: string;
  onBack: () => void;
}

export function MessageViewer({ messageId, email, onBack }: MessageViewerProps) {
  const queryClient = useQueryClient();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  
  const { data: message, isLoading, isError } = useGetMessage(
    { id: messageId, email },
    { query: { enabled: !!messageId && !!email, queryKey: ['message', messageId, email] } }
  );

  const markReadMutation = useMarkMessageRead();

  // Mark as read when opened
  useEffect(() => {
    if (message && !message.isRead) {
      markReadMutation.mutate(
        { data: { id: messageId, email } },
        {
          onSuccess: () => {
            // Optimistically update cache for the inbox list and stats
            queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey({ email }) });
            queryClient.invalidateQueries({ queryKey: getGetEmailStatsQueryKey({ email }) });
            
            // Also update the specific message cache
            queryClient.setQueryData(['message', messageId, email], (old: any) => 
              old ? { ...old, isRead: true } : old
            );
          }
        }
      );
    }
  }, [message, messageId, email, queryClient]);

  // Inject HTML into iframe safely
  useEffect(() => {
    if (message?.htmlBody && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        doc.write(message.htmlBody);
        doc.close();
      }
    }
  }, [message?.htmlBody]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-card rounded-lg border border-border shadow-sm p-6 space-y-4 animate-pulse flex-1">
        <div className="h-8 bg-muted rounded w-1/4 mb-4"></div>
        <div className="h-6 bg-muted rounded w-3/4"></div>
        <div className="flex gap-4 mb-6">
          <div className="h-4 bg-muted rounded w-32"></div>
          <div className="h-4 bg-muted rounded w-24"></div>
        </div>
        <Separator />
        <div className="space-y-2 mt-6">
          <div className="h-4 bg-muted rounded w-full"></div>
          <div className="h-4 bg-muted rounded w-full"></div>
          <div className="h-4 bg-muted rounded w-5/6"></div>
          <div className="h-4 bg-muted rounded w-4/6"></div>
        </div>
      </div>
    );
  }

  if (isError || !message) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-card rounded-lg border border-border shadow-sm p-6 flex-1">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold">Message not found</h3>
        <p className="text-muted-foreground mt-2 mb-6 text-center max-w-md">
          The message might have expired or been deleted.
        </p>
        <Button onClick={onBack}>Return to Inbox</Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border shadow-sm overflow-hidden flex-1">
      <div className="flex items-center gap-4 p-4 border-b border-border bg-muted/10 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 sm:hidden">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex flex-col flex-1 min-w-0">
          <h2 className="text-lg font-bold text-foreground truncate" data-testid="msg-view-subject">
            {message.subject || "(No Subject)"}
          </h2>
        </div>
      </div>

      <div className="p-4 sm:p-6 border-b border-border bg-muted/5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div className="flex flex-col">
            <span className="text-sm font-semibold text-foreground flex items-center gap-2">
              <span className="text-muted-foreground font-normal">From:</span> {message.from}
            </span>
            <span className="text-sm text-foreground/80 flex items-center gap-2 mt-1">
              <span className="text-muted-foreground font-normal">To:</span> {message.to}
            </span>
          </div>
          <span className="text-sm text-muted-foreground whitespace-nowrap bg-background px-3 py-1 rounded-md border border-border">
            {format(new Date(message.receivedAt), "PPpp")}
          </span>
        </div>

        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {message.attachments.map((att, i) => (
              <Badge key={i} variant="secondary" className="flex items-center gap-1.5 py-1.5 px-3">
                <Paperclip className="h-3 w-3" />
                <span className="max-w-[150px] truncate">{att.filename}</span>
                <span className="text-xs opacity-70">({Math.round(att.size / 1024)}kb)</span>
                <Download className="h-3 w-3 ml-1 cursor-pointer hover:text-primary transition-colors" />
              </Badge>
            ))}
          </div>
        )}
      </div>

      <ScrollArea className="flex-1 p-0">
        <div className="p-4 sm:p-6 min-h-full bg-white dark:bg-[#fafafa]">
          {message.htmlBody ? (
            <iframe
              ref={iframeRef}
              title="Message Content"
              className="w-full min-h-[500px] border-0"
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            />
          ) : (
            <div className="whitespace-pre-wrap font-mono text-sm text-black p-4">
              {message.textBody || "Empty message body."}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
