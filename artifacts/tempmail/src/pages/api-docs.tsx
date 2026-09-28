import { useState, useMemo, ReactNode } from "react";
import { Link } from "wouter";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Book, Code2, Key, Webhook, Mail, Inbox, FileText, Server, AlertCircle,
  CheckCircle2, Copy, ChevronRight, ExternalLink, Zap, Lock, Globe, Play,
  Download, Terminal, X,
} from "lucide-react";

import { API_BASE_URL as API_BASE, getFullBase } from "../lib/api-base";

// ---------------------------------------------------------------------------
// Data model
// ---------------------------------------------------------------------------

type ParamLoc = "query" | "header" | "body";
type HttpMethod = "GET" | "POST" | "PATCH" | "DELETE";

interface DocParam {
  name: string;
  in: ParamLoc;
  type: "string" | "boolean";
  required?: boolean;
  desc: string;
  placeholder?: string;
}

interface EndpointSpec {
  id: string;
  section: string;
  method: HttpMethod;
  path: string;
  title: string;
  params: DocParam[];
  responseExample?: string;
  danger?: string;
}

const API_KEY_PARAM: DocParam = {
  name: "X-API-Key", in: "header", type: "string",
  desc: "API key (opsional untuk endpoint publik, wajib untuk limit lebih tinggi).",
  placeholder: "tm_xxx",
};

const MANAGE_TOKEN_PARAM: DocParam = {
  name: "X-Manage-Token", in: "header", type: "string", required: true,
  desc: "Bukti kepemilikan alamat (diterbitkan saat /generate sebagai manageToken).",
  placeholder: "manage-token-anda",
};

const EMAIL_QUERY: DocParam = {
  name: "email", in: "query", type: "string", required: true,
  desc: "Alamat email.",
  placeholder: "nama@bakmi.my.id",
};

const SECTIONS: { id: string; label: string; icon: any; intro?: ReactNode }[] = [
  { id: "generate", label: "Generate Email", icon: Mail },
  { id: "inbox", label: "Lihat Inbox", icon: Inbox },
  {
    id: "message", label: "Baca & Kelola Pesan", icon: FileText,
    intro: <p className="text-sm text-muted-foreground leading-relaxed">Mengambil isi lengkap sebuah pesan, menghapus, atau mengarsipkannya. Aksi hapus/arsip butuh bukti kepemilikan alamat.</p>,
  },
  { id: "domains", label: "Daftar Domain", icon: Globe },
  { id: "stats", label: "Statistik", icon: Server },
  { id: "extend", label: "Perpanjang Email", icon: Zap },
  { id: "reset", label: "Hapus Inbox", icon: AlertCircle },
  {
    id: "destroy", label: "Musnahkan Email", icon: AlertCircle,
    intro: <p className="text-sm text-muted-foreground">Menghapus alamat email beserta seluruh riwayat pesannya secara permanen dari server.</p>,
  },
  {
    id: "blacklist", label: "Blacklist Pengirim", icon: AlertCircle,
    intro: <p className="text-sm text-muted-foreground leading-relaxed">Blokir email dari domain atau pengirim tertentu agar tidak masuk inbox.</p>,
  },
];

