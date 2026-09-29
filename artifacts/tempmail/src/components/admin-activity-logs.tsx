import { useEffect, useState } from "react";
import { Search, RefreshCw, ScrollText, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL as BASE } from "../lib/api-base";

interface LogItem {
  id: number | string;
  createdAt: string;
  admin: string;
  type: string;
  detail: string;
}

function normalizeItem(raw: Record<string, unknown>, i: number): LogItem {
  const g = (k: string) => raw[k];
  return {
    id: (g("id") as number | string) ?? i,
    createdAt: String(g("createdAt") ?? g("created_at") ?? g("timestamp") ?? ""),
    admin: String(g("admin") ?? g("adminEmail") ?? g("admin_email") ?? g("user") ?? g("email") ?? "-"),
    type: String(g("type") ?? g("action") ?? "-"),
    detail: String(g("detail") ?? g("description") ?? g("message") ?? "-"),
  };
}

function fmtWaktu(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      timeZone: "Asia/Jakarta",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(d);
  } catch {
    return d.toLocaleString("id-ID");
  }
}

const PAGE_SIZE = 10;

export default function AdminActivityLogs() {
  const { toast } = useToast();
  const [items, setItems] = useState<LogItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [q, setQ] = useState("");
  const [debType, setDebType] = useState("");
  const [debQ, setDebQ] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = setTimeout(() => {
      setDebType(typeFilter.trim());
      setDebQ(q.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(t);
  }, [typeFilter, q]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          page: String(page),
          limit: String(PAGE_SIZE),
        });
        if (debType) params.set("type", debType);
        if (debQ) params.set("q", debQ);
        const res = await fetch(`${BASE}/api/admin/activity-logs?${params.toString()}`, {
          credentials: "include",
        });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
        const raw = Array.isArray(data)
          ? data
          : Array.isArray((data as { items?: unknown[] })?.items)
            ? (data as { items: unknown[] }).items
            : [];
        if (cancelled) return;
        setItems((raw as Record<string, unknown>[]).map(normalizeItem));
        setTotal(Number((data as { total?: number })?.total ?? raw.length));
      } catch (e) {
        if (!cancelled) {
          toast({
            title: "Gagal memuat log aktivitas",
            description: e instanceof Error ? e.message : "",
            variant: "destructive",
          });
          setItems([]);
          setTotal(0);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [page, debType, debQ, toast]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Cari admin, aksi, atau detail..."
            className="h-9 pl-8 text-xs"
          />
        </div>
        <Input
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          placeholder="Filter tipe, mis. login"
          className="h-9 text-xs sm:w-44"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-9 gap-1.5 shrink-0"
          onClick={() => {
            setTypeFilter("");
            setQ("");
          }}
        >
          <RefreshCw className="h-3.5 w-3.5" /> Reset
        </Button>
      </div>

      {/* Tabel */}
      <div className="rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="bg-muted/50 text-left">
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground whitespace-nowrap">Waktu</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Admin</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Aksi</th>
                <th className="px-3 py-2.5 text-xs font-semibold text-muted-foreground">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={4} className="px-3 py-2">
                      <Skeleton className="h-8 w-full" />
                    </td>
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-10 text-center">
                    <ScrollText className="h-8 w-8 mx-auto mb-2 text-muted-foreground opacity-40" />
                    <p className="text-sm text-muted-foreground">Belum ada log aktivitas.</p>
                    {(debType || debQ) && (
                      <p className="text-xs text-muted-foreground mt-1">Coba ubah atau reset filter.</p>
                    )}
                  </td>
                </tr>
              ) : (
                items.map((it) => (
                  <tr key={String(it.id)} className="hover:bg-muted/30 transition-colors">
                    <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap align-top">
                      {fmtWaktu(it.createdAt)}
                    </td>
                    <td className="px-3 py-2.5 text-xs font-mono truncate max-w-[180px] align-top" title={it.admin}>
                      {it.admin}
                    </td>
                    <td className="px-3 py-2.5 align-top">
                      <Badge variant="outline" className="text-[10px] h-5 font-mono whitespace-nowrap">
                        {it.type}
                      </Badge>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-muted-foreground align-top min-w-[200px]">
                      {it.detail}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-xs text-muted-foreground">
            Halaman {safePage} dari {totalPages} · {total.toLocaleString("id-ID")} entri
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              title="Halaman sebelumnya"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
              .map((p, idx, arr) => (
                <span key={p} className="flex items-center gap-1">
                  {idx > 0 && p - arr[idx - 1] > 1 && (
                    <span className="text-xs text-muted-foreground px-0.5">…</span>
                  )}
                  <Button
                    variant={p === safePage ? "default" : "outline"}
                    size="sm"
                    className="h-7 w-7 p-0 text-xs"
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </Button>
                </span>
              ))}
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-7 p-0"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              title="Halaman berikutnya"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
