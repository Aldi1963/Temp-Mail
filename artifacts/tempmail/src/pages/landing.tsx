import { Link } from "wouter";
import { useTheme } from "@/components/theme-provider";
import {
  Mail, Shield, Zap, Trash2, Bell, Lock, Globe, ArrowRight,
  Moon, Sun, Copy, RefreshCw, Inbox, CheckCircle2, Github
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: Zap,
    color: "text-yellow-500",
    bg: "bg-yellow-50 dark:bg-yellow-950/40",
    title: "Instan & Langsung Aktif",
    desc: "Email siap dalam hitungan detik. Tidak perlu registrasi, tidak perlu verifikasi."
  },
  {
    icon: Shield,
    color: "text-blue-500",
    bg: "bg-blue-50 dark:bg-blue-950/40",
    title: "Privasi Terlindungi",
    desc: "Tidak ada iklan, tidak ada pelacak, tidak ada penjualan data. Identitas Anda aman."
  },
  {
    icon: Trash2,
    color: "text-red-500",
    bg: "bg-red-50 dark:bg-red-950/40",
    title: "Kadaluarsa Otomatis",
    desc: "Email dan semua pesannya dihapus otomatis. Tidak ada jejak yang tertinggal."
  },
  {
    icon: Bell,
    color: "text-green-500",
    bg: "bg-green-50 dark:bg-green-950/40",
    title: "Notifikasi Real-time",
    desc: "Aktifkan notifikasi browser dan tahu langsung saat email baru masuk."
  },
  {
    icon: Lock,
    color: "text-purple-500",
    bg: "bg-purple-50 dark:bg-purple-950/40",
    title: "PIN Proteksi Inbox",
    desc: "Kunci inbox dengan PIN 4 digit agar tidak bisa diakses orang lain."
  },
  {
    icon: Globe,
    color: "text-cyan-500",
    bg: "bg-cyan-50 dark:bg-cyan-950/40",
    title: "Banyak Pilihan Domain",
    desc: "Pilih domain yang Anda suka dari beberapa pilihan yang tersedia."
  },
];

const steps = [
  { n: "01", title: "Buka TempMail", desc: "Email baru langsung dibuat otomatis ketika Anda membuka halaman." },
  { n: "02", title: "Salin Alamat Email", desc: "Klik tombol Salin dan gunakan email ini untuk mendaftar di situs mana pun." },
  { n: "03", title: "Baca Email di Inbox", desc: "Email yang masuk akan muncul otomatis. Tidak perlu refresh manual." },
  { n: "04", title: "Selesai!", desc: "Email kadaluarsa sendiri atau bisa Anda perpanjang kapan saja." },
];

