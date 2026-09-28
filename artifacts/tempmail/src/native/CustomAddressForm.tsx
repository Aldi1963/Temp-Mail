import { useEffect, useState } from "react";
import { useGetAvailableDomains } from "@aldi1963/temp-mail-api-client";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import type { NativeMailbox } from "./useNativeMailbox";

/**
 * Form alamat kustom inline (gaya native, tanpa popup).
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

  const preview = `${name.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "") || "nama-kamu"}@${domain || domains[0] || "…"}`;

  const create = () => {
    const clean = name.trim().toLowerCase().replace(/[^a-z0-9._-]/g, "");
    if (!clean) {
      toast({ title: "Isi nama alamat dulu", variant: "destructive" });
      return;
    }
    void mailbox.generateEmail(domain || undefined, clean).then(() => {
      setName("");
      onDone?.();
    });
  };

  return (
    <div className={cn("rounded-2xl border border-border/70 bg-card p-3", className)}>
      <div className="flex rounded-xl overflow-hidden border border-border bg-background">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="nama-kamu"
          autoCapitalize="none"
          autoCorrect="off"
          maxLength={64}
          className="flex-1 min-w-0 px-3 py-2.5 text-[14px] outline-none bg-transparent"
        />
        <span className="px-3 flex items-center text-[13px] text-muted-foreground bg-muted/50 truncate max-w-[45%]">
          @{domain || domains[0] || "…"}
        </span>
      </div>
      {domains.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {domains.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDomain(d)}
              className={cn(
                "rounded-full px-3 py-1.5 text-[12px] font-bold border active:scale-95",
                (domain || domains[0]) === d
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-background text-muted-foreground border-border/70"
              )}
            >
              @{d}
            </button>
          ))}
        </div>
      )}
      <p className="text-[12px] text-muted-foreground mt-2.5">
        Jadinya: <span className="font-bold text-foreground">{preview}</span>
      </p>
      <button
        type="button"
        onClick={create}
        disabled={mailbox.isGenerating}
        className="w-full mt-2 rounded-2xl bg-primary text-primary-foreground text-[13.5px] font-extrabold py-2.5 active:scale-[0.99] disabled:opacity-60"
      >
        {mailbox.isGenerating ? "Membuat…" : "Buat alamat ini"}
      </button>
    </div>
  );
}
