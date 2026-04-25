import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "wouter";
import {
  Activity,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  ArrowLeft,
  Clock,
  Server,
  Database,
  Mail,
  Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/header";

type Sample = { t: number; ok: boolean; ms: number };
type CheckId = "api" | "branding" | "domains";
type CheckState = "operational" | "degraded" | "down" | "unknown";

interface CheckDef {
  id: CheckId;
  name: string;
  description: string;
  url: string;
  icon: typeof Server;
}

const CHECKS: CheckDef[] = [
  {
    id: "api",
    name: "API Server",
    description: "Inti server REST API",
    url: "/api/healthz",
    icon: Server,
  },
  {
    id: "branding",
    name: "Database",
    description: "Akses baca konfigurasi & user",
    url: "/api/site/branding",
    icon: Database,
  },
  {
    id: "domains",
    name: "Email Service",
    description: "Daftar domain email aktif",
    url: "/api/email/domains",
    icon: Mail,
  },
];

const POLL_INTERVAL_MS = 15_000;
const MAX_SAMPLES = 240; // ~1 jam @ 15s
const STORAGE_KEY = "tempmail_status_history_v1";
const TIMEOUT_MS = 8_000;
const DEGRADED_MS = 1_500;

function isValidSample(x: unknown): x is Sample {
  if (!x || typeof x !== "object") return false;
  const s = x as Record<string, unknown>;
  return (
    typeof s.t === "number" &&
    Number.isFinite(s.t) &&
    typeof s.ms === "number" &&
    Number.isFinite(s.ms) &&
    typeof s.ok === "boolean"
  );
}

function sanitizeSamples(arr: unknown): Sample[] {
  if (!Array.isArray(arr)) return [];
  const out: Sample[] = [];
  for (const item of arr) {
    if (isValidSample(item)) out.push(item);
  }
  return out.slice(-MAX_SAMPLES);
}

function loadHistory(): Record<CheckId, Sample[]> {
  if (typeof window === "undefined") {
    return { api: [], branding: [], domains: [] };
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { api: [], branding: [], domains: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return { api: [], branding: [], domains: [] };
    }
    return {
      api: sanitizeSamples((parsed as Record<string, unknown>).api),
      branding: sanitizeSamples((parsed as Record<string, unknown>).branding),
      domains: sanitizeSamples((parsed as Record<string, unknown>).domains),
    };
  } catch {
    return { api: [], branding: [], domains: [] };
  }
}

function saveHistory(h: Record<CheckId, Sample[]>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(h));
  } catch {
    // ignore quota errors
  }
}

async function pingEndpoint(url: string): Promise<Sample> {
  const t = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      cache: "no-store",
      credentials: "omit",
      signal: controller.signal,
      headers: { Accept: "application/json" },
    });
    const ms = Date.now() - t;
    return { t, ok: res.ok, ms };
  } catch {
    return { t, ok: false, ms: Date.now() - t };
  } finally {
    clearTimeout(timeout);
  }
}

function deriveState(samples: Sample[]): {
  state: CheckState;
  uptime: number | null;
  avgMs: number | null;
  latestMs: number | null;
  latestOk: boolean | null;
} {
  if (!samples.length) {
    return { state: "unknown", uptime: null, avgMs: null, latestMs: null, latestOk: null };
  }
  const latest = samples[samples.length - 1];
  const okCount = samples.filter((s) => s.ok).length;
  const uptime = (okCount / samples.length) * 100;
  const okSamples = samples.filter((s) => s.ok);
  const avgMs = okSamples.length
    ? Math.round(okSamples.reduce((a, b) => a + b.ms, 0) / okSamples.length)
    : null;

  let state: CheckState;
  if (!latest.ok) state = "down";
  else if (latest.ms > DEGRADED_MS) state = "degraded";
  else state = "operational";

  return {
    state,
    uptime,
    avgMs,
    latestMs: latest.ms,
    latestOk: latest.ok,
  };
}

function formatUptime(uptime: number | null): string {
  if (uptime === null) return "—";
  if (uptime >= 99.95) return "100%";
  return `${uptime.toFixed(2)}%`;
}

