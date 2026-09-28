// Halaman Masuk/Daftar fullscreen khusus aplikasi native.
// BUKAN popup: halaman penuh dengan tombol kembali, tab inline,
// dan error ditampilkan sebagai teks inline.
import { useState } from "react";
import { ArrowLeft, Loader2, LogIn, UserPlus } from "lucide-react";
import { useNativeAuth } from "./useNativeAuth";
import { cn } from "@/lib/utils";

type Mode = "login" | "register";

export function NativeLogin({ onDone }: { onDone: () => void }) {
  const { login, register } = useNativeAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const switchMode = (m: Mode) => {
    setMode(m);
    setError(null);
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
            {mode === "login" ? "Masuk" : "Daftar"}
          </span>
        </div>
      </div>

      <div className="px-5 pt-6 pb-10 max-w-sm mx-auto">
        <h1 className="text-2xl font-extrabold tracking-tight">
          Masuk ke TempMail
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Sinkronkan alamat &amp; riwayat ke semua perangkat.
        </p>

        {/* Tab inline Masuk | Daftar */}
        <div className="grid grid-cols-2 gap-1 rounded-2xl bg-muted p-1 mt-6">
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

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label
              htmlFor="native-login-email"
              className="block text-xs font-bold text-muted-foreground mb-1.5"
            >
              Email
            </label>
            <input
              id="native-login-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="nama@email.com"
              disabled={isSubmitting}
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-[15px] outline-none focus:border-primary disabled:opacity-60"
            />
          </div>

          <div>
            <label
              htmlFor="native-login-password"
              className="block text-xs font-bold text-muted-foreground mb-1.5"
            >
              Password
            </label>
            <input
              id="native-login-password"
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                mode === "register" ? "Minimal 8 karakter" : "Password kamu"
              }
              disabled={isSubmitting}
              className="w-full rounded-2xl border border-border bg-card px-4 py-3 text-[15px] outline-none focus:border-primary disabled:opacity-60"
            />
          </div>

          {/* Error inline, bukan popup */}
          {error && (
            <p
              role="alert"
              className="text-[13px] font-medium text-destructive bg-destructive/10 rounded-xl px-4 py-3"
            >
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-2xl bg-primary text-primary-foreground py-3.5 text-[15px] font-extrabold active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 className="h-5 w-5 animate-spin" />}
            {isSubmitting
              ? "Tunggu..."
              : mode === "login"
                ? "Masuk"
                : "Buat Akun"}
          </button>
        </form>

        <p className="text-[11px] text-muted-foreground text-center mt-6 px-4">
          {mode === "login"
            ? "Alamat guest yang sudah dibuat di HP ini tetap tersimpan lokal."
            : "Setelah daftar, alamat guest di HP ini bisa disinkronkan ke akunmu."}
        </p>
      </div>
    </div>
  );
}
