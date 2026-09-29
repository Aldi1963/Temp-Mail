import { useEffect, useState } from "react";
import { TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { API_BASE_URL as BASE } from "../lib/api-base";

interface TrafficPoint {
  date: string;
  count: number;
}

const DAYS_OPTIONS = [7, 14, 30] as const;

async function fetchTraffic(days: number): Promise<TrafficPoint[]> {
  const res = await fetch(`${BASE}/api/admin/stats/traffic?days=${days}`, {
    credentials: "include",
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
  const raw: unknown[] = Array.isArray(data)
    ? data
    : Array.isArray((data as { items?: unknown[] })?.items)
      ? (data as { items: unknown[] }).items
      : [];
  return (raw as Array<Record<string, unknown>>).map((d) => ({
    date: String(d.date ?? ""),
    count: Number(d.count ?? 0),
  }));
}

function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.floor(Math.log10(v));
  const base = 10 ** exp;
  const n = v / base;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * base;
}

type Pt = readonly [number, number];

function smoothPath(pts: readonly Pt[]): string {
  if (pts.length === 0) return "";
  const f = (n: number) => n.toFixed(1);
  if (pts.length === 1) return `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  let d = `M ${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[Math.min(pts.length - 1, i + 2)];
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C ${f(c1x)} ${f(c1y)}, ${f(c2x)} ${f(c2y)}, ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

function fmtDay(dateStr: string): string {
  const d = new Date(dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

function fmtFull(dateStr: string): string {
  const d = new Date(dateStr.length === 10 ? `${dateStr}T00:00:00` : dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
}

function TrafficLineChart({ data }: { data: TrafficPoint[] }) {
  const W = 640;
  const H = 230;
  const PL = 40;
  const PR = 12;
  const PT = 14;
  const PB = 30;
  const iw = W - PL - PR;
  const ih = H - PT - PB;

  const ceil = niceCeil(Math.max(0, ...data.map((d) => d.count)));
  const x = (i: number) => PL + (data.length <= 1 ? iw / 2 : (i / (data.length - 1)) * iw);
  const y = (v: number) => PT + ih - (v / ceil) * ih;

  const pts: Pt[] = data.map((d, i) => [x(i), y(d.count)] as const);
  const line = smoothPath(pts);
  const area = data.length > 1
    ? `${line} L ${x(data.length - 1).toFixed(1)} ${(PT + ih).toFixed(1)} L ${x(0).toFixed(1)} ${(PT + ih).toFixed(1)} Z`
    : "";

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(ceil * f));
  const labelIdx = new Set<number>();
  const maxLabels = 6;
  const step = Math.max(1, Math.floor(data.length / maxLabels));
  for (let i = 0; i < data.length; i += step) labelIdx.add(i);
  labelIdx.add(data.length - 1);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto"
      role="img"
      aria-label="Grafik trafik email masuk"
    >
      <defs>
        <linearGradient id="trafficArea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
        </linearGradient>
      </defs>

      {/* grid horizontal */}
      {ticks.map((t) => (
        <g key={t}>
          <line
            x1={PL}
            x2={W - PR}
            y1={y(t)}
            y2={y(t)}
            stroke="hsl(var(--border))"
            strokeDasharray="3 5"
            strokeWidth={1}
            opacity={0.7}
          />
          <text
            x={PL - 8}
            y={y(t) + 4}
            textAnchor="end"
            fontSize={11}
            fill="hsl(var(--muted-foreground))"
          >
            {t}
          </text>
        </g>
      ))}

      {/* area + garis */}
      {area && <path d={area} fill="url(#trafficArea)" />}
      {line && (
        <path
          d={line}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      )}

      {/* titik data */}
      {pts.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={3.5} fill="hsl(var(--background))" stroke="hsl(var(--primary))" strokeWidth={2}>
          <title>{`${fmtFull(data[i].date)}: ${data[i].count} email`}</title>
        </circle>
      ))}

      {/* label sumbu x */}
      {data.map((d, i) =>
        labelIdx.has(i) ? (
          <text
            key={i}
            x={x(i)}
            y={H - 8}
            textAnchor="middle"
            fontSize={11}
            fill="hsl(var(--muted-foreground))"
          >
            {fmtDay(d.date)}
          </text>
        ) : null
      )}
    </svg>
  );
}

export default function AdminTrafficChart() {
  const [days, setDays] = useState<number>(30);
  const [data, setData] = useState<TrafficPoint[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setData(null);
    setError(null);
    fetchTraffic(days)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Gagal memuat data");
      });
    return () => {
      cancelled = true;
    };
  }, [days]);

  const total = (data ?? []).reduce((s, d) => s + d.count, 0);
  const avg = data && data.length > 0 ? (total / data.length).toFixed(1) : "0";

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-1">
        <h3 className="text-sm font-bold flex items-center gap-2 text-foreground">
          <TrendingUp className="h-4 w-4 text-primary" />
          Trafik Email Masuk
        </h3>
        <div className="flex rounded-lg border p-0.5 gap-0.5" role="group" aria-label="Rentang hari">
          {DAYS_OPTIONS.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDays(d)}
              className={`px-3 h-7 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                days === d
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {d} hari
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-border/60">
        {data === null && !error ? (
          <Skeleton className="h-48 w-full" />
        ) : error ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">Grafik belum bisa dimuat: {error}</p>
            <p className="text-xs text-muted-foreground mt-1">Endpoint /api/admin/stats/traffic mungkin belum tersedia.</p>
          </div>
        ) : data && data.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">Belum ada data trafik pada rentang ini.</p>
          </div>
        ) : (
          data && (
            <>
              <TrafficLineChart data={data} />
              <div className="flex items-center gap-4 pt-2 pb-1 text-xs text-muted-foreground">
                <span>
                  Total: <strong className="text-foreground">{total.toLocaleString("id-ID")}</strong> email
                </span>
                <span>
                  Rata-rata: <strong className="text-foreground">{avg}</strong> email/hari
                </span>
              </div>
            </>
          )
        )}
      </div>
    </div>
  );
}
