import { useEffect, useState } from "react";
import { ChevronDown, Dices } from "lucide-react";
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
 * Domain memakai <select> native -> di Android membuka picker sistem.
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

  const { data: domainsData } = useGetAvailableDomains();
  const domains: string[] = (domainsData?.domains as string[] | undefined) ?? [];

  useEffect(() => {
    if (!domain && domains.length > 0) setDomain(domains[0]);
  }, [domains, domain]);

  const efektif = domain || domains[0] || "";

  const create = () => {
    const clean = name.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (!clean) {
      toast({ title: "Isi nama alamat dulu", variant: "destructive" });
      return;
    }
    void mailbox.generateEmail(efektif || undefined, clean).then(() => {
      setName("");
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
        <div className="relative shrink-0 max-w-[44%] border-l border-border bg-muted/50 flex items-center">
          {domains.length > 0 ? (
            <>
              <select
                value={efektif}
                onChange={(e) => setDomain(e.target.value)}
                aria-label="Pilih domain"
                className="h-full w-full appearance-none bg-transparent pl-2.5 pr-7 py-2.5 text-[13px] font-bold text-foreground outline-none"
              >
                {domains.map((d) => (
                  <option key={d} value={d}>
                    @{d}
                  </option>
                ))}
              </select>
              <ChevronDown className="h-4 w-4 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
            </>
          ) : (
            <span className="px-3 py-2.5 text-[13px] text-muted-foreground">@…</span>
          )}
        </div>
      </div>
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
