import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Mail, Inbox, Clock, MailOpen, RefreshCw, User, ShieldCheck,
  Code2, UserCircle, LayoutDashboard, LogOut, Menu, X, Home,
  LogIn, KeyRound, ShieldPlus, ShieldOff, UserPlus, Activity, Sun, Moon,
  Search, Pencil, Copy, Trash2, Check
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import CustomDomainsCard from "@/components/custom-domains";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTheme } from "@/components/theme-provider";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import { format, formatDistanceToNow } from "date-fns";
import { id as idLocale } from "date-fns/locale";
import { API_BASE_URL as BASE } from "../lib/api-base";

interface UserEmail {
  email: string;
  domain: string;
  label: string | null;
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

interface ActivityLogItem {
  id: number;
  action: string;
  description: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

type Section = "overview";

const navItems = [
  { id: "overview" as Section, icon: LayoutDashboard, label: "Dashboard" },
];

const navLinks = [
  { href: "/profile", icon: UserCircle, label: "Profil & Keamanan" },
  { href: "/developer", icon: Code2, label: "Developer Tools" },
];

const ACTION_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  login: { icon: LogIn, color: "text-blue-500", label: "Login" },
  login_2fa: { icon: ShieldCheck, color: "text-blue-500", label: "Login (2FA)" },
  register: { icon: UserPlus, color: "text-green-500", label: "Daftar Akun" },
  password_changed: { icon: KeyRound, color: "text-orange-500", label: "Ganti Password" },
  "2fa_enabled": { icon: ShieldPlus, color: "text-green-500", label: "2FA Diaktifkan" },
  "2fa_disabled": { icon: ShieldOff, color: "text-red-500", label: "2FA Dinonaktifkan" },
  email_received: { icon: Mail, color: "text-primary", label: "Email Masuk" },
};

/* Pagination bernomor: 1 2 3 … N */
function pageNums(total: number, current: number): (number | string)[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, 2, current - 1, current, current + 1, total - 1, total]);
  const sorted = [...set].filter((p) => p >= 1 && p <= total).sort((a, b) => a - b);
  const out: (number | string)[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - (sorted[i - 1] as number) > 1) out.push("\u2026");
    out.push(p);
  });
  return out;
}

