import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeft, Mail, Users, Inbox, Settings, Globe,
  Trash2, ShieldCheck, ShieldX, RefreshCw, Save, PlusCircle, X,
  BarChart2, ToggleLeft, ToggleRight
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface AdminStats {
  totalUsers: number;
  totalEmails: number;
  totalMessages: number;
}

interface AdminUser {
  id: number;
  email: string;
  role: string;
  createdAt: string;
}

interface SiteSettings {
  site_name: string;
  default_ttl_minutes: string;
  max_inboxes: string;
  available_domains: string;
  allow_registration: string;
  maintenance_mode: string;
  max_message_size_kb: string;
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

export default function AdminPage() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [settings, setSettings] = useState<SiteSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [editSettings, setEditSettings] = useState<Partial<SiteSettings>>({});
  const [newDomain, setNewDomain] = useState("");

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
      setStats(s);
      setUsers(u);
      setSettings(cfg);
      setEditSettings(cfg);
    } catch (err: unknown) {
      toast({ title: "Gagal memuat data admin", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await adminApi("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify(editSettings),
      });
      setSettings(editSettings as SiteSettings);
      toast({ title: "Pengaturan berhasil disimpan" });
    } catch (err: unknown) {
      toast({ title: "Gagal menyimpan", description: err instanceof Error ? err.message : "", variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const handleRoleChange = async (id: number, newRole: string) => {
    try {
      await adminApi(`/api/admin/users/${id}/role`, {
        method: "PATCH",
        body: JSON.stringify({ role: newRole }),
      });
      setUsers((prev) => prev.map((u) => u.id === id ? { ...u, role: newRole } : u));
      toast({ title: `Role diubah ke ${newRole}` });
    } catch (err: unknown) {
      toast({ title: "Gagal mengubah role", description: err instanceof Error ? err.message : "", variant: "destructive" });
    }
  };

  const handleDeleteUser = async (id: number) => {
    try {
      await adminApi(`/api/admin/users/${id}`, { method: "DELETE" });
      setUsers((prev) => prev.filter((u) => u.id !== id));
      toast({ title: "Pengguna dihapus" });
    } catch (err: unknown) {
      toast({ title: "Gagal menghapus", description: err instanceof Error ? err.message : "", variant: "destructive" });
    }
  };

  const getDomains = (): string[] => {
    try { return JSON.parse(editSettings.available_domains ?? "[]"); }
    catch { return []; }
  };

  const addDomain = () => {
    const d = newDomain.trim().toLowerCase();
    if (!d || !d.includes(".")) {
      toast({ title: "Domain tidak valid", variant: "destructive" });
      return;
    }
    const current = getDomains();
    if (current.includes(d)) {
      toast({ title: "Domain sudah ada", variant: "destructive" });
      return;
    }
    setEditSettings((prev) => ({ ...prev, available_domains: JSON.stringify([...current, d]) }));
    setNewDomain("");
  };

  const removeDomain = (d: string) => {
    const current = getDomains().filter((x) => x !== d);
    setEditSettings((prev) => ({ ...prev, available_domains: JSON.stringify(current) }));
  };

  const toggleBool = (key: keyof SiteSettings) => {
    const current = editSettings[key] === "true";
    setEditSettings((prev) => ({ ...prev, [key]: current ? "false" : "true" }));
  };

  if (!user || user.role !== "admin") return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto flex h-14 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2 font-bold text-lg">
              <div className="bg-primary/10 p-1.5 rounded-md text-primary">
                <ShieldCheck className="h-5 w-5" />
              </div>
              Panel Admin
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={fetchAll}>
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={logout}>
              Keluar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-6 space-y-6">
        {/* Overview Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Users, label: "Total Pengguna", value: stats?.totalUsers ?? 0, color: "text-violet-500" },
            { icon: Mail, label: "Total Email", value: stats?.totalEmails ?? 0, color: "text-primary" },
            { icon: Inbox, label: "Total Pesan", value: stats?.totalMessages ?? 0, color: "text-green-500" },
          ].map((s) => (
            <Card key={s.label} className="border-border/50">
              <CardContent className="p-4 flex flex-col items-center text-center gap-1">
                <s.icon className={`h-6 w-6 ${s.color} mb-1`} />
                {loading ? <Skeleton className="h-8 w-16" /> : <span className={`text-3xl font-bold ${s.color}`}>{s.value}</span>}
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="settings">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="settings" className="gap-1.5 flex-1 sm:flex-none">
              <Settings className="h-3.5 w-3.5" />
              Pengaturan
            </TabsTrigger>
            <TabsTrigger value="domains" className="gap-1.5 flex-1 sm:flex-none">
              <Globe className="h-3.5 w-3.5" />
              Domain
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-1.5 flex-1 sm:flex-none">
              <Users className="h-3.5 w-3.5" />
              Pengguna
            </TabsTrigger>
            <TabsTrigger value="stats" className="gap-1.5 flex-1 sm:flex-none">
              <BarChart2 className="h-3.5 w-3.5" />
              Statistik
            </TabsTrigger>
          </TabsList>

          {/* Settings Tab */}
          <TabsContent value="settings" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pengaturan Situs</CardTitle>
                <CardDescription>Konfigurasi umum aplikasi TempMail.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {loading ? (
                  <div className="space-y-4">{[1,2,3,4].map(i => <Skeleton key={i} className="h-10 w-full" />)}</div>
                ) : (
                  <>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label>Nama Situs</Label>
                        <Input
                          value={editSettings.site_name ?? ""}
                          onChange={(e) => setEditSettings((p) => ({ ...p, site_name: e.target.value }))}
                          placeholder="TempMail"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Default TTL (menit)</Label>
                        <Input
                          type="number"
                          value={editSettings.default_ttl_minutes ?? "10"}
                          onChange={(e) => setEditSettings((p) => ({ ...p, default_ttl_minutes: e.target.value }))}
                          min={1}
                          max={1440}
                        />
                        <p className="text-xs text-muted-foreground">Masa aktif email baru yang di-generate (default: 10 menit).</p>
                      </div>
                      <div className="space-y-1.5">
                        <Label>Max Inbox per User</Label>
                        <Input
                          type="number"
                          value={editSettings.max_inboxes ?? "5"}
                          onChange={(e) => setEditSettings((p) => ({ ...p, max_inboxes: e.target.value }))}
                          min={1}
                          max={20}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Max Ukuran Pesan (KB)</Label>
                        <Input
                          type="number"
                          value={editSettings.max_message_size_kb ?? "1024"}
                          onChange={(e) => setEditSettings((p) => ({ ...p, max_message_size_kb: e.target.value }))}
                          min={100}
                        />
                      </div>
                    </div>

                    <div className="border border-border rounded-lg divide-y divide-border">
                      <div className="flex items-center justify-between p-4">
                        <div>
                          <p className="text-sm font-medium">Izinkan Registrasi</p>
                          <p className="text-xs text-muted-foreground">Pengguna baru bisa mendaftar akun.</p>
                        </div>
                        <Button variant="ghost" size="sm" className="gap-2" onClick={() => toggleBool("allow_registration")}>
                          {editSettings.allow_registration === "true"
                            ? <><ToggleRight className="h-5 w-5 text-green-500" /><span className="text-green-600 text-xs">Aktif</span></>
                            : <><ToggleLeft className="h-5 w-5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Nonaktif</span></>
                          }
                        </Button>
                      </div>
                      <div className="flex items-center justify-between p-4">
                        <div>
                          <p className="text-sm font-medium">Mode Pemeliharaan</p>
                          <p className="text-xs text-muted-foreground">Situs menampilkan halaman maintenance untuk pengguna biasa.</p>
                        </div>
                        <Button variant="ghost" size="sm" className="gap-2" onClick={() => toggleBool("maintenance_mode")}>
                          {editSettings.maintenance_mode === "true"
                            ? <><ToggleRight className="h-5 w-5 text-orange-500" /><span className="text-orange-600 text-xs">Aktif</span></>
                            : <><ToggleLeft className="h-5 w-5 text-muted-foreground" /><span className="text-xs text-muted-foreground">Nonaktif</span></>
                          }
                        </Button>
                      </div>
                    </div>

                    <Button onClick={handleSaveSettings} disabled={savingSettings} className="gap-2">
                      <Save className="h-4 w-4" />
                      {savingSettings ? "Menyimpan..." : "Simpan Pengaturan"}
                    </Button>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Domains Tab */}
          <TabsContent value="domains" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Manajemen Domain</CardTitle>
                <CardDescription>Tambah atau hapus domain yang tersedia untuk generate email.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="domain-baru.com"
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

                <div className="border border-border rounded-lg divide-y divide-border overflow-hidden">
                  {getDomains().length === 0 ? (
                    <div className="p-6 text-center text-muted-foreground text-sm">Belum ada domain.</div>
                  ) : getDomains().map((d) => (
                    <div key={d} className="flex items-center justify-between p-3 hover:bg-muted/20">
                      <div className="flex items-center gap-2">
                        <Globe className="h-4 w-4 text-primary" />
                        <span className="font-mono text-sm">@{d}</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => removeDomain(d)}
                        disabled={getDomains().length <= 1}
                        title="Minimal 1 domain harus ada"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                <Button onClick={handleSaveSettings} disabled={savingSettings} className="gap-2">
                  <Save className="h-4 w-4" />
                  {savingSettings ? "Menyimpan..." : "Simpan Perubahan Domain"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Manajemen Pengguna</CardTitle>
                <CardDescription>{users.length} pengguna terdaftar.</CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
                ) : users.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground text-sm">Belum ada pengguna.</div>
                ) : (
                  <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                    {users.map((u) => (
                      <div key={u.id} className="flex items-center justify-between p-3 hover:bg-muted/20">
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium truncate">{u.email}</span>
                            <Badge
                              variant={u.role === "admin" ? "default" : "secondary"}
                              className="text-[10px] h-4 px-1.5 shrink-0"
                            >
                              {u.role === "admin" ? "Admin" : "User"}
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            Bergabung {format(new Date(u.createdAt), "d MMM yyyy")}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {u.id !== user.id && (
                            <>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title={u.role === "admin" ? "Turunkan ke User" : "Jadikan Admin"}
                                onClick={() => handleRoleChange(u.id, u.role === "admin" ? "user" : "admin")}
                              >
                                {u.role === "admin"
                                  ? <ShieldX className="h-3.5 w-3.5 text-muted-foreground" />
                                  : <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                                }
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
                                      Akun <strong>{u.email}</strong> akan dihapus permanen. Tindakan ini tidak bisa dibatalkan.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Batal</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteUser(u.id)}
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                      Hapus
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            </>
                          )}
                          {u.id === user.id && (
                            <Badge variant="outline" className="text-[10px] h-5">Anda</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Stats Tab */}
          <TabsContent value="stats" className="mt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ringkasan Statistik</CardTitle>
                <CardDescription>Data penggunaan keseluruhan sistem TempMail.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loading ? (
                  <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
                ) : (
                  <div className="grid sm:grid-cols-2 gap-4">
                    {[
                      { label: "Total Pengguna Terdaftar", value: stats?.totalUsers ?? 0, icon: Users, color: "bg-violet-50 dark:bg-violet-950/30 text-violet-600" },
                      { label: "Total Email Pernah Dibuat", value: stats?.totalEmails ?? 0, icon: Mail, color: "bg-primary/10 text-primary" },
                      { label: "Total Pesan Diterima", value: stats?.totalMessages ?? 0, icon: Inbox, color: "bg-green-50 dark:bg-green-950/30 text-green-600" },
                      { label: "Rata-rata Pesan per Email", value: stats?.totalEmails ? (stats.totalMessages / stats.totalEmails).toFixed(1) : "0", icon: BarChart2, color: "bg-orange-50 dark:bg-orange-950/30 text-orange-600" },
                    ].map((s) => (
                      <div key={s.label} className={`${s.color} rounded-xl p-4 flex items-center gap-4`}>
                        <s.icon className="h-8 w-8 opacity-80" />
                        <div>
                          <div className="text-2xl font-bold">{s.value}</div>
                          <div className="text-xs font-medium opacity-70">{s.label}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
