import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Mail, Users, Inbox, Settings, Globe,
  Trash2, ShieldCheck, ShieldX, RefreshCw, Save, PlusCircle, X,
  BarChart2, ToggleLeft, ToggleRight, LayoutDashboard, LogOut,
  Menu, Megaphone, Palette, Zap, Tag, Info, AlertTriangle, CheckCircle,
  Home, ChevronRight, Image, FileText, Search, Copy, Key, ExternalLink,
  KeyRound, TrendingUp, Activity, Clock
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type Section = "overview" | "general" | "web" | "domains" | "users" | "stats";

interface AdminStats { totalUsers: number; totalEmails: number; totalMessages: number; }
interface AdminUser { id: number; email: string; role: string; createdAt: string; }
interface DetailedStats {
  activeEmails: number;
  emailsToday: number;
  newUsersThisWeek: number;
  messagesToday: number;
  emailsPerDay: { date: string; count: number }[];
  messagesPerDay: { date: string; count: number }[];
}
interface SiteSettings {
  site_name: string; default_ttl_minutes: string; max_inboxes: string;
  available_domains: string; allow_registration: string; maintenance_mode: string;
  max_message_size_kb: string; site_description: string; site_logo_url: string;
  meta_title: string; meta_keywords: string; footer_text: string;
  require_login_to_generate: string; max_emails_per_day: string;
  show_qr_by_default: string; auto_copy_on_generate: string;
  announcement_enabled: string; announcement_text: string; announcement_type: string;
}