function PageButtons({ total, current, onChange }: { total: number; current: number; onChange: (p: number) => void }) {
  if (total <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-1 mt-3 flex-wrap">
      {pageNums(total, current).map((p, i) =>
        typeof p === "string" ? (
          <span key={`gap-${i}`} className="px-1 text-xs text-muted-foreground">{"\u2026"}</span>
        ) : (
          <Button key={p} variant={p === current ? "default" : "outline"} size="sm" className="h-7 w-7 p-0 text-xs" onClick={() => onChange(p)}>
            {p}
          </Button>
        )
      )}
    </div>
  );
}

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [, navigate] = useLocation();
  const [emails, setEmails] = useState<UserEmail[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [activities, setActivities] = useState<ActivityLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activityLoading, setActivityLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const EMAIL_PAGE_SIZE = 5;
  const [emailPage, setEmailPage] = useState(1);
  const [emailQuery, setEmailQuery] = useState("");
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [labelDraft, setLabelDraft] = useState("");
  const [savingLabel, setSavingLabel] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [showBulkDelete, setShowBulkDelete] = useState(false);
  const [deletingEmails, setDeletingEmails] = useState(false);
  const [copiedEmail, setCopiedEmail] = useState<string | null>(null);
  const { toast } = useToast();
  const q = emailQuery.trim().toLowerCase();
  const filteredEmails = q
    ? emails.filter((e) => e.email.toLowerCase().includes(q) || (e.label ?? "").toLowerCase().includes(q))
    : emails;
  const emailTotalPages = Math.max(1, Math.ceil(filteredEmails.length / EMAIL_PAGE_SIZE));
  const safeEmailPage = Math.min(emailPage, emailTotalPages);
  const pagedEmails = filteredEmails.slice((safeEmailPage - 1) * EMAIL_PAGE_SIZE, safeEmailPage * EMAIL_PAGE_SIZE);
  const allPagedSelected = pagedEmails.length > 0 && pagedEmails.every((e) => selectedEmails.includes(e.email));

  const toggleSelect = (email: string) =>
    setSelectedEmails((prev) => (prev.includes(email) ? prev.filter((x) => x !== email) : [...prev, email]));
  const toggleSelectAll = () =>
    setSelectedEmails((prev) => {
      const pageAddrs = pagedEmails.map((e) => e.email);
      const allIn = pageAddrs.every((a) => prev.includes(a));
      return allIn ? prev.filter((a) => !pageAddrs.includes(a)) : Array.from(new Set([...prev, ...pageAddrs]));
    });

  const copyEmail = (email: string) => {
    if (navigator.clipboard) navigator.clipboard.writeText(email).catch(() => {});
    setCopiedEmail(email);
    window.setTimeout(() => setCopiedEmail((c) => (c === email ? null : c)), 1500);
  };

  const startEditLabel = (e: UserEmail) => {
    setEditingLabel(e.email);
    setLabelDraft(e.label ?? "");
  };

  const saveLabel = async (email: string) => {
    const clean = labelDraft.trim().slice(0, 40);
    setSavingLabel(true);
    try {
      const r = await fetch(`${BASE}/api/user/emails/label`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, label: clean }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.message || "Gagal menyimpan label.");
      setEmails((prev) => prev.map((x) => (x.email === email ? { ...x, label: d.label ?? null } : x)));
      setEditingLabel(null);
      toast({ title: "Label disimpan." });
    } catch (err) {
      toast({ title: "Gagal menyimpan label.", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setSavingLabel(false);
    }
  };

  const deleteEmails = async (targets: string[]) => {
    if (targets.length === 0) return;
    setDeletingEmails(true);
    let ok = 0;
    for (const email of targets) {
      try {
        const r = await fetch(`${BASE}/api/user/emails`, {
          method: "DELETE",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email }),
        });
        if (r.ok) ok++;
      } catch {
        /* lanjut ke alamat berikutnya */
      }
    }
    setDeletingEmails(false);
    setDeleteTarget(null);
    setShowBulkDelete(false);
    if (ok > 0) {
      setEmails((prev) => prev.filter((x) => !targets.includes(x.email)));
      setSelectedEmails((prev) => prev.filter((a) => !targets.includes(a)));
    }
    if (ok === targets.length) {
      toast({ title: `${ok} alamat dihapus.` });
    } else {
      toast({ title: "Sebagian gagal dihapus.", description: `${ok} dari ${targets.length} alamat terhapus.`, variant: "destructive" });
    }
  };
  const [activityPage, setActivityPage] = useState(1);
  const ACTIVITY_PAGE_SIZE = 5;
  const activityTotalPages = Math.max(1, Math.ceil(activities.length / ACTIVITY_PAGE_SIZE));
  const safeActivityPage = Math.min(activityPage, activityTotalPages);
  const pagedActivities = activities.slice((safeActivityPage - 1) * ACTIVITY_PAGE_SIZE, safeActivityPage * ACTIVITY_PAGE_SIZE);
  const activityPageNums: (number | string)[] = pageNums(activityTotalPages, safeActivityPage);

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

  const fetchActivity = async () => {
    setActivityLoading(true);
    try {
      const res = await fetch(`${BASE}/api/user/activity?limit=15`, { credentials: "include" });
      const data = await res.json();
      setActivities(data.activities ?? []);
    } catch {
      /* ignore */
    } finally {
      setActivityLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    fetchActivity();
  }, []);

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
    <div className="min-h-screen bg-background flex overflow-x-hidden">
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
          <div className="ml-auto flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground shrink-0"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              title={theme === "dark" ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
            >
              {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
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

          {/* Activity Log */}
          <Card className="border-border/50">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Log Aktivitas
              </CardTitle>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchActivity}>
                <RefreshCw className={`h-3.5 w-3.5 ${activityLoading ? "animate-spin" : ""}`} />
              </Button>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
                </div>
              ) : activities.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Activity className="h-8 w-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Belum ada aktivitas yang tercatat.</p>
                  <p className="text-xs mt-1 opacity-70">Aktivitas akan muncul setelah login, ganti password, dll.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {pagedActivities.map((act) => {
                    const meta = ACTION_META[act.action] ?? { icon: Activity, color: "text-muted-foreground", label: act.action };
                    const Icon = meta.icon;
                    return (
                      <div key={act.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-muted/30 transition-colors">
                        <div className={`mt-0.5 shrink-0 ${meta.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-sm font-medium text-foreground truncate">{act.description}</span>
                            <span
                              className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0"
                              title={format(new Date(act.createdAt), "d MMM yyyy, HH:mm:ss")}
                            >
                              {formatDistanceToNow(new Date(act.createdAt), { addSuffix: true, locale: idLocale })}
                            </span>
                          </div>
                          <Badge variant="outline" className="text-[10px] h-4 px-1.5 mt-0.5 font-normal">
                            {meta.label}
                          </Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
              {!activityLoading && activityTotalPages > 1 && (
                <div className="flex items-center justify-center gap-1 mt-3 flex-wrap">
                  {activityPageNums.map((p, i) =>
                    typeof p === "string" ? (
                      <span key={`gap-${i}`} className="px-1 text-xs text-muted-foreground">{"\u2026"}</span>
                    ) : (
                      <Button
                        key={p}
                        variant={p === safeActivityPage ? "default" : "outline"}
                        size="sm"
                        className="h-7 w-7 p-0 text-xs"
                        onClick={() => setActivityPage(p)}
                      >
                        {p}
                      </Button>
                    )
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Kelola Email — CRUD */}
          <Card className="border-border/50">
            <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Inbox className="h-4 w-4" />
                Kelola Email
                {!loading && emails.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] h-5">{emails.length}</Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-1.5">
                <Link href="/">
                  <Button size="sm" className="h-7 gap-1 text-xs">
                    <Mail className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Buat Baru</span>
                  </Button>
                </Link>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchData} title="Segarkan daftar">
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 mb-3">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={emailQuery}
                    onChange={(e) => { setEmailQuery(e.target.value); setEmailPage(1); }}
                    placeholder="Cari alamat atau label…"
                    className="h-8 pl-8 pr-8 text-xs"
                  />
                  {emailQuery && (
                    <button
                      type="button"
                      onClick={() => { setEmailQuery(""); setEmailPage(1); }}
                      title="Hapus pencarian"
                      aria-label="Hapus pencarian"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-5 w-5 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
                {emailQuery.trim() && (
                  <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                    {filteredEmails.length} hasil
                  </span>
                )}
                {selectedEmails.length > 0 && (
                  <>
                    <Badge variant="secondary" className="text-[10px] h-6 shrink-0">{selectedEmails.length} dipilih</Badge>
                    <Button
                      variant="destructive" size="sm" className="h-8 text-xs gap-1 shrink-0"
                      onClick={() => setShowBulkDelete(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      Hapus
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 text-xs shrink-0" onClick={() => setSelectedEmails([])}>
                      Batal
                    </Button>
                  </>
                )}
              </div>

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
                </div>
              ) : filteredEmails.length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <MailOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  {q ? (
                    <>
                      <p className="text-sm">Tidak ada hasil untuk <span className="font-medium text-foreground">{emailQuery}</span>.</p>
                      <Button size="sm" variant="outline" className="mt-4" onClick={() => setEmailQuery("")}>
                        Bersihkan pencarian
                      </Button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm">Belum ada email yang tercatat.</p>
                      <p className="text-xs mt-1">Email yang di-generate saat login akan muncul di sini.</p>
                      <Link href="/">
                        <Button size="sm" className="mt-4 gap-1">
                          <Mail className="h-3.5 w-3.5" />
                          Buat Email Baru
                        </Button>
                      </Link>
                    </>
                  )}
                </div>
              ) : (
                <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-muted/40">
                    <Checkbox
                      checked={allPagedSelected}
                      onCheckedChange={toggleSelectAll}
                      aria-label="Pilih semua di halaman ini"
                    />
                    <span className="text-[11px] text-muted-foreground">Pilih semua di halaman ini</span>
                  </div>
                  {pagedEmails.map((e) => (
                    <div
                      key={e.email}
                      className="flex items-center gap-2.5 p-3 hover:bg-muted/30 transition-colors"
                    >
                      <Checkbox
                        checked={selectedEmails.includes(e.email)}
                        onCheckedChange={() => toggleSelect(e.email)}
                        aria-label={`Pilih ${e.email}`}
                        className="shrink-0"
                      />
                      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
                        {editingLabel === e.email ? (
                          <div className="flex items-center gap-1.5">
                            <Input
                              autoFocus
                              value={labelDraft}
                              onChange={(ev) => setLabelDraft(ev.target.value)}
                              onKeyDown={(ev) => {
                                if (ev.key === "Enter") saveLabel(e.email);
                                if (ev.key === "Escape") setEditingLabel(null);
                              }}
                              placeholder="Nama label, mis. GitHub"
                              maxLength={40}
                              className="h-7 text-xs"
                            />
                            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" disabled={savingLabel} onClick={() => saveLabel(e.email)} title="Simpan label">
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={() => setEditingLabel(null)} title="Batal">
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 min-w-0">
                            {e.label ? (
                              <span className="text-sm font-medium truncate">{e.label}</span>
                            ) : (
                              <span className="font-mono text-sm font-medium text-primary truncate">{e.email}</span>
                            )}
                            <button
                              onClick={() => startEditLabel(e)}
                              title={e.label ? "Ubah label" : "Tambah label"}
                              className="text-muted-foreground hover:text-foreground shrink-0 transition-colors"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                        {e.label && (
                          <span className="font-mono text-xs text-muted-foreground truncate">{e.email}</span>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          Dibuat {format(new Date(e.createdAt), "d MMM yyyy, HH:mm")} • {e.messageCount} pesan
                        </span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Badge
                          variant={e.isExpired ? "secondary" : "outline"}
                          className={`text-[10px] h-5 ${e.isExpired ? "" : "border-green-500 text-green-600"}`}
                        >
                          {e.isExpired ? "Kadaluarsa" : "Aktif"}
                        </Badge>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => copyEmail(e.email)} title="Salin alamat">
                          {copiedEmail === e.email ? <Check className="h-3.5 w-3.5 text-green-600" /> : <Copy className="h-3.5 w-3.5" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(e.email)} title="Hapus alamat">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {!loading && (
                <PageButtons total={emailTotalPages} current={safeEmailPage} onChange={setEmailPage} />
              )}

              <AlertDialog open={deleteTarget !== null} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus alamat ini?</AlertDialogTitle>
                    <AlertDialogDescription>
                      <span className="font-mono break-all">{deleteTarget}</span> akan dihapus dari akun Anda dan tidak bisa diakses lagi.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deletingEmails}
                      onClick={() => { if (deleteTarget) deleteEmails([deleteTarget]); }}
                    >
                      {deletingEmails ? "Menghapus…" : "Ya, hapus"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>

              <AlertDialog open={showBulkDelete} onOpenChange={setShowBulkDelete}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Hapus {selectedEmails.length} alamat?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Semua alamat yang dipilih akan dihapus dari akun Anda dan tidak bisa diakses lagi. Tindakan ini tidak bisa dibatalkan.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Batal</AlertDialogCancel>
                    <AlertDialogAction
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      disabled={deletingEmails}
                      onClick={() => deleteEmails(selectedEmails)}
                    >
                      {deletingEmails ? "Menghapus…" : `Ya, hapus ${selectedEmails.length} alamat`}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
                  <CustomDomainsCard />
</main>
      </div>
    </div>
  );
}
