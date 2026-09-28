import { format } from "date-fns";
import {
  ArrowLeft, Download, FileText, Paperclip, FileDown, ShieldBan, ShieldAlert,
  Copy, Check, FileImage, FileVideo, FileAudio, FileArchive, FileCode, File,
  KeyRound, ExternalLink, Globe, Code, Printer, Forward, Share2
} from "lucide-react";
import { useEffect, useRef, useState, useMemo } from "react";
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
} from "@aldi1963/temp-mail-api-client";
import { useQueryClient } from "@tanstack/react-query";
import { getManageToken } from "@/lib/manage-token";
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

function getAttachmentIcon(contentType: string) {
  if (contentType.startsWith("image/")) return FileImage;
  if (contentType.startsWith("video/")) return FileVideo;
  if (contentType.startsWith("audio/")) return FileAudio;
  if (contentType.includes("zip") || contentType.includes("tar") || contentType.includes("rar") || contentType.includes("7z")) return FileArchive;
  if (contentType.includes("pdf") || contentType.includes("text")) return FileText;
  if (contentType.includes("html") || contentType.includes("javascript") || contentType.includes("json") || contentType.includes("xml")) return FileCode;
  return File;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Regex detector for OTP codes and verification links
function extractOtpAndLinks(text: string, html: string) {
  const combined = `${text} ${html.replace(/<[^>]*>/g, " ")}`;
  
  // Detect OTP (4-8 digits, or patterns like 123-456, G-123456)
  const otpPatterns = [
    /\b(?:code|kode|otp|pin|verification|verifikasi|token|password|passcode)\b[^\d]{1,25}(\d{4,8})\b/i,
    /\b([0-9]{3}[-\s][0-9]{3})\b/,
    /\b(?:G-|FB-)(\d{5,6})\b/i,
    /\b(\d{6})\b/
  ];

  let detectedOtp: string | null = null;
  for (const pattern of otpPatterns) {
    const match = combined.match(pattern);
    if (match) {
      detectedOtp = match[1] || match[0];
      break;
    }
  }

  // Detect verify/confirm URL
  let detectedVerifyUrl: string | null = null;
  const linkMatches = html.matchAll(/href=["'](https?:\/\/[^"']+)["']/gi);
  for (const m of linkMatches) {
    const url = m[1];
    if (/(verify|verifikasi|confirm|aktivasi|activate|auth|validate)/i.test(url)) {
      detectedVerifyUrl = url;
      break;
    }
  }

  return { detectedOtp, detectedVerifyUrl };
}

// Clean raw MIME headers if email was forwarded raw by Cloudflare simple worker
function looksLikeHtml(s: string): boolean {
  const t = s.trimStart();
  return /^(<!doctype html|<html[\s>]|<head[\s>]|<body[\s>])/i.test(t);
}

function parseReadableEmail(raw: string): { text: string; html: string | null } {
  if (!raw) return { text: "", html: null };

  // If already clean text (no MIME headers like Received:, ARC-Seal, etc)
  if (!raw.includes("Received:") && !raw.includes("ARC-Seal:") && !raw.includes("Content-Type:") && !raw.includes("boundary=")) {
    // Single-part HTML emails are sometimes stored as text — render them as HTML
    if (looksLikeHtml(raw)) return { text: "", html: raw };
    return { text: raw, html: null };
  }

  // Find all boundaries (handles nested multipart like Canva / Amazon SES)
  const boundaryRegex = /boundary="?([^"\r\n;]+)"?/gi;
  const boundaries: string[] = [];
  let bm: RegExpExecArray | null;
  while ((bm = boundaryRegex.exec(raw)) !== null) {
    boundaries.push(bm[1]);
  }

  function decodeQp(s: string): string {
    if (!s) return "";
    return s
      .replace(/=\r?\n/g, "")
      .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
  }

  function cleanPart(partStr: string): string {
    const bodyStart = partStr.indexOf("\r\n\r\n") !== -1 ? partStr.indexOf("\r\n\r\n") + 4 : partStr.indexOf("\n\n") !== -1 ? partStr.indexOf("\n\n") + 2 : -1;
    let body = bodyStart !== -1 ? partStr.slice(bodyStart) : partStr;
    body = body.replace(/--[^\r\n-]+--?[\r\n]*/g, "").trim();
    return decodeQp(body);
  }

  let extractedText = "";
  let extractedHtml: string | null = null;

  if (boundaries.length > 0) {
    for (const b of boundaries) {
      const escaped = b.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
      const parts = raw.split(new RegExp(`--${escaped}(?:--)?`));
      for (const part of parts) {
        if (part.includes("Content-Type: text/plain") && !extractedText) {
          extractedText = cleanPart(part);
        }
        if (part.includes("Content-Type: text/html") && !extractedHtml) {
          extractedHtml = cleanPart(part);
        }
      }
    }
  }

  if (!extractedText && !extractedHtml) {
    const headerEnd = raw.indexOf("\r\n\r\n") !== -1 ? raw.indexOf("\r\n\r\n") + 4 : raw.indexOf("\n\n") !== -1 ? raw.indexOf("\n\n") + 2 : -1;
    if (headerEnd !== -1) {
      extractedText = decodeQp(raw.slice(headerEnd).trim());
    }
  }

  const finalText = extractedText || raw;
  if (!extractedHtml && looksLikeHtml(finalText)) {
    return { text: "", html: finalText };
  }
  return { text: finalText, html: extractedHtml };
}