async function adminApi(path: string, opts?: RequestInit) {
  const res = await fetch(path, {
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    ...opts,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  return data;
}

const NAV = [
  { id: "overview" as Section, icon: LayoutDashboard, label: "Ringkasan" },
  { id: "general" as Section, icon: Settings, label: "Pengaturan Umum" },
  { id: "web" as Section, icon: Palette, label: "Pengaturan Web" },
  { id: "domains" as Section, icon: Globe, label: "Domain" },
  { id: "users" as Section, icon: Users, label: "Pengguna" },
  { id: "stats" as Section, icon: BarChart2, label: "Statistik" },
];

function ToggleRow({ label, desc, checked, onToggle }: {
  label: string; desc: string; checked: boolean; onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between py-3 px-0">
      <div className="flex-1 pr-4">
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${checked ? "bg-primary" : "bg-input"}`}
        role="switch"
        aria-checked={checked}
      >
        <span className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform duration-200 ${checked ? "translate-x-5" : "translate-x-0"}`} />
      </button>
    </div>
  );
}

export default function AdminPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [active, setActive] = useState<Section>("overview");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [detailedStats, setDetailedStats] = useState<DetailedStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editSettings, setEditSettings] = useState<Partial<SiteSettings>>({});
  const [newDomain, setNewDomain] = useState("");
  const [dnsTarget, setDnsTarget] = useState("");
  const [dnsChecking, setDnsChecking] = useState(false);
  // Reset password state
  const [resetPasswordUserId, setResetPasswordUserId] = useState<number | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState("");
  const [resetPasswordLoading, setResetPasswordLoading] = useState(false);
  const [dnsResult, setDnsResult] = useState<{
    domain: string; a: string[]; cname: string[]; mx: { exchange: string; priority: number }[];
    status: "ok" | "partial" | "error"; summary: string;
  } | null>(null);
  const [inboundSecret, setInboundSecret] = useState<string | null>(null);
  const [secretLoading, setSecretLoading] = useState(false);
  const [secretVisible, setSecretVisible] = useState(false);

  useEffect(() => {
    if (!user) { navigate("/login"); return; }
    if (user.role !== "admin") { navigate("/dashboard"); return; }
    fetchAll();
  }, [user]);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [s, u, cfg, ds] = await Promise.all([
        adminApi("/api/admin/stats"),
        adminApi("/api/admin/users"),
        adminApi("/api/admin/settings"),
        adminApi("/api/admin/stats/detail"),
      ]);
      setStats(s); setUsers(u); setSettings(cfg); setEditSettings(cfg); setDetailedStats(ds);
    } catch (err: unknown) {
      toast({ title: "Gagal memuat data", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleResetPassword = async () => {
    if (!resetPasswordUserId || !resetPasswordValue || resetPasswordValue.length < 6) {
      toast({ title: "Password minimal 6 karakter", variant: "destructive" });
      return;
    }
    setResetPasswordLoading(true);
    try {
      await adminApi(`/api/admin/users/${resetPasswordUserId}/password`, {
        method: "PATCH",
        body: JSON.stringify({ password: resetPasswordValue }),
      });
      toast({ title: "Password berhasil direset" });
      setResetPasswordUserId(null);
      setResetPasswordValue("");
    } catch (err: unknown) {
      toast({ title: "Gagal reset password", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally { setResetPasswordLoading(false); }
  };

  const saveSettings = async (partial?: Partial<SiteSettings>) => {
    const payload = partial ?? editSettings;
    setSaving(true);
    try {
      await adminApi("/api/admin/settings", { method: "PUT", body: JSON.stringify(payload) });
      setSettings((prev) => ({ ...prev, ...payload } as SiteSettings));
      if (!partial) setSettings(payload as SiteSettings);
      toast({ title: "Pengaturan disimpan" });
    } catch (err: unknown) {
      toast({ title: "Gagal menyimpan", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const set = (key: keyof SiteSettings, val: string) =>
    setEditSettings((p) => ({ ...p, [key]: val }));
  const toggle = (key: keyof SiteSettings) =>
    setEditSettings((p) => ({ ...p, [key]: p[key] === "true" ? "false" : "true" }));

  const getDomains = (): string[] => {
    try { return JSON.parse(editSettings.available_domains ?? "[]"); } catch { return []; }
  };
  const addDomain = () => {
    const d = newDomain.trim().toLowerCase();
    if (!d || !d.includes(".")) { toast({ title: "Domain tidak valid", variant: "destructive" }); return; }
    const cur = getDomains();
    if (cur.includes(d)) { toast({ title: "Domain sudah ada", variant: "destructive" }); return; }
    set("available_domains", JSON.stringify([...cur, d]));
    setNewDomain("");
  };
  const removeDomain = (d: string) => {
    set("available_domains", JSON.stringify(getDomains().filter((x) => x !== d)));
  };

  const loadInboundSecret = async () => {
    if (inboundSecret) { setSecretVisible(true); return; }
    setSecretLoading(true);
    try {
      const data = await adminApi("/api/webhook/inbound-secret");
      setInboundSecret(data.secret);
      setSecretVisible(true);
    } catch (err: unknown) {
      toast({ title: "Gagal memuat secret", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally { setSecretLoading(false); }
  };

  const copyText = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => toast({ title: `${label} disalin!` }));
  };

  const checkDns = async () => {
    const d = dnsTarget.trim().toLowerCase();
    if (!d || !d.includes(".")) { toast({ title: "Masukkan domain yang valid", variant: "destructive" }); return; }
    setDnsChecking(true);
    setDnsResult(null);
    try {
      const data = await adminApi(`/api/admin/dns-check?domain=${encodeURIComponent(d)}`);
      setDnsResult(data);
    } catch (err: unknown) {
      toast({ title: "Gagal cek DNS", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setDnsChecking(false);
    }
  };

  const handleRoleChange = async (id: number, role: string) => {
    try {
      await adminApi(`/api/admin/users/${id}/role`, { method: "PATCH", body: JSON.stringify({ role }) });
      setUsers((p) => p.map((u) => u.id === id ? { ...u, role } : u));
      toast({ title: `Role diubah ke ${role}` });
    } catch (err: unknown) { toast({ title: "Gagal", description: err instanceof Error ? err.message : "", variant: "destructive" }); }
  };
  const handleDeleteUser = async (id: number) => {
    try {
      await adminApi(`/api/admin/users/${id}`, { method: "DELETE" });
      setUsers((p) => p.filter((u) => u.id !== id));
      toast({ title: "Pengguna dihapus" });
    } catch (err: unknown) { toast({ title: "Gagal", description: err instanceof Error ? err.message : "", variant: "destructive" }); }
  };

  if (!user || user.role !== "admin") return null;

  const navTo = (s: Section) => { setActive(s); setSidebarOpen(false); };

  const Sidebar = () => (
    <aside className="flex flex-col h-full bg-card border-r border-border">
      {/* Brand */}
      <div className="flex items-center gap-2.5 px-4 py-4 border-b border-border">
        <div className="bg-primary/10 p-1.5 rounded-md text-primary shrink-0">
          <ShieldCheck className="h-5 w-5" />
        </div>
        <div>
          <p className="font-bold text-sm leading-none">Panel Admin</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">TempMail</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV.map((n) => (
          <button
            key={n.id}
            onClick={() => navTo(n.id)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              active === n.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            <n.icon className="h-4 w-4 shrink-0" />
            {n.label}
          </button>
        ))}
      </nav>

      <Separator />

      {/* User info + actions */}
      <div className="p-3 space-y-2">
        <Link href="/">
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <Home className="h-4 w-4 shrink-0" />
            Kembali ke Situs
          </button>
        </Link>
        <Link href="/dashboard">
          <button className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">
            <LayoutDashboard className="h-4 w-4 shrink-0" />
            Dashboard Saya
          </button>
        </Link>
        <div className="px-3 py-2 rounded-lg bg-muted/50 flex items-center gap-2">
          <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-xs font-bold text-primary">{user.email[0].toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium truncate">{user.email}</p>
            <Badge variant="default" className="text-[9px] h-4 px-1 mt-0.5">Admin</Badge>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive" onClick={logout} title="Keluar">
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="min-h-screen bg-background flex overflow-x-hidden">
      {/* Desktop Sidebar */}
      <div className="hidden md:flex md:w-56 lg:w-60 shrink-0 flex-col fixed inset-y-0 left-0 z-40">
        <Sidebar />
      </div>

      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 bottom-0 w-60 z-10">
            <Sidebar />
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col md:ml-56 lg:ml-60">
        {/* Top bar */}
        <header className="sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border h-14 flex items-center px-4 gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8 md:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-1 text-sm text-muted-foreground flex-1 min-w-0">
            <span className="hidden sm:inline">Admin</span>
            <ChevronRight className="h-3 w-3 hidden sm:inline" />
            <span className="font-medium text-foreground truncate">{NAV.find((n) => n.id === active)?.label}</span>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchAll}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </header>

        <main className="flex-1 p-4 md:p-6 max-w-4xl mx-auto w-full space-y-6 pb-12 overflow-x-hidden">

          {/* ── OVERVIEW ── */}
          {active === "overview" && (
            <>
              <div>
                <h1 className="text-xl font-bold">Ringkasan</h1>
                <p className="text-sm text-muted-foreground mt-1">Gambaran umum kondisi sistem TempMail.</p>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:gap-4">
                {[
                  { icon: Users, label: "Pengguna", value: stats?.totalUsers ?? 0, color: "text-violet-500", bg: "bg-violet-50 dark:bg-violet-950/30" },
                  { icon: Mail, label: "Email Dibuat", value: stats?.totalEmails ?? 0, color: "text-primary", bg: "bg-primary/10" },
                  { icon: Inbox, label: "Pesan Masuk", value: stats?.totalMessages ?? 0, color: "text-green-600", bg: "bg-green-50 dark:bg-green-950/30" },
                ].map((s) => (
                  <Card key={s.label} className="border-border/50">
                    <CardContent className="p-3 sm:p-4">
                      <div className={`${s.bg} w-8 h-8 sm:w-9 sm:h-9 rounded-lg flex items-center justify-center mb-2 sm:mb-3`}>
                        <s.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${s.color}`} />
                      </div>
                      {loading ? <Skeleton className="h-6 w-10 mb-1 sm:h-8 sm:w-16" /> : (
                        <div className={`text-lg sm:text-2xl font-bold ${s.color}`}>{s.value}</div>
                      )}
                      <div className="text-[10px] sm:text-xs text-muted-foreground leading-tight">{s.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Quick links */}
              <div className="grid sm:grid-cols-2 gap-3">
                {NAV.filter((n) => n.id !== "overview").map((n) => (
                  <button
                    key={n.id}
                    onClick={() => navTo(n.id)}
                    className="flex items-center gap-3 p-4 rounded-xl border border-border hover:bg-muted/50 transition-colors text-left group"
                  >
                    <div className="bg-muted w-9 h-9 rounded-lg flex items-center justify-center shrink-0 group-hover:bg-primary/10 transition-colors">
                      <n.icon className="h-4.5 w-4.5 text-muted-foreground group-hover:text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{n.label}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground ml-auto opacity-50 group-hover:opacity-100" />
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ── PENGATURAN UMUM ── */}
          {active === "general" && (
            <>
              <div>
                <h1 className="text-xl font-bold">Pengaturan Umum</h1>
                <p className="text-sm text-muted-foreground mt-1">Konfigurasi dasar sistem email sementara.</p>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Settings className="h-4 w-4" /> Batas & Durasi</CardTitle>
                  <CardDescription>Atur batas penggunaan dan masa aktif email.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loading ? <div className="space-y-3">{[1,2,3,4].map(i=><Skeleton key={i} className="h-10 w-full"/>)}</div> : (
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Default TTL Email (menit)</Label>
                        <Input type="number" value={editSettings.default_ttl_minutes ?? "10"}
                          onChange={(e) => set("default_ttl_minutes", e.target.value)} min={1} max={1440} />
                        <p className="text-xs text-muted-foreground">Masa aktif email yang di-generate (default 10 menit).</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Max Inbox per Pengguna</Label>
                        <Input type="number" value={editSettings.max_inboxes ?? "5"}
                          onChange={(e) => set("max_inboxes", e.target.value)} min={1} max={20} />
                        <p className="text-xs text-muted-foreground">Jumlah inbox yang bisa dibuka bersamaan.</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Max Ukuran Pesan (KB)</Label>
                        <Input type="number" value={editSettings.max_message_size_kb ?? "1024"}
                          onChange={(e) => set("max_message_size_kb", e.target.value)} min={100} />
                        <p className="text-xs text-muted-foreground">Batas ukuran pesan yang diterima.</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Max Email per Hari per User</Label>
                        <Input type="number" value={editSettings.max_emails_per_day ?? "50"}
                          onChange={(e) => set("max_emails_per_day", e.target.value)} min={1} />
                        <p className="text-xs text-muted-foreground">0 = tidak dibatasi.</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4" /> Kontrol Akses</CardTitle>
                  <CardDescription>Atur siapa yang bisa menggunakan layanan.</CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  {loading ? <Skeleton className="h-20 w-full" /> : (
                    <>
                      <ToggleRow
                        label="Izinkan Registrasi"
                        desc="Pengguna baru bisa membuat akun."
                        checked={editSettings.allow_registration === "true"}
                        onToggle={() => toggle("allow_registration")}
                      />
                      <ToggleRow
                        label="Wajib Login untuk Generate Email"
                        desc="Pengguna harus login sebelum bisa generate email sementara."
                        checked={editSettings.require_login_to_generate === "true"}
                        onToggle={() => toggle("require_login_to_generate")}
                      />
                      <ToggleRow
                        label="Mode Pemeliharaan"
                        desc="Tampilkan halaman maintenance untuk semua pengguna biasa."
                        checked={editSettings.maintenance_mode === "true"}
                        onToggle={() => toggle("maintenance_mode")}
                      />
                    </>
                  )}
                </CardContent>
              </Card>

              <Button onClick={() => saveSettings()} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? "Menyimpan..." : "Simpan Pengaturan Umum"}
              </Button>
            </>
          )}

          {/* ── PENGATURAN WEB ── */}
          {active === "web" && (
            <>
              <div>
                <h1 className="text-xl font-bold">Pengaturan Web</h1>
                <p className="text-sm text-muted-foreground mt-1">Konfigurasi tampilan, branding, SEO, dan fitur antarmuka.</p>
              </div>

              {/* Branding */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Image className="h-4 w-4" /> Branding & Identitas</CardTitle>
                  <CardDescription>Nama, deskripsi, dan logo situs.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loading ? <div className="space-y-3">{[1,2,3].map(i=><Skeleton key={i} className="h-10 w-full"/>)}</div> : (
                    <>
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                          <Label>Nama Situs</Label>
                          <Input value={editSettings.site_name ?? ""} onChange={(e) => set("site_name", e.target.value)} placeholder="TempMail" />
                        </div>
                        <div className="space-y-1.5">
                          <Label>URL Logo Situs</Label>
                          <Input value={editSettings.site_logo_url ?? ""} onChange={(e) => set("site_logo_url", e.target.value)} placeholder="https://..." />
                          <p className="text-xs text-muted-foreground">Kosongkan untuk menggunakan ikon default.</p>
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Deskripsi Singkat Situs</Label>
                        <Textarea
                          value={editSettings.site_description ?? ""}
                          onChange={(e) => set("site_description", e.target.value)}
                          placeholder="Layanan email sementara gratis..."
                          rows={2}
                        />
                        <p className="text-xs text-muted-foreground">Ditampilkan di halaman utama sebagai tagline.</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Teks Footer</Label>
                        <Input value={editSettings.footer_text ?? ""} onChange={(e) => set("footer_text", e.target.value)} placeholder="© 2025 TempMail..." />
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* SEO */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Search className="h-4 w-4" /> SEO & Meta</CardTitle>
                  <CardDescription>Konfigurasi tag meta untuk mesin pencari.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loading ? <div className="space-y-3">{[1,2].map(i=><Skeleton key={i} className="h-10 w-full"/>)}</div> : (
                    <>
                      <div className="space-y-1.5">
                        <Label>Meta Title (judul browser/SEO)</Label>
                        <Input value={editSettings.meta_title ?? ""} onChange={(e) => set("meta_title", e.target.value)} placeholder="TempMail - Email Sementara Gratis" />
                        <p className="text-xs text-muted-foreground">Ditampilkan di tab browser dan hasil pencarian Google.</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Meta Keywords</Label>
                        <Input value={editSettings.meta_keywords ?? ""} onChange={(e) => set("meta_keywords", e.target.value)} placeholder="email sementara, disposable email, temp mail" />
                        <p className="text-xs text-muted-foreground">Pisahkan dengan koma.</p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Fitur UI */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Zap className="h-4 w-4" /> Fitur Antarmuka</CardTitle>
                  <CardDescription>Toggle fitur-fitur di halaman utama.</CardDescription>
                </CardHeader>
                <CardContent className="divide-y divide-border">
                  {loading ? <Skeleton className="h-28 w-full" /> : (
                    <>
                      <ToggleRow
                        label="Tampilkan QR Code Otomatis"
                        desc="QR code langsung muncul saat email di-generate."
                        checked={editSettings.show_qr_by_default === "true"}
                        onToggle={() => toggle("show_qr_by_default")}
                      />
                      <ToggleRow
                        label="Auto Copy Email"
                        desc="Email otomatis disalin ke clipboard saat di-generate."
                        checked={editSettings.auto_copy_on_generate === "true"}
                        onToggle={() => toggle("auto_copy_on_generate")}
                      />
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Pengumuman */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Megaphone className="h-4 w-4" /> Banner Pengumuman</CardTitle>
                  <CardDescription>Tampilkan banner info/peringatan di bagian atas halaman.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {loading ? <div className="space-y-3">{[1,2,3].map(i=><Skeleton key={i} className="h-10 w-full"/>)}</div> : (
                    <>
                      <ToggleRow
                        label="Aktifkan Banner"
                        desc="Tampilkan banner pengumuman di halaman utama."
                        checked={editSettings.announcement_enabled === "true"}
                        onToggle={() => toggle("announcement_enabled")}
                      />
                      <div className="space-y-1.5">
                        <Label>Tipe Banner</Label>
                        <Select
                          value={editSettings.announcement_type ?? "info"}
                          onValueChange={(v) => set("announcement_type", v)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="info">
                              <div className="flex items-center gap-2"><Info className="h-3.5 w-3.5 text-blue-500" />Info (biru)</div>
                            </SelectItem>
                            <SelectItem value="warning">
                              <div className="flex items-center gap-2"><AlertTriangle className="h-3.5 w-3.5 text-yellow-500" />Peringatan (kuning)</div>
                            </SelectItem>
                            <SelectItem value="success">
                              <div className="flex items-center gap-2"><CheckCircle className="h-3.5 w-3.5 text-green-500" />Sukses (hijau)</div>
                            </SelectItem>
                            <SelectItem value="error">
                              <div className="flex items-center gap-2"><X className="h-3.5 w-3.5 text-red-500" />Error (merah)</div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Teks Pengumuman</Label>
                        <Textarea
                          value={editSettings.announcement_text ?? ""}
                          onChange={(e) => set("announcement_text", e.target.value)}
                          placeholder="Tulis pesan pengumuman di sini..."
                          rows={3}
                          disabled={editSettings.announcement_enabled !== "true"}
                        />
                      </div>
                      {/* Preview */}
                      {editSettings.announcement_enabled === "true" && editSettings.announcement_text && (
                        <div>
                          <Label className="text-xs text-muted-foreground mb-1.5 block">Preview</Label>
                          <div className={`rounded-lg px-4 py-3 text-sm flex items-start gap-2 border ${
                            editSettings.announcement_type === "warning" ? "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200" :
                            editSettings.announcement_type === "success" ? "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200" :
                            editSettings.announcement_type === "error" ? "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-800 dark:text-red-200" :
                            "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200"
                          }`}>
                            {editSettings.announcement_type === "warning" && <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />}
                            {editSettings.announcement_type === "success" && <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                            {editSettings.announcement_type === "error" && <X className="h-4 w-4 mt-0.5 shrink-0" />}
                            {editSettings.announcement_type === "info" && <Info className="h-4 w-4 mt-0.5 shrink-0" />}
                            <span>{editSettings.announcement_text}</span>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>

              <Button onClick={() => saveSettings()} disabled={saving} className="gap-2">
                <Save className="h-4 w-4" />
                {saving ? "Menyimpan..." : "Simpan Pengaturan Web"}
              </Button>
            </>
          )}

          {/* ── DOMAIN ── */}
          {active === "domains" && (
            <>
              {/* ── Header ── */}
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <h1 className="text-xl font-bold">Manajemen Domain</h1>
                  <p className="text-sm text-muted-foreground mt-1">Tambah domain dan hubungkan ke Cloudflare Email Routing.</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-green-500/10 border border-green-500/20">
                    <div className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-medium text-green-600 dark:text-green-400">{getDomains().length} Domain Aktif</span>
                  </div>
                </div>
              </div>

              {/* ── Layout 2 kolom ── */}
              <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">

                {/* Kolom kiri — Daftar Domain + DNS */}
                <div className="xl:col-span-2 space-y-5">

                  {/* Daftar Domain */}
                  <Card className="overflow-hidden">
                    <CardHeader className="pb-3 border-b border-border bg-muted/30">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Globe className="h-4 w-4 text-primary" />
                        Domain Tersedia
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-0">
                      {/* Domain list */}
                      <div className="divide-y divide-border">
                        {loading ? (
                          [1,2,3].map(i => <Skeleton key={i} className="h-16 w-full rounded-none" />)
                        ) : getDomains().length === 0 ? (
                          <div className="p-8 text-center text-muted-foreground text-sm">Belum ada domain.</div>
                        ) : getDomains().map((d) => (
                          <div key={d} className="flex items-center gap-2 px-4 py-3 group hover:bg-muted/30 transition-colors">
                            {/* CF Icon */}
                            <div className="h-9 w-9 rounded-xl bg-orange-500/10 border border-orange-400/20 flex items-center justify-center shrink-0">
                              <svg className="h-4 w-4 text-orange-500" viewBox="0 0 200 210" fill="currentColor">
                                <path d="M131.3 75.9c-2.8-9.8-9.8-17.5-19.1-21.3L68.6 37.1c-2.8-1.1-5.9.4-6.9 3.2-.5 1.3-.4 2.7.2 3.9l9.1 17.7c.7 1.4.7 3-.1 4.3-.8 1.3-2.1 2.2-3.6 2.4l-51.1 6.4c-3 .4-5.1 3.1-4.8 6.1.1 1.2.6 2.3 1.5 3.1l16.4 14.4c1.1 1 1.7 2.4 1.5 3.8-.2 1.4-1 2.6-2.2 3.4L4 114c-2.5 1.6-3.2 4.9-1.6 7.4.8 1.3 2.1 2.1 3.6 2.4l108.4 19.7c1.9.3 3.7-.3 5-1.6 1.3-1.3 1.9-3.1 1.6-4.9l-2.5-15.1c-.3-1.9.3-3.8 1.7-5.1 1.4-1.3 3.3-1.9 5.2-1.6l57.3 8.3c2.9.4 5.7-1.5 6.4-4.4.4-1.5.1-3.1-.8-4.3l-57.8-39z"/>
                              </svg>
                            </div>
                            {/* Domain Info */}
                            <div className="flex-1 min-w-0">
                              <p className="font-mono text-sm font-bold truncate">@{d}</p>
                              <p className="text-[11px] text-muted-foreground truncate">contoh@{d}</p>
                            </div>
                            {/* Actions */}
                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <a
                                href={`https://dash.cloudflare.com/?to=/:account/${d}/email/routing`}
                                target="_blank"
                                rel="noopener noreferrer"
                                title="Buka Cloudflare Email Routing"
                              >
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-950/30">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              </a>
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary hover:bg-primary/10"
                                onClick={() => { setDnsTarget(d); }}
                                title="Tes DNS"
                              >
                                <Search className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => removeDomain(d)} disabled={getDomains().length <= 1}
                                title="Hapus domain"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      {/* Add domain */}
                      <div className="p-3 border-t border-border bg-muted/20 space-y-2">
                        <div className="flex gap-2">
                          <Input
                            placeholder="contoh-domain.com"
                            value={newDomain}
                            onChange={(e) => setNewDomain(e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") addDomain(); }}
                            className="flex-1 h-8 text-sm"
                          />
                          <Button onClick={addDomain} size="sm" className="gap-1.5 shrink-0 h-8">
                            <PlusCircle className="h-3.5 w-3.5" />
                            Tambah
                          </Button>
                        </div>
                        <Button onClick={() => saveSettings()} disabled={saving} variant="outline" size="sm" className="w-full gap-2 h-8">
                          <Save className="h-3.5 w-3.5" />
                          {saving ? "Menyimpan..." : "Simpan Perubahan"}
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Tes DNS */}
                  <Card>
                    <CardHeader className="pb-3 border-b border-border bg-muted/30">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Search className="h-4 w-4 text-primary" />
                        Tes Koneksi DNS
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex gap-2">
                        <Input
                          placeholder="domain.com"
                          value={dnsTarget}
                          onChange={(e) => { setDnsTarget(e.target.value); setDnsResult(null); }}
                          onKeyDown={(e) => { if (e.key === "Enter") checkDns(); }}
                          className="flex-1 h-8 text-sm"
                        />
                        <Button onClick={checkDns} disabled={dnsChecking} size="sm" className="gap-1.5 shrink-0 h-8">
                          <RefreshCw className={`h-3.5 w-3.5 ${dnsChecking ? "animate-spin" : ""}`} />
                          {dnsChecking ? "..." : "Cek"}
                        </Button>
                      </div>

                      {dnsResult && (
                        <div className={`rounded-xl border p-3 space-y-2.5 ${
                          dnsResult.status === "ok" ? "border-green-500/40 bg-green-500/5"
                          : dnsResult.status === "partial" ? "border-yellow-500/40 bg-yellow-500/5"
                          : "border-destructive/40 bg-destructive/5"
                        }`}>
                          <div className="flex items-center gap-2">
                            {dnsResult.status === "ok" && <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />}
                            {dnsResult.status === "partial" && <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />}
                            {dnsResult.status === "error" && <ShieldX className="h-4 w-4 text-destructive shrink-0" />}
                            <span className={`text-sm font-semibold ${
                              dnsResult.status === "ok" ? "text-green-600 dark:text-green-400"
                              : dnsResult.status === "partial" ? "text-yellow-600 dark:text-yellow-400"
                              : "text-destructive"
                            }`}>
                              {dnsResult.status === "ok" ? "DNS OK" : dnsResult.status === "partial" ? "Sebagian" : "Tidak Ditemukan"}
                            </span>
                            <code className="text-[10px] text-muted-foreground font-mono ml-auto truncate">{dnsResult.domain}</code>
                          </div>
                          <p className="text-xs text-muted-foreground">{dnsResult.summary}</p>
                          {(dnsResult.mx.length > 0 || dnsResult.a.length > 0) && (
                            <div className="space-y-1.5 pt-1 border-t border-border/50">
                              {dnsResult.mx.length > 0 && (
                                <div className="flex gap-2 text-[11px]">
                                  <span className="text-muted-foreground w-8 shrink-0 font-medium">MX</span>
                                  <div className="flex flex-wrap gap-1">
                                    {dnsResult.mx.map(m => <code key={m.exchange} className="bg-muted px-1.5 py-0.5 rounded font-mono">{m.priority} {m.exchange}</code>)}
                                  </div>
                                </div>
                              )}
                              {dnsResult.a.length > 0 && (
                                <div className="flex gap-2 text-[11px]">
                                  <span className="text-muted-foreground w-8 shrink-0 font-medium">A</span>
                                  <div className="flex flex-wrap gap-1">
                                    {dnsResult.a.map(ip => <code key={ip} className="bg-muted px-1.5 py-0.5 rounded font-mono">{ip}</code>)}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Kolom kanan — Panduan Cloudflare */}
                <div className="xl:col-span-3 space-y-5">

                  {/* Header Cloudflare */}
                  <div className="rounded-2xl border border-orange-400/30 bg-gradient-to-br from-orange-500/5 via-transparent to-orange-400/5 p-5">
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 rounded-2xl bg-orange-500/15 border border-orange-400/30 flex items-center justify-center shrink-0">
                        <svg className="h-6 w-6 text-orange-500" viewBox="0 0 200 210" fill="currentColor">
                          <path d="M131.3 75.9c-2.8-9.8-9.8-17.5-19.1-21.3L68.6 37.1c-2.8-1.1-5.9.4-6.9 3.2-.5 1.3-.4 2.7.2 3.9l9.1 17.7c.7 1.4.7 3-.1 4.3-.8 1.3-2.1 2.2-3.6 2.4l-51.1 6.4c-3 .4-5.1 3.1-4.8 6.1.1 1.2.6 2.3 1.5 3.1l16.4 14.4c1.1 1 1.7 2.4 1.5 3.8-.2 1.4-1 2.6-2.2 3.4L4 114c-2.5 1.6-3.2 4.9-1.6 7.4.8 1.3 2.1 2.1 3.6 2.4l108.4 19.7c1.9.3 3.7-.3 5-1.6 1.3-1.3 1.9-3.1 1.6-4.9l-2.5-15.1c-.3-1.9.3-3.8 1.7-5.1 1.4-1.3 3.3-1.9 5.2-1.6l57.3 8.3c2.9.4 5.7-1.5 6.4-4.4.4-1.5.1-3.1-.8-4.3l-57.8-39z"/>
                        </svg>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-base">Koneksi Cloudflare Email Routing</h3>
                        <p className="text-sm text-muted-foreground mt-0.5">Ikuti langkah-langkah berikut untuk menghubungkan domain Anda agar email masuk secara real-time.</p>
                        <div className="flex flex-wrap gap-2 mt-3">
                          <a href="https://dash.cloudflare.com/" target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 border-orange-400/40 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30">
                              Dashboard <ExternalLink className="h-3 w-3" />
                            </Button>
                          </a>
                          <a href="https://developers.cloudflare.com/email-routing/email-workers/" target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                              Dokumentasi <ExternalLink className="h-3 w-3" />
                            </Button>
                          </a>
                          <a href="https://dash.cloudflare.com/?to=/:account/workers-and-pages" target="_blank" rel="noopener noreferrer">
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 text-muted-foreground hover:text-foreground">
                              Workers & Pages <ExternalLink className="h-3 w-3" />
                            </Button>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Langkah-langkah */}
                  <Card>
                    <CardHeader className="pb-3 border-b border-border bg-muted/30">
                      <CardTitle className="text-sm font-semibold">Langkah-langkah Setup</CardTitle>
                      <CardDescription className="text-xs">Ikuti urutan ini untuk mengaktifkan penerimaan email real-time.</CardDescription>
                    </CardHeader>
                    <CardContent className="p-4 space-y-0">

                      {/* Step 1 */}
                      <div className="flex gap-3 pb-5 relative">
                        <div className="flex flex-col items-center">
                          <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 z-10">1</div>
                          <div className="w-px flex-1 bg-border mt-1" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5 pb-2">
                          <p className="text-sm font-semibold mb-1">Aktifkan Cloudflare Email Routing</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Buka <a href="https://dash.cloudflare.com/" target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">Cloudflare Dashboard</a>, pilih domain Anda → menu <strong>Email</strong> → <strong>Email Routing</strong> → klik <strong>Enable Email Routing</strong>.
                          </p>
                        </div>
                      </div>

                      {/* Step 2 */}
                      <div className="flex gap-3 pb-5 relative">
                        <div className="flex flex-col items-center">
                          <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 z-10">2</div>
                          <div className="w-px flex-1 bg-border mt-1" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5 pb-2">
                          <p className="text-sm font-semibold mb-1.5">Tambahkan MX Record</p>
                          <p className="text-xs text-muted-foreground mb-2">Di <strong>DNS</strong> → <strong>Records</strong>, tambahkan 3 record MX berikut:</p>
                          <div className="rounded-lg overflow-hidden border border-border text-xs">
                            <table className="w-full">
                              <thead className="bg-muted">
                                <tr className="text-[10px] text-muted-foreground font-medium">
                                  <th className="text-left px-2.5 py-1.5">TYPE</th>
                                  <th className="text-left px-2.5 py-1.5">NAME</th>
                                  <th className="text-left px-2.5 py-1.5">MAIL SERVER</th>
                                  <th className="text-left px-2.5 py-1.5">PRIO</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border font-mono">
                                {[
                                  ["route1.mx.cloudflare.net", "10"],
                                  ["route2.mx.cloudflare.net", "20"],
                                  ["route3.mx.cloudflare.net", "30"],
                                ].map(([v, p]) => (
                                  <tr key={v} className="hover:bg-muted/40">
                                    <td className="px-2.5 py-1.5 text-blue-500 font-bold">MX</td>
                                    <td className="px-2.5 py-1.5 text-muted-foreground">@</td>
                                    <td className="px-2.5 py-1.5 text-[11px]">{v}</td>
                                    <td className="px-2.5 py-1.5 text-muted-foreground">{p}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>

                      {/* Step 3 */}
                      <div className="flex gap-3 pb-5 relative">
                        <div className="flex flex-col items-center">
                          <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 z-10">3</div>
                          <div className="w-px flex-1 bg-border mt-1" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5 pb-2">
                          <p className="text-sm font-semibold mb-1">Salin Webhook Secret</p>
                          <p className="text-xs text-muted-foreground mb-2">Salin secret ini — Anda akan membutuhkannya di langkah berikutnya.</p>
                          {!secretVisible ? (
                            <Button size="sm" variant="outline" onClick={loadInboundSecret} disabled={secretLoading} className="gap-2 h-8">
                              <Key className="h-3.5 w-3.5" />
                              {secretLoading ? "Memuat..." : "Tampilkan Webhook Secret"}
                            </Button>
                          ) : (
                            <div className="flex items-center gap-2">
                              <code className="flex-1 min-w-0 bg-muted px-3 py-2 rounded-lg text-xs font-mono break-all border border-border">
                                {inboundSecret}
                              </code>
                              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0"
                                onClick={() => copyText(inboundSecret!, "Secret")}>
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Step 4 */}
                      <div className="flex gap-3 pb-5 relative">
                        <div className="flex flex-col items-center">
                          <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 z-10">4</div>
                          <div className="w-px flex-1 bg-border mt-1" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5 pb-2">
                          <p className="text-sm font-semibold mb-1">Buat & Deploy Email Worker</p>
                          <p className="text-xs text-muted-foreground mb-2">
                            Buka <a href="https://dash.cloudflare.com/?to=/:account/workers-and-pages" target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-2 hover:underline">Workers & Pages</a> → <strong>Create Worker</strong> → tempel kode dari file <code className="bg-muted px-1 rounded">cloudflare-worker/email-worker.js</code> di project ini.
                          </p>
                          <p className="text-xs text-muted-foreground">Di <strong>Settings → Variables &amp; Secrets</strong>, tambahkan 2 environment variable:</p>
                          <div className="mt-2 rounded-lg border border-border bg-muted/50 overflow-hidden">
                            <div className="px-3 py-2 border-b border-border/50 flex items-center justify-between">
                              <div>
                                <span className="text-[11px] font-mono font-semibold text-purple-500">TEMPMAIL_WEBHOOK_URL</span>
                              </div>
                            </div>
                            <div className="px-3 py-2 font-mono text-[11px] text-muted-foreground break-all">
                              https://yourapp.replit.app/api/webhook/inbound-email
                            </div>
                            <div className="px-3 py-2 border-t border-b border-border/50">
                              <span className="text-[11px] font-mono font-semibold text-purple-500">TEMPMAIL_WEBHOOK_SECRET</span>
                            </div>
                            <div className="px-3 py-2 font-mono text-[11px] text-muted-foreground">
                              (nilai dari Langkah 3)
                            </div>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-2">Tambahkan juga dependensi npm <code className="bg-muted px-1 rounded">postal-mime</code> di dalam Worker.</p>
                        </div>
                      </div>

                      {/* Step 5 */}
                      <div className="flex gap-3 pb-5 relative">
                        <div className="flex flex-col items-center">
                          <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center shrink-0 z-10">5</div>
                          <div className="w-px flex-1 bg-border mt-1" />
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5 pb-2">
                          <p className="text-sm font-semibold mb-1">Hubungkan Worker ke Routing Rule</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Kembali ke <strong>Email Routing</strong> → tab <strong>Routing Rules</strong> → bagian <strong>Catch-all address</strong> → ubah action ke <strong>Send to a Worker</strong> → pilih worker yang tadi dibuat → klik <strong>Save</strong>.
                          </p>
                        </div>
                      </div>

                      {/* Step 6 */}
                      <div className="flex gap-3">
                        <div className="flex flex-col items-center">
                          <div className="h-7 w-7 rounded-full bg-green-500 text-white text-xs font-bold flex items-center justify-center shrink-0">6</div>
                        </div>
                        <div className="flex-1 min-w-0 pt-0.5">
                          <p className="text-sm font-semibold mb-1">Tambah Domain di TempMail</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            Tambahkan domain ke daftar <strong>Domain Tersedia</strong> di kolom kiri, lalu klik <strong>Simpan Perubahan</strong>. Email masuk akan langsung tersimpan ke inbox secara real-time.
                          </p>
                          <div className="mt-2 flex items-center gap-2 p-2.5 bg-green-500/5 border border-green-500/20 rounded-lg">
                            <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />
                            <p className="text-xs text-green-700 dark:text-green-300 font-medium">Setup selesai! Email akan diterima secara real-time.</p>
                          </div>
                        </div>
                      </div>

                    </CardContent>
                  </Card>

                  {/* Webhook Endpoint Info */}
                  <Card>
                    <CardHeader className="pb-3 border-b border-border bg-muted/30">
                      <CardTitle className="text-sm font-semibold flex items-center gap-2">
                        <Zap className="h-4 w-4 text-primary" />
                        Referensi Webhook Endpoint
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="rounded-lg bg-muted/50 border border-border overflow-hidden">
                        <div className="flex items-center gap-2 px-3 py-2 border-b border-border/50 bg-muted">
                          <span className="text-[10px] font-bold text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded">POST</span>
                          <code className="text-xs font-mono text-foreground">/api/webhook/inbound-email</code>
                        </div>
                        <div className="p-3 space-y-2 text-xs">
                          <div className="flex gap-3 items-start">
                            <span className="text-muted-foreground w-16 shrink-0 font-medium pt-0.5">Header</span>
                            <code className="bg-muted border border-border px-2 py-1 rounded font-mono text-[11px]">X-Webhook-Secret: &lt;secret&gt;</code>
                          </div>
                          <div className="flex gap-3 items-start">
                            <span className="text-muted-foreground w-16 shrink-0 font-medium pt-0.5">Body</span>
                            <code className="bg-muted border border-border px-2 py-1 rounded font-mono text-[11px] leading-relaxed">
                              {"{ to, from, subject,\n  textBody, htmlBody }"}
                            </code>
                          </div>
                          <div className="flex gap-3 items-start">
                            <span className="text-muted-foreground w-16 shrink-0 font-medium pt-0.5">Response</span>
                            <code className="bg-muted border border-border px-2 py-1 rounded font-mono text-[11px]">{"{ ok: true }"}</code>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                </div>
              </div>
            </>
          )}

          {/* ── PENGGUNA ── */}
          {active === "users" && (
            <>
              <div>
                <h1 className="text-xl font-bold">Manajemen Pengguna</h1>
                <p className="text-sm text-muted-foreground mt-1">{users.length} pengguna terdaftar di sistem.</p>
              </div>

              <Card>
                <CardContent className="p-0">
                  {loading ? (
                    <div className="p-4 space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
                  ) : users.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground text-sm">Belum ada pengguna.</div>
                  ) : (
                    <div className="divide-y divide-border">
                      {users.map((u) => (
                        <div key={u.id} className="flex items-center justify-between p-4 hover:bg-muted/20 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0 text-sm font-bold">
                              {u.email[0].toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-medium truncate">{u.email}</span>
                                <Badge variant={u.role === "admin" ? "default" : "secondary"} className="text-[10px] h-4 px-1.5 shrink-0">
                                  {u.role === "admin" ? "Admin" : "User"}
                                </Badge>
                                {u.id === user.id && <Badge variant="outline" className="text-[10px] h-4 px-1.5 shrink-0">Anda</Badge>}
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">Bergabung {format(new Date(u.createdAt), "d MMM yyyy, HH:mm")}</p>
                            </div>
                          </div>
                          {u.id !== user.id && (
                            <div className="flex items-center gap-1 shrink-0 ml-2">
                              <Button
                                variant="outline" size="sm" className="h-7 text-xs gap-1"
                                onClick={() => handleRoleChange(u.id, u.role === "admin" ? "user" : "admin")}
                              >
                                {u.role === "admin"
                                  ? <><ShieldX className="h-3 w-3" /><span className="hidden sm:inline">Turunkan</span></>
                                  : <><ShieldCheck className="h-3 w-3" /><span className="hidden sm:inline">Admin</span></>}
                              </Button>
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary"
                                title="Reset password"
                                onClick={() => { setResetPasswordUserId(u.id); setResetPasswordValue(""); }}
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                              </Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Hapus pengguna?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Akun <strong>{u.email}</strong> akan dihapus permanen beserta semua datanya. Tidak bisa dibatalkan.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => handleDeleteUser(u.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                      Hapus Permanen
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </>
          )}

          {/* ── STATISTIK ── */}
          {active === "stats" && (
            <>
              <div>
                <h1 className="text-xl font-bold">Statistik</h1>
                <p className="text-sm text-muted-foreground mt-1">Data penggunaan sistem secara keseluruhan.</p>
              </div>

              {/* Stat Cards — 3 total + 3 hari ini */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  { label: "Total Pengguna", value: stats?.totalUsers ?? 0, icon: Users, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-950/40" },
                  { label: "Total Email Dibuat", value: stats?.totalEmails ?? 0, icon: Mail, color: "text-primary", bg: "bg-primary/10" },
                  { label: "Total Pesan Masuk", value: stats?.totalMessages ?? 0, icon: Inbox, color: "text-green-600 dark:text-green-400", bg: "bg-green-50 dark:bg-green-950/40" },
                ].map((s) => (
                  <Card key={s.label} className="border-border/50">
                    <CardContent className="p-4">
                      <div className={`${s.bg} w-8 h-8 rounded-lg flex items-center justify-center mb-3`}>
                        <s.icon className={`h-4 w-4 ${s.color}`} />
                      </div>
                      {loading ? <Skeleton className="h-8 w-16 mb-1" /> : (
                        <div className={`text-2xl font-bold ${s.color}`}>{s.value.toLocaleString("id-ID")}</div>
                      )}
                      <div className="text-xs text-muted-foreground mt-0.5">{s.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Stat Hari Ini */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Email Aktif Sekarang", value: detailedStats?.activeEmails ?? 0, icon: Activity, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-950/40" },
                  { label: "Email Dibuat Hari Ini", value: detailedStats?.emailsToday ?? 0, icon: Mail, color: "text-orange-600 dark:text-orange-400", bg: "bg-orange-50 dark:bg-orange-950/40" },
                  { label: "Pesan Diterima Hari Ini", value: detailedStats?.messagesToday ?? 0, icon: Inbox, color: "text-primary", bg: "bg-primary/10" },
                  { label: "User Baru (7 Hari)", value: detailedStats?.newUsersThisWeek ?? 0, icon: TrendingUp, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/40" },
                ].map((s) => (
                  <Card key={s.label} className="border-border/50">
                    <CardContent className="p-3">
                      <div className={`${s.bg} w-7 h-7 rounded-md flex items-center justify-center mb-2`}>
                        <s.icon className={`h-3.5 w-3.5 ${s.color}`} />
                      </div>
                      {loading ? <Skeleton className="h-7 w-12 mb-1" /> : (
                        <div className={`text-xl font-bold ${s.color}`}>{s.value.toLocaleString("id-ID")}</div>
                      )}
                      <div className="text-[11px] text-muted-foreground leading-tight mt-0.5">{s.label}</div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Grafik Email per Hari */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <BarChart2 className="h-4 w-4" /> Email Dibuat per Hari (7 Hari Terakhir)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? <Skeleton className="h-48 w-full" /> : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={detailedStats?.emailsPerDay ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(d: string) => {
                            const dt = new Date(d + "T00:00:00");
                            return dt.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
                          }}
                          className="text-muted-foreground"
                        />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip
                          formatter={(v: number) => [v, "Email"]}
                          labelFormatter={(d: string) => new Date(d + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                        />
                        <Bar dataKey="count" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Grafik Pesan per Hari */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Inbox className="h-4 w-4" /> Pesan Masuk per Hari (7 Hari Terakhir)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? <Skeleton className="h-48 w-full" /> : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={detailedStats?.messagesPerDay ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border/50" />
                        <XAxis
                          dataKey="date"
                          tick={{ fontSize: 11 }}
                          tickFormatter={(d: string) => {
                            const dt = new Date(d + "T00:00:00");
                            return dt.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
                          }}
                        />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip
                          formatter={(v: number) => [v, "Pesan"]}
                          labelFormatter={(d: string) => new Date(d + "T00:00:00").toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long" })}
                          contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid hsl(var(--border))", background: "hsl(var(--popover))", color: "hsl(var(--popover-foreground))" }}
                        />
                        <Bar dataKey="count" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </CardContent>
              </Card>

              {/* Metrik Turunan + Konfigurasi */}
              <div className="grid sm:grid-cols-2 gap-3">
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-orange-100 dark:bg-orange-950/50 p-1.5 rounded-lg">
                        <BarChart2 className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">Rata-rata Pesan / Email</p>
                    </div>
                    {loading ? <Skeleton className="h-8 w-16" /> : (
                      <p className="text-2xl font-bold">
                        {stats?.totalEmails ? (stats.totalMessages / stats.totalEmails).toFixed(1) : "0"}
                      </p>
                    )}
                  </CardContent>
                </Card>
                <Card className="bg-muted/30">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="bg-cyan-100 dark:bg-cyan-950/50 p-1.5 rounded-lg">
                        <Zap className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">Rata-rata Email / User</p>
                    </div>
                    {loading ? <Skeleton className="h-8 w-16" /> : (
                      <p className="text-2xl font-bold">
                        {stats?.totalUsers ? (stats.totalEmails / stats.totalUsers).toFixed(1) : "0"}
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Konfigurasi Sistem */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="h-4 w-4" /> Konfigurasi Sistem
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-0 divide-y divide-border/50">
                  <div className="flex items-center justify-between py-2.5 gap-3">
                    <span className="text-sm text-muted-foreground shrink-0">Status Sistem</span>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${settings?.maintenance_mode === "true" ? "bg-yellow-100 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300" : "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${settings?.maintenance_mode === "true" ? "bg-yellow-500" : "bg-green-500"}`} />
                      {settings?.maintenance_mode === "true" ? "Pemeliharaan" : "Normal"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 gap-3">
                    <span className="text-sm text-muted-foreground shrink-0">Registrasi</span>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${settings?.allow_registration === "true" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${settings?.allow_registration === "true" ? "bg-primary" : "bg-muted-foreground"}`} />
                      {settings?.allow_registration === "true" ? "Dibuka" : "Ditutup"}
                    </span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 gap-3">
                    <span className="text-sm text-muted-foreground shrink-0">Nama Situs</span>
                    <span className="text-sm font-medium truncate text-right max-w-[55%]">{settings?.site_name ?? "-"}</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 gap-3">
                    <span className="text-sm text-muted-foreground shrink-0">TTL Email</span>
                    <span className="text-sm font-medium">{settings?.default_ttl_minutes ?? "10"} menit</span>
                  </div>
                  <div className="flex items-center justify-between py-2.5 gap-3">
                    <span className="text-sm text-muted-foreground shrink-0">Max Inbox</span>
                    <span className="text-sm font-medium">{settings?.max_inboxes ?? "5"} per user</span>
                  </div>
                  <div className="flex items-start justify-between py-2.5 gap-3">
                    <span className="text-sm text-muted-foreground shrink-0 mt-0.5">Domain Aktif</span>
                    <div className="flex flex-wrap gap-1.5 justify-end max-w-[60%]">
                      {loading ? <Skeleton className="h-6 w-24 rounded-full" /> : getDomains().map(d => (
                        <span key={d} className="inline-flex items-center gap-1 bg-primary/10 text-primary text-[11px] font-mono font-medium px-2 py-0.5 rounded-full">@{d}</span>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

        </main>
      </div>

      {/* ── Reset Password Dialog ── */}
      {resetPasswordUserId !== null && (
        <Dialog open={true} onOpenChange={() => { setResetPasswordUserId(null); setResetPasswordValue(""); }}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-primary" />
                Reset Password Pengguna
              </DialogTitle>
              <DialogDescription>
                Masukkan password baru untuk akun <strong>{users.find(u => u.id === resetPasswordUserId)?.email}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 py-1">
              <div className="space-y-1.5">
                <Label>Password Baru</Label>
                <Input
                  type="password"
                  placeholder="Minimal 6 karakter"
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleResetPassword()}
                />
              </div>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => { setResetPasswordUserId(null); setResetPasswordValue(""); }}>Batal</Button>
              <Button onClick={handleResetPassword} disabled={resetPasswordLoading} className="gap-2">
                <KeyRound className="h-4 w-4" />
                {resetPasswordLoading ? "Menyimpan..." : "Reset Password"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
