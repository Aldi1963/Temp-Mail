// Log aktivitas admin: daftar (waktu, aksi, pelaku, detail),
// filter teks inline, pagination "muat lagi".
import { useCallback, useEffect, useState } from "react";
import { History, Search, X } from "lucide-react";
import { nativeFetch } from "./api";
import { ErrorBox, LoadingBlock, fmtDateTime, inputCls } from "./AdminShared";

interface ActivityLog {
  id: number;
  userId: number | null;
  actorEmail: string | null;
  action: string;
  description: string | null;
  createdAt: string;
}

interface LogsRes {
  items: ActivityLog[];
  total: number;
  page: number;
  limit: number;
}

const LIMIT = 20;

export function AdminActivityLogs() {
  const [items, setItems] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  // Debounce filter teks.
  useEffect(() => {
    const t = window.setTimeout(() => setDebouncedQ(q.trim()), 400);
    return () => window.clearTimeout(t);
  }, [q]);

  const fetchPage = useCallback(async (p: number, query: string, append: boolean) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError("");
    try {
      const res = await nativeFetch<LogsRes>(
        `/api/admin/activity-logs?q=${encodeURIComponent(query)}&page=${p}&limit=${LIMIT}`
      );
      setItems((prev) => (append ? [...prev, ...(res?.items ?? [])] : (res?.items ?? [])));
      setTotal(Number(res?.total ?? 0));
      setPage(p);
    } catch (e) {
      if (!append) setError(e instanceof Error ? e.message : "Gagal memuat log aktivitas.");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Reset ke halaman 1 setiap filter berubah.
  useEffect(() => {
    void fetchPage(1, debouncedQ, false);
  }, [debouncedQ, fetchPage]);

  const hasMore = items.length < total;

  return (
    <div className="px-4 pt-3 pb-6 space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari aksi atau detail…"
          className={`${inputCls} pl-9 pr-9`}
        />
        {q !== "" && (
          <button
            aria-label="Hapus filter"
            onClick={() => setQ("")}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full flex items-center justify-center text-muted-foreground active:bg-muted"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <p className="text-[11.5px] text-muted-foreground px-1">
        {total > 0 ? (
          <>
            Menampilkan <b className="text-foreground">{items.length}</b> dari{" "}
            <b className="text-foreground">{total}</b> aktivitas
          </>
        ) : (
          "Log aktivitas sistem"
        )}
      </p>

      {loading ? (
        <LoadingBlock label="Memuat log..." />
      ) : error ? (
        <ErrorBox message={error} onRetry={() => void fetchPage(1, debouncedQ, false)} />
      ) : items.length === 0 ? (
        <div className="flex flex-col items-center text-center py-12 px-6">
          <span className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
            <History className="h-7 w-7 text-muted-foreground" />
          </span>
          <p className="text-[14px] font-bold">Tidak ada aktivitas</p>
          <p className="text-[12px] text-muted-foreground mt-1">
            {debouncedQ ? "Tidak ada yang cocok dengan filter." : "Belum ada aktivitas tercatat."}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {items.map((l) => (
              <div key={l.id} className="rounded-2xl border border-border/60 bg-card p-3.5">
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 font-mono text-[11.5px] font-bold text-primary truncate">
                    {l.action}
                  </code>
                  <span className="shrink-0 text-[10.5px] text-muted-foreground">
                    {fmtDateTime(l.createdAt)}
                  </span>
                </div>
                {l.description ? (
                  <p className="text-[12.5px] text-foreground/90 mt-1.5 leading-relaxed">
                    {l.description}
                  </p>
                ) : null}
                {l.actorEmail ? (
                  <p className="text-[11px] text-muted-foreground mt-1 truncate">
                    oleh <span className="font-mono">{l.actorEmail}</span>
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground mt-1">oleh sistem</p>
                )}
              </div>
            ))}
          </div>
          {hasMore && (
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void fetchPage(page + 1, debouncedQ, true)}
              className="w-full rounded-2xl border border-border/70 text-[13px] font-bold py-2.5 active:scale-[0.99] disabled:opacity-50"
            >
              {loadingMore ? "Memuat…" : `Muat lagi (${total - items.length} tersisa)`}
            </button>
          )}
        </>
      )}
    </div>
  );
}
