import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Mail, Lock, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast({ title: "Berhasil login!", description: "Selamat datang kembali." });
      navigate("/dashboard");
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
                <Label htmlFor="password">Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full gap-2" disabled={loading}>
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
      </div>
    </div>
  );
}