export function MessageViewer({ messageId, email, onBack }: MessageViewerProps) {
  const queryClient = useQueryClient();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [otpCopied, setOtpCopied] = useState(false);
  const [viewMode, setViewMode] = useState<"html" | "text">("html");

  const { data: message, isLoading, isError } = useGetMessage(
    { id: messageId, email },
    { query: { enabled: !!messageId && !!email, queryKey: ["message", messageId, email] } }
  );

  const markReadMutation = useMarkMessageRead();
  const blockMutation = useAddToBlacklist({
    request: email && getManageToken(email) ? { headers: { "X-Manage-Token": getManageToken(email)! } } : {},
  });

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

  const parsedContent = useMemo(() => {
    if (!message) return { text: "", html: null };

    // Function to extract clean HTML if raw HTML contains MIME headers/multiparts
    const extractCleanHtml = (raw: string | null): string | null => {
      if (!raw) return null;
      const htmlStart = raw.search(/<!doctype html|<html/i);
      if (htmlStart !== -1) {
        let clean = raw.slice(htmlStart);
        const htmlEnd = clean.search(/<\/html>/i);
        if (htmlEnd !== -1) {
          clean = clean.slice(0, htmlEnd + 7);
        }
        // decode quoted printable
        clean = clean
          .replace(/=\r?\n/g, "")
          .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
        return clean;
      }
      return raw;
    };

    if (message.htmlBody) {
      return {
        text: message.textBody || "",
        html: extractCleanHtml(message.htmlBody),
      };
    }
    const parsed = parseReadableEmail(message.textBody || "");
    return {
      text: parsed.text,
      html: extractCleanHtml(parsed.html),
    };
  }, [message]);

  const handlePrint = () => {
    if (iframeRef.current?.contentWindow) {
      try {
        iframeRef.current.contentWindow.focus();
        iframeRef.current.contentWindow.print();
        return;
      } catch {}
    }
    window.print();
  };

  useEffect(() => {
    if (parsedContent.html && iframeRef.current) {
      const doc = iframeRef.current.contentDocument;
      if (doc) {
        doc.open();
        // If html already has <!doctype html> or <html, write it directly!
        if (parsedContent.html.toLowerCase().includes("<html") || parsedContent.html.toLowerCase().includes("<!doctype")) {
          // Inject max-width responsive helper before </head> or at start
          let finalHtml = parsedContent.html;
          const responsiveStyle = `<style>
            body { margin: 8px; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
            img, table { max-width: 100% !important; height: auto !important; }
          </style>`;
          if (finalHtml.includes("</head>")) {
            finalHtml = finalHtml.replace("</head>", `${responsiveStyle}</head>`);
          } else {
            finalHtml = responsiveStyle + finalHtml;
          }
          doc.write(finalHtml);
        } else {
          const styledHtml = `
            <!DOCTYPE html>
            <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1">
                <style>
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    font-size: 14px;
                    line-height: 1.6;
                    margin: 8px;
                    color: inherit;
                    word-break: break-word;
                  }
                  img { max-width: 100% !important; height: auto !important; }
                  table { max-width: 100% !important; }
                </style>
              </head>
              <body>
                ${parsedContent.html}
              </body>
            </html>
          `;
          doc.write(styledHtml);
        }
        doc.close();

        // Auto-adjust iframe height to eliminate double scrollbar
        const adjustHeight = () => {
          if (iframeRef.current && doc.body) {
            const h = Math.max(doc.body.scrollHeight, doc.documentElement.scrollHeight, 250);
            iframeRef.current.style.height = `${h + 20}px`;
          }
        };
        setTimeout(adjustHeight, 150);
        setTimeout(adjustHeight, 500);
      }
    }
  }, [parsedContent.html]);

  const { detectedOtp, detectedVerifyUrl } = useMemo(() => {
    if (!message) return { detectedOtp: null, detectedVerifyUrl: null };
    return extractOtpAndLinks(parsedContent.text, parsedContent.html || "");
  }, [message, parsedContent]);

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

  const copyEmailContent = () => {
    if (!message) return;
    const plain = message.textBody || message.htmlBody?.replace(/<[^>]*>/g, "") || "";
    const full = [
      `Dari: ${message.from}`,
      `Ke: ${message.to}`,
      `Subjek: ${message.subject}`,
      `Tanggal: ${format(new Date(message.receivedAt), "d MMM yyyy, HH:mm")}`,
      ``,
      plain,
    ].join("\n");
    navigator.clipboard.writeText(full).then(() => {
      setCopied(true);
      toast({ title: "Tersalin!", description: "Isi email telah disalin ke clipboard.", duration: 2000 });
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const copyOtp = (otp: string) => {
    navigator.clipboard.writeText(otp);
    setOtpCopied(true);
    toast({ title: "Kode OTP Tersalin!", description: otp, duration: 2500 });
    setTimeout(() => setOtpCopied(false), 2000);
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
    <div className="flex flex-col h-full min-h-0 bg-card rounded-lg border border-border shadow-sm overflow-hidden flex-1">
      {/* Header */}
      <div className="flex items-center gap-3 p-3 sm:p-4 border-b border-border bg-muted/10 sticky top-0 z-10">
        <Button variant="ghost" size="icon" onClick={onBack} className="shrink-0 sm:hidden h-8 w-8">
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-sm sm:text-base font-bold text-foreground truncate flex-1" data-testid="msg-view-subject">
          {message.subject || "(Tanpa Subjek)"}
        </h2>

        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Copy button */}
          <Button
            variant="ghost"
            size="sm"
            className="gap-1 h-8 px-2 text-xs text-muted-foreground hover:text-primary hover:bg-primary/10"
            title="Salin isi email"
            onClick={copyEmailContent}
          >
            {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copied ? "Tersalin" : "Salin"}</span>
          </Button>

          {/* Block dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1 h-8 px-2 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                title="Blokir pengirim"
              >
                <ShieldBan className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Blokir</span>
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
              <Button variant="outline" size="sm" className="gap-1 h-8 px-2 text-xs">
                <FileDown className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Ekspor</span>
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
              <DropdownMenuItem
                className="text-xs cursor-pointer gap-2"
                onClick={handlePrint}
              >
                <Printer className="h-3.5 w-3.5" />
                Cetak / PDF
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-xs cursor-pointer gap-2"
                onClick={() => {
                  const subject = encodeURIComponent(`Fwd: ${message.subject}`);
                  const body = encodeURIComponent(
                    `--- Diteruskan dari TempMail ---\nDari: ${message.from}\nTanggal: ${message.receivedAt}\n\n${parsedContent.text || ""}`
                  );
                  window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
                }}
              >
                <Forward className="h-3.5 w-3.5" />
                Kirim ke Gmail
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* ── AUTO-DETECTED OTP & VERIFICATION CALLOUT ── */}
      {(detectedOtp || detectedVerifyUrl) && (
        <div className="bg-primary/5 border-b border-primary/20 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
          {detectedOtp && (
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-primary/10 text-primary">
                <KeyRound className="h-4 w-4" />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Kode OTP:
                </span>
                <span className="font-mono text-base font-extrabold text-foreground tracking-widest bg-background px-2.5 py-0.5 rounded border border-primary/30 select-all">
                  {detectedOtp}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => copyOtp(detectedOtp!)}
                  className="h-7 px-2.5 text-xs font-semibold text-primary border-primary/30 hover:bg-primary/10 gap-1 active:scale-95"
                >
                  {otpCopied ? <Check className="h-3 w-3 text-green-500" /> : <Copy className="h-3 w-3" />}
                  {otpCopied ? "Tersalin" : "Salin Kode"}
                </Button>
              </div>
            </div>
          )}

          {detectedVerifyUrl && (
            <div className="flex items-center gap-2 ml-auto">
              <a
                href={detectedVerifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 h-7 px-3 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-xs active:scale-95 transition-all"
              >
                <ExternalLink className="h-3 w-3" />
                Buka Link Verifikasi
              </a>
            </div>
          )}
        </div>
      )}

      {/* Meta */}
      <div className="p-3 sm:p-4 border-b border-border bg-muted/5">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3">
          <div className="flex flex-col gap-0.5 min-w-0">
            <span className="text-xs sm:text-sm flex items-center gap-1.5">
              <span className="text-muted-foreground text-xs">Dari:</span>
              <span className="font-medium truncate">{message.from}</span>
            </span>
            <span className="text-xs sm:text-sm flex items-center gap-1.5">
              <span className="text-muted-foreground text-xs">Ke:</span>
              <span className="text-foreground/80 truncate font-mono">{message.to}</span>
            </span>
          </div>
          <span className="text-[11px] sm:text-xs text-muted-foreground whitespace-nowrap bg-background px-2 py-1 rounded-md border border-border shrink-0 self-start">
            {format(new Date(message.receivedAt), "d MMM yyyy, HH:mm")}
          </span>
        </div>

        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/40">
            <div className="flex items-center gap-1.5 mb-2">
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">
                {message.attachments.length} Lampiran
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {message.attachments.map((att, i) => {
                const IconComponent = getAttachmentIcon(att.contentType);
                return (
                  <div
                    key={i}
                    className="flex items-center gap-2.5 rounded-lg border border-border bg-muted/30 px-3 py-2 group"
                  >
                    <div className="shrink-0 w-7 h-7 rounded-lg bg-background border border-border flex items-center justify-center">
                      <IconComponent className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium truncate leading-tight">{att.filename}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {formatFileSize(att.size)} · {att.contentType.split("/")[1]?.toUpperCase() || att.contentType}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
            <p className="text-[10px] text-muted-foreground mt-2 italic">
              Konten lampiran dilindungi untuk keamanan Anda.
            </p>
          </div>
        )}
      </div>

      {/* Body — Renders rich email (like Gmail) if HTML is available, or clean text */}
      <ScrollArea className="flex-1 min-h-0 p-0">
        <div className="p-2 sm:p-4 min-h-[300px] bg-white text-black rounded-b-2xl">
          {parsedContent.html ? (
            <iframe
              ref={iframeRef}
              title="Isi Pesan"
              className="w-full min-h-[450px] border-0 block bg-white"
              sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
            />
          ) : (
            <div className="p-3 whitespace-pre-wrap font-sans text-sm sm:text-base leading-relaxed max-w-none select-text text-slate-800">
              {parsedContent.text || "Isi pesan kosong."}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