const ENDPOINTS: EndpointSpec[] = [
  {
    id: "generate", section: "generate", method: "GET", path: "/api/email/generate",
    title: "Membuat alamat email sementara baru. Untuk alamat guest, respons menyertakan manageToken — simpan baik-baik, itu bukti kepemilikan Anda.",
    params: [
      { name: "username", in: "query", type: "string", desc: "Username kustom (a-z, 0-9, ._-) maks 30 karakter. Opsional.", placeholder: "john" },
      { name: "domain", in: "query", type: "string", desc: "Domain dari daftar yang tersedia. Opsional.", placeholder: "bakmi.my.id" },
      API_KEY_PARAM,
    ],
    responseExample: `{
  "email": "john@bakmi.my.id",
  "username": "john",
  "domain": "bakmi.my.id",
  "expiresAt": "2026-10-28T09:00:00.000Z",
  "createdAt": "2026-09-28T09:00:00.000Z",
  "manageToken": "milik-anda-jangan-disebar"
}`,
  },
  {
    id: "inbox", section: "inbox", method: "GET", path: "/api/email/inbox",
    title: "Mengambil daftar pesan yang masuk ke alamat email tertentu.",
    params: [
      { ...EMAIL_QUERY, desc: "Alamat email yang inbox-nya ingin dilihat." },
      API_KEY_PARAM,
    ],
    responseExample: `{
  "email": "john@bakmi.my.id",
  "messages": [
    {
      "id": "uuid-pesan-1",
      "from": "newsletter@github.com",
      "subject": "Verifikasi akun Anda",
      "preview": "Halo, terima kasih telah mendaftar...",
      "receivedAt": "2026-09-28T09:05:00.000Z",
      "isRead": false,
      "hasAttachments": false
    }
  ],
  "total": 1,
  "unreadCount": 1
}`,
  },
  {
    id: "message-get", section: "message", method: "GET", path: "/api/email/message",
    title: "Mengambil isi lengkap sebuah pesan termasuk HTML body dan lampiran.",
    params: [
      { name: "id", in: "query", type: "string", required: true, desc: "ID pesan dari endpoint /inbox.", placeholder: "uuid-pesan-1" },
      { ...EMAIL_QUERY, desc: "Alamat email pemilik pesan." },
      API_KEY_PARAM,
    ],
    responseExample: `{
  "id": "uuid-pesan-1",
  "email": "john@bakmi.my.id",
  "from": "newsletter@github.com",
  "to": "john@bakmi.my.id",
  "subject": "Verifikasi akun Anda",
  "textBody": "Kode verifikasi: 482917",
  "htmlBody": "<html>...</html>",
  "receivedAt": "2026-09-28T09:05:00.000Z",
  "isRead": false,
  "attachments": []
}`,
  },
  {
    id: "message-delete", section: "message", method: "DELETE", path: "/api/email/message",
    title: "Menghapus satu pesan secara permanen.",
    params: [
      { name: "id", in: "query", type: "string", required: true, desc: "ID pesan yang ingin dihapus.", placeholder: "uuid-pesan-1" },
      { ...EMAIL_QUERY, desc: "Alamat email pemilik pesan." },
      MANAGE_TOKEN_PARAM,
    ],
    responseExample: `{
  "success": true,
  "message": "Message deleted"
}`,
    danger: "Pesan yang dihapus tidak bisa dikembalikan.",
  },
  {
    id: "message-archive", section: "message", method: "PATCH", path: "/api/email/message/archive",
    title: "Mengarsipkan atau mengembalikan pesan dari arsip.",
    params: [
      { name: "id", in: "body", type: "string", required: true, desc: "ID pesan.", placeholder: "uuid-pesan-1" },
      { name: "email", in: "body", type: "string", required: true, desc: "Alamat email pemilik pesan.", placeholder: "nama@bakmi.my.id" },
      { name: "archived", in: "body", type: "boolean", required: true, desc: "true = arsipkan, false = kembalikan ke inbox." },
      MANAGE_TOKEN_PARAM,
    ],
    responseExample: `{
  "success": true,
  "archived": true
}`,
  },
  {
    id: "domains", section: "domains", method: "GET", path: "/api/email/domains",
    title: "Mengambil daftar domain yang tersedia untuk membuat alamat email.",
    params: [API_KEY_PARAM],
    responseExample: `{
  "domains": ["bakmi.my.id", "clipku.com"]
}`,
  },
  {
    id: "stats", section: "stats", method: "GET", path: "/api/email/stats",
    title: "Mengambil statistik penggunaan untuk satu alamat email (jumlah pesan, pengirim teratas, dll).",
    params: [
      { ...EMAIL_QUERY, desc: "Alamat email yang ingin dilihat statistiknya." },
      API_KEY_PARAM,
    ],
  },
  {
    id: "extend", section: "extend", method: "POST", path: "/api/email/extend",
    title: "Memperpanjang masa aktif alamat email sebelum kedaluwarsa.",
    params: [
      { name: "email", in: "body", type: "string", required: true, desc: "Alamat email yang ingin diperpanjang.", placeholder: "nama@bakmi.my.id" },
      { name: "minutes", in: "body", type: "string", desc: "Durasi perpanjangan dalam menit. Opsional.", placeholder: "1440" },
      MANAGE_TOKEN_PARAM,
      API_KEY_PARAM,
    ],
    responseExample: `{
  "success": true,
  "email": "nama@bakmi.my.id",
  "expiresAt": "2026-10-29T09:00:00.000Z"
}`,
  },
  {
    id: "reset", section: "reset", method: "DELETE", path: "/api/email/reset",
    title: "Menghapus semua pesan dari inbox sebuah alamat email.",
    params: [
      { ...EMAIL_QUERY, desc: "Alamat email yang inbox-nya ingin dikosongkan." },
      MANAGE_TOKEN_PARAM,
    ],
    responseExample: `{
  "success": true,
  "message": "Inbox cleared"
}`,
    danger: "Seluruh pesan di inbox akan dihapus dan tidak bisa dikembalikan.",
  },
  {
    id: "destroy", section: "destroy", method: "DELETE", path: "/api/email/destroy",
    title: "Pemusnahan permanen alamat email dan seluruh pesan (burner).",
    params: [
      { ...EMAIL_QUERY, desc: "Alamat email yang ingin dimusnahkan permanen." },
      MANAGE_TOKEN_PARAM,
    ],
    responseExample: `{
  "success": true,
  "message": "Email nama@bakmi.my.id berhasil dimusnahkan secara permanen."
}`,
    danger: "Alamat dan seluruh riwayat pesannya hilang permanen dari server.",
  },
  {
    id: "blacklist-get", section: "blacklist", method: "GET", path: "/api/email/blacklist",
    title: "Lihat daftar pengirim yang diblokir.",
    params: [
      { ...EMAIL_QUERY, desc: "Alamat email pemilik blacklist." },
      API_KEY_PARAM,
    ],
    responseExample: `{
  "blocked": [
    { "id": 1, "pattern": "spam@example.com", "createdAt": "2026-09-28T09:00:00.000Z" }
  ]
}`,
  },
  {
    id: "blacklist-add", section: "blacklist", method: "POST", path: "/api/email/blacklist",
    title: "Tambah pengirim ke blacklist.",
    params: [
      { name: "email", in: "body", type: "string", required: true, desc: "Alamat email pemilik.", placeholder: "nama@bakmi.my.id" },
      { name: "pattern", in: "body", type: "string", required: true, desc: "Email pengirim atau @domain.com (untuk blokir seluruh domain).", placeholder: "spam@example.com" },
      MANAGE_TOKEN_PARAM,
    ],
    responseExample: `{
  "success": true,
  "message": "Blocked: spam@example.com"
}`,
  },
  {
    id: "blacklist-del", section: "blacklist", method: "DELETE", path: "/api/email/blacklist",
    title: "Hapus pengirim dari blacklist.",
    params: [
      { ...EMAIL_QUERY, desc: "Alamat email pemilik." },
      { name: "pattern", in: "query", type: "string", required: true, desc: "Pattern yang ingin dihapus.", placeholder: "spam@example.com" },
      MANAGE_TOKEN_PARAM,
    ],
    responseExample: `{
  "success": true,
  "message": "Removed from blacklist"
}`,
  },
];

