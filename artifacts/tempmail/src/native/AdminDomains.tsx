// Kelola domain kustom (BYOD): tambah, verifikasi DNS, hapus.
import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Eye, EyeOff, Plus, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { nativeFetch } from "./api";
import { useToast } from "@/hooks/use-toast";
import { copyText } from "./clipboard";
import {
  DangerConfirm,
  ErrorBox,
  Field,
  LoadingBlock,
  fmtDateTime,
  inputCls,
} from "./AdminShared";

interface CustomDomain {
  id: number;
  domain: string;
  status: string;
  verificationToken: string;
  webhookSecret: string;
  verifiedAt: string | null;
  createdAt: string;
}

interface DomainListRes {
  domains: CustomDomain[];
  maxPerUser: number;
  webhookUrl: string;
}

interface VerifyRes {
  txtOk: boolean;
  mxOk: boolean;
  status: string;
  message: string;
}

export function AdminDomains() {
  const { toast } = useToast();
  const [domains, setDomains] = useState<CustomDomain[]>([]);
  const [maxPerUser, setMaxPerUser] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [newDomain, setNewDomain] = useState("");
  const [adding, setAdding] = useState(false);
  const [verifyingId, setVerifyingId] = useState<number | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<Record<number, VerifyRes>>({});
  const [showSecret, setShowSecret] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState<string | null>(null);
  const [busyDel, setBusyDel] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await nativeFetch<DomainListRes>("/api/custom-domains");
      setDomains(res.domains);
      setMaxPerUser(res.maxPerUser);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gagal memuat domain.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const err = (e: unknown) => (e instanceof Error ? e.message : "Terjadi kesalahan.");

  const doCopy = async (key: string, text: string, label: string) => {
    const ok = await copyText(text);
    if (ok) {
      setCopied(key);
      toast({ title: `${label} disalin.` });
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 2000);
    } else {
      toast({ title: "Gagal menyalin.", variant: "destructive" });
    }
  };

  const addDomain = async () => {
    const d = newDomain.trim().toLowerCase();
    if (!d || adding) return;
    setAdding(true);
    try {
      const res = await nativeFetch<{ domain: CustomDomain }>("/api/custom-domains", {
        method: "POST",
        body: JSON.stringify({ domain: d }),
      });
      setDomains((prev) => [res.domain, ...prev]);
      setNewDomain("");
      toast({ title: "Domain ditambahkan.", description: "Lengkapi DNS lalu verifikasi." });
    } catch (e) {
      toast({ title: "Gagal menambah domain", description: err(e), variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const verify = async (d: CustomDomain) => {
    setVerifyingId(d.id);
    try {
      const res = await nativeFetch<VerifyRes>(`/api/custom-domains/${d.id}/verify`, {
        method: "POST",
      });
      setDomains((prev) => prev.map((x) => (x.id === d.id ? { ...x, status: res.status } : x)));
      setVerifyMsg((prev) => ({ ...prev, [d.id]: res }));
      toast({ title: res.message });
    } catch (e) {
      toast({ title: "Verifikasi gagal", description: err(e), variant: "destructive" });
    } finally {
      setVerifyingId(null);
    }
  };

  const remove = async (d: CustomDomain) => {
    setBusyDel(d.id);
    try {
      await nativeFetch(`/api/custom-domains/${d.id}`, { method: "DELETE" });
      setDomains((prev) => prev.filter((x) => x.id !== d.id));
      toast({ title: "Domain dihapus." });
    } catch (e) {
      toast({ title: "Gagal menghapus", description: err(e), variant: "destructive" });
    } finally {
      setBusyDel(null);
    }
  };

  const copyBtn = (key: string, text: string, label: string) => (
    <button
      type="button"
      onClick={() => void doCopy(key, text, label)}
      aria-label={`Salin ${label}`}
      className="shrink-0 w-9 h-9 rounded-xl bg-muted flex items-center justify-center active:scale-[0.95]"
    >
      {copied === key ? (
        <Check className="h-4 w-4 text-emerald-500" />
      ) : (
        <Copy className="h-4 w-4 text-muted-foreground" />
      )}
    </button>
  );

  return (
    <div className="px-4 pt-3 pb-6 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[13.5px] font-extrabold">Domain kustom</p>
        <span className="text-[11px] font-bold text-muted-foreground bg-muted rounded-full px-2.5 py-1">
          {domains.length}/{maxPerUser}
        </span>
      </div>

      <div className="rounded-2xl border border-border/60 bg-card p-3.5">
        <Field label="Tambah domain baru" hint="Contoh: mail.contoh.com — maksimal 5 domain per akun.">
          <div className="flex gap-2">
            <input
              value={newDomain}
              onChange={(e) => setNewDomain(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void addDomain();
              }}
              placeholder="domainanda.com"
              autoCapitalize="none"
              autoCorrect="off"
              className={cn(inputCls, "flex-1 min-w-0 font-mono")}
            />
            <button
              type="button"
              disabled={adding || !newDomain.trim()}
              onClick={() => void addDomain()}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground text-[13px] font-bold px-4 active:scale-[0.97] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" />
              {adding ? "..." : "Tambah"}
            </button>
          </div>
        </Field>
      </div>

      {loading ? (
        <LoadingBlock label="Memuat domain..." />
      ) : error ? (
        <ErrorBox message={error} onRetry={() => void load()} />
      ) : domains.length === 0 ? (
        <p className="text-center text-[13px] text-muted-foreground py-8">
          Belum ada domain kustom. Tambahkan domain Anda di atas.
        </p>
      ) : (
        domains.map((d) => {
          const active = d.status === "active";
          const vm = verifyMsg[d.id];
          return (
            <div key={d.id} className="rounded-2xl border border-border/60 bg-card p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <span className="flex-1 min-w-0 text-[14px] font-extrabold truncate font-mono">
                  {d.domain}
                </span>
                <span
                  className={cn(
                    "shrink-0 text-[10px] font-extrabold uppercase tracking-wide px-2 py-1 rounded-md",
                    active ? "bg-emerald-500/15 text-emerald-500" : "bg-amber-500/15 text-amber-500"
                  )}
                >
                  {active ? "Aktif" : "Menunggu verifikasi"}
                </span>
              </div>

              {!active && (
                <div className="rounded-xl bg-muted/60 p-3 space-y-2.5">
                  <p className="text-[12.5px] font-extrabold">Langkah verifikasi DNS</p>
                  <div>
                    <p className="text-[12px] text-muted-foreground">
                      1. TXT record{" "}
                      <span className="font-mono text-foreground">
                        _tempmail-verify.{d.domain}
                      </span>
                    </p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <code className="flex-1 min-w-0 font-mono text-[11px] break-all bg-background rounded-lg px-2 py-2 border border-border/60">
                        {d.verificationToken}
                      </code>
                      {copyBtn(`tok:${d.id}`, d.verificationToken, "Token verifikasi")}
                    </div>
                  </div>
                  <p className="text-[12px] text-muted-foreground">
                    2. MX record ke{" "}
                    <span className="font-mono text-foreground">mx.cloudflare.net</span>{" "}
                    (via Cloudflare Email Routing)
                  </p>
                  {vm && (
                    <p className="text-[11.5px] font-bold">
                      TXT:{" "}
                      <span className={vm.txtOk ? "text-emerald-500" : "text-amber-500"}>
                        {vm.txtOk ? "ditemukan" : "belum ditemukan"}
                      </span>
                      {" · "}MX:{" "}
                      <span className={vm.mxOk ? "text-emerald-500" : "text-amber-500"}>
                        {vm.mxOk ? "ditemukan" : "belum ditemukan"}
                      </span>
                    </p>
                  )}
                </div>
              )}

              <div>
                <p className="text-[11px] font-bold text-muted-foreground mb-1">
                  Webhook secret (untuk worker Email Routing)
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 font-mono text-[11px] break-all bg-muted rounded-lg px-2 py-2">
                    {showSecret[d.id] ? d.webhookSecret : "•".repeat(28)}
                  </code>
                  <button
                    type="button"
                    onClick={() => setShowSecret((s) => ({ ...s, [d.id]: !s[d.id] }))}
                    aria-label={showSecret[d.id] ? "Sembunyikan secret" : "Tampilkan secret"}
                    className="shrink-0 w-9 h-9 rounded-xl bg-muted flex items-center justify-center active:scale-[0.95]"
                  >
                    {showSecret[d.id] ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                  {copyBtn(`sec:${d.id}`, d.webhookSecret, "Webhook secret")}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">
                  Ditambahkan {fmtDateTime(d.createdAt)}
                  {active && d.verifiedAt ? ` · aktif ${fmtDateTime(d.verifiedAt)}` : ""}
                </span>
                <div className="flex items-center gap-2">
                  {!active && (
                    <button
                      type="button"
                      disabled={verifyingId === d.id}
                      onClick={() => void verify(d)}
                      className="inline-flex items-center gap-1.5 text-[12.5px] font-bold rounded-xl px-3.5 py-2 bg-primary/10 text-primary active:scale-[0.97] disabled:opacity-50"
                    >
                      <RefreshCw
                        className={cn("h-3.5 w-3.5", verifyingId === d.id && "animate-spin")}
                      />
                      {verifyingId === d.id ? "Memeriksa..." : "Verifikasi"}
                    </button>
                  )}
                  <DangerConfirm onConfirm={() => void remove(d)} disabled={busyDel === d.id} />
                </div>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
