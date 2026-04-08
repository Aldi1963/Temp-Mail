import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Mail, Users, Inbox, Settings, Globe,
  Trash2, ShieldCheck, ShieldX, RefreshCw, Save, PlusCircle, X,
  BarChart2, ToggleLeft, ToggleRight, LayoutDashboard, LogOut,
  Menu, Megaphone, Palette, Zap, Tag, Info, AlertTriangle, CheckCircle,
  Home, ChevronRight, Image, FileText, Search, Copy, Key, ExternalLink
} from "lucide-react";
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
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type Section = "overview" | "general" | "web" | "domains" | "users" | "stats";

interface AdminStats { totalUsers: number; totalEmails: number; totalMessages: number; }
interface AdminUser { id: number; email: string; role: string; createdAt: string; }
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
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editSettings, setEditSettings] = useState<Partial<SiteSettings>>({});
  const [newDomain, setNewDomain] = useState("");
  const [dnsTarget, setDnsTarget] = useState("");
  const [dnsChecking, setDnsChecking] = useState(false);
  const [dnsResult, setDnsResult] = useState<{
    domain: string; a: string[]; cname: string[]; mx: { exchange: string; priority: number }[];
    status: "ok" | "partial" | "error"; summary: string;
  } | null>(null);
  const [guideType, setGuideType] = useState<"subdomain" | "root">("subdomain");
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
      const [s, u, cfg] = await Promise.all([
        adminApi("/api/admin/stats"),
        adminApi("/api/admin/users"),
        adminApi("/api/admin/settings"),
      ]);
      setStats(s); setUsers(u); setSettings(cfg); setEditSettings(cfg);
    } catch (err: unknown) {
      toast({ title: "Gagal memuat data", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally { setLoading(false); }
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
              <div>
                <h1 className="text-xl font-bold">Manajemen Domain</h1>
                <p className="text-sm text-muted-foreground mt-1">Tambah, hapus, dan verifikasi domain email yang tersedia.</p>
              </div>

              {/* Daftar Domain */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2"><Globe className="h-4 w-4" /> Domain Tersedia</CardTitle>
                  <CardDescription>{getDomains().length} domain aktif</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="contoh-domain.com"
                      value={newDomain}
                      onChange={(e) => setNewDomain(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") addDomain(); }}
                      className="flex-1"
                    />
                    <Button onClick={addDomain} className="gap-1.5 shrink-0">
                      <PlusCircle className="h-4 w-4" />
                      Tambah
                    </Button>
                  </div>
                  <div className="border border-border rounded-lg overflow-hidden divide-y divide-border">
                    {loading ? (
                      [1,2,3].map(i => <Skeleton key={i} className="h-12 w-full rounded-none" />)
                    ) : getDomains().length === 0 ? (
                      <div className="p-8 text-center text-muted-foreground text-sm">Belum ada domain.</div>
                    ) : getDomains().map((d) => (
                      <div key={d} className="flex items-center gap-2 p-3 hover:bg-muted/30 transition-colors">
                        <div className="flex items-center gap-2.5 flex-1 min-w-0">
                          <div className="h-8 w-8 bg-primary/10 rounded-lg flex items-center justify-center shrink-0">
                            <Globe className="h-4 w-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <span className="font-mono text-sm font-medium block truncate">@{d}</span>
                            <p className="text-xs text-muted-foreground truncate">Email aktif: user@{d}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground hover:text-primary px-2"
                            onClick={() => { setDnsTarget(d); setActive("domains"); }}
                          >
                            Tes DNS
                          </Button>
                          <Button
                            variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeDomain(d)} disabled={getDomains().length <= 1} title="Minimal 1 domain harus ada"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button onClick={() => saveSettings()} disabled={saving} className="w-full gap-2">
                    <Save className="h-4 w-4" />
                    {saving ? "Menyimpan..." : "Simpan Perubahan"}
                  </Button>
                </CardContent>
              </Card>

              {/* Panduan Pemasangan Domain */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="h-4 w-4" /> Panduan Pemasangan Domain
                  </CardTitle>
                  <CardDescription>Langkah-langkah menghubungkan domain kustom ke aplikasi ini.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Pilih tipe */}
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button
                      size="sm" variant={guideType === "subdomain" ? "default" : "outline"}
                      onClick={() => setGuideType("subdomain")}
                      className="flex-1 text-xs sm:text-sm"
                    >Subdomain (mail.domain.com)</Button>
                    <Button
                      size="sm" variant={guideType === "root" ? "default" : "outline"}
                      onClick={() => setGuideType("root")}
                      className="flex-1 text-xs sm:text-sm"
                    >Root Domain (domain.com)</Button>
                  </div>

                  <ol className="space-y-4">
                    {/* Langkah 1 */}
                    <li className="flex gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mt-0.5">1</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">Publish aplikasi di Replit</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Klik tombol <strong>Publish</strong> di Replit. Aplikasi akan tersedia di domain <code className="bg-muted px-1 rounded text-xs">*.replit.app</code>. Catat domain tersebut — kita butuh nanti.</p>
                      </div>
                    </li>

                    {/* Langkah 2 */}
                    <li className="flex gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mt-0.5">2</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">Daftarkan custom domain di Replit</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Buka halaman deployment → <strong>Custom Domain</strong> → masukkan domain Anda. Replit akan memberi DNS record yang harus dipasang.</p>
                      </div>
                    </li>

                    {/* Langkah 3 */}
                    <li className="flex gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mt-0.5">3</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">Tambahkan DNS Record di panel domain Anda</p>
                        <p className="text-xs text-muted-foreground mt-1 mb-2">Buka Cloudflare / Namecheap / panel DNS lainnya, lalu tambahkan record berikut:</p>
                        <div className="overflow-x-auto rounded-lg border border-border">
                          <table className="w-full text-xs font-mono min-w-[260px] bg-muted">
                            <thead>
                              <tr className="text-[10px] text-muted-foreground font-sans border-b border-border">
                                <th className="text-left px-3 py-2">TYPE</th><th className="text-left px-3 py-2">NAME</th><th className="text-left px-3 py-2">VALUE</th>
                              </tr>
                            </thead>
                            <tbody>
                              {guideType === "subdomain" ? (
                                <tr>
                                  <td className="px-3 py-2 text-blue-500 font-bold">CNAME</td>
                                  <td className="px-3 py-2">mail</td>
                                  <td className="px-3 py-2">nama-project.username.replit.app</td>
                                </tr>
                              ) : (
                                <tr>
                                  <td className="px-3 py-2 text-green-500 font-bold">A</td>
                                  <td className="px-3 py-2">@</td>
                                  <td className="px-3 py-2">(IP dari Replit)</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                        {guideType === "subdomain" && (
                          <p className="text-xs text-muted-foreground mt-2">
                            <strong>Cloudflare:</strong> Pastikan ikon awan berwarna <strong>abu-abu</strong> (proxy OFF), bukan oranye. Proxy ON akan mencegah Replit menerbitkan SSL.
                          </p>
                        )}
                      </div>
                    </li>

                    {/* Langkah 4 */}
                    <li className="flex gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mt-0.5">4</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">Tunggu propagasi DNS (5–60 menit)</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Setelah record disimpan, DNS perlu waktu untuk menyebar. Gunakan alat <strong>Tes DNS</strong> di bawah untuk memantau statusnya.</p>
                      </div>
                    </li>

                    {/* Langkah 5 */}
                    <li className="flex gap-3">
                      <div className="flex-shrink-0 h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center mt-0.5">5</div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">Verifikasi di Replit & tambah ke daftar domain</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Kembali ke Replit → klik <strong>Verify</strong>. Jika berhasil, tambahkan domain ke daftar di atas agar bisa digunakan untuk generate email.</p>
                      </div>
                    </li>
                  </ol>
                </CardContent>
              </Card>

              {/* Tes DNS */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Search className="h-4 w-4" /> Tes Koneksi DNS
                  </CardTitle>
                  <CardDescription>Periksa apakah domain sudah terdaftar dan mengarah dengan benar.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex gap-2">
                    <Input
                      placeholder="contoh: mail.domain.com"
                      value={dnsTarget}
                      onChange={(e) => { setDnsTarget(e.target.value); setDnsResult(null); }}
                      onKeyDown={(e) => { if (e.key === "Enter") checkDns(); }}
                      className="flex-1"
                    />
                    <Button onClick={checkDns} disabled={dnsChecking} className="gap-1.5 shrink-0">
                      <RefreshCw className={`h-4 w-4 ${dnsChecking ? "animate-spin" : ""}`} />
                      {dnsChecking ? "Mengecek..." : "Cek DNS"}
                    </Button>
                  </div>

                  {dnsResult && (
                    <div className={`rounded-lg border p-4 space-y-3 ${
                      dnsResult.status === "ok" ? "border-green-500/40 bg-green-500/5"
                      : dnsResult.status === "partial" ? "border-yellow-500/40 bg-yellow-500/5"
                      : "border-destructive/40 bg-destructive/5"
                    }`}>
                      {/* Status Badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {dnsResult.status === "ok" && <CheckCircle className="h-4 w-4 text-green-500 shrink-0" />}
                        {dnsResult.status === "partial" && <AlertTriangle className="h-4 w-4 text-yellow-500 shrink-0" />}
                        {dnsResult.status === "error" && <ShieldX className="h-4 w-4 text-destructive shrink-0" />}
                        <span className={`text-sm font-medium shrink-0 ${
                          dnsResult.status === "ok" ? "text-green-600 dark:text-green-400"
                          : dnsResult.status === "partial" ? "text-yellow-600 dark:text-yellow-400"
                          : "text-destructive"
                        }`}>
                          {dnsResult.status === "ok" ? "DNS OK" : dnsResult.status === "partial" ? "Sebagian Ditemukan" : "Tidak Ditemukan"}
                        </span>
                        <span className="text-xs text-muted-foreground font-mono truncate ml-auto min-w-0">{dnsResult.domain}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{dnsResult.summary}</p>
                      <Separator />
                      <div className="space-y-2 text-xs">
                        {dnsResult.a.length > 0 && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground w-16 shrink-0">A Record</span>
                            <div className="flex flex-wrap gap-1">
                              {dnsResult.a.map(ip => <code key={ip} className="bg-muted px-1.5 py-0.5 rounded font-mono">{ip}</code>)}
                            </div>
                          </div>
                        )}
                        {dnsResult.cname.length > 0 && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground w-16 shrink-0">CNAME</span>
                            <div className="flex flex-wrap gap-1">
                              {dnsResult.cname.map(c => <code key={c} className="bg-muted px-1.5 py-0.5 rounded font-mono">{c}</code>)}
                            </div>
                          </div>
                        )}
                        {dnsResult.mx.length > 0 && (
                          <div className="flex gap-2">
                            <span className="text-muted-foreground w-16 shrink-0">MX</span>
                            <div className="flex flex-wrap gap-1">
                              {dnsResult.mx.map(m => <code key={m.exchange} className="bg-muted px-1.5 py-0.5 rounded font-mono">{m.priority} {m.exchange}</code>)}
                            </div>
                          </div>
                        )}
                        {dnsResult.a.length === 0 && dnsResult.cname.length === 0 && dnsResult.mx.length === 0 && (
                          <p className="text-muted-foreground italic">Tidak ada DNS record yang ditemukan. Periksa konfigurasi DNS Anda.</p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Cloudflare Email Workers Setup */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Key className="h-4 w-4 text-orange-500" />
                    Terima Email Real-Time via Cloudflare
                  </CardTitle>
                  <CardDescription>
                    Hubungkan domain Anda dengan Cloudflare Email Workers agar email benar-benar masuk ke inbox secara real-time.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">

                  {/* Alur */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span className="bg-muted px-2 py-1 rounded font-medium">Pengirim</span>
                    <ChevronRight className="h-3 w-3 shrink-0" />
                    <span className="bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-1 rounded font-medium">MX → Cloudflare</span>
                    <ChevronRight className="h-3 w-3 shrink-0" />
                    <span className="bg-blue-500/10 text-blue-600 dark:text-blue-400 px-2 py-1 rounded font-medium">Email Worker</span>
                    <ChevronRight className="h-3 w-3 shrink-0" />
                    <span className="bg-primary/10 text-primary px-2 py-1 rounded font-medium">TempMail API</span>
                    <ChevronRight className="h-3 w-3 shrink-0" />
                    <span className="bg-green-500/10 text-green-600 dark:text-green-400 px-2 py-1 rounded font-medium">Inbox</span>
                  </div>

                  <Separator />

                  {/* Step 1 — Webhook Secret */}
                  <div className="space-y-2">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">1</span>
                      Webhook Secret
                    </p>
                    <p className="text-xs text-muted-foreground pl-7">
                      Kunci rahasia antara Worker dan TempMail. Salin dan simpan untuk dimasukkan ke Environment Variables Worker.
                    </p>
                    <div className="pl-7">
                      {!secretVisible ? (
                        <Button size="sm" variant="outline" onClick={loadInboundSecret} disabled={secretLoading} className="gap-2">
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

                  {/* Step 2 — MX Record */}
                  <div className="space-y-2">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">2</span>
                      Tambahkan MX Record di Cloudflare
                    </p>
                    <p className="text-xs text-muted-foreground pl-7">
                      Tambahkan record MX berikut di Cloudflare DNS domain Anda:
                    </p>
                    <div className="overflow-x-auto rounded-lg border border-border">
                      <table className="w-full text-xs font-mono bg-muted">
                        <thead>
                          <tr className="text-[10px] text-muted-foreground font-sans border-b border-border">
                            <th className="text-left px-2 py-2 w-10">TYPE</th>
                            <th className="text-left px-2 py-2 w-8">NAME</th>
                            <th className="text-left px-2 py-2">VALUE</th>
                            <th className="text-left px-2 py-2 w-12">PRIO</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/50">
                          {[["route1.mx.cloudflare.net","10"],["route2.mx.cloudflare.net","20"],["route3.mx.cloudflare.net","30"]].map(([v,p]) => (
                            <tr key={v}>
                              <td className="px-2 py-1.5 text-blue-500 font-bold">MX</td>
                              <td className="px-2 py-1.5">@</td>
                              <td className="px-2 py-1.5 break-all">{v}</td>
                              <td className="px-2 py-1.5">{p}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Step 3 — Aktifkan Email Routing */}
                  <div className="space-y-2">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">3</span>
                      Aktifkan Email Routing di Cloudflare
                    </p>
                    <p className="text-xs text-muted-foreground pl-7">
                      Cloudflare Dashboard → pilih domain → menu <strong>Email</strong> → <strong>Email Routing</strong> → klik <strong>Enable Email Routing</strong>.
                    </p>
                  </div>

                  {/* Step 4 — Deploy Worker */}
                  <div className="space-y-2">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">4</span>
                      Deploy Cloudflare Email Worker
                    </p>
                    <div className="pl-7 space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Buka <strong>Workers &amp; Pages</strong> → <strong>Create Worker</strong> → tempel kode dari file{" "}
                        <code className="bg-muted px-1 rounded break-all">cloudflare-worker/email-worker.js</code> di project ini.
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Di <strong>Settings → Variables</strong> tambahkan:
                      </p>
                    </div>
                    <div className="bg-muted rounded-lg p-3 font-mono text-xs border border-border space-y-2">
                      <div>
                        <div className="text-purple-500 font-medium">TEMPMAIL_WEBHOOK_URL</div>
                        <div className="text-muted-foreground break-all mt-0.5">https://yourapp.replit.app/api/webhook/inbound-email</div>
                      </div>
                      <div>
                        <div className="text-purple-500 font-medium">TEMPMAIL_WEBHOOK_SECRET</div>
                        <div className="text-muted-foreground mt-0.5">(salin dari Langkah 1)</div>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground pl-7">
                      Tambahkan juga dependensi <code className="bg-muted px-1 rounded">postal-mime</code> via npm di dalam Worker.
                    </p>
                  </div>

                  {/* Step 5 — Hubungkan Worker ke Email Routing */}
                  <div className="space-y-2">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">5</span>
                      Hubungkan Worker ke Email Routing
                    </p>
                    <p className="text-xs text-muted-foreground pl-7">
                      <strong>Email Routing</strong> → tab <strong>Routing Rules</strong> → <strong>Catch-all address</strong> → ubah action ke <strong>Send to a Worker</strong> → pilih worker Anda.
                    </p>
                  </div>

                  {/* Step 6 — Tambah domain */}
                  <div className="space-y-2">
                    <p className="text-sm font-semibold flex items-center gap-2">
                      <span className="h-5 w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">6</span>
                      Tambahkan Domain ke Daftar TempMail
                    </p>
                    <p className="text-xs text-muted-foreground pl-7">
                      Setelah semua selesai, tambahkan domain Anda (misal <code className="bg-muted px-1 rounded">namadomain.com</code>) ke daftar Domain Tersedia di bagian atas halaman ini, lalu klik Simpan. Email dengan alamat <code className="bg-muted px-1 rounded">user@namadomain.com</code> akan langsung masuk ke inbox secara real-time.
                    </p>
                  </div>

                  <Separator />

                  <div className="flex items-start gap-2 p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                    <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground">
                      <strong>Endpoint webhook:</strong> <code className="bg-muted px-1 rounded">POST /api/webhook/inbound-email</code> — 
                      menerima JSON <code className="bg-muted px-1 rounded">{`{to, from, subject, textBody, htmlBody}`}</code> dengan header <code className="bg-muted px-1 rounded">X-Webhook-Secret</code>. 
                      Email otomatis masuk ke inbox dan memicu webhook notifikasi jika ada.
                    </p>
                  </div>
                </CardContent>
              </Card>
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
                <p className="text-sm text-muted-foreground mt-1">Ringkasan data penggunaan sistem secara keseluruhan.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {[
                  { label: "Total Pengguna Terdaftar", value: stats?.totalUsers ?? 0, icon: Users, color: "bg-violet-100 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300" },
                  { label: "Total Email Dibuat", value: stats?.totalEmails ?? 0, icon: Mail, color: "bg-primary/10 text-primary" },
                  { label: "Total Pesan Diterima", value: stats?.totalMessages ?? 0, icon: Inbox, color: "bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-300" },
                  { label: "Rata-rata Pesan/Email", value: stats?.totalEmails ? (stats.totalMessages / stats.totalEmails).toFixed(1) : "0", icon: BarChart2, color: "bg-orange-100 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300" },
                ].map((s) => (
                  <Card key={s.label} className={`border-0 ${s.color}`}>
                    <CardContent className="p-5 flex items-center gap-4">
                      <s.icon className="h-10 w-10 opacity-70 shrink-0" />
                      <div>
                        {loading ? <Skeleton className="h-9 w-20 mb-1" /> : <div className="text-3xl font-bold">{s.value}</div>}
                        <div className="text-xs font-medium opacity-70">{s.label}</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Informasi Sistem</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: "Nama Situs", value: settings?.site_name ?? "-" },
                    { label: "Domain Tersedia", value: getDomains().map(d => `@${d}`).join(", ") || "-" },
                    { label: "Default TTL", value: `${settings?.default_ttl_minutes ?? "10"} menit` },
                    { label: "Max Inbox", value: `${settings?.max_inboxes ?? "5"} per user` },
                    { label: "Registrasi", value: settings?.allow_registration === "true" ? "Dibuka" : "Ditutup" },
                    { label: "Mode Pemeliharaan", value: settings?.maintenance_mode === "true" ? "Aktif" : "Nonaktif" },
                  ].map((r) => (
                    <div key={r.label} className="flex justify-between gap-4 text-sm border-b border-border/50 pb-2 last:border-0">
                      <span className="text-muted-foreground shrink-0">{r.label}</span>
                      <span className="font-medium text-right min-w-0 truncate">{r.value}</span>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </>
          )}

        </main>
      </div>
    </div>
  );
}
