import { useEffect, useState } from "react";
import { Ban, Plus, Trash2, Globe } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL as BASE } from "../lib/api-base";

interface BlockedDomain {
  id: number | string;
  domain: string;
  reason: string;
  createdAt: string | null;
}

function normalize(raw: Record<string, unknown>, i: number): BlockedDomain {
  const g = (k: string) => raw[k];
  return {
    id: (g("id") as number | string) ?? i,
    domain: String(g("domain") ?? ""),
    reason: String(g("reason") ?? g("alasan") ?? "-"),
    createdAt: g("createdAt") != null ? String(g("createdAt")) : g("created_at") != null ? String(g("created_at")) : null,
  };
}

function fmtTgl(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" });
}

export default function AdminBlockedDomains() {
  const { toast } = useToast();
  const [items, setItems] = useState<BlockedDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [domain, setDomain] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/admin/blocked-domains`, { credentials: "include" });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      const raw: unknown[] = Array.isArray(data)
        ? data
        : Array.isArray((data as { items?: unknown[] })?.items)
          ? (data as { items: unknown[] }).items
          : Array.isArray((data as { domains?: unknown[] })?.domains)
            ? (data as { domains: unknown[] }).domains
            : [];
      setItems((raw as Record<string, unknown>[]).map(normalize).filter((d) => d.domain));
    } catch (e) {
      toast({
        title: "Gagal memuat domain diblokir",
        description: e instanceof Error ? e.message : "",
        variant: "destructive",
      });
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const add = async () => {
    const d = domain.trim().toLowerCase().replace(/^@/, "");
    if (!d) return;
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(d)) {
      toast({ title: "Domain tidak valid", description: "Contoh: spamdomain.com", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/admin/blocked-domains`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: d, reason: reason.trim() || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setDomain("");
      setReason("");
      await load();
      toast({ title: "Domain diblokir", description: `@${d} tidak bisa dipakai lagi.` });
    } catch (e) {
      toast({ title: "Gagal", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: number | string) => {
    setDeletingId(id);
    try {
      const res = await fetch(`${BASE}/api/admin/blocked-domains/${encodeURIComponent(String(id))}`, {
        method: "DELETE",
        credentials: "include",
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.message || `HTTP ${res.status}`);
      setItems((prev) => prev.filter((x) => x.id !== id));
      toast({ title: "Blokir domain dihapus" });
    } catch (e) {
      toast({ title: "Gagal", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Domain pada daftar ini tidak bisa dipakai untuk membuat alamat email sementara.
      </p>

      {/* Form tambah */}
      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="contoh: spamdomain.com"
          className="h-9 text-xs font-mono sm:max-w-[240px]"
        />
        <Input
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="Alasan (opsional)"
          className="h-9 text-xs flex-1"
        />
        <Button onClick={add} disabled={saving || !domain.trim()} className="gap-1.5 h-9 shrink-0">
          <Plus className="h-4 w-4" /> {saving ? "Menyimpan..." : "Blokir Domain"}
        </Button>
      </div>

      {/* Daftar */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-14 w-full rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <Globe className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Belum ada domain yang diblokir.</p>
        </div>
      ) : (
        <div className="divide-y divide-border rounded-xl border overflow-hidden">
          {items.map((d) => (
            <div key={String(d.id)} className="flex items-center gap-2.5 px-3 py-2.5 hover:bg-muted/30 transition-colors">
              <div className="h-8 w-8 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <Ban className="h-4 w-4 text-destructive" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-mono text-sm font-medium truncate">@{d.domain}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  {d.reason}
                  {d.createdAt ? ` · diblokir ${fmtTgl(d.createdAt)}` : ""}
                </p>
              </div>
              <Badge variant="destructive" className="text-[10px] h-5 shrink-0 hidden sm:inline-flex">
                Diblokir
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                onClick={() => remove(d.id)}
                disabled={deletingId === d.id}
                title="Hapus dari daftar blokir"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
