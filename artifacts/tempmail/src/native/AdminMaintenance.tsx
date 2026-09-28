// Mode maintenance: toggle aktif/mati + pesan kustom.
// Backend tidak punya endpoint khusus — memakai GET/PUT /api/admin/settings
// dengan key maintenance_mode ("true"/"false") dan maintenance_message.
import { useCallback, useEffect, useState } from "react";
import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { nativeFetch } from "./api";
import { useToast } from "@/hooks/use-toast";
import { AdminToggle, ErrorBox, Field, LoadingBlock, inputCls } from "./AdminShared";

export function AdminMaintenance() {
  const { toast } = useToast();
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const s = await nativeFetch<Record<string, string>>("/api/admin/settings");
      setEnabled(s.maintenance_mode === "true");
      setMessage(s.maintenance_message ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat status maintenance.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      await nativeFetch("/api/admin/settings", {
        method: "PUT",
        body: JSON.stringify({
          maintenance_mode: enabled ? "true" : "false",
          maintenance_message: message.trim(),
        }),
      });
      toast({ title: "Pengaturan maintenance disimpan." });
    } catch (e) {
      toast({
        title: "Gagal menyimpan",
        description: e instanceof Error ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 pt-3 pb-6 space-y-3">
      <div className="rounded-2xl border border-border/60 bg-card p-3.5">
        <div className="flex items-center justify-between">
          <p className="text-[13.5px] font-extrabold">Mode maintenance</p>
          <span
            className={cn(
              "text-[10px] font-extrabold uppercase tracking-wide px-2 py-1 rounded-md",
              enabled ? "bg-destructive/15 text-destructive" : "bg-emerald-500/15 text-emerald-500"
            )}
          >
            {enabled ? "Aktif" : "Nonaktif"}
          </span>
        </div>

        {loading ? (
          <LoadingBlock label="Memuat status..." />
        ) : error ? (
          <div className="mt-3">
            <ErrorBox message={error} onRetry={() => void load()} />
          </div>
        ) : (
          <div className="mt-3 space-y-3.5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[13px] font-bold">Aktifkan maintenance</p>
                <p className="text-[11px] text-muted-foreground">
                  {enabled
                    ? "API non-admin sedang diblokir (503)"
                    : "Semua layanan berjalan normal"}
                </p>
              </div>
              <AdminToggle
                on={enabled}
                onChange={() => setEnabled((v) => !v)}
                label="Aktifkan mode maintenance"
              />
            </div>

            <Field
              label="Pesan kustom"
              hint="Ditonjolkan ke pengguna saat maintenance aktif. Kosongkan untuk pesan bawaan."
            >
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="Server sedang dalam pemeliharaan. Coba lagi nanti."
                className={cn(inputCls, "resize-none leading-relaxed")}
              />
            </Field>

            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="w-full rounded-xl bg-primary text-primary-foreground text-[14px] font-bold py-3 active:scale-[0.99] disabled:opacity-50"
            >
              {saving ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.07] p-3.5 flex gap-2.5">
        <TriangleAlert className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-[11.5px] text-muted-foreground leading-relaxed">
          Saat aktif, semua <span className="font-mono">/api/*</span> menjawab 503 kecuali{" "}
          <span className="font-mono">/api/admin/*</span> dan health check. Perubahan berlaku
          maksimal ~10 detik (cache server).
        </p>
      </div>
    </div>
  );
}
