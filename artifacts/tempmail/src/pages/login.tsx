import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { Mail, Lock, LogIn, ShieldCheck, Eye, EyeOff, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "@/components/theme-provider";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [loading, setLoading] = useState(false);
  const [needs2fa, setNeeds2fa] = useState(false);
  const [token2fa, setToken2fa] = useState("");
  const { login, refetch } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const cleanEmail = email.trim().toLowerCase();
      const cleanPassword = password.trim();
      const result = await login(cleanEmail, cleanPassword);
      if (result.requires2fa) {
        setNeeds2fa(true);
        toast({ title: "Verifikasi 2FA diperlukan", description: "Masukkan kode dari aplikasi authenticator Anda." });
      } else {
        toast({ title: "Berhasil login!", description: "Selamat datang kembali." });
        navigate("/dashboard");
      }
    } catch (err: unknown) {
      toast({
        title: "Login gagal",
        description: err instanceof Error ? err.message : "Terjadi kesalahan.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const execute2faVerify = async (code: string) => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/auth/2fa/verify-login`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: code }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.message || `HTTP ${r.status}`);
      await refetch();
      toast({ title: "Berhasil login!", description: "Selamat datang kembali." });
      navigate("/dashboard");
    } catch (err: unknown) {
      toast({
        title: "Kode 2FA tidak valid",
        description: err instanceof Error ? err.message : "Terjadi kesalahan.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handle2faVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    execute2faVerify(token2fa);
  };

  // Auto-submit 2FA when 6 digits are typed
  useEffect(() => {
    if (token2fa.length === 6 && !loading) {
      execute2faVerify(token2fa);
    }
  }, [token2fa]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      {/* Theme Toggle Button pojok kanan atas */}
      <div className="absolute top-4 right-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          title={theme === "dark" ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
          className="h-9 w-9 text-muted-foreground hover:text-foreground"
        >
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
      </div>

      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <span className="text-2xl font-bold tracking-tight">TempMail</span>
        </div>

        {!needs2fa ? (
          <Card className="border-border/50 shadow-lg">
            <CardHeader className="text-center">
              <CardTitle className="text-xl">Masuk ke Akun</CardTitle>
              <CardDescription>Gunakan email dan password Anda untuk masuk.</CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit}>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="nama@email.com"
                      className="pl-9"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      autoFocus
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password">Password</Label>
                    <button
                      type="button"
                      onClick={() => toast({ title: "Bantuan Lupa Password", description: "Silakan hubungi administrator via Telegram bot jika akun Anda terkunci." })}
                      className="text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                      Lupa password?
                    </button>
                  </div>
                  <div className="relative">
                    <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      className="pl-9 pr-10"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                      title={showPassword ? "Sembunyikan password" : "Lihat password"}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="remember"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary accent-primary"
                  />
                  <Label htmlFor="remember" className="text-xs font-normal text-muted-foreground cursor-pointer select-none">
                    Ingat saya di perangkat ini
                  </Label>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full gap-2 font-semibold" disabled={loading}>
                  <LogIn className="h-4 w-4" />
                  {loading ? "Memproses..." : "Masuk"}
                </Button>
                <p className="text-sm text-center text-muted-foreground">
                  Belum punya akun?{" "}
                  <Link href="/register" className="text-primary hover:underline font-medium">
                    Daftar sekarang
                  </Link>
                </p>
                <Link href="/" className="text-xs text-center text-muted-foreground hover:text-foreground">
                  ← Kembali ke TempMail
                </Link>
              </CardFooter>
            </form>
          </Card>
        ) : (
          <Card className="border-border/50 shadow-lg">
            <CardHeader className="text-center">
              <div className="flex justify-center mb-2">
                <div className="bg-primary/10 p-3 rounded-full">
                  <ShieldCheck className="h-6 w-6 text-primary" />
                </div>
              </div>
              <CardTitle className="text-xl">Verifikasi 2FA</CardTitle>
              <CardDescription>Masukkan kode 6 digit dari aplikasi authenticator Anda.</CardDescription>
            </CardHeader>
            <form onSubmit={handle2faVerify}>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="token">Kode Autentikasi</Label>
                  <Input
                    id="token"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    placeholder="000000"
                    className="text-center tracking-widest text-2xl font-mono h-12"
                    value={token2fa}
                    onChange={(e) => setToken2fa(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    maxLength={6}
                    autoFocus
                    required
                  />
                  <p className="text-xs text-muted-foreground text-center">
                    Kode akan otomatis diverifikasi saat 6 digit terisi
                  </p>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button type="submit" className="w-full gap-2 font-semibold" disabled={loading || token2fa.length < 6}>
                  <ShieldCheck className="h-4 w-4" />
                  {loading ? "Memverifikasi..." : "Verifikasi"}
                </Button>
                <button
                  type="button"
                  className="text-xs text-center text-muted-foreground hover:text-foreground"
                  onClick={() => { setNeeds2fa(false); setToken2fa(""); }}
                >
                  ← Kembali ke halaman login
                </button>
              </CardFooter>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
