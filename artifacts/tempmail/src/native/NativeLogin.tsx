// Halaman Masuk/Daftar fullscreen khusus aplikasi native.
// BUKAN popup: halaman penuh dengan tombol kembali, tombol Google,
// tab inline, dan error ditampilkan sebagai teks inline.
import { useState } from "react";
import {
  ArrowLeft,
  Loader2,
  LogIn,
  UserPlus,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
} from "lucide-react";
import { useNativeAuth } from "./useNativeAuth";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

// Logo "G" Google resmi (4 warna).
function GoogleGLogo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

export function NativeLogin({ onDone }: { onDone: () => void }) {
  const { login, register, loginWithGoogle, googleAvailable } = useNativeAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
  };

  const handleGoogle = async () => {
    setError(null);
    setGoogleBusy(true);
    try {
      await loginWithGoogle();
      onDone();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Login Google gagal.";
      // Batal menutup browser = bukan error, abaikan saja.
      if (msg !== "Login Google dibatalkan.") setError(msg);
    } finally {
      setGoogleBusy(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const em = email.trim().toLowerCase();
    if (!em || !password) {
      setError("Email dan password wajib diisi.");
      return;
    }
    if (mode === "register" && password.length < 8) {
      setError("Password minimal 8 karakter.");
      return;
    }
    setIsSubmitting(true);
    try {
      if (mode === "login") await login(em, password);
      else await register(em, password);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Terjadi kesalahan.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-background">
      {/* Header halaman */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/60">
        <div className="flex items-center gap-1 pl-2 pr-1 h-14">
          <button
            aria-label="Kembali"
            onClick={onDone}
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-[17px] font-extrabold tracking-tight flex-1">
            Akun
          </span>
        </div>
      </div>

      <div className="px-6 pt-8 pb-10 max-w-sm mx-auto">
        {/* Brand */}
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-[22px] bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-cyan-500/25">
            <Mail className="h-8 w-8 text-white" strokeWidth={2.2} />
          </div>
          <h1 className="text-[26px] font-extrabold tracking-tight mt-4 leading-tight">
            {mode === "login" ? "Selamat datang kembali" : "Buat akun TempMail"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
            Sinkronkan alamat &amp; riwayat email ke semua perangkatmu.
          </p>
        </div>

        {/* Tombol Google */}
        {googleAvailable && (
          <button
            type="button"
            onClick={handleGoogle}
            disabled={googleBusy || isSubmitting}
            className="mt-7 w-full rounded-2xl bg-white py-3.5 px-4 flex items-center justify-center gap-3 border border-slate-200 shadow-sm active:scale-[0.98] disabled:opacity-60"
          >
            {googleBusy ? (
              <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
            ) : (
              <GoogleGLogo className="h-5 w-5 shrink-0" />
            )}
            <span className="text-[15px] font-bold text-slate-800">
              {googleBusy ? "Menghubungkan..." : "Lanjutkan dengan Google"}
            </span>
          </button>
        )}

        {/* Pembatas */}
        <div className="flex items-center gap-3 mt-6">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs font-semibold text-muted-foreground">
            atau dengan email
          </span>
          <div className="h-px flex-1 bg-border" />
        </div>

        {/* Tab inline Masuk | Daftar */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1 mt-5">
          {(
            [
              { key: "login", label: "Masuk", icon: LogIn },
              { key: "register", label: "Daftar", icon: UserPlus },
            ] as const
          ).map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => switchMode(key)}
              className={cn(
                "flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-bold transition-colors",
                mode === key
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground active:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-3.5">
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground pointer-events-none" />
            <input
              id="native-login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              aria-label="Email"
              disabled={isSubmitting}
              className="w-full rounded-2xl border border-border bg-card pl-11 pr-4 py-3.5 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition"
            />
          </div>

          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-[18px] w-[18px] text-muted-foreground pointer-events-none" />
            <input
              id="native-login-password"
              type={showPassword ? "text" : "password"}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                mode === "register" ? "Minimal 8 karakter" : "Password kamu"
              }
              aria-label="Password"
              disabled={isSubmitting}
              className="w-full rounded-2xl border border-border bg-card pl-11 pr-12 py-3.5 text-[15px] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition"
            />
            <button
              type="button"
              aria-label={showPassword ? "Sembunyikan password" : "Tampilkan password"}
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground active:bg-accent"
            >
              {showPassword ? (
                <EyeOff className="h-[18px] w-[18px]" />
              ) : (
                <Eye className="h-[18px] w-[18px]" />
              )}
            </button>
          </div>

          {/* Error inline, bukan popup */}
          {error && (
            <p
              role="alert"
              className="text-[13px] font-medium text-destructive bg-destructive/10 rounded-2xl px-4 py-3 leading-relaxed"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white py-3.5 text-[15px] font-extrabold shadow-lg shadow-cyan-500/25 active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2 transition"
          >
            {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
            {isSubmitting
              ? "Tunggu..."
              : mode === "login"
                ? "Masuk"
                : "Buat Akun"}
          </button>
        </form>

        <div className="flex items-center justify-center gap-1.5 mt-6 text-[11px] text-muted-foreground">
          <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
          <span className="text-center leading-relaxed">
            {mode === "login"
              ? "Alamat guest di HP ini tetap tersimpan lokal."
              : "Alamat guest di HP ini bisa disinkronkan setelah daftar."}
          </span>
        </div>
      </div>
    </div>
  );
}
