import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { CheckCircle2, XCircle, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

export default function VerifyEmailPage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");
  const [, navigate] = useLocation();
  const { refetch } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setStatus("error");
      setMessage("Token verifikasi tidak ditemukan di URL.");
      return;
    }

    const verify = async () => {
      try {
        const res = await fetch(`${BASE}/api/auth/verify-email`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        });
        const data = await res.json();
        if (!res.ok) {
          setStatus("error");
          setMessage(data.message || "Verifikasi gagal. Token mungkin sudah kadaluarsa.");
        } else {
          setStatus("success");
          setMessage(data.message || "Email berhasil diverifikasi!");
          await refetch();
        }
      } catch {
        setStatus("error");
        setMessage("Terjadi kesalahan jaringan. Coba lagi.");
      }
    };

    verify();
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Logo */}
        <Link href="/">
          <div className="flex items-center justify-center gap-2 cursor-pointer mb-8">
            <div className="bg-primary/10 p-2 rounded-xl text-primary border border-primary/20">
              <Mail className="h-6 w-6" />
            </div>
            <span className="font-bold text-xl">TempMail</span>
          </div>
        </Link>

        {status === "loading" && (
          <div className="space-y-4">
            <div className="flex justify-center">
              <Loader2 className="h-16 w-16 text-primary animate-spin" />
            </div>
            <h1 className="text-2xl font-bold">Memverifikasi Email...</h1>
            <p className="text-muted-foreground">Mohon tunggu sebentar.</p>
          </div>
        )}

        {status === "success" && (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div className="bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 rounded-full p-4">
                <CheckCircle2 className="h-16 w-16 text-green-500" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2">Email Terverifikasi!</h1>
              <p className="text-muted-foreground">{message}</p>
            </div>
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-xl p-4">
              <p className="text-sm text-green-700 dark:text-green-300">
                Akun Anda sekarang telah diverifikasi dan mendapat akses penuh ke semua fitur TempMail.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/">
                <Button className="w-full sm:w-auto">Ke Inbox</Button>
              </Link>
              <Link href="/profile">
                <Button variant="outline" className="w-full sm:w-auto">Lihat Profil</Button>
              </Link>
            </div>
          </div>
        )}

        {status === "error" && (
          <div className="space-y-5">
            <div className="flex justify-center">
              <div className="bg-destructive/10 border border-destructive/20 rounded-full p-4">
                <XCircle className="h-16 w-16 text-destructive" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-2">Verifikasi Gagal</h1>
              <p className="text-muted-foreground">{message}</p>
            </div>
            <div className="bg-destructive/5 border border-destructive/20 rounded-xl p-4">
              <p className="text-sm text-muted-foreground">
                Link verifikasi berlaku selama 24 jam dan hanya dapat digunakan sekali. 
                Silakan buat link baru dari halaman profil Anda.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link href="/profile">
                <Button className="w-full sm:w-auto">Ke Profil</Button>
              </Link>
              <Link href="/">
                <Button variant="outline" className="w-full sm:w-auto">Ke Inbox</Button>
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