function formatLatency(ms: number | null): string {
  if (ms === null) return "—";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function relativeTime(ts: number | null, now: number): string {
  if (!ts) return "belum pernah";
  const diff = Math.max(0, now - ts);
  const sec = Math.floor(diff / 1000);
  if (sec < 5) return "baru saja";
  if (sec < 60) return `${sec} detik lalu`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} menit lalu`;
  const hr = Math.floor(min / 60);
  return `${hr} jam lalu`;
}

const STATE_META: Record<CheckState, { label: string; color: string; bg: string; ring: string; icon: typeof CheckCircle2 }> = {
  operational: {
    label: "Beroperasi",
    color: "text-green-600 dark:text-green-400",
    bg: "bg-green-500",
    ring: "ring-green-500/30",
    icon: CheckCircle2,
  },
  degraded: {
    label: "Lambat",
    color: "text-amber-600 dark:text-amber-400",
    bg: "bg-amber-500",
    ring: "ring-amber-500/30",
    icon: AlertTriangle,
  },
  down: {
    label: "Gangguan",
    color: "text-red-600 dark:text-red-400",
    bg: "bg-red-500",
    ring: "ring-red-500/30",
    icon: XCircle,
  },
  unknown: {
    label: "Memeriksa…",
    color: "text-muted-foreground",
    bg: "bg-muted-foreground/40",
    ring: "ring-muted-foreground/20",
    icon: Activity,
  },
};

function Sparkline({ samples }: { samples: Sample[] }) {
  // Render last 60 samples (15 min) as colored bars
  const visible = samples.slice(-60);
  const maxBars = 60;
  const padding = Array(Math.max(0, maxBars - visible.length)).fill(null);

  // Build a screen-reader summary so blind users get the same trend info
  const okCount = visible.filter((s) => s.ok).length;
  const failCount = visible.length - okCount;
  const okSamples = visible.filter((s) => s.ok);
  const avgMs = okSamples.length
    ? Math.round(okSamples.reduce((a, b) => a + b.ms, 0) / okSamples.length)
    : 0;
  const ariaLabel = visible.length
    ? `Tren 15 menit terakhir: ${visible.length} pengecekan, ${okCount} sukses, ${failCount} gagal, latensi rata-rata ${avgMs} milidetik.`
    : "Belum ada data riwayat.";

  return (
    <div
      className="flex items-end gap-px h-7"
      data-testid="sparkline"
      role="img"
      aria-label={ariaLabel}
    >
      {padding.map((_, i) => (
        <div
          key={`pad-${i}`}
          className="flex-1 h-1 bg-muted/40 rounded-sm self-end"
          aria-hidden="true"
        />
      ))}
      {visible.map((s, i) => {
        const heightPct = !s.ok
          ? 100
          : Math.min(100, Math.max(20, (s.ms / 800) * 100));
        const color = !s.ok
          ? "bg-red-500"
          : s.ms > DEGRADED_MS
          ? "bg-amber-500"
          : "bg-green-500";
        return (
          <div
            key={`s-${i}`}
            className={`flex-1 rounded-sm ${color} opacity-80 hover:opacity-100 transition-opacity`}
            style={{ height: `${heightPct}%` }}
            title={`${new Date(s.t).toLocaleTimeString("id-ID")} — ${
              s.ok ? `${s.ms}ms` : "gagal"
            }`}
          />
        );
      })}
    </div>
  );
}

export default function StatusPage() {
  const [history, setHistory] = useState<Record<CheckId, Sample[]>>(loadHistory);
  const [now, setNow] = useState(Date.now());
  const [isPolling, setIsPolling] = useState(false);
  const lastCheckRef = useRef<number>(0);
  // Single-flight guard: prevents auto-interval from running concurrently
  // with a user-triggered manual refresh (or another auto tick that hasn't
  // completed yet on a slow network).
  const inFlightRef = useRef<boolean>(false);

  // 1s ticker for relative time labels & countdown
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  const runChecks = async () => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setIsPolling(true);
    try {
      const results = await Promise.all(
        CHECKS.map(async (c) => ({ id: c.id, sample: await pingEndpoint(c.url) }))
      );
      setHistory((prev) => {
        const next: Record<CheckId, Sample[]> = { ...prev };
        for (const r of results) {
          next[r.id] = [...(next[r.id] || []), r.sample].slice(-MAX_SAMPLES);
        }
        saveHistory(next);
        return next;
      });
      lastCheckRef.current = Date.now();
    } finally {
      inFlightRef.current = false;
      setIsPolling(false);
    }
  };

  useEffect(() => {
    runChecks();
    const interval = setInterval(runChecks, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const checks = useMemo(
    () =>
      CHECKS.map((c) => ({
        def: c,
        ...deriveState(history[c.id] || []),
      })),
    [history]
  );

  const overall: CheckState = useMemo(() => {
    if (checks.every((c) => c.state === "unknown")) return "unknown";
    if (checks.some((c) => c.state === "down")) return "down";
    if (checks.some((c) => c.state === "degraded")) return "degraded";
    return "operational";
  }, [checks]);

  const overallMeta = STATE_META[overall];
  const OverallIcon = overallMeta.icon;

  const overallLabel =
    overall === "operational"
      ? "Semua Sistem Beroperasi"
      : overall === "degraded"
      ? "Layanan Sedang Lambat"
      : overall === "down"
      ? "Ada Gangguan Layanan"
      : "Sedang Memeriksa Status…";

  const overallSubLabel =
    overall === "operational"
      ? "Semua komponen berjalan normal."
      : overall === "degraded"
      ? "Beberapa permintaan lebih lambat dari biasanya."
      : overall === "down"
      ? "Salah satu komponen tidak merespons. Tim sedang memeriksa."
      : "Mohon tunggu beberapa detik…";

  const lastCheckLabel = relativeTime(lastCheckRef.current || null, now);

  return (
    <div className="min-h-[100dvh] bg-background">
      <Header />

      <main className="container max-w-4xl mx-auto px-4 py-8 md:py-12">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs mb-6">
          <Link href="/" className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" />
            Beranda
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-medium">Status Sistem</span>
        </div>

        {/* Header */}
        <div className="space-y-2 mb-8">
          <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
            <Activity className="h-8 w-8 text-primary" />
            Status Sistem
          </h1>
          <p className="text-muted-foreground">
            Pantauan langsung kesehatan layanan TempMail. Diperiksa otomatis dari browser Anda setiap 15 detik.
          </p>
        </div>

        {/* Overall status banner */}
        <div
          className={`rounded-2xl border p-6 mb-6 flex items-center gap-4 ring-4 ${overallMeta.ring} ${
            overall === "operational"
              ? "border-green-500/40 bg-green-500/5"
              : overall === "degraded"
              ? "border-amber-500/40 bg-amber-500/5"
              : overall === "down"
              ? "border-red-500/40 bg-red-500/5"
              : "border-border bg-card"
          }`}
          data-testid="overall-status-banner"
        >
          <div
            className={`h-14 w-14 rounded-full flex items-center justify-center shrink-0 ${overallMeta.bg}/15`}
          >
            <OverallIcon className={`h-7 w-7 ${overallMeta.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className={`text-xl md:text-2xl font-bold ${overallMeta.color}`}>
              {overallLabel}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">{overallSubLabel}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={runChecks}
            disabled={isPolling}
            className="shrink-0 gap-1.5"
            data-testid="btn-refresh-status"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPolling ? "animate-spin" : ""}`} />
            Cek Sekarang
          </Button>
        </div>

        {/* Last checked */}
        <div className="flex items-center justify-between mb-3 px-1">
          <p className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Clock className="h-3 w-3" />
            Terakhir diperiksa {lastCheckLabel}
          </p>
          <p className="text-xs text-muted-foreground">
            Auto-refresh setiap 15 detik
          </p>
        </div>

        {/* Component cards */}
        <div className="space-y-3 mb-8">
          {checks.map(({ def, state, uptime, avgMs, latestMs }) => {
            const meta = STATE_META[state];
            const Icon = def.icon;
            const StateIcon = meta.icon;
            const samples = history[def.id] || [];
            return (
              <div
                key={def.id}
                className="rounded-xl border border-border bg-card p-5"
                data-testid={`status-card-${def.id}`}
              >
                <div className="flex items-start gap-4">
                  <div className="bg-primary/10 p-2.5 rounded-lg shrink-0">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div className="min-w-0">
                        <h3 className="font-semibold text-base">{def.name}</h3>
                        <p className="text-xs text-muted-foreground">{def.description}</p>
                      </div>
                      <div className={`inline-flex items-center gap-1.5 text-xs font-semibold ${meta.color} shrink-0`}>
                        <StateIcon className="h-4 w-4" />
                        {meta.label}
                      </div>
                    </div>

                    {/* Metrics */}
                    <div className="grid grid-cols-3 gap-3 mt-3 mb-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Uptime (1j)
                        </p>
                        <p className="text-lg font-bold tabular-nums" data-testid={`uptime-${def.id}`}>
                          {formatUptime(uptime)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Latensi rata-rata
                        </p>
                        <p className="text-lg font-bold tabular-nums">
                          {formatLatency(avgMs)}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Terakhir
                        </p>
                        <p className="text-lg font-bold tabular-nums">
                          {formatLatency(latestMs)}
                        </p>
                      </div>
                    </div>

                    {/* Sparkline */}
                    <div>
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
                        Riwayat 15 menit terakhir
                      </p>
                      <Sparkline samples={samples} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer info */}
        <div className="rounded-xl border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground space-y-2">
          <div className="flex items-center gap-2 font-semibold text-foreground">
            <Globe className="h-3.5 w-3.5" />
            Bagaimana cara kerjanya?
          </div>
          <p>
            Halaman ini melakukan permintaan langsung dari browser Anda ke endpoint publik TempMail.
            Hasil disimpan lokal di perangkat Anda — bukan dari server. Jadi nilai uptime/latensi
            mencerminkan pengalaman koneksi <strong>Anda sendiri</strong>, dan akan lebih akurat
            seiring lamanya halaman ini terbuka.
          </p>
          <p className="pt-1">
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-green-500" /> &lt; {DEGRADED_MS}ms (normal)
            </span>
            <span className="mx-3">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-amber-500" /> ≥ {DEGRADED_MS}ms (lambat)
            </span>
            <span className="mx-3">·</span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500" /> Gagal / timeout
            </span>
          </p>
        </div>
      </main>
    </div>
  );
}
