import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Mail, Lock, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export default function RegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const { register } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast({ title: "Password tidak cocok", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "Password minimal 6 karakter", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      await register(email, password);
      toast({ title: "Akun berhasil dibuat!", description: "Selamat datang di TempMail." });
      navigate("/dashboard");
    } catch (err: unknown) {
      toast({
        title: "Registrasi gagal",
        description: err instanceof Error ? err.message : "Terjadi kesalahan.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="bg-primary/10 p-2 rounded-lg">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <span className="text-2xl font-bold">TempMail</span>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Buat Akun Baru</CardTitle>
            <CardDescription>
              Daftar untuk menyimpan riwayat email dan mengakses fitur lanjutan.
              <br />
              <span className="text-primary font-medium text-xs">Pengguna pertama akan menjadi Admin.</span>
            </CardDescription>
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
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="Minimal 6 karakter"
                    className="pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm">Konfirmasi Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type="password"
                    placeholder="Ulangi password"
                    className="pl-9"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full gap-2" disabled={loading}>
                <UserPlus className="h-4 w-4" />
                {loading ? "Mendaftarkan..." : "Daftar"}
              </Button>
              <p className="text-sm text-center text-muted-foreground">
                Sudah punya akun?{" "}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Masuk di sini
                </Link>
              </p>
              <Link href="/" className="text-xs text-center text-muted-foreground hover:text-foreground">
                ← Kembali ke TempMail
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
