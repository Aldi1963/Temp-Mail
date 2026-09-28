import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Globe, RefreshCw, Server, XCircle, Zap } from "lucide-react";
import { API_BASE_URL } from "@/lib/api-base";
import { cn } from "@/lib/utils";

interface RowProps {
  icon: typeof Server;
  label: string;
  value: string;
  ok?: boolean;
}

function Row({ icon: Icon, label, value, ok }: RowProps) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-card border border-border/70 px-4 py-3.5">
      <span className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-primary" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13px] font-bold">{label}</span>
        <span className="block text-[12px] text-muted-foreground truncate">{value}</span>
      </span>
      {ok === true && <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" />}
      {ok === false && <XCircle className="h-5 w-5 text-destructive shrink-0" />}
    </div>
  );
}

// Halaman status native — memakai API_BASE_URL absolut agar tidak false-alarm
// di WebView (URL relatif akan mengarah ke localhost).
export function NativeStatusPage() {
  const [result, setResult] = useState<{ ok: boolean; ms: number } | null>(null);
  const [checking, setChecking] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    const t0 = performance.now();
    try {
      const res = await fetch(`${API_BASE_URL}/api/healthz`, { cache: "no-store" });
      setResult({ ok: res.ok, ms: Math.round(performance.now() - t0) });
    } catch {
      setResult({ ok: false, ms: Math.round(performance.now() - t0) });
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void check();
  }, [check]);

  return (
    <div className="px-4 pt-4 space-y-2.5">
      <div
        className={cn(
          "rounded-3xl p-4 flex items-center gap-3",
          result == null
            ? "bg-muted"
            : result.ok
              ? "bg-emerald-500/10 border border-emerald-500/30"
              : "bg-destructive/10 border border-destructive/30"
        )}
      >
        <span
          className={cn(
            "w-11 h-11 rounded-2xl flex items-center justify-center shrink-0",
            result == null ? "bg-muted-foreground/20" : result.ok ? "bg-emerald-500/20" : "bg-destructive/20"
          )}
        >
          <Server className={cn("h-5 w-5", result?.ok ? "text-emerald-600" : "text-muted-foreground")} />
        </span>
        <div className="flex-1">
          <p className="text-[15px] font-extrabold">
            {result == null ? "Memeriksa…" : result.ok ? "Semua sistem normal" : "Server bermasalah"}
          </p>
          <p className="text-[12px] text-muted-foreground">
            {result == null ? "Tunggu sebentar" : `Diperiksa ${result.ms} ms yang lalu`}
          </p>
        </div>
        <button
          type="button"
          onClick={() => void check()}
          disabled={checking}
          aria-label="Periksa ulang"
          className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground active:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={cn("h-5 w-5", checking && "animate-spin")} />
        </button>
      </div>

      <Row icon={Zap} label="API Server" value={result == null ? "…" : result.ok ? "Operasional" : "Tidak terjangkau"} ok={result?.ok} />
      <Row icon={Globe} label="Alamat server" value={API_BASE_URL} />
      <Row
        icon={RefreshCw}
        label="Waktu respons"
        value={result == null ? "…" : `${result.ms} ms`}
        ok={result == null ? undefined : result.ms < 1500}
      />

      <p className="text-[11px] text-muted-foreground text-center px-6 pt-2">
        Bila server tidak terjangkau, periksa koneksi internet lalu coba lagi.
      </p>
    </div>
  );
}
