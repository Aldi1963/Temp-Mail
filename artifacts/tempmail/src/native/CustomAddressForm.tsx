import { useEffect, useState } from "react";
import { Check, ChevronDown, Dices } from "lucide-react";
import { useGetAvailableDomains } from "@aldi1963/temp-mail-api-client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { NativeMailbox } from "./useNativeMailbox";

// Kata Bahasa Indonesia untuk nama acak alamat kustom.
const KATA_ACAK = [
  "senja", "kupu", "embun", "samudra", "angkasa", "pelangi", "mentari",
  "rembulan", "ombak", "hujan", "kicau", "melati", "cempaka", "garuda",
  "kencana", "sriti", "jalak", "merak", "camar", "tiram",
];

function namaAcak(): string {
  const kata = KATA_ACAK[Math.floor(Math.random() * KATA_ACAK.length)];
  const angka = Math.floor(1000 + Math.random() * 9000);
  return `${kata}-${angka}`;
}

/**
 * Form alamat kustom inline (gaya native, tanpa popup).
 * Domain memakai dropdown inline kustom: daftar mekar tepat di bawah baris
 * input sebagai bagian alur halaman (mendorong konten ke bawah), bukan
 * dialog sistem dan bukan overlay.
 * Dipakai di hero Beranda dan di tab Alamat Saya.
 */
export function CustomAddressForm({
  mailbox,
  onDone,
  className,
}: {
  mailbox: NativeMailbox;
  onDone?: () => void;
  className?: string;
}) {
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [domain, setDomain] = useState("");
  const [open, setOpen] = useState(false);

  const { data: domainsData } = useGetAvailableDomains();
  const domains: string[] = (domainsData?.domains as string[] | undefined) ?? [];

  useEffect(() => {
    if (!domain && domains.length > 0) setDomain(domains[0]);
  }, [domains, domain]);

  const efektif = domain || domains[0] || "";

  const pilihDomain = (d: string) => {
    setDomain(d);
    setOpen(false);
  };

  const create = () => {
    const clean = name.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (!clean) {
      toast({ title: "Isi nama alamat dulu", variant: "destructive" });
      return;
    }
    void mailbox.generateEmail(efektif || undefined, clean).then(() => {
      setName("");
      setOpen(false);
      onDone?.();
    });
  };

  return (
    <div className={cn("rounded-2xl border border-border/70 bg-card p-3", className)}>
      <div className="flex items-stretch rounded-xl border border-border bg-background overflow-hidden focus-within:ring-1 focus-within:ring-primary">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="nama-kamu"
          autoCapitalize="none"
          autoCorrect="off"
          maxLength={64}
          aria-label="Nama alamat"
          className="flex-1 min-w-0 px-3 py-2.5 text-[14px] outline-none bg-transparent"
        />
        <button
          type="button"
          aria-label="Isi nama acak"
          title="Isi nama acak"
          onClick={() => setName(namaAcak())}
          className="px-2.5 text-muted-foreground active:text-primary active:scale-90 shrink-0"
        >
          <Dices className="h-[18px] w-[18px]" />
        </button>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label="Pilih domain"
          aria-expanded={open}
          disabled={domains.length === 0}
          className="shrink-0 max-w-[46%] border-l border-border bg-muted/50 flex items-center gap-1 pl-2.5 pr-2 py-2.5 text-[13px] font-bold disabled:opacity-70"
        >
          <span className="truncate">{efektif ? `@${efektif}` : "@…"}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
              open && "rotate-180"
            )}
          />
        </button>
      </div>
      {open && domains.length > 0 && (
        <div className="mt-2 overflow-hidden rounded-xl border border-border/70 bg-background shadow-sm">
          <ul className="py-1">
            {domains.map((d) => {
              const aktif = d === efektif;
              return (
                <li key={d}>
                  <button
                    type="button"
                    onClick={() => pilihDomain(d)}
                    aria-pressed={aktif}
                    className={cn(
                      "w-full flex items-center justify-between gap-2 px-3 py-2.5 text-[14px] text-left active:bg-muted",
                      aktif ? "font-bold text-primary" : "text-foreground"
                    )}
                  >
                    <span className="truncate">@{d}</span>
                    {aktif && <Check className="h-[18px] w-[18px] shrink-0" />}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
      <button
        type="button"
        onClick={create}
        disabled={mailbox.isGenerating}
        className="w-full mt-2.5 rounded-2xl bg-primary text-primary-foreground text-[13.5px] font-extrabold py-2.5 active:scale-[0.99] disabled:opacity-60"
      >
        {mailbox.isGenerating ? "Membuat…" : "Buat alamat ini"}
      </button>
    </div>
  );
}
