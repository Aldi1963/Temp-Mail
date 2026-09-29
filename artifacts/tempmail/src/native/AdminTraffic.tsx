// Grafik trafik pesan admin: garis SVG murni (tanpa library), rentang 7/14/30 hari.
import { useCallback, useEffect, useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { nativeFetch } from "./api";
import { ErrorBox, LoadingBlock } from "./AdminShared";

interface TrafficPoint {
  date: string;
  count: number;
}

const RANGES = [7, 14, 30] as const;
const fmtNum = (n: number) => new Intl.NumberFormat("id-ID").format(n);

function normalize(raw: unknown): TrafficPoint[] {
  const arr = Array.isArray(raw) ? raw : ((raw as any)?.items ?? (raw as any)?.traffic ?? []);
  if (!Array.isArray(arr)) return [];
  return arr
    .map((p: any) => ({ date: String(p?.date ?? ""), count: Number(p?.count ?? 0) || 0 }))
    .filter((p) => p.date);
}

const W = 340;
const H = 140;
const PAD = { l: 30, r: 8, t: 10, b: 22 };

function dateShort(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });
}

export function AdminTraffic() {
  const [days, setDays] = useState<(typeof RANGES)[number]>(30);
  const [points, setPoints] = useState<TrafficPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await nativeFetch(`/api/admin/stats/traffic?days=${days}`);
      setPoints(normalize(res));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat grafik trafik.");
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => {
    void load();
  }, [load]);

  const chart = useMemo(() => {
    const n = points.length;
    if (n === 0) return null;
    const max = Math.max(1, ...points.map((p) => p.count));
    const iw = W - PAD.l - PAD.r;
    const ih = H - PAD.t - PAD.b;
    const x = (i: number) => PAD.l + (n === 1 ? iw / 2 : (i / (n - 1)) * iw);
    const y = (v: number) => PAD.t + (1 - v / max) * ih;
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(p.count).toFixed(1)}`).join(" ");
    const area = `${line} L${x(n - 1).toFixed(1)},${(PAD.t + ih).toFixed(1)} L${x(0).toFixed(1)},${(PAD.t + ih).toFixed(1)} Z`;
    const labelIdx = [0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1].filter(
      (v, i, a) => a.indexOf(v) === i
    );
    return { line, area, x, y, max, labelIdx };
  }, [points]);

  const total = points.reduce((a, p) => a + p.count, 0);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-3.5">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[13.5px] font-extrabold inline-flex items-center gap-1.5">
          <TrendingUp className="h-4 w-4 text-primary" />
          Trafik pesan
        </p>
        <div className="flex rounded-xl bg-muted p-1 gap-1">
          {RANGES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setDays(r)}
              className={cn(
                "rounded-lg px-2.5 py-1 text-[11.5px] font-bold",
                days === r ? "bg-background shadow text-foreground" : "text-muted-foreground"
              )}
            >
              {r} hari
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <LoadingBlock label="Memuat grafik..." />
      ) : error ? (
        <ErrorBox message={error} onRetry={() => void load()} />
      ) : !chart ? (
        <p className="text-center text-[12.5px] text-muted-foreground py-8">
          Belum ada data trafik untuk rentang ini.
        </p>
      ) : (
        <>
          <p className="text-[11.5px] text-muted-foreground mb-1">
            Total <b className="text-foreground">{fmtNum(total)}</b> pesan dalam {days} hari
          </p>
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label="Grafik trafik pesan">
            <defs>
              <linearGradient id="tm-traffic-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="currentColor" stopOpacity="0.35" className="text-primary" />
                <stop offset="100%" stopColor="currentColor" stopOpacity="0" className="text-primary" />
              </linearGradient>
            </defs>
            {/* garis grid horizontal */}
            {[0.25, 0.5, 0.75, 1].map((f) => (
              <line
                key={f}
                x1={PAD.l}
                x2={W - PAD.r}
                y1={PAD.t + (1 - f) * (H - PAD.t - PAD.b)}
                y2={PAD.t + (1 - f) * (H - PAD.t - PAD.b)}
                stroke="currentColor"
                strokeOpacity="0.12"
                strokeDasharray="3 3"
              />
            ))}
            <path d={chart.area} fill="url(#tm-traffic-fill)" />
            <path
              d={chart.line}
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-primary"
            />
            {/* label sumbu Y (maks) */}
            <text x={2} y={chart.y(chart.max) + 3.5} fontSize="9" fill="currentColor" opacity="0.55">
              {fmtNum(chart.max)}
            </text>
            {/* label tanggal */}
            {chart.labelIdx.map((i) => (
              <text
                key={i}
                x={chart.x(i)}
                y={H - 6}
                fontSize="9"
                textAnchor="middle"
                fill="currentColor"
                opacity="0.55"
              >
                {dateShort(points[i].date)}
              </text>
            ))}
            {/* titik data */}
            {points.map((p, i) => (
              <circle
                key={p.date}
                cx={chart.x(i)}
                cy={chart.y(p.count)}
                r={2.5}
                fill="currentColor"
                className="text-primary"
              >
                <title>{`${dateShort(p.date)}: ${fmtNum(p.count)} pesan`}</title>
              </circle>
            ))}
          </svg>
        </>
      )}
    </div>
  );
}
