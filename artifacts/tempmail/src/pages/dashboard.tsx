import { useEffect, useState } from "react";
import { Link } from "wouter";
import {
  Mail, Inbox, Clock, MailOpen, ArrowLeft, RefreshCw, User, ShieldCheck
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

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [emails, setEmails] = useState<UserEmail[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [emailsRes, statsRes] = await Promise.all([
        fetch("/api/user/emails", { credentials: "include" }),
        fetch("/api/user/stats", { credentials: "include" }),
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

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-5xl mx-auto flex h-14 items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-3">
            <Link href="/">
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-2 font-bold text-lg">
              <div className="bg-primary/10 p-1.5 rounded-md text-primary">
                <Mail className="h-5 w-5" />
              </div>
              TempMail
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{user?.email}</span>
              {user?.role === "admin" && (
                <Badge variant="default" className="text-[10px] h-5 gap-1">
                  <ShieldCheck className="h-3 w-3" />
                  Admin
                </Badge>
              )}
            </div>
            {user?.role === "admin" && (
              <Link href="/admin">
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Panel Admin
                </Button>
              </Link>
            )}
            <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={logout}>
              Keluar
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Dashboard Saya</h1>
          <p className="text-muted-foreground text-sm mt-1">Riwayat email sementara dan statistik penggunaan Anda.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { icon: Mail, label: "Total Email", value: stats?.totalEmails ?? 0, color: "text-primary" },
            { icon: Inbox, label: "Total Pesan", value: stats?.totalMessages ?? 0, color: "text-green-500" },
            { icon: Clock, label: "Email Aktif", value: stats?.activeEmails ?? 0, color: "text-orange-500" },
          ].map((s) => (
            <Card key={s.label} className="border-border/50">
              <CardContent className="p-4 flex flex-col items-center text-center gap-1">
                <s.icon className={`h-5 w-5 ${s.color} mb-1`} />
                {loading ? (
                  <Skeleton className="h-8 w-12" />
                ) : (
                  <span className={`text-2xl font-bold ${s.color}`}>{s.value}</span>
                )}
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </CardContent>
            </Card>
          ))}
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
                  <div key={e.email} className="flex items-center justify-between p-3 hover:bg-muted/30 transition-colors">
                    <div className="flex flex-col gap-0.5 min-w-0">
                      <span className="font-mono text-sm font-medium text-primary truncate">{e.email}</span>
                      <span className="text-xs text-muted-foreground">
                        Dibuat {format(new Date(e.createdAt), "d MMM yyyy, HH:mm")}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 shrink-0 ml-3">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Inbox className="h-3.5 w-3.5" />
                        {e.messageCount} pesan
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
  );
}
