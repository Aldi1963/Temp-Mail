import { useState, useEffect } from "react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Link } from "wouter";
import {
  User, Lock, ShieldCheck, ChevronLeft, CheckCircle2, AlertTriangle, Copy, Eye, EyeOff,
  MailCheck, MailWarning, ExternalLink, Send, RefreshCw, Unplug, Ban, Plus, Trash2
} from "lucide-react";

import { API_BASE_URL as BASE, getFullBase } from "../lib/api-base";
const api = (path: string, opts?: RequestInit) =>
  fetch(`${BASE}/api${path}`, { credentials: "include", ...opts });

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy} className="text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

function EmailVerificationCard() {
  const { user, refetch } = useAuth();
  const [loading, setLoading] = useState(false);
  const [verifyUrl, setVerifyUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  if (!user) return null;

  const handleSendVerification = async () => {
    setLoading(true);
    const r = await api("/auth/send-verification", { method: "POST" });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) {
      toast({ title: "Gagal", description: data.message, variant: "destructive" });
      return;
    }
    const fullUrl = getFullBase() + data.verifyUrl;
    setVerifyUrl(fullUrl);
    toast({ title: "Link verifikasi dibuat!", description: "Klik link di bawah untuk memverifikasi email." });
  };

  const copyUrl = () => {
    if (!verifyUrl) return;
    navigator.clipboard.writeText(verifyUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (user.emailVerified) {
    return (
      <div className="rounded-xl border p-5 space-y-3 border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MailCheck className="h-5 w-5 text-green-600" />
            <h2 className="font-semibold text-lg">Verifikasi Email</h2>
          </div>
          <Badge className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-400 border-green-200 dark:border-green-800 text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" /> Terverifikasi
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Email <strong>{user.email}</strong> sudah terverifikasi. Akun Anda mendapat akses penuh.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-5 space-y-3 border-muted bg-muted/30">
      <div className="flex items-center gap-2">
        <MailWarning className="h-5 w-5 text-muted-foreground" />
        <h2 className="font-semibold text-lg">Verifikasi Email</h2>
      </div>
      <p className="text-sm text-muted-foreground">
        Verifikasi email saat ini <strong>dinonaktifkan</strong> — server belum terhubung ke
        layanan pengiriman email sehingga link verifikasi tidak dapat dikirim.
        Akun Anda tetap dapat digunakan seperti biasa.
      </p>
    </div>
  );
}

function ChangePasswordCard() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNext, setShowNext] = useState(false);
  const { toast } = useToast();

  const submit = async () => {
    if (next !== confirm) {
      toast({ title: "Password tidak cocok", variant: "destructive" });
      return;
    }
    if (next.length < 6) {
      toast({ title: "Password baru minimal 6 karakter", variant: "destructive" });
      return;
    }
    setLoading(true);
    const r = await api("/auth/change-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) {
      toast({ title: "Gagal", description: data.message, variant: "destructive" });
      return;
    }
    toast({ title: "Password berhasil diubah!" });
    setCurrent(""); setNext(""); setConfirm("");
  };

  return (
    <div className="rounded-xl border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Lock className="h-5 w-5 text-primary" />
        <h2 className="font-semibold text-lg">Ubah Password</h2>
      </div>
      <div className="space-y-3">
        <div className="relative">
          <Input
            type={showCurrent ? "text" : "password"}
            value={current}
            onChange={(e) => setCurrent(e.target.value)}
            placeholder="Password saat ini"
          />
          <button
            type="button"
            onClick={() => setShowCurrent(!showCurrent)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="relative">
          <Input
            type={showNext ? "text" : "password"}
            value={next}
            onChange={(e) => setNext(e.target.value)}
            placeholder="Password baru (min. 6 karakter)"
          />
          <button
            type="button"
            onClick={() => setShowNext(!showNext)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          >
            {showNext ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <Input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Konfirmasi password baru"
        />
        <Button onClick={submit} disabled={loading || !current || !next || !confirm} className="w-full">
          {loading ? "Menyimpan..." : "Ubah Password"}
        </Button>
      </div>
    </div>
  );
}

function TwoFactorCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [step, setStep] = useState<"idle" | "setup" | "enable" | "disable" | "backup">("idle");
  const [qrDataUrl, setQrDataUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [token, setToken] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadStatus = async () => {
    const r = await api("/auth/2fa/status");
    if (r.ok) { const d = await r.json(); setEnabled(d.enabled); }
  };

  useEffect(() => { loadStatus(); }, []);

  const startSetup = async () => {
    setLoading(true);
    const r = await api("/auth/2fa/setup", { method: "POST" });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) { toast({ title: "Gagal", description: data.message, variant: "destructive" }); return; }
    setQrDataUrl(data.qrDataUrl);
    setSecret(data.secret);
    setToken("");
    setStep("setup");
  };

  const enableTfa = async () => {
    setLoading(true);
    const r = await api("/auth/2fa/enable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) { toast({ title: "Gagal", description: data.message, variant: "destructive" }); return; }
    setBackupCodes(data.backupCodes);
    setStep("backup");
    setEnabled(true);
  };

  const disableTfa = async () => {
    setLoading(true);
    const r = await api("/auth/2fa/disable", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    const data = await r.json();
    setLoading(false);
    if (!r.ok) { toast({ title: "Gagal", description: data.message, variant: "destructive" }); return; }
    toast({ title: "2FA berhasil dinonaktifkan" });
    setEnabled(false);
    setStep("idle");
    setToken("");
  };

  return (
    <div className="rounded-xl border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Two-Factor Authentication (2FA)</h2>
        </div>
        {enabled !== null && (
          <Badge variant={enabled ? "default" : "secondary"} className="text-xs">
            {enabled ? "Aktif" : "Nonaktif"}
          </Badge>
        )}
      </div>

      {/* Status */}
      {step === "idle" && (
        <>
          {enabled === null && <p className="text-sm text-muted-foreground">Memuat status...</p>}
          {enabled === false && (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Aktifkan 2FA untuk keamanan login berlapis menggunakan aplikasi authenticator seperti Google Authenticator atau Authy.
              </p>
              <Button onClick={startSetup} disabled={loading} className="gap-2">
                <ShieldCheck className="h-4 w-4" />
                {loading ? "Memuat..." : "Aktifkan 2FA"}
              </Button>
            </div>
          )}
          {enabled === true && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-4 w-4" />
                Akun Anda dilindungi dengan 2FA.
              </div>
              <Button variant="outline" onClick={() => { setStep("disable"); setToken(""); }}>
                Nonaktifkan 2FA
              </Button>
            </div>
          )}
        </>
      )}

      {/* Setup — QR Code */}
      {step === "setup" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Scan QR code di bawah menggunakan aplikasi authenticator, lalu masukkan kode 6 digit.
          </p>
          <div className="flex justify-center">
            <img src={qrDataUrl} alt="QR Code 2FA" className="w-44 h-44 rounded-lg border" />
          </div>
          <div className="bg-muted rounded-lg p-3">
            <p className="text-xs text-muted-foreground mb-1">Atau masukkan kode manual:</p>
            <div className="flex items-center gap-2">
              <code className="text-xs font-mono break-all flex-1">{secret}</code>
              <CopyButton value={secret} />
            </div>
          </div>
          <Input
            value={token}
            onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Masukkan kode 6 digit"
            maxLength={6}
            className="text-center tracking-widest text-lg font-mono"
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("idle")} className="flex-1">Batal</Button>
            <Button onClick={enableTfa} disabled={loading || token.length !== 6} className="flex-1">
              {loading ? "Memverifikasi..." : "Verifikasi & Aktifkan"}
            </Button>
          </div>
        </div>
      )}

      {/* Backup Codes */}
      {step === "backup" && (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            <p className="text-sm font-medium">Simpan kode cadangan ini sekarang!</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Kode cadangan dapat digunakan sekali untuk login jika Anda tidak bisa mengakses aplikasi authenticator.
          </p>
          <div className="grid grid-cols-2 gap-2 bg-muted rounded-lg p-3">
            {backupCodes.map((code) => (
              <div key={code} className="flex items-center gap-2">
                <code className="text-xs font-mono text-foreground">{code}</code>
                <CopyButton value={code} />
              </div>
            ))}
          </div>
          <Button
            onClick={() => {
              navigator.clipboard.writeText(backupCodes.join("\n"));
              toast({ title: "Semua kode berhasil disalin!" });
            }}
            variant="outline"
            className="w-full gap-2"
          >
            <Copy className="h-4 w-4" /> Salin Semua Kode
          </Button>
          <Button className="w-full" onClick={() => setStep("idle")}>
            Selesai — Sudah Saya Simpan
          </Button>
        </div>
      )}

      {/* Disable */}
      {step === "disable" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Masukkan kode dari aplikasi authenticator untuk menonaktifkan 2FA.
          </p>
          <Input
            value={token}
            onChange={(e) => setToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="Kode 6 digit"
            maxLength={6}
            className="text-center tracking-widest text-lg font-mono"
          />
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setStep("idle")} className="flex-1">Batal</Button>
            <Button
              variant="destructive"
              onClick={disableTfa}
              disabled={loading || token.length !== 6}
              className="flex-1"
            >
              {loading ? "Memproses..." : "Nonaktifkan 2FA"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}


interface TelegramStatus {
  linked: boolean;
  username?: string | null;
}

function TelegramCard() {
  const [status, setStatus] = useState<TelegramStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [unlinking, setUnlinking] = useState(false);
  const [confirmUnlink, setConfirmUnlink] = useState(false);
  const { toast } = useToast();

  const jfetch = async (path: string, init?: RequestInit) => {
    const r = await api(path, init);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.message || `HTTP ${r.status}`);
    return d;
  };

  const load = async () => {
    setLoading(true);
    try {
      const d = await jfetch("/user/telegram");
      setStatus({ linked: !!d.linked, username: d.username ?? null });
    } catch {
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleLink = async () => {
    setLinking(true);
    try {
      const d = await jfetch("/user/telegram/link", { method: "POST" });
      if (!d?.url) throw new Error("URL penghubung tidak diterima dari server.");
      window.open(d.url, "_blank", "noopener");
      toast({
        title: "Buka Telegram",
        description: "Selesaikan penghubungan di aplikasi Telegram, lalu tekan Periksa Status.",
      });
    } catch (e) {
      toast({ title: "Gagal", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setLinking(false);
    }
  };

  const handleUnlink = async () => {
    setUnlinking(true);
    try {
      await jfetch("/user/telegram", { method: "DELETE" });
      setStatus({ linked: false, username: null });
      setConfirmUnlink(false);
      toast({ title: "Telegram diputus", description: "Penerusan pesan ke Telegram dihentikan." });
    } catch (e) {
      toast({ title: "Gagal", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setUnlinking(false);
    }
  };

  return (
    <div className="rounded-xl border p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Send className="h-5 w-5 text-primary" />
          <h2 className="font-semibold text-lg">Notifikasi Telegram</h2>
        </div>
        {!loading && status && (
          <Badge variant={status.linked ? "default" : "secondary"} className="text-xs">
            {status.linked ? "Terhubung" : "Belum terhubung"}
          </Badge>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat status...</p>
      ) : status === null ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Status Telegram belum bisa dimuat. Endpoint mungkin belum tersedia — coba lagi nanti.
          </p>
          <Button variant="outline" size="sm" onClick={load} className="gap-2">
            <RefreshCw className="h-3.5 w-3.5" /> Coba Lagi
          </Button>
        </div>
      ) : status.linked ? (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
            <CheckCircle2 className="h-4 w-4" />
            Terhubung{status.username ? <> sebagai <strong>@{status.username}</strong></> : ""}.
          </div>
          <p className="text-sm text-muted-foreground">
            Setiap pesan baru yang masuk ke alamat email Anda akan otomatis diteruskan ke Telegram.
          </p>
          {!confirmUnlink ? (
            <Button variant="outline" onClick={() => setConfirmUnlink(true)} className="gap-2">
              <Unplug className="h-4 w-4" /> Putus Koneksi
            </Button>
          ) : (
            <div className="flex items-center gap-2">
              <p className="text-sm text-muted-foreground flex-1">Yakin ingin memutus Telegram?</p>
              <Button variant="outline" size="sm" onClick={() => setConfirmUnlink(false)} disabled={unlinking}>
                Batal
              </Button>
              <Button variant="destructive" size="sm" onClick={handleUnlink} disabled={unlinking}>
                {unlinking ? "Memutus..." : "Ya, Putus"}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Hubungkan akun Telegram agar setiap pesan baru yang masuk ke alamat email Anda
            otomatis diteruskan ke Telegram.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleLink} disabled={linking} className="gap-2">
              <Send className="h-4 w-4" />
              {linking ? "Membuka..." : "Hubungkan Telegram"}
            </Button>
            <Button variant="outline" size="sm" onClick={load} className="gap-2 self-center">
              <RefreshCw className="h-3.5 w-3.5" /> Periksa Status
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}


interface BlockedSender {
  id: number | string;
  value: string;
  type: "email" | "domain";
  createdAt?: string | null;
}

function normalizeBlockedSenders(d: any): BlockedSender[] {
  const raw: any[] = Array.isArray(d) ? d : Array.isArray(d?.items) ? d.items : Array.isArray(d?.blocked) ? d.blocked : [];
  return raw.map((b, i) => ({
    id: b.id ?? b._id ?? i,
    value: b.value ?? b.pattern ?? b.email ?? b.domain ?? "",
    type: ((b.type === "domain" || (typeof (b.value ?? b.pattern) === "string" && (b.value ?? b.pattern).startsWith("@"))) ? "domain" : "email") as "email" | "domain",
    createdAt: b.createdAt ?? b.created_at ?? null,
  })).filter((b) => b.value);
}

function BlockedSendersCard() {
  const [items, setItems] = useState<BlockedSender[]>([]);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [type, setType] = useState<"email" | "domain">("email");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | string | null>(null);
  const { toast } = useToast();

  const jfetch = async (path: string, init?: RequestInit) => {
    const r = await api(path, init);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(d.message || `HTTP ${r.status}`);
    return d;
  };

  const load = async () => {
    setLoading(true);
    try {
      const d = await jfetch("/user/blocked-senders");
      setItems(normalizeBlockedSenders(d));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const add = async () => {
    const v = input.trim().toLowerCase();
    if (!v) return;
    if (type === "email" && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) {
      toast({ title: "Email tidak valid", description: "Masukkan alamat email lengkap, mis. spam@contoh.com.", variant: "destructive" });
      return;
    }
    if (type === "domain" && !/^@?[a-z0-9.-]+\.[a-z]{2,}$/.test(v)) {
      toast({ title: "Domain tidak valid", description: "Masukkan domain, mis. contoh.com atau @contoh.com.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await jfetch("/user/blocked-senders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ value: v, type }),
      });
      setInput("");
      await load();
      toast({ title: "Pengirim diblokir" });
    } catch (e) {
      toast({ title: "Gagal", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number | string) => {
    setDeletingId(id);
    try {
      await jfetch(`/user/blocked-senders/${encodeURIComponent(String(id))}`, { method: "DELETE" });
      setItems((prev) => prev.filter((x) => x.id !== id));
      toast({ title: "Blokir dihapus" });
    } catch (e) {
      toast({ title: "Gagal", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-xl border p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Ban className="h-5 w-5 text-primary" />
        <h2 className="font-semibold text-lg">Blokir Pengirim</h2>
        {!loading && items.length > 0 && (
          <Badge variant="secondary" className="text-xs">{items.length}</Badge>
        )}
      </div>
      <p className="text-sm text-muted-foreground">
        Pesan dari alamat email atau domain yang diblokir tidak akan muncul di inbox
        semua alamat milik akun Anda.
      </p>

      {/* Form tambah */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") add(); }}
          placeholder={type === "email" ? "spam@contoh.com" : "contoh.com"}
          className="flex-1"
        />
        <div className="flex gap-2">
          <div className="flex rounded-lg border p-0.5 gap-0.5 shrink-0">
            {(["email", "domain"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={`px-3 h-8 rounded-md text-xs font-medium transition-colors cursor-pointer ${type === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t === "email" ? "Email" : "Domain"}
              </button>
            ))}
          </div>
          <Button onClick={add} disabled={saving || !input.trim()} className="gap-1.5 shrink-0">
            <Plus className="h-4 w-4" /> {saving ? "Menyimpan..." : "Blokir"}
          </Button>
        </div>
      </div>

      {/* Daftar */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Memuat daftar blokir...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">Belum ada pengirim yang diblokir.</p>
      ) : (
        <div className="divide-y divide-border rounded-lg border overflow-hidden">
          {items.map((b) => (
            <div key={String(b.id)} className="flex items-center gap-2.5 px-3 py-2.5">
              <Ban className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="font-mono text-sm truncate flex-1 min-w-0">{b.value}</span>
              <Badge variant="outline" className="text-[10px] h-5 shrink-0">
                {b.type === "domain" ? "Domain" : "Email"}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => remove(b.id)}
                disabled={deletingId === b.id}
                title="Hapus dari blokir"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-8 space-y-6 overflow-x-hidden">
        <div className="flex items-center gap-3">
          <Link href="/dashboard">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <User className="h-6 w-6 text-primary" />
              Profil & Keamanan
            </h1>
            <p className="text-sm text-muted-foreground">Kelola informasi akun dan pengaturan keamanan</p>
          </div>
        </div>

        {/* Info Akun */}
        <div className="rounded-xl border p-5 space-y-3">
          <div className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-lg">Informasi Akun</h2>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Email</span>
              <span className="text-sm font-medium">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">Peran</span>
              <Badge variant={user?.role === "admin" ? "default" : "secondary"} className="text-xs">
                {user?.role === "admin" ? "Admin" : "User"}
              </Badge>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">Bergabung</span>
              <span className="text-sm">
                {user?.createdAt
                  ? new Date(user.createdAt).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" })
                  : "—"}
              </span>
            </div>
          </div>
        </div>

        <EmailVerificationCard />
        <TelegramCard />
        <BlockedSendersCard />
        <ChangePasswordCard />
        <TwoFactorCard />
      </main>
    </div>
  );
}
