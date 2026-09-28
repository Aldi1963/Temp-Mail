import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Bell, BellOff, Check, Copy, Flame, Plus, QrCode, Share2, Star, Trash2, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Share } from "@capacitor/share";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { buzz, timeAgo, timeUntil } from "./otp";
import { useNativeSettings } from "./settings";
import { nativeFetch, manageHeaders } from "./api";
import { copyText } from "./clipboard";
import type { NativeMailbox } from "./useNativeMailbox";
import { CustomAddressForm } from "./CustomAddressForm";

function IconBtn({
  label,
  onClick,
  active,
  danger,
  children,
}: {
  label: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "w-8 h-8 rounded-full flex items-center justify-center shrink-0 active:bg-muted",
        danger ? "text-destructive" : active ? "text-primary" : "text-muted-foreground"
      )}
    >
      {children}
    </button>
  );
}

interface ServerEmail {
  email: string;
  label?: string | null;
  expiresAt?: string | null;
}

// Masa aktif alamat guest (tanpa akun): 30 hari sejak dibuat, seperti web.
const GUEST_LIFETIME_MS = 30 * 24 * 60 * 60 * 1000;

export function AlamatTab({ mailbox }: { mailbox: NativeMailbox }) {
  const { mergedInboxList, activeEmail, setActiveEmail, removeFromList, generateEmail, isGenerating, user } =
    mailbox;
  const { settings, patch } = useNativeSettings();
  const { toast } = useToast();
  const [qrOpen, setQrOpen] = useState<string | null>(null);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [extending, setExtending] = useState<string | null>(null);
  const [confirmDestroy, setConfirmDestroy] = useState<string | null>(null);
  const [serverLabels, setServerLabels] = useState<Record<string, string>>({});
  const [expiryMap, setExpiryMap] = useState<Record<string, string>>({});
  const [customOpen, setCustomOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  // Muat label + masa kedaluwarsa dari server sekali bila sudah login
  // (fallback bila label lokal kosong). expiryMap juga diperbarui lokal
  // setiap kali perpanjangan berhasil.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    nativeFetch<{ emails?: ServerEmail[] }>("/api/user/emails")
      .then((d) => {
        if (cancelled) return;
        const labels: Record<string, string> = {};
        const expiries: Record<string, string> = {};
        for (const e of d?.emails ?? []) {
          if (e?.email && e.label) labels[e.email] = e.label;
          if (e?.email && e.expiresAt) expiries[e.email] = e.expiresAt;
        }
        setServerLabels(labels);
        setExpiryMap((prev) => ({ ...expiries, ...prev }));
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user]);

  const labelFor = (email: string) => settings.labels[email] || serverLabels[email] || "";

  // Kedaluwarsa alamat: dari server bila login, else 30 hari sejak dibuat.
  const expiresAtFor = (email: string, addedAt: string): string | null => {
    const hit = expiryMap[email];
    if (hit) return hit;
    const t = Date.parse(addedAt ?? "");
    if (Number.isNaN(t)) return null;
    return new Date(t + GUEST_LIFETIME_MS).toISOString();
  };

  // Favorit selalu di atas, urutan lain dipertahankan.
  const sorted = [...mergedInboxList].sort((a, b) => {
    const fa = settings.favorites.includes(a.email) ? 0 : 1;
    const fb = settings.favorites.includes(b.email) ? 0 : 1;
    return fa - fb;
  });

  const toggleFav = (email: string) => {
    const has = settings.favorites.includes(email);
    patch({
      favorites: has
        ? settings.favorites.filter((e) => e !== email)
        : [email, ...settings.favorites],
    });
    buzz(10);
  };

  const toggleMute = (email: string) => {
    const off = settings.notifyOff.includes(email);
    patch({
      notifyOff: off
        ? settings.notifyOff.filter((e) => e !== email)
        : [...settings.notifyOff, email],
    });
    toast({ title: off ? "Notifikasi dinyalakan" : "Notifikasi dimatikan", description: email });
  };

  const saveLabel = (email: string) => {
    const clean = labelDraft.trim().slice(0, 40);
    const next = { ...settings.labels };
    if (clean) next[email] = clean;
    else delete next[email];
    patch({ labels: next });
    setEditingLabel(null);
    if (user) {
      // Sinkron ke server, fire-and-forget.
      nativeFetch("/api/user/emails/label", {
        method: "PATCH",
        body: JSON.stringify({ email, label: clean }),
      }).catch(() => {});
    }
  };

  const extend = async (email: string) => {
    setExtending(email);
    try {
      const data = await nativeFetch<{ appliedMinutes?: number; newExpiresAt?: string }>(
        "/api/email/extend",
        {
          method: "POST",
          headers: manageHeaders(email),
          body: JSON.stringify({ email, extraMinutes: 60 }),
        }
      );
      const mins = data?.appliedMinutes ?? 60;
      if (data?.newExpiresAt) {
        setExpiryMap((prev) => ({ ...prev, [email]: data.newExpiresAt as string }));
      }
      toast({ title: `Diperpanjang +${mins} menit`, description: "Masa aktif alamat bertambah." });
    } catch (e) {
      toast({
        title: "Gagal memperpanjang",
        description: e instanceof Error ? e.message : "Coba lagi.",
        variant: "destructive",
      });
    } finally {
      setExtending(null);
    }
  };

  // Musnahkan alamat permanen di server (two-tap confirm, tanpa popup).
  const destroy = async (email: string) => {
    if (confirmDestroy !== email) {
      setConfirmDestroy(email);
      window.setTimeout(() => setConfirmDestroy((c) => (c === email ? null : c)), 4000);
      return;
    }
    setConfirmDestroy(null);
    try {
      await nativeFetch(`/api/email/destroy?email=${encodeURIComponent(email)}`, {
        method: "DELETE",
        headers: manageHeaders(email),
      });
      removeFromList(email);
      toast({ title: "Alamat dimusnahkan permanen" });
    } catch (e) {
      toast({
        title: "Gagal memusnahkan",
        description: e instanceof Error ? e.message : "Coba lagi.",
        variant: "destructive",
      });
    }
  };

  const copyAddr = async (email: string) => {
    try {
      await navigator.clipboard.writeText(email);
      toast({ title: "Alamat disalin" });
    } catch {
      toast({ title: "Gagal menyalin", variant: "destructive" });
    }
  };

  // Ekspor/backup semua alamat ke JSON, dibagikan lewat share sheet native.
  // Fallback: salin JSON ke clipboard bila Share tidak tersedia/gagal.
  const exportAddresses = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const payload = {
        version: 1,
        exportedAt: new Date().toISOString(),
        addresses: sorted.map((e) => ({
          email: e.email,
          label: labelFor(e.email) || null,
          createdAt: e.addedAt,
        })),
      };
      const json = JSON.stringify(payload, null, 2);
      try {
        await Share.share({
          title: "Backup alamat TempMail",
          text: json,
          dialogTitle: "Ekspor alamat",
        });
        toast({ title: "Alamat diekspor" });
      } catch {
        const ok = await copyText(json);
        if (ok) {
          toast({ title: "JSON tersalin", description: "Share tidak tersedia, JSON disalin ke clipboard." });
        } else {
          toast({
            title: "Gagal mengekspor",
            description: "Share dan clipboard tidak tersedia.",
            variant: "destructive",
          });
        }
      }
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div
        className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/60"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center gap-1 pl-2 pr-1 h-14">
          <span className="text-[17px] font-extrabold tracking-tight flex-1 ml-2">Alamat Saya</span>
          <button
            type="button"
            aria-label="Ekspor alamat"
            onClick={exportAddresses}
            disabled={exporting || sorted.length === 0}
            className="w-10 h-10 rounded-full flex items-center justify-center mr-1 text-muted-foreground active:scale-95 disabled:opacity-50"
          >
            <Share2 className="h-5 w-5" />
          </button>
          <button
            type="button"
            aria-label="Buat alamat baru"
            onClick={() => generateEmail()}
            disabled={isGenerating}
            className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center mr-2 active:scale-95 disabled:opacity-60"
          >
            <Plus className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Form alamat kustom inline */}
      <div className="px-3 pt-3">
        <button
          type="button"
          onClick={() => setCustomOpen((o) => !o)}
          className={cn(
            "w-full rounded-2xl border border-dashed px-4 py-3 text-[13px] font-bold flex items-center justify-center gap-2 active:scale-[0.99]",
            customOpen ? "border-primary/60 text-primary bg-primary/[0.06]" : "border-primary/40 text-primary"
          )}
        >
          {customOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {customOpen ? "Tutup form kustom" : "Buat alamat kustom"}
        </button>
        {customOpen && (
          <CustomAddressForm
            mailbox={mailbox}
            onDone={() => setCustomOpen(false)}
            className="mt-2"
          />
        )}
      </div>

      <div className="p-3 space-y-2">
        {sorted.length === 0 && (
          <div className="text-center py-12 px-6">
            <p className="text-sm font-bold">Belum ada alamat</p>
            <p className="text-xs text-muted-foreground mt-1">
              Buat alamat pertama dengan tombol + di atas.
            </p>
          </div>
        )}
        {sorted.map((e) => {
          const on = e.email === activeEmail;
          const fav = settings.favorites.includes(e.email);
          const muted = settings.notifyOff.includes(e.email);
          const label = labelFor(e.email);
          const armed = confirmDestroy === e.email;
          const remaining = timeUntil(expiresAtFor(e.email, e.addedAt));
          const expired = remaining === "kedaluwarsa";
          return (
            <div
              key={e.email}
              className={cn(
                "rounded-2xl border",
                on ? "bg-primary/[0.08] border-primary/30" : "bg-card border-border/70"
              )}
            >
              <div className="flex items-center gap-0.5 p-2">
                <button
                  type="button"
                  onClick={() => {
                    setActiveEmail(e.email);
                    buzz(10);
                  }}
                  className="flex items-center gap-2.5 flex-1 min-w-0 text-left p-1"
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
                    <span className="block text-[11px] text-muted-foreground mt-0.5 truncate">
                      {on ? "Aktif · " : ""}
                      {fav ? "★ " : ""}
                      ditambahkan {timeAgo(e.addedAt)}
                      {remaining && (
                        <span
                          className={cn(
                            "font-bold",
                            expired ? "text-destructive" : "text-primary"
                          )}
                        >
                          {" "}· tersisa {remaining}
                        </span>
                      )}
                    </span>
                  </span>
                </button>
                <IconBtn label="Favorit" onClick={() => toggleFav(e.email)} active={fav}>
                  <Star className={cn("h-4 w-4", fav && "fill-amber-400 text-amber-400")} />
                </IconBtn>
                <IconBtn label="Bisukan notifikasi" onClick={() => toggleMute(e.email)} active={muted}>
                  {muted ? <BellOff className="h-4 w-4" /> : <Bell className="h-4 w-4" />}
                </IconBtn>
                <IconBtn
                  label="Tampilkan QR"
                  onClick={() => setQrOpen(qrOpen === e.email ? null : e.email)}
                  active={qrOpen === e.email}
                >
                  <QrCode className="h-4 w-4" />
                </IconBtn>
                <IconBtn
                  label={armed ? "Ketuk lagi untuk musnahkan" : "Musnahkan alamat"}
                  onClick={() => destroy(e.email)}
                  danger={armed}
                >
                  <Flame className="h-4 w-4" />
                </IconBtn>
                <IconBtn label={`Hapus ${e.email} dari daftar`} onClick={() => removeFromList(e.email)}>
                  <Trash2 className="h-4 w-4" />
                </IconBtn>
              </div>

              {armed && (
                <p className="px-4 pb-1 text-[11px] font-bold text-destructive">
                  Ketuk ikon api sekali lagi untuk memusnahkan alamat ini permanen.
                </p>
              )}

              <div className="flex items-center gap-2 pl-[42px] pr-3 pb-2.5 -mt-1">
                {editingLabel === e.email ? (
                  <input
                    autoFocus
                    value={labelDraft}
                    onChange={(ev) => setLabelDraft(ev.target.value)}
                    onBlur={() => saveLabel(e.email)}
                    onKeyDown={(ev) => {
                      if (ev.key === "Enter") saveLabel(e.email);
                      if (ev.key === "Escape") setEditingLabel(null);
                    }}
                    placeholder="Nama label…"
                    maxLength={40}
                    className="flex-1 min-w-0 text-[12px] bg-muted rounded-lg px-2 py-1 outline-none focus:ring-1 focus:ring-primary"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setLabelDraft(label);
                      setEditingLabel(e.email);
                    }}
                    className="flex-1 min-w-0 text-left text-[12px] text-muted-foreground truncate"
                  >
                    {label || <span className="italic">+ Tambah label</span>}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => extend(e.email)}
                  disabled={extending === e.email}
                  className="text-[12px] font-bold text-primary shrink-0 active:scale-95 disabled:opacity-50"
                >
                  {extending === e.email ? "…" : "Perpanjang"}
                </button>
              </div>

              {qrOpen === e.email && (
                <div className="border-t border-border/60 p-4 flex flex-col items-center gap-3">
                  <div className="bg-white p-3 rounded-2xl">
                    <QRCodeSVG value={e.email} size={160} />
                  </div>
                  <p className="text-[12px] font-mono break-all text-center px-2">{e.email}</p>
                  <button
                    type="button"
                    onClick={() => copyAddr(e.email)}
                    className="inline-flex items-center gap-1.5 text-[12px] font-bold bg-primary text-primary-foreground rounded-xl px-4 py-2 active:scale-95"
                  >
                    <Copy className="h-3.5 w-3.5" /> Salin alamat
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground text-center px-8 pb-6">
        Ketuk alamat untuk mengaktifkannya.
        <br />
        Ikon api memusnahkan alamat permanen, ikon sampah hanya menghapus dari daftar.
      </p>
    </div>
  );
}