// ---------------------------------------------------------------------------
// Request building + code samples
// ---------------------------------------------------------------------------

interface BuiltRequest {
  url: string;
  headers: Record<string, string>;
  body?: string;
}

function buildHttpRequest(spec: EndpointSpec, values: Record<string, string>): BuiltRequest {
  const fullBase = getFullBase();
  const qs = spec.params
    .filter((p) => p.in === "query")
    .map((p) => ({ k: p.name, v: (values[p.name] ?? "").trim() }))
    .filter((q) => q.v)
    .map((q) => `${encodeURIComponent(q.k)}=${encodeURIComponent(q.v)}`)
    .join("&");
  const url = `${fullBase}${spec.path}${qs ? `?${qs}` : ""}`;
  const headers: Record<string, string> = {};
  spec.params
    .filter((p) => p.in === "header")
    .forEach((p) => {
      const v = (values[p.name] ?? "").trim();
      if (v) headers[p.name] = v;
    });
  const bodyParams = spec.params.filter((p) => p.in === "body");
  let body: string | undefined;
  if (bodyParams.length > 0) {
    const obj: Record<string, unknown> = {};
    bodyParams.forEach((p) => {
      const v = (values[p.name] ?? "").trim();
      if (!v) return;
      obj[p.name] = p.type === "boolean" ? v === "true" : v;
    });
    body = JSON.stringify(obj);
    headers["Content-Type"] = "application/json";
  }
  return { url, headers, body };
}

