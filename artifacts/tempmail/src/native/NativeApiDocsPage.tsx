import { Code2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Endpoint {
  method: "GET" | "POST" | "DELETE" | "PATCH";
  path: string;
  desc: string;
}

const ENDPOINTS: Endpoint[] = [
  { method: "GET", path: "/api/email/generate", desc: "Buat alamat email baru (acak atau kustom)." },
  { method: "GET", path: "/api/email/inbox", desc: "Lihat daftar pesan masuk sebuah alamat." },
  { method: "GET", path: "/api/email/message", desc: "Baca isi lengkap satu pesan." },
  { method: "DELETE", path: "/api/email/message", desc: "Hapus satu pesan dari inbox." },
  { method: "POST", path: "/api/email/extend", desc: "Perpanjang masa aktif alamat." },
  { method: "POST", path: "/api/email/blacklist", desc: "Blokir pengirim agar pesannya ditolak." },
  { method: "GET", path: "/api/email/domains", desc: "Daftar domain email yang tersedia." },
  { method: "DELETE", path: "/api/email/destroy", desc: "Musnahkan alamat permanen dari server." },
];

const METHOD_STYLE: Record<Endpoint["method"], string> = {
  GET: "bg-emerald-500/15 text-emerald-600",
  POST: "bg-sky-500/15 text-sky-600",
  DELETE: "bg-destructive/10 text-destructive",
  PATCH: "bg-amber-500/15 text-amber-600",
};

export function NativeApiDocsPage() {
  return (
    <div className="px-4 pt-4">
      <div className="rounded-3xl bg-primary/[0.08] border border-primary/20 p-4 flex items-center gap-3 mb-3">
        <span className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
          <Code2 className="h-5 w-5 text-primary" />
        </span>
        <p className="text-[13px] font-bold leading-snug">
          Endpoint utama TempMail API. Dokumentasi lengkap ada di situs web.
        </p>
      </div>
      <div className="space-y-2">
        {ENDPOINTS.map((e) => (
          <div key={e.method + e.path} className="rounded-2xl bg-card border border-border/70 px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "text-[10px] font-extrabold rounded-md px-1.5 py-0.5 shrink-0",
                  METHOD_STYLE[e.method]
                )}
              >
                {e.method}
              </span>
              <code className="text-[12px] font-mono truncate">{e.path}</code>
            </div>
            <p className="text-[12px] text-muted-foreground mt-1.5">{e.desc}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
