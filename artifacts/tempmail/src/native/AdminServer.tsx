// Monitor server: CPU, RAM, disk, uptime, ukuran DB. Auto-refresh 30 detik.
import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  Cpu,
  Database,
  HardDrive,
  MemoryStick,
  RefreshCw,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { nativeFetch } from "./api";
import { ErrorBox, LoadingBlock } from "./AdminShared";

interface ServerInfo {
  cpu: { load1m: number; load5m: number; load15m: number; cores: number } | null;
  mem: { totalMB: number; freeMB: number; usedMB: number; usedPercent: number } | null;
  disk: { totalGB: number; usedGB: number; availGB: number; usedPercent: number } | null;
  uptime: { seconds: number; human: string } | null;
  db: { sizeBytes: number; sizeMB: number } | null;
  time: string;
}

const fmtMB = (n: number) => `${new Intl.NumberFormat("id-ID").format(n)} MB`;
const fmtGB = (n: number) =>
  `${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(n)} GB`;

function MetricCard({
  icon: Icon,
  title,
  children,
}: {
  icon: typeof Cpu;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3.5">
      <div className="flex items-center gap-2 mb-2.5">
        <span className="w-8 h-8 rounded-xl bg-muted flex items-center justify-center shrink-0">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-[13.5px] font-extrabold">{title}</span>
      </div>
      {children}
    </div>
  );
}

function Bar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color =
    clamped >= 90 ? "bg-destructive" : clamped >= 70 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="h-2 rounded-full bg-muted overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all", color)}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

const unavailable = (
  <p className="text-[12px] text-muted-foreground">Tidak tersedia.</p>
);

export function AdminServer() {
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else {
      setLoading(true);
      setError("");
    }
    try {
      const data = await nativeFetch<ServerInfo>("/api/admin/server");
      setInfo(data);
      setUpdatedAt(new Date());
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "Gagal memuat info server.");
    } finally {
      if (silent) setRefreshing(false);
      else setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => {
      void load(true);
    }, 30000);
    return () => window.clearInterval(t);
  }, [load]);

  return (
    <div className="px-4 pt-3 pb-6 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[13.5px] font-extrabold">Monitor server</p>
          {updatedAt && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Diperbarui{" "}
              {updatedAt.toLocaleTimeString("id-ID", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              })}{" "}
              · otomatis tiap 30 detik
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load(true)}
          aria-label="Muat ulang"
          className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center active:scale-[0.95]"
        >
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
        </button>
      </div>

      {loading ? (
        <LoadingBlock label="Memuat info server..." />
      ) : error || !info ? (
        <ErrorBox message={error || "Data tidak tersedia."} onRetry={() => void load()} />
      ) : (
        <>
          <MetricCard icon={Cpu} title="CPU">
            {info.cpu ? (
              <div className="space-y-2">
                <div className="flex gap-2">
                  {[
                    { label: "1 mnt", v: info.cpu.load1m },
                    { label: "5 mnt", v: info.cpu.load5m },
                    { label: "15 mnt", v: info.cpu.load15m },
                  ].map((x) => (
                    <div key={x.label} className="flex-1 rounded-xl bg-muted/60 px-2 py-1.5 text-center">
                      <div className="text-[14px] font-extrabold">{x.v.toFixed(2)}</div>
                      <div className="text-[10px] text-muted-foreground">{x.label}</div>
                    </div>
                  ))}
                </div>
                <p className="text-[11.5px] text-muted-foreground">
                  {info.cpu.cores} core
                </p>
              </div>
            ) : (
              unavailable
            )}
          </MetricCard>

          <MetricCard icon={MemoryStick} title="RAM">
            {info.mem ? (
              <div className="space-y-2">
                <Bar pct={info.mem.usedPercent} />
                <p className="text-[12.5px] font-semibold">
                  {fmtMB(info.mem.usedMB)}{" "}
                  <span className="text-muted-foreground font-normal">
                    dari {fmtMB(info.mem.totalMB)} ({info.mem.usedPercent}%)
                  </span>
                </p>
              </div>
            ) : (
              unavailable
            )}
          </MetricCard>

          <MetricCard icon={HardDrive} title="Disk">
            {info.disk ? (
              <div className="space-y-2">
                <Bar pct={info.disk.usedPercent} />
                <p className="text-[12.5px] font-semibold">
                  {fmtGB(info.disk.usedGB)}{" "}
                  <span className="text-muted-foreground font-normal">
                    dari {fmtGB(info.disk.totalGB)} ({info.disk.usedPercent}%)
                  </span>
                </p>
              </div>
            ) : (
              unavailable
            )}
          </MetricCard>

          <div className="grid grid-cols-2 gap-2.5">
            <MetricCard icon={Timer} title="Uptime">
              {info.uptime ? (
                <p className="text-[13px] font-bold leading-snug">{info.uptime.human}</p>
              ) : (
                unavailable
              )}
            </MetricCard>
            <MetricCard icon={Database} title="Database">
              {info.db ? (
                <p className="text-[13px] font-bold leading-snug">
                  {new Intl.NumberFormat("id-ID", { maximumFractionDigits: 2 }).format(
                    info.db.sizeMB
                  )}{" "}
                  MB
                </p>
              ) : (
                unavailable
              )}
            </MetricCard>
          </div>
        </>
      )}
    </div>
  );
}
