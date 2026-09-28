// Layar utama admin: sub-navigasi inline + dashboard statistik.
import { useCallback, useEffect, useState } from "react";
import {
  Globe,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessagesSquare,
  Server as ServerIcon,
  Users,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { nativeFetch } from "./api";
import { ErrorBox, LoadingBlock } from "./AdminShared";
// Komponen seksi (Pengguna, Domain, Broadcast, Server, Maintenance)
// ditambahkan pada commit bagian 2 & 3.

const SECTIONS = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "users", label: "Pengguna", icon: Users },
  { id: "domains", label: "Domain", icon: Globe },
  { id: "broadcast", label: "Broadcast", icon: Megaphone },
  { id: "server", label: "Server", icon: ServerIcon },
  { id: "maintenance", label: "Maintenance", icon: Wrench },
] as const;

type AdminSection = (typeof SECTIONS)[number]["id"];

interface Stats {
  totalUsers: number;
  totalEmails: number;
  totalMessages: number;
}

interface DayPoint {
  date: string;
  count: number;
}

interface StatsDetail {
  activeEmails: number;
  emailsToday: number;
  newUsersThisWeek: number;
  messagesToday: number;
  emailsPerDay: DayPoint[];
  messagesPerDay: DayPoint[];
}

const HARI = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
const fmtNum = (n: number) => new Intl.NumberFormat("id-ID").format(n);

function dayLabel(isoDate: string): string {
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return `${HARI[d.getDay()]} ${d.getDate()}`;
}

function StatCard({
  icon: Icon,
  label,
  value,
  tint,
}: {
  icon: typeof Users;
  label: string;
  value: number;
  tint: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3.5">
      <span className={cn("w-9 h-9 rounded-xl flex items-center justify-center", tint)}>
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="mt-2.5 text-[22px] font-extrabold tracking-tight leading-none">
        {fmtNum(value)}
      </div>
      <div className="mt-1 text-[11.5px] font-semibold text-muted-foreground">{label}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex-1 text-center py-1">
      <div className="text-[16px] font-extrabold">{fmtNum(value)}</div>
      <div className="text-[10.5px] font-semibold text-muted-foreground mt-0.5 leading-tight">
        {label}
      </div>
    </div>
  );
}

function AdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [detail, setDetail] = useState<StatsDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [chartMode, setChartMode] = useState<"pesan" | "alamat">("pesan");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [s, d] = await Promise.all([
        nativeFetch<Stats>("/api/admin/stats"),
        nativeFetch<StatsDetail>("/api/admin/stats/detail"),
      ]);
      setStats(s);
      setDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat statistik.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <LoadingBlock label="Memuat statistik..." />;
  if (error || !stats || !detail)
    return (
      <div className="px-4 pt-3">
        <ErrorBox message={error || "Data tidak tersedia."} onRetry={() => void load()} />
      </div>
    );

  const days = chartMode === "pesan" ? detail.messagesPerDay : detail.emailsPerDay;
  const max = Math.max(1, ...days.map((d) => d.count));

  return (
    <div className="px-4 pt-3 pb-6 space-y-3">
      <div className="grid grid-cols-2 gap-2.5">
        <StatCard icon={Users} label="Total Pengguna" value={stats.totalUsers} tint="bg-sky-500/15 text-sky-500" />
        <StatCard icon={Mail} label="Total Alamat" value={stats.totalEmails} tint="bg-violet-500/15 text-violet-500" />
        <StatCard icon={MessagesSquare} label="Total Pesan" value={stats.totalMessages} tint="bg-emerald-500/15 text-emerald-500" />
        <StatCard icon={LayoutDashboard} label="Pesan Hari Ini" value={detail.messagesToday} tint="bg-amber-500/15 text-amber-500" />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card px-3.5 py-3 flex divide-x divide-border/60">
        <MiniStat label="Alamat aktif" value={detail.activeEmails} />
        <MiniStat label="Alamat hari ini" value={detail.emailsToday} />
        <MiniStat label="User baru (7 hari)" value={detail.newUsersThisWeek} />
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-3.5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[13.5px] font-extrabold">Aktivitas 7 hari terakhir</p>
          <div className="flex rounded-xl bg-muted p-1 gap-1">
            {(["pesan", "alamat"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setChartMode(m)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[12px] font-bold capitalize",
                  chartMode === m ? "bg-background shadow text-foreground" : "text-muted-foreground"
                )}
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-stretch gap-1.5 h-44">
          {days.map((d) => {
            const pct = Math.max(3, (d.count / max) * 100);
            return (
              <div key={d.date} className="flex-1 flex flex-col min-w-0">
                <div className="flex-1 flex items-end">
                  <div
                    className="w-full rounded-t-lg bg-primary/85"
                    style={{ height: `${pct}%` }}
                    title={`${fmtNum(d.count)} ${chartMode}`}
                  />
                </div>
                <div className="pt-1.5 text-center">
                  <div className="text-[11px] font-extrabold leading-none">
                    {d.count >= 1000 ? `${(d.count / 1000).toFixed(1)}rb` : d.count}
                  </div>
                  <div className="text-[9.5px] text-muted-foreground mt-0.5 leading-none">
                    {dayLabel(d.date)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Placeholder sementara untuk seksi yang dibangun di commit berikutnya.
function ComingSoon({ label }: { label: string }) {
  return (
    <div className="px-4 pt-10 pb-6 text-center">
      <p className="text-[14px] font-extrabold">Bagian {label}</p>
      <p className="text-[12px] text-muted-foreground mt-1">
        Sedang dalam pengembangan.
      </p>
    </div>
  );
}

export function AdminTab() {
  const [section, setSection] = useState<AdminSection>("dashboard");

  const pick = (id: AdminSection) => {
    setSection(id);
    window.scrollTo({ top: 0 });
  };

  return (
    <div>
      <div
        className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/60"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center h-14 px-4">
          <span className="text-[17px] font-extrabold tracking-tight">Admin</span>
        </div>
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SECTIONS.map((s) => {
            const active = section === s.id;
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => pick(s.id)}
                className={cn(
                  "shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12.5px] font-bold whitespace-nowrap active:scale-[0.97]",
                  active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {section === "dashboard" && <AdminDashboard />}
      {section === "users" && <ComingSoon label="Pengguna" />}
      {section === "domains" && <ComingSoon label="Domain" />}
      {section === "broadcast" && <ComingSoon label="Broadcast" />}
      {section === "server" && <ComingSoon label="Server" />}
      {section === "maintenance" && <ComingSoon label="Maintenance" />}
    </div>
  );
}
