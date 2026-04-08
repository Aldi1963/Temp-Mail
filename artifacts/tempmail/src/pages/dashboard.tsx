import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Mail, Inbox, Clock, MailOpen, RefreshCw, User, ShieldCheck,
  Code2, UserCircle, LayoutDashboard, LogOut, Menu, X, Home
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { format } from "date-fns";

interface UserEmail {
  email: string;
  domain: string;
  createdAt: string;
  expiresAt: string;
  isExpired: boolean;
  messageCount: number;
}

interface UserStats {
  totalEmails: number;
  totalMessages: number;
  activeEmails: number;
}

type Section = "overview";

const navItems = [
  { id: "overview" as Section, icon: LayoutDashboard, label: "Dashboard" },
];

const navLinks = [
  { href: "/profile", icon: UserCircle, label: "Profil & Keamanan" },
  { href: "/developer", icon: Code2, label: "Developer Tools" },
];

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [emails, setEmails] = useState<UserEmail[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [emailsRes, statsRes] = await Promise.all([
        fetch(`${BASE}/api/user/emails`, { credentials: "include" }),
        fetch(`${BASE}/api/user/stats`, { credentials: "include" }),
      ]);
      const emailsData = await emailsRes.json();
      const statsData = await statsRes.json();
      setEmails(emailsData.emails ?? []);
      setStats(statsData);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const initials = user?.email ? user.email.substring(0, 2).toUpperCase() : "U";

  const SidebarContent = () => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
        <div className="bg-primary/10 p-1.5 rounded-md text-primary">
          <Mail className="h-5 w-5" />
        </div>
        <span className="font-bold text-base">TempMail</span>
      </div>

      {/* User info */}
      <div className="px-4 py-3 border-b border-border">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-sm flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">{user?.email}</p>
            <Badge
              variant={user?.role === "admin" ? "default" : "secondary"}
              className="text-[9px] h-4 px-1.5 mt-0.5"
            >
              {user?.role === "admin" ? "Admin" : "User"}
            </Badge>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
          Menu
        </p>

        {navItems.map((item) => (
          <button
            key={item.id}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors bg-primary text-primary-foreground"
          >
            <item.icon className="h-4 w-4 flex-shrink-0" />
            {item.label}
          </button>
        ))}

        <div className="pt-2">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-2 mb-2">
            Akun
          </p>
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-foreground hover:bg-muted"
                onClick={() => setSidebarOpen(false)}
              >
                <link.icon className="h-4 w-4 flex-shrink-0" />
                {link.label}
              </button>
            </Link>
          ))}

          {user?.role === "admin" && (
            <Link href="/admin">
              <button
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-foreground hover:bg-muted"
                onClick={() => setSidebarOpen(false)}
              >
                <ShieldCheck className="h-4 w-4 flex-shrink-0" />
                Panel Admin
              </button>
            </Link>
          )}
        </div>
      </nav>

      {/* Bottom actions */}
      <div className="px-3 py-3 border-t border-border space-y-1">
        <Link href="/">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-foreground hover:bg-muted">
            <Home className="h-4 w-4 flex-shrink-0" />
            Kembali ke TempMail
          </button>
        </Link>
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-destructive hover:bg-destructive/10"
        >
          <LogOut className="h-4 w-4 flex-shrink-0" />
          Keluar
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex">
      {/* ── Desktop Sidebar ── */}
      <aside className="hidden md:flex flex-col w-60 border-r border-border bg-background flex-shrink-0 sticky top-0 h-screen">
        <SidebarContent />
      </aside>

      {/* ── Mobile Sidebar Overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="relative w-64 bg-background border-r border-border flex flex-col h-full shadow-2xl">
            <button
              onClick={() => setSidebarOpen(false)}
              className="absolute top-3 right-3 p-1.5 rounded-md hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile topbar */}
        <header className="md:hidden border-b bg-background/95 backdrop-blur sticky top-0 z-40 flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-md hover:bg-muted text-foreground"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-2 font-bold text-base">
            <div className="bg-primary/10 p-1 rounded-md text-primary">
              <Mail className="h-4 w-4" />
            </div>
            TempMail
          </div>
          <div className="ml-auto">
            <div className="h-7 w-7 rounded-full bg-primary/15 flex items-center justify-center text-primary font-semibold text-xs">
              {initials}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 md:p-8 space-y-6 max-w-3xl overflow-x-hidden">
          <div>
            <h1 className="text-2xl font-bold">Dashboard Saya</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Riwayat email sementara dan statistik penggunaan Anda.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 md:gap-4">
            {[
              { icon: Mail, label: "Total Email", value: stats?.totalEmails ?? 0, color: "text-primary" },
              { icon: Inbox, label: "Total Pesan", value: stats?.totalMessages ?? 0, color: "text-green-500" },
              { icon: Clock, label: "Email Aktif", value: stats?.activeEmails ?? 0, color: "text-orange-500" },
            ].map((s) => (
              <Card key={s.label} className="border-border/50">
                <CardContent className="p-3 md:p-4 flex flex-col items-center text-center gap-1">
                  <s.icon className={`h-5 w-5 ${s.color} mb-1`} />
                  {loading ? (
                    <Skeleton className="h-8 w-10" />
                  ) : (
                    <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
                  )}
                  <span className="text-[10px] md:text-xs text-muted-foreground leading-tight">{s.label}</span>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Shortcut Cards */}
          <div className="grid grid-cols-2 gap-3">
            <Link href="/profile">
              <div className="rounded-xl border border-border/50 p-4 flex items-center gap-3 hover:bg-muted/40 transition-colors cursor-pointer">
                <div className="bg-blue-500/10 p-2 rounded-lg text-blue-500">
                  <UserCircle className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Profil</p>
                  <p className="text-xs text-muted-foreground">Password & 2FA</p>
                </div>
              </div>
            </Link>
            <Link href="/developer">
              <div className="rounded-xl border border-border/50 p-4 flex items-center gap-3 hover:bg-muted/40 transition-colors cursor-pointer">
                <div className="bg-purple-500/10 p-2 rounded-lg text-purple-500">
                  <Code2 className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-sm font-medium">Developer</p>
                  <p className="text-xs text-muted-foreground">API & Webhook</p>
                </div>
              </div>
            </Link>
          </div>

          {/* Email History */}
          <Card className="border-border/50">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Inbox className="h-4 w-4" />
                Riwayat Email
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchData}>
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                </div>
              ) : emails.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <MailOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">Belum ada email yang tercatat.</p>
                  <p className="text-xs mt-1">Email yang di-generate saat login akan muncul di sini.</p>
                  <Link href="/">
                    <Button size="sm" className="mt-4 gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      Buat Email Baru
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                  {emails.map((e) => (
                    <div
                      key={e.email}
                      className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <span className="font-mono text-sm font-medium text-primary truncate">{e.email}</span>
                        <span className="text-xs text-muted-foreground">
                          Dibuat {format(new Date(e.createdAt), "d MMM yyyy, HH:mm")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 ml-3">
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Inbox className="h-3.5 w-3.5" />
                          <span className="hidden sm:inline">{e.messageCount} pesan</span>
                          <span className="sm:hidden">{e.messageCount}</span>
                        </div>
                        <Badge
                          variant={e.isExpired ? "secondary" : "outline"}
                          className={`text-[10px] h-5 ${e.isExpired ? "" : "border-green-500 text-green-600"}`}
                        >
                          {e.isExpired ? "Kadaluarsa" : "Aktif"}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </main>
      </div>
    </div>
  );
}
