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
  MailCheck, MailWarning, ExternalLink
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
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
    const fullUrl = window.location.origin + import.meta.env.BASE_URL.replace(/\/$/, "") + data.verifyUrl;
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
    <div className="rounded-xl border p-5 space-y-4 border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MailWarning className="h-5 w-5 text-orange-600" />
          <h2 className="font-semibold text-lg">Verifikasi Email</h2>
        </div>
        <Badge variant="secondary" className="text-xs text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30 border-orange-200">
          Belum Diverifikasi
        </Badge>
      </div>

      <div className="flex items-start gap-2 text-sm text-orange-700 dark:text-orange-300">
        <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
        <p>Email akun Anda belum diverifikasi. Klik tombol untuk mendapatkan link verifikasi.</p>
      </div>

      {!verifyUrl ? (
        <Button
          onClick={handleSendVerification}
          disabled={loading}
          className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
        >
          <MailCheck className="h-4 w-4" />
          {loading ? "Membuat link..." : "Dapatkan Link Verifikasi"}
        </Button>
      ) : (
        <div className="space-y-3">
          <div className="bg-background rounded-lg border border-border p-3 space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Link Verifikasi Anda:</p>
            <div className="flex items-start gap-2">
              <code className="text-xs break-all flex-1 text-primary font-mono leading-relaxed">{verifyUrl}</code>
              <button onClick={copyUrl} className="shrink-0 text-muted-foreground hover:text-foreground transition-colors mt-0.5">
                {copied ? <CheckCircle2 className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="flex gap-2">
            <a href={verifyUrl} target="_self" className="flex-1">
              <Button className="w-full gap-2">
                <ExternalLink className="h-4 w-4" />
                Klik untuk Verifikasi
              </Button>
            </a>
            <Button variant="outline" onClick={() => setVerifyUrl(null)} className="shrink-0">
              Reset
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Link berlaku selama 24 jam dan hanya dapat digunakan sekali.
          </p>
        </div>
      )}
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
        <ChangePasswordCard />
        <TwoFactorCard />
      </main>
    </div>
  );
}
