import { format } from "date-fns";
import { ArrowLeft, Download, FileText, Paperclip, FileDown, ShieldBan, ShieldAlert } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  useGetMessage,
  useMarkMessageRead,
  useAddToBlacklist,
  getGetInboxQueryKey,
  getGetEmailStatsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";

interface MessageViewerProps {
  messageId: string;
  email: string;
  onBack: () => void;
}

function exportAsEml(message: {
  from: string;
  to: string;
  subject: string;
  receivedAt: string;
  textBody?: string;
  htmlBody?: string;
}) {
  const date = new Date(message.receivedAt).toUTCString();
  const boundary = `boundary_${Date.now()}`;
  let body: string;

  if (message.htmlBody && message.textBody) {
    body = [
      `MIME-Version: 1.0`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      ``,
      `--${boundary}`,
      `Content-Type: text/plain; charset=UTF-8`,
      ``,
      message.textBody,
      `--${boundary}`,
      `Content-Type: text/html; charset=UTF-8`,
      ``,
      message.htmlBody,
      `--${boundary}--`,
    ].join("\r\n");
  } else {
    const contentType = message.htmlBody ? "text/html" : "text/plain";
    const content = message.htmlBody || message.textBody || "";
    body = [`MIME-Version: 1.0`, `Content-Type: ${contentType}; charset=UTF-8`, ``, content].join("\r\n");
  }

  const eml = [
    `From: ${message.from}`,
    `To: ${message.to}`,
    `Subject: ${message.subject}`,
    `Date: ${date}`,
    body,
  ].join("\r\n");

  const blob = new Blob([eml], { type: "message/rfc822" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${message.subject.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}.eml`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAsTxt(message: {
  from: string;
  to: string;
  subject: string;
  receivedAt: string;
  textBody?: string;
  htmlBody?: string;
}) {
  const date = format(new Date(message.receivedAt), "PPpp");
  const plainText = message.textBody || message.htmlBody?.replace(/<[^>]*>/g, "") || "";
  const txt = [
    `Dari: ${message.from}`,
    `Kepada: ${message.to}`,
    `Subjek: ${message.subject}`,
    `Tanggal: ${date}`,
    ``,
    `--- Isi Pesan ---`,
    ``,
    plainText,
  ].join("\n");

  const blob = new Blob([txt], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${message.subject.replace(/[^a-z0-9]/gi, "_").slice(0, 40)}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export function MessageViewer({ messageId, email, onBack }: MessageViewerProps) {
  const queryClient = useQueryClient();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();

  const { data: message, isLoading, isError } = useGetMessage(
    { id: messageId, email },
    { query: { enabled: !!messageId && !!email, queryKey: ["message", messageId, email] } }
  );

  const markReadMutation = useMarkMessageRead();
  const blockMutation = useAddToBlacklist();

  useEffect(() => {
    if (message && !message.isRead) {
      markReadMutation.mutate(
        { data: { id: messageId, email } },
        {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey({ email }) });
            queryClient.invalidateQueries({ queryKey: getGetEmailStatsQueryKey({ email }) });
            queryClient.setQueryData(["message", messageId, email], (old: typeof message) =>
              old ? { ...old, isRead: true } : old
            );
          },
        }
      );
    }
  }, [message?.id]);

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

  const handleBlock = (pattern: string, label: string) => {
    blockMutation.mutate(
      { data: { email, pattern } },
      {
        onSuccess: () => {
          toast({ title: "Pengirim diblokir", description: `${label} telah ditambahkan ke daftar blokir.` });
          queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey({ email }) });
        },
        onError: () => {
          toast({ title: "Gagal memblokir", variant: "destructive" });
        },
      }
    );
  };

  const getSenderDomain = (from: string) => {
    const match = from.match(/@([^>]+)>?$/);
    return match ? `@${match[1].trim()}` : null;
  };

  if (isLoading) {
    return (
      <div className="flex flex-col h-full bg-card rounded-lg border border-border shadow-sm p-6 space-y-4 animate-pulse flex-1">
        <div className="h-8 bg-muted rounded w-1/4 mb-4" />
        <div className="h-6 bg-muted rounded w-3/4" />
        <div className="flex gap-4 mb-6">
          <div className="h-4 bg-muted rounded w-32" />
          <div className="h-4 bg-muted rounded w-24" />
        </div>
        <Separator />
        <div className="space-y-2 mt-6">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-4 bg-muted rounded" style={{ width: `${90 - i * 10}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !message) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-card rounded-lg border border-border shadow-sm p-6 flex-1">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-xl font-semibold">Pesan tidak ditemukan</h3>
        <p className="text-muted-foreground mt-2 mb-6 text-center max-w-md">
          Pesan mungkin sudah kadaluarsa atau dihapus.
        </p>
        <Button onClick={onBack}>Kembali ke Inbox</Button>
      </div>
    );
  }

  const senderDomain = getSenderDomain(message.from);

  return (
    <div className="flex flex-col h-full bg-card rounded-lg border border-border shadow-sm overflow-hidden flex-1">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border bg-muted/10 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 sm:hidden h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-base font-bold text-foreground truncate flex-1" data-testid="msg-view-subject">
          {message.subject || "(Tanpa Subjek)"}
        </h2>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Block dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Blokir pengirim"
              >
                <ShieldBan className="h-3.5 w-3.5" />
                Blokir
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem
                className="text-xs cursor-pointer gap-2 text-destructive focus:text-destructive"
                onClick={() => handleBlock(message.from, message.from)}
                disabled={blockMutation.isPending}
              >
                <ShieldBan className="h-3.5 w-3.5" />
                Blokir pengirim ini
              </DropdownMenuItem>
              {senderDomain && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    className="text-xs cursor-pointer gap-2 text-orange-600 focus:text-orange-600"
                    onClick={() => handleBlock(senderDomain, senderDomain)}
                    disabled={blockMutation.isPending}
                  >
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Blokir domain {senderDomain}
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Export dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1.5 h-8 text-xs">
                <FileDown className="h-3.5 w-3.5" />
                Ekspor
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-36">
              <DropdownMenuItem
                className="text-xs cursor-pointer gap-2"
                onClick={() => exportAsEml(message)}
              >
                <Download className="h-3.5 w-3.5" />
                Unduh .eml
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs cursor-pointer gap-2"
                onClick={() => exportAsTxt(message)}
              >
                <FileText className="h-3.5 w-3.5" />
                Unduh .txt
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Meta */}
      <div className="p-4 sm:p-5 border-b border-border bg-muted/5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
          <div className="flex flex-col gap-1 min-w-0">
            <span className="text-sm flex items-center gap-1.5">
              <span className="text-muted-foreground text-xs">Dari:</span>
              <span className="font-medium truncate">{message.from}</span>
            </span>
            <span className="text-sm flex items-center gap-1.5">
              <span className="text-muted-foreground text-xs">Ke:</span>
              <span className="text-foreground/80 truncate">{message.to}</span>
            </span>
          </div>
          <span className="text-xs text-muted-foreground whitespace-nowrap bg-background px-2.5 py-1.5 rounded-md border border-border shrink-0">
            {format(new Date(message.receivedAt), "d MMM yyyy, HH:mm")}
          </span>
        </div>

        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {message.attachments.map((att, i) => (
              <Badge key={i} variant="secondary" className="flex items-center gap-1.5 py-1 px-2.5 text-xs">
                <Paperclip className="h-3 w-3" />
                <span className="max-w-[120px] truncate">{att.filename}</span>
                <span className="opacity-60">({Math.round(att.size / 1024)}kb)</span>
              </Badge>
            ))}
          </div>
        )}
      </div>

      {/* Body */}
      <ScrollArea className="flex-1 p-0">
        <div className="p-4 sm:p-6 min-h-full bg-white dark:bg-[#fafafa]">
          {message.htmlBody ? (
            <iframe
              ref={iframeRef}
              title="Isi Pesan"
              className="w-full min-h-[500px] border-0"
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            />
          ) : (
            <pre className="whitespace-pre-wrap font-mono text-sm text-black leading-relaxed">
              {message.textBody || "Isi pesan kosong."}
            </pre>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