function toCurl(spec: EndpointSpec, req: BuiltRequest): string {
  const parts = [`curl -X ${spec.method} "${req.url}"`];
  for (const [k, v] of Object.entries(req.headers)) parts.push(`-H "${k}: ${v}"`);
  if (req.body) parts.push(`-d '${req.body.replace(/'/g, `'\\''`)}'`);
  return parts.join(" \\\n  ");
}

function toJs(spec: EndpointSpec, req: BuiltRequest): string {
  const lines = [
    `const res = await fetch(${JSON.stringify(req.url)}, {`,
    `  method: ${JSON.stringify(spec.method)},`,
  ];
  const hKeys = Object.keys(req.headers);
  if (hKeys.length > 0) {
    lines.push(`  headers: {`);
    hKeys.forEach((k) => lines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(req.headers[k])},`));
    lines.push(`  },`);
  }
  if (req.body) {
    const pretty = JSON.stringify(JSON.parse(req.body), null, 2).split("\n").join("\n  ");
    lines.push(`  body: JSON.stringify(${pretty}, null, 2),`);
  }
  lines.push(`});`, ``, `const data = await res.json();`, `console.log(res.status, data);`);
  return lines.join("\n");
}

function toPy(spec: EndpointSpec, req: BuiltRequest): string {
  const lines = [`import requests`, ``, `url = ${JSON.stringify(req.url)}`];
  const hKeys = Object.keys(req.headers);
  if (hKeys.length > 0) {
    lines.push(`headers = {`);
    hKeys.forEach((k) => lines.push(`    ${JSON.stringify(k)}: ${JSON.stringify(req.headers[k])},`));
    lines.push(`}`);
  }
  if (req.body) {
    lines.push(`payload = ${JSON.stringify(JSON.parse(req.body), null, 2)}`);
  }
  const args = [`url`];
  if (hKeys.length > 0) args.push(`headers=headers`);
  if (req.body) args.push(`json=payload`);
  const m = spec.method.toLowerCase();
  if (m === "get" || m === "post") lines.push(`resp = requests.${m}(${args.join(", ")})`);
  else lines.push(`resp = requests.request(${JSON.stringify(spec.method)}, ${args.join(", ")})`);
  lines.push(`print(resp.status_code)`, `print(resp.json())`);
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Postman Collection v2.1
// ---------------------------------------------------------------------------

function buildPostmanCollection(): unknown {
  const baseUrl = getFullBase();
  return {
    info: {
      name: "TempMail API",
      description: "Koleksi endpoint TempMail REST API. Import file ini ke Postman untuk mencoba semua endpoint langsung.",
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json",
    },
    variable: [{ key: "baseUrl", value: baseUrl, type: "string" }],
    item: ENDPOINTS.map((spec) => {
      const query = spec.params
        .filter((p) => p.in === "query")
        .map((p) => ({ key: p.name, value: p.placeholder ?? "", description: p.desc, disabled: !p.required }));
      const header = spec.params
        .filter((p) => p.in === "header")
        .map((p) => ({ key: p.name, value: p.placeholder ?? "", description: p.desc, disabled: !p.required }));
      const request: Record<string, unknown> = {
        method: spec.method,
        header,
        url: {
          raw: `{{baseUrl}}${spec.path}`,
          host: ["{{baseUrl}}"],
          path: spec.path.replace(/^\//, "").split("/"),
          query,
        },
        description: spec.title,
      };
      const bodyParams = spec.params.filter((p) => p.in === "body");
      if (bodyParams.length > 0) {
        const obj: Record<string, unknown> = {};
        bodyParams.forEach((p) => {
          obj[p.name] = p.type === "boolean" ? true : (p.placeholder ?? "");
        });
        request.body = {
          mode: "raw",
          raw: JSON.stringify(obj, null, 2),
          options: { raw: { language: "json" } },
        };
      }
      return { name: `${spec.method} ${spec.path}`, request, response: [] as unknown[] };
    }),
  };
}

function downloadCollection() {
  const blob = new Blob([JSON.stringify(buildPostmanCollection(), null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "tempmail-api.postman_collection.json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------------------
// UI components
// ---------------------------------------------------------------------------

function CodeBlock({ children, lang = "bash" }: { children: string; lang?: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const onCopy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    toast({ title: "Disalin ke clipboard" });
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group rounded-lg border border-border bg-muted/40 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-muted/60">
        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{lang}</span>
        <button onClick={onCopy} className="text-muted-foreground hover:text-foreground transition-colors">
          {copied ? <CheckCircle2 className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
        </button>
      </div>
      <pre className="p-3 text-xs font-mono leading-relaxed overflow-x-auto whitespace-pre-wrap break-all">
        <code>{children}</code>
      </pre>
    </div>
  );
}

const LOC_LABELS: Record<ParamLoc, string> = { query: "Query Params", header: "Headers", body: "Body (JSON)" };

function ParamTable({ params }: { params: DocParam[] }) {
  const locs: ParamLoc[] = ["query", "header", "body"];
  return (
    <div className="space-y-3">
      {locs.map((loc) => {
        const rows = params.filter((p) => p.in === loc);
        if (rows.length === 0) return null;
        return (
          <div key={loc}>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">{LOC_LABELS[loc]}</p>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold">Parameter</th>
                    <th className="text-left px-3 py-2 font-semibold hidden sm:table-cell">Tipe</th>
                    <th className="text-left px-3 py-2 font-semibold">Keterangan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((r) => (
                    <tr key={r.name}>
                      <td className="px-3 py-2 font-mono whitespace-nowrap">
                        {r.name}
                        {r.required && <span className="text-red-500 ml-1">*</span>}
                      </td>
                      <td className="px-3 py-2 text-muted-foreground hidden sm:table-cell">{r.in === "header" ? "header" : r.type}</td>
                      <td className="px-3 py-2 text-muted-foreground">{r.desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CodeSamples({ spec, values }: { spec: EndpointSpec; values: Record<string, string> }) {
  const [tab, setTab] = useState<"curl" | "js" | "py">("curl");
  const req = useMemo(() => buildHttpRequest(spec, values), [spec, values]);
  const samples = useMemo(
    () => ({ curl: toCurl(spec, req), js: toJs(spec, req), py: toPy(spec, req) }),
    [spec, req]
  );
  const tabs = [
    { id: "curl" as const, label: "cURL" },
    { id: "js" as const, label: "JavaScript" },
    { id: "py" as const, label: "Python" },
  ];
  return (
    <div>
      <div className="flex items-center gap-1 mb-2">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mr-1">Contoh Kode</p>
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`text-[11px] px-2.5 py-1 rounded-md font-medium transition-colors ${
              tab === t.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <CodeBlock lang={tab === "curl" ? "bash" : tab === "js" ? "javascript" : "python"}>
        {samples[tab]}
      </CodeBlock>
    </div>
  );
}

function TryIt({ spec }: { spec: EndpointSpec }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [resp, setResp] = useState<{ status: number; ms: number; body: string } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const setVal = (name: string, v: string) => setValues((prev) => ({ ...prev, [name]: v }));

  const send = async () => {
    setSending(true);
    setErr(null);
    setResp(null);
    const req = buildHttpRequest(spec, values);
    const t0 = performance.now();
    try {
      const res = await fetch(req.url, { method: spec.method, headers: req.headers, body: req.body });
      const text = await res.text();
      let pretty = text;
      try {
        pretty = JSON.stringify(JSON.parse(text), null, 2);
      } catch {
        /* bukan JSON, tampilkan mentah */
      }
      setResp({ status: res.status, ms: Math.round(performance.now() - t0), body: pretty });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Request gagal dikirim.");
    } finally {
      setSending(false);
    }
  };

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-1.5">
        <Play className="h-3.5 w-3.5" /> Coba Langsung
      </Button>
    );
  }

  const groups: { key: ParamLoc; label: string }[] = [
    { key: "query", label: "Query Params" },
    { key: "header", label: "Headers" },
    { key: "body", label: "Body" },
  ];

  const statusColor =
    resp == null
      ? ""
      : resp.status < 300
        ? "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30"
        : resp.status < 500
          ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30"
          : "bg-red-500/15 text-red-600 dark:text-red-400 border-red-500/30";

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/[0.03] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40">
        <span className="text-xs font-semibold flex items-center gap-1.5">
          <Terminal className="h-3.5 w-3.5 text-primary" /> Coba Langsung
        </span>
        <button
          onClick={() => setOpen(false)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Tutup"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="p-3 sm:p-4 space-y-4">
        {spec.danger && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-2.5 flex gap-2">
            <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700 dark:text-amber-300">{spec.danger}</p>
          </div>
        )}
        {groups.map((g) => {
          const ps = spec.params.filter((p) => p.in === g.key);
          if (ps.length === 0) return null;
          return (
            <div key={g.key}>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">
                {g.label}
              </p>
              <div className="space-y-2">
                {ps.map((p) => (
                  <div key={p.name} className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                    <label className="text-xs font-mono sm:w-40 shrink-0 break-all">
                      {p.name}
                      {p.required && <span className="text-red-500 ml-0.5">*</span>}
                    </label>
                    {p.type === "boolean" ? (
                      <select
                        value={values[p.name] ?? "true"}
                        onChange={(e) => setVal(p.name, e.target.value)}
                        className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-mono sm:max-w-40"
                      >
                        <option value="true">true</option>
                        <option value="false">false</option>
                      </select>
                    ) : (
                      <input
                        value={values[p.name] ?? ""}
                        onChange={(e) => setVal(p.name, e.target.value)}
                        placeholder={p.placeholder}
                        spellCheck={false}
                        autoComplete="off"
                        className="flex-1 min-w-0 rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-mono placeholder:text-muted-foreground/50"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
        <div>
          <Button size="sm" onClick={send} disabled={sending} className="gap-1.5">
            <Play className="h-3.5 w-3.5" /> {sending ? "Mengirim..." : "Kirim Request"}
          </Button>
        </div>
        {err && <p className="text-xs text-red-500">Gagal: {err}</p>}
        {resp && (
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className={`text-[11px] font-bold px-2 py-0.5 rounded border font-mono ${statusColor}`}>
                {resp.status}
              </span>
              <span className="text-[11px] text-muted-foreground font-mono">{resp.ms} ms</span>
            </div>
            <CodeBlock lang="json">{resp.body}</CodeBlock>
          </div>
        )}
        <CodeSamples spec={spec} values={values} />
      </div>
    </div>
  );
}

function EndpointCard({ spec }: { spec: EndpointSpec }) {
  const colors: Record<string, string> = {
    GET: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
    POST: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    PATCH: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    DELETE: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  };
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${colors[spec.method]}`}>{spec.method}</span>
          <code className="text-sm font-mono font-semibold flex-1 min-w-0 break-all">{spec.path}</code>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">{spec.title}</p>
      </div>
      <div className="p-4 space-y-4 text-sm">
        {spec.params.length > 0 && <ParamTable params={spec.params} />}
        {spec.responseExample && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Contoh Response</p>
            <CodeBlock lang="json">{spec.responseExample}</CodeBlock>
          </div>
        )}
        <TryIt spec={spec} />
      </div>
    </div>
  );
}

const NAV_SECTIONS = [
  { id: "intro", label: "Pengenalan", icon: Book },
  { id: "auth", label: "Autentikasi", icon: Lock },
  { id: "generate", label: "Generate Email", icon: Mail },
  { id: "inbox", label: "Lihat Inbox", icon: Inbox },
  { id: "message", label: "Kelola Pesan", icon: FileText },
  { id: "domains", label: "Daftar Domain", icon: Globe },
  { id: "stats", label: "Statistik", icon: Server },
  { id: "extend", label: "Perpanjang Email", icon: Zap },
  { id: "reset", label: "Hapus Inbox", icon: AlertCircle },
  { id: "destroy", label: "Musnahkan Email", icon: AlertCircle },
  { id: "blacklist", label: "Blacklist", icon: AlertCircle },
  { id: "webhooks", label: "Webhook", icon: Webhook },
  { id: "errors", label: "Kode Error", icon: AlertCircle },
];

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
      {/* Mobile section nav — the sidebar is desktop-only */}
      <div className="lg:hidden sticky top-16 sm:top-14 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b border-border/60">
        <nav className="flex gap-1.5 overflow-x-auto px-4 py-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {NAV_SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="shrink-0 text-[11px] font-medium px-2.5 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/60 active:bg-primary/10 transition-colors"
            >
              {s.label}
            </a>
          ))}
        </nav>
      </div>
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 py-6 md:py-10">
        <div className="grid lg:grid-cols-[220px_1fr] gap-8">
          {/* Sidebar — sticky on desktop */}
          <aside className="hidden lg:block">
            <div className="sticky top-20 space-y-1">
              <div className="flex items-center gap-2 mb-4">
                <Code2 className="h-5 w-5 text-primary" />
                <h2 className="font-bold text-sm">Daftar Isi</h2>
              </div>
              <nav className="space-y-0.5">
                {NAV_SECTIONS.map((s) => (
                  <a
                    key={s.id}
                    href={`#${s.id}`}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <s.icon className="h-3.5 w-3.5" />
                    {s.label}
                  </a>
                ))}
              </nav>
            </div>
          </aside>

          {/* Content */}
          <div className="space-y-12 min-w-0">
            {/* Header */}
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs">
                <Link href="/" className="text-muted-foreground hover:text-foreground">
                  Beranda
                </Link>
                <ChevronRight className="h-3 w-3 text-muted-foreground" />
                <span className="text-foreground font-medium">Dokumentasi API</span>
              </div>
              <h1 className="text-3xl md:text-4xl font-bold flex items-center gap-3">
                <Code2 className="h-8 w-8 text-primary" />
                Dokumentasi API
              </h1>
              <p className="text-base text-muted-foreground">
                Integrasikan layanan email sementara ke aplikasi Anda menggunakan REST API yang sederhana.
                Setiap endpoint bisa dicoba langsung dari halaman ini.
              </p>
              <div className="flex gap-2 pt-2 flex-wrap">
                <Link href="/developer">
                  <Button size="sm" className="gap-1.5">
                    <Key className="h-4 w-4" />
                    Dapatkan API Key
                  </Button>
                </Link>
                <Button size="sm" variant="outline" className="gap-1.5" onClick={downloadCollection}>
                  <Download className="h-4 w-4" />
                  Collection Postman
                </Button>
                <a href="#generate">
                  <Button size="sm" variant="ghost" className="gap-1.5">
                    Mulai Cepat <ChevronRight className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>

            {/* Pengenalan */}
            <section id="intro" className="space-y-4 scroll-mt-28 lg:scroll-mt-20">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Book className="h-6 w-6 text-primary" /> Pengenalan
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                API ini memungkinkan Anda membuat alamat email sementara, menerima pesan masuk,
                membaca isi email, dan mengelola inbox secara terprogram.
                Semua endpoint mengembalikan respons dalam format <code className="bg-muted px-1.5 py-0.5 rounded text-xs">JSON</code>.
              </p>
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="rounded-xl border border-border p-4 bg-muted/20">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Base URL</p>
                  <code className="text-sm font-mono break-all">{getFullBase()}/api</code>
                </div>
                <div className="rounded-xl border border-border p-4 bg-muted/20">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Format</p>
                  <code className="text-sm font-mono">application/json</code>
                </div>
              </div>
            </section>

            {/* Autentikasi */}
            <section id="auth" className="space-y-4 scroll-mt-28 lg:scroll-mt-20">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Lock className="h-6 w-6 text-primary" /> Autentikasi
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Semua request ke endpoint terproteksi membutuhkan API key di header
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs mx-1">X-API-Key</code>.
                API key dapat dibuat di halaman <Link href="/developer" className="text-primary underline-offset-2 hover:underline">Developer Tools</Link> setelah login.
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Operasi yang mengubah data sebuah alamat (hapus/arsip pesan, blacklist, perpanjang, reset, musnahkan)
                butuh bukti kepemilikan: header
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs mx-1">X-Manage-Token</code> yang
                diterbitkan saat alamat dibuat via <code className="bg-muted px-1.5 py-0.5 rounded text-xs">/generate</code>.
                Pengguna login otomatis terotentikasi via session.
              </p>
<CodeBlock lang="curl">{`curl -H "X-API-Key: <redacted>
  ${getFullBase()}/api/email/generate`}</CodeBlock>
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 flex gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Jangan pernah membagikan API key Anda di kode publik (GitHub, frontend website, dll).
                  Simpan di environment variable di server.
                </p>
              </div>
            </section>

            {/* Endpoint sections (data-driven) */}
            {SECTIONS.map((s) => (
              <section key={s.id} id={s.id} className="space-y-4 scroll-mt-28 lg:scroll-mt-20">
                <h2 className="text-2xl font-bold flex items-center gap-2">
                  <s.icon className="h-6 w-6 text-primary" /> {s.label}
                </h2>
                {s.intro}
                {ENDPOINTS.filter((e) => e.section === s.id).map((e) => (
                  <EndpointCard key={e.id} spec={e} />
                ))}
              </section>
            ))}

            {/* Webhooks */}
            <section id="webhooks" className="space-y-4 scroll-mt-28 lg:scroll-mt-20">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Webhook className="h-6 w-6 text-primary" /> Webhook
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Webhook memungkinkan server Anda menerima notifikasi otomatis saat ada email masuk.
                Kami akan mengirim HTTP POST ke URL yang Anda daftarkan setiap kali pesan baru tiba.
              </p>

              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" /> Format Payload yang Kami Kirim
                </h3>
                <CodeBlock lang="json">{`{
  "event": "new_message",
  "data": {
    "messageId": "uuid-pesan",
    "from": "sender@example.com",
    "to": "you@bakmi.my.id",
    "subject": "Hello",
    "preview": "Cuplikan singkat isi pesan...",
    "receivedAt": "2026-09-28T09:30:00.000Z"
  }
}`}</CodeBlock>
                <p className="text-xs text-muted-foreground">
                  Header <code className="bg-muted px-1 rounded">X-Webhook-Signature</code> berisi HMAC SHA-256
                  dari body, untuk verifikasi keaslian request. Daftarkan endpoint di halaman Developer Tools.
                </p>
              </div>
            </section>

            {/* Errors */}
            <section id="errors" className="space-y-4 scroll-mt-28 lg:scroll-mt-20">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-primary" /> Kode Status & Error
              </h2>
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Kode</th>
                      <th className="text-left px-3 py-2 font-semibold">Arti</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border text-xs">
                    <tr><td className="px-3 py-2 font-mono">200</td><td className="px-3 py-2 text-muted-foreground">Berhasil.</td></tr>
                    <tr><td className="px-3 py-2 font-mono">400</td><td className="px-3 py-2 text-muted-foreground">Parameter tidak valid atau hilang.</td></tr>
                    <tr><td className="px-3 py-2 font-mono">401</td><td className="px-3 py-2 text-muted-foreground">API key tidak ada atau salah.</td></tr>
                    <tr><td className="px-3 py-2 font-mono">403</td><td className="px-3 py-2 text-muted-foreground">Akses ditolak (misal: bukan pemilik resource).</td></tr>
                    <tr><td className="px-3 py-2 font-mono">404</td><td className="px-3 py-2 text-muted-foreground">Resource tidak ditemukan.</td></tr>
                    <tr><td className="px-3 py-2 font-mono">410</td><td className="px-3 py-2 text-muted-foreground">Email sudah kedaluwarsa.</td></tr>
                    <tr><td className="px-3 py-2 font-mono">429</td><td className="px-3 py-2 text-muted-foreground">Terlalu banyak request — coba lagi nanti.</td></tr>
                    <tr><td className="px-3 py-2 font-mono">500</td><td className="px-3 py-2 text-muted-foreground">Kesalahan internal server.</td></tr>
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">
                Format respons error standar:
              </p>
              <CodeBlock lang="json">{`{
  "error": "Bad request",
  "message": "Penjelasan singkat masalahnya"
}`}</CodeBlock>
            </section>

            {/* Footer CTA */}
            <div className="rounded-2xl border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 p-6 text-center space-y-3 mt-8">
              <h3 className="font-bold text-lg">Siap Mulai Mengintegrasikan?</h3>
              <p className="text-sm text-muted-foreground">Buat API key gratis dan mulai pakai dalam beberapa menit.</p>
              <div className="flex gap-2 justify-center flex-wrap">
                <Link href="/developer">
                  <Button className="gap-1.5">
                    <Key className="h-4 w-4" /> Dapatkan API Key
                  </Button>
                </Link>
                <Button variant="outline" className="gap-1.5" onClick={downloadCollection}>
                  <Download className="h-4 w-4" /> Collection Postman
                </Button>
                <Link href="/dashboard">
                  <Button variant="ghost" className="gap-1.5">
                    Buka Dashboard <ExternalLink className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
