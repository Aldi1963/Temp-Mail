import { useEffect, useState } from "react";
import {
  Globe, Plus, Copy, Check, Trash2, RefreshCw, ChevronDown,
  ShieldCheck, Clock3, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface CustomDomain {
  id: number;
  domain: string;
  status: string;
  verificationToken: string;
  webhookSecret: string;
  verifiedAt: string | null;
  createdAt: string;
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [ok, setOk] = useState(false);
  return (
    <Button
      variant="outline" size="sm" className="h-7 gap-1 text-xs shrink-0"
      title={label}
      onClick={() => {
        if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
        setOk(true);
        window.setTimeout(() => setOk(false), 1500);
      }}
    >
      {ok ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
      <span className="hidden sm:inline">{label}</span>
    </Button>
  );
}

function SetupGuide({ d, webhookUrl }: { d: CustomDomain; webhookUrl: string }) {
  const [script, setScript] = useState<string | null>(null);
  const [loadingScript, setLoadingScript] = useState(false);
  const { toast } = useToast();

  const loadScript = async () => {
    if (script) return;
    setLoadingScript(true);
    try {
      const r = await fetch(`${BASE}/api/user/domains/${d.id}/worker-script`, { credentials: "include" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Gagal memuat script.");
      setScript(j.script);
    } catch (e) {
      toast({ title: "Gagal memuat script worker.", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setLoadingScript(false);
    }
  };

  return (
    <div className="mt-3 space-y-4">
      <div className="flex gap-3">
        <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">1</div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-xs font-semibold">Verifikasi kepemilikan domain</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">Tambahkan TXT record berikut di DNS domain Anda:</p>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-20 shrink-0">Host</span>
            <code className="flex-1 min-w-0 break-all bg-muted rounded px-1.5 py-1">_tempmail-verify</code>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            <span className="text-muted-foreground w-20 shrink-0">Value</span>
            <code className="flex-1 min-w-0 break-all bg-muted rounded px-1.5 py-1">{d.verificationToken}</code>
            <CopyBtn text={d.verificationToken} label="Salin" />
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">2</div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-xs font-semibold">Arahkan MX ke Cloudflare</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">Tambahkan 3 MX record berikut (hapus MX lama bila ada):</p>
          {[
            ["Prioritas 10", "route1.mx.cloudflare.net"],
            ["Prioritas 20", "route2.mx.cloudflare.net"],
            ["Prioritas 30", "route3.mx.cloudflare.net"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-center gap-2 text-[11px]">
              <span className="text-muted-foreground w-20 shrink-0">{k}</span>
              <code className="flex-1 min-w-0 break-all bg-muted rounded px-1.5 py-1">{v}</code>
            </div>
          ))}
        </div>
      </div>

      <div className="flex gap-3">
        <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">3</div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-xs font-semibold">Pasang Email Worker</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            Di Cloudflare: Workers &amp; Pages → Create Worker → Deploy → Edit code → tempel script di bawah → Deploy.
            Lalu Email → Email Routing → pilih domain → Routing rules → tambah rule catch-all dengan action
            &quot;Send to Worker&quot; ke worker ini.
          </p>
          {!script ? (
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={loadScript} disabled={loadingScript}>
              <Copy className="h-3.5 w-3.5" />
              {loadingScript ? "Memuat…" : "Tampilkan script worker"}
            </Button>
          ) : (
            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <CopyBtn text={script} label="Salin script" />
                <span className="text-[11px] text-muted-foreground">Script sudah terisi webhook domain ini.</span>
              </div>
              <pre className="max-h-44 overflow-auto text-[10px] leading-relaxed bg-background rounded border border-border/50 p-2 whitespace-pre-wrap break-all">
                {script.slice(0, 1200)}{script.length > 1200 ? "\n…" : ""}
              </pre>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <div className="h-6 w-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">4</div>
        <div className="flex-1 min-w-0 space-y-1.5">
          <p className="text-xs font-semibold">Verifikasi</p>
          <p className="text-[11px] text-muted-foreground leading-relaxed">Tunggu DNS menyebar (±5 menit), lalu klik tombol &quot;Verifikasi&quot; pada domain ini.</p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground flex items-start gap-1.5 pt-2 border-t border-border/50">
        <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
        <span>Webhook URL: <code className="break-all">{webhookUrl}</code> — secret worker tersimpan otomatis di script.</span>
      </p>
    </div>
  );
}

export default function CustomDomainsCard() {
  const { toast } = useToast();
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [loading, setLoading] = useState(true);
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [openSetup, setOpenSetup] = useState<number | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");

  const fetchDomains = async () => {
    setLoading(true);
    try {
      const r = await fetch(`${BASE}/api/user/domains`, { credentials: "include" });
      const j = await r.json();
      if (!r.ok) throw new Error(j.message || "Gagal memuat domain.");
      setDomains(j.domains ?? []);
      setWebhookUrl(j.webhookUrl ?? "");
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchDomains(); }, []);

  const addDomain = async () => {
    const v = newDomain.trim().toLowerCase();
    if (!v) return;
    setAdding(true);
    try {
      const r = await fetch(`${BASE}/api/user/domains`, {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domain: v }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || "Gagal menambah domain.");
      setDomains((p) => [...p, j.domain]);
      setNewDomain("");
      setOpenSetup(j.domain.id);
      toast({ title: "Domain ditambahkan.", description: "Ikuti panduan di bawah untuk verifikasi." });
    } catch (e) {
      toast({ title: "Gagal menambah domain.", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const verifyDomain = async (id: number) => {
    setVerifyingId(id);
    try {
      const r = await fetch(`${BASE}/api/user/domains/${id}/verify`, { method: "POST", credentials: "include" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || "Gagal verifikasi.");
      setDomains((p) => p.map((d) => (d.id === id ? { ...d, status: j.status } : d)));
      if (j.status === "active") {
        toast({ title: "Domain aktif!", description: "Domain bisa dipakai membuat alamat email." });
        setOpenSetup(null);
      } else {
        toast({
          title: "Belum terverifikasi.",
          description: `TXT ${j.txtOk ? "ditemukan" : "belum ditemukan"} · MX ${j.mxOk ? "sudah benar" : "belum mengarah ke Cloudflare"}.`,
          variant: "destructive",
        });
      }
    } catch (e) {
      toast({ title: "Gagal verifikasi.", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setVerifyingId(null);
    }
  };

  const deleteDomain = async () => {
    if (deleteId == null) return;
    try {
      const r = await fetch(`${BASE}/api/user/domains/${deleteId}`, { method: "DELETE", credentials: "include" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.message || "Gagal menghapus.");
      setDomains((p) => p.filter((d) => d.id !== deleteId));
      toast({ title: "Domain dihapus." });
    } catch (e) {
      toast({ title: "Gagal menghapus domain.", description: e instanceof Error ? e.message : "", variant: "destructive" });
    } finally {
      setDeleteId(null);
    }
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3 flex flex-row items-center justify-between gap-2">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <Globe className="h-4 w-4" />
          Domain Saya
          {!loading && domains.length > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5">{domains.length}</Badge>
          )}
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchDomains} title="Segarkan daftar">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <Input
            value={newDomain}
            onChange={(e) => setNewDomain(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addDomain(); }}
            placeholder="contoh.com"
            className="h-9 text-sm flex-1"
          />
          <Button size="sm" className="h-9 gap-1 text-xs shrink-0" onClick={addDomain} disabled={adding || !newDomain.trim()}>
            <Plus className="h-3.5 w-3.5" />
            {adding ? "Menambah…" : "Tambah"}
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground leading-relaxed">
          Sambungkan domain milik Anda via Cloudflare Email Routing. Setelah aktif, domain tampil di pilihan domain saat membuat alamat.
        </p>

        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : domains.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">Belum ada domain kustom.</p>
        ) : (
          <div className="divide-y divide-border/50">
            {domains.map((d) => (
              <div key={d.id} className="py-3 first:pt-1 last:pb-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium break-all flex-1 min-w-0">{d.domain}</span>
                  {d.status === "active" ? (
                    <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30 text-[10px] h-5 gap-1">
                      <ShieldCheck className="h-3 w-3" /> Aktif
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[10px] h-5 gap-1">
                      <Clock3 className="h-3 w-3" /> Menunggu verifikasi
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                  <Button
                    variant="outline" size="sm" className="h-7 text-xs gap-1"
                    onClick={() => setOpenSetup((o) => (o === d.id ? null : d.id))}
                  >
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform ${openSetup === d.id ? "rotate-180" : ""}`} />
                    Panduan
                  </Button>
                  {d.status !== "active" && (
                    <Button
                      size="sm" className="h-7 text-xs gap-1"
                      onClick={() => verifyDomain(d.id)}
                      disabled={verifyingId === d.id}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {verifyingId === d.id ? "Memeriksa…" : "Verifikasi"}
                    </Button>
                  )}
                  <Button
                    variant="ghost" size="sm" className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                    onClick={() => setDeleteId(d.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Hapus
                  </Button>
                </div>
                {openSetup === d.id && <SetupGuide d={d} webhookUrl={webhookUrl} />}
              </div>
            ))}
          </div>
        )}

        <AlertDialog open={deleteId != null} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Hapus domain?</AlertDialogTitle>
              <AlertDialogDescription>
                Domain akan dilepas dari akun Anda. Alamat email yang sudah dibuat dengan domain ini tidak bisa menerima pesan baru.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={deleteDomain}>
                Ya, hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
    </Card>
  );
}