export default function LandingPage() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border/60 bg-background/90 backdrop-blur">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex h-14 items-center justify-between">
          <Link href="/">
            <div className="flex items-center gap-2 cursor-pointer">
              <div className="bg-primary/10 p-1.5 rounded-lg text-primary border border-primary/20">
                <Mail className="h-4 w-4" />
              </div>
              <span className="font-bold text-base">TempMail</span>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost" size="icon"
              className="h-8 w-8 text-muted-foreground"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Link href="/login">
              <Button variant="ghost" size="sm" className="h-8 text-xs">Masuk</Button>
            </Link>
            <Link href="/">
              <Button size="sm" className="h-8 text-xs gap-1.5 bg-primary hover:bg-primary/90">
                Buat Email <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        {/* Background gradients */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-background pointer-events-none" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-primary/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-20 md:py-28 text-center">
          <Badge variant="secondary" className="mb-6 gap-1.5 text-xs px-3 py-1">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            100% Gratis — Tanpa Registrasi
          </Badge>

          <h1 className="text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tight leading-tight mb-6">
            Email Sementara{" "}
            <span className="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Instan & Gratis
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed">
            Buat alamat email sekali pakai dalam hitungan detik. Lindungi email asli Anda dari spam, 
            iklan, dan pelacak. Tidak perlu daftar, langsung pakai.
          </p>

          {/* Demo email widget */}
          <div className="max-w-lg mx-auto mb-10">
            <div className="relative rounded-2xl border border-primary/20 bg-card/80 backdrop-blur p-5 shadow-lg shadow-primary/5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-muted-foreground font-medium">INBOX AKTIF</span>
              </div>
              <div className="font-mono text-xl font-bold mb-4 select-all text-left">
                <span className="text-primary">qr8x2kpj</span>
                <span className="text-muted-foreground/70">@tmpmail.dev</span>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2 text-xs text-muted-foreground">
                  <Copy className="h-3.5 w-3.5" />
                  Salin Alamat Email
                </div>
                <div className="flex items-center gap-2 bg-primary/10 text-primary rounded-lg px-3 py-2 text-xs font-medium">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Generate
                </div>
              </div>
              <div className="mt-3 flex gap-2 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Inbox className="h-3 w-3" /> 0 pesan</span>
                <span>·</span>
                <span className="flex items-center gap-1">⏱ 10m 00d tersisa</span>
              </div>
            </div>
            <p className="text-xs text-muted-foreground mt-2 opacity-60">* Contoh tampilan inbox aktif</p>
          </div>

          <Link href="/">
            <Button size="lg" className="gap-2.5 h-12 px-8 text-base shadow-lg shadow-primary/20">
              Buat Email Sekarang — Gratis
              <ArrowRight className="h-5 w-5" />
            </Button>
          </Link>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-6 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Tidak perlu daftar</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Aktif dalam 1 detik</span>
            <span className="flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> Kadaluarsa otomatis</span>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-muted/20 border-y border-border/40">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Semua yang Anda butuhkan</h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Dibangun untuk kecepatan, privasi, dan kemudahan. Tidak ada kompromi.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {features.map((f) => (
              <div key={f.title} className="rounded-xl border border-border/50 bg-card p-5 hover:border-primary/20 hover:shadow-sm transition-all">
                <div className={`w-10 h-10 rounded-xl ${f.bg} flex items-center justify-center mb-4`}>
                  <f.icon className={`h-5 w-5 ${f.color}`} />
                </div>
                <h3 className="font-semibold text-sm mb-1.5">{f.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-3">Cara Kerja</h2>
            <p className="text-muted-foreground">Sesederhana yang bisa dibayangkan.</p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((s, i) => (
              <div key={s.n} className="relative text-center">
                {i < steps.length - 1 && (
                  <div className="hidden lg:block absolute top-8 left-[calc(50%+32px)] right-[-50%] h-px bg-border" />
                )}
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-4">
                  <span className="text-2xl font-black text-primary">{s.n}</span>
                </div>
                <h3 className="font-semibold text-sm mb-2">{s.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section className="py-16 bg-muted/20 border-y border-border/40">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl font-bold mb-3">Kapan Anda membutuhkannya?</h2>
          <p className="text-muted-foreground mb-8">Email sementara berguna untuk banyak situasi sehari-hari.</p>
          <div className="flex flex-wrap justify-center gap-2">
            {[
              "Daftar akun demo", "Verifikasi one-time", "Menghindari spam",
              "Uji coba aplikasi", "Download ebook gratis", "Mendaftar newsletter",
              "Konfirmasi pembelian", "Akses konten premium", "Testing form email",
            ].map((tag) => (
              <span key={tag} className="px-3 py-1.5 rounded-full border border-border bg-background text-xs font-medium hover:border-primary/30 hover:bg-primary/5 transition-colors cursor-default">
                {tag}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="py-20">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <div className="relative rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/5 via-card to-card p-10 overflow-hidden">
            <div className="absolute -top-10 -right-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-primary/5 rounded-full blur-2xl" />
            <div className="relative">
              <div className="bg-primary/10 border border-primary/20 p-3 rounded-2xl w-fit mx-auto mb-5">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-3xl font-bold mb-3">Siap memulai?</h2>
              <p className="text-muted-foreground mb-7 text-sm">
                Tidak perlu akun. Tidak perlu kartu kredit. Gratis selamanya.
              </p>
              <Link href="/">
                <Button size="lg" className="gap-2 h-11 px-8 shadow-lg shadow-primary/20">
                  Buat Email Gratis Sekarang
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/60 py-6 px-6">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="bg-primary/10 p-1 rounded-md text-primary">
              <Mail className="h-3.5 w-3.5" />
            </div>
            <span>© {new Date().getFullYear()} TempMail</span>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/" className="hover:text-foreground transition-colors">Inbox</Link>
            <Link href="/privacy" className="hover:text-foreground transition-colors">Kebijakan Privasi</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Syarat Layanan</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
