import { useState, ReactNode } from "react";
import { Link } from "wouter";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Book, Code2, Key, Webhook, Mail, Inbox, FileText, Server, AlertCircle,
  CheckCircle2, Copy, ChevronRight, ExternalLink, Zap, Lock, Globe,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

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

function Endpoint({
  method, path, title, children,
}: {
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  path: string;
  title: string;
  children: ReactNode;
}) {
  const colors: Record<string, string> = {
    GET: "bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/30",
    POST: "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30",
    PUT: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
    PATCH: "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30",
    DELETE: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  };
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${colors[method]}`}>{method}</span>
          <code className="text-sm font-mono font-semibold flex-1 min-w-0 break-all">{path}</code>
        </div>
        <p className="text-xs text-muted-foreground mt-1.5">{title}</p>
      </div>
      <div className="p-4 space-y-3 text-sm">{children}</div>
    </div>
  );
}

function ParamTable({ rows }: { rows: { name: string; type: string; required?: boolean; desc: string }[] }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left px-3 py-2 font-semibold">Parameter</th>
            <th className="text-left px-3 py-2 font-semibold">Tipe</th>
            <th className="text-left px-3 py-2 font-semibold">Keterangan</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r) => (
            <tr key={r.name}>
              <td className="px-3 py-2 font-mono">
                {r.name}
                {r.required && <span className="text-red-500 ml-1">*</span>}
              </td>
              <td className="px-3 py-2 text-muted-foreground">{r.type}</td>
              <td className="px-3 py-2 text-muted-foreground">{r.desc}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const NAV_SECTIONS = [
  { id: "intro", label: "Pengenalan", icon: Book },
  { id: "auth", label: "Autentikasi", icon: Lock },
  { id: "generate", label: "Generate Email", icon: Mail },
  { id: "inbox", label: "Lihat Inbox", icon: Inbox },
  { id: "message", label: "Baca Pesan", icon: FileText },
  { id: "domains", label: "Daftar Domain", icon: Globe },
  { id: "stats", label: "Statistik", icon: Server },
  { id: "extend", label: "Perpanjang Email", icon: Zap },
  { id: "reset", label: "Hapus Inbox", icon: AlertCircle },
  { id: "blacklist", label: "Blacklist", icon: AlertCircle },
  { id: "webhooks", label: "Webhook", icon: Webhook },
  { id: "errors", label: "Kode Error", icon: AlertCircle },
];

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header />
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
                <Link href="/">
                  <a className="text-muted-foreground hover:text-foreground">Beranda</a>
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
              </p>
              <div className="flex gap-2 pt-2">
                <Link href="/developer">
                  <Button size="sm" className="gap-1.5">
                    <Key className="h-4 w-4" />
                    Dapatkan API Key
                  </Button>
                </Link>
                <a href="#generate">
                  <Button size="sm" variant="outline" className="gap-1.5">
                    Mulai Cepat <ChevronRight className="h-4 w-4" />
                  </Button>
                </a>
              </div>
            </div>

            {/* Pengenalan */}
            <section id="intro" className="space-y-4 scroll-mt-20">
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
                  <code className="text-sm font-mono break-all">{window.location.origin}/api</code>
                </div>
                <div className="rounded-xl border border-border p-4 bg-muted/20">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Format</p>
                  <code className="text-sm font-mono">application/json</code>
                </div>
              </div>
            </section>

            {/* Autentikasi */}
            <section id="auth" className="space-y-4 scroll-mt-20">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Lock className="h-6 w-6 text-primary" /> Autentikasi
              </h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Semua request ke endpoint terproteksi membutuhkan API key di header
                <code className="bg-muted px-1.5 py-0.5 rounded text-xs mx-1">X-API-Key</code>.
                API key dapat dibuat di halaman <Link href="/developer" className="text-primary underline-offset-2 hover:underline">Developer Tools</Link> setelah login.
              </p>
              <CodeBlock lang="curl">{`curl -H "X-API-Key: tmk_your_key_here" \\
  ${window.location.origin}/api/email/generate`}</CodeBlock>
              <div className="rounded-lg border border-amber-500/40 bg-amber-500/5 p-3 flex gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Jangan pernah membagikan API key Anda di kode publik (GitHub, frontend website, dll).
                  Simpan di environment variable di server.
                </p>
              </div>
            </section>

            {/* Generate Email */}
            <section id="generate" className="space-y-4 scroll-mt-20">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Mail className="h-6 w-6 text-primary" /> Generate Email Sementara
              </h2>
              <Endpoint method="GET" path="/api/email/generate" title="Membuat alamat email sementara baru atau memperpanjang masa aktif yang sudah ada">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Query Parameters</p>
                  <ParamTable rows={[
                    { name: "username", type: "string", desc: "Username kustom (a-z, 0-9, ._-) maks 30 karakter. Opsional." },
                    { name: "domain", type: "string", desc: "Domain dari daftar yang tersedia. Opsional." },
                  ]} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contoh Request</p>
                  <CodeBlock lang="curl">{`curl "${window.location.origin}/api/email/generate?username=john&domain=tmpmail.dev" \\
  -H "X-API-Key: tmk_xxx"`}</CodeBlock>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contoh Response</p>
                  <CodeBlock lang="json">{`{
  "email": "john@tmpmail.dev",
  "username": "john",
  "domain": "tmpmail.dev",
  "expiresAt": "2026-04-25T03:30:00.000Z",
  "createdAt": "2026-04-25T03:20:00.000Z"
}`}</CodeBlock>
                </div>
              </Endpoint>
            </section>

            {/* Inbox */}
            <section id="inbox" className="space-y-4 scroll-mt-20">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Inbox className="h-6 w-6 text-primary" /> Lihat Inbox
              </h2>
              <Endpoint method="GET" path="/api/email/inbox?email=..." title="Mengambil daftar pesan yang masuk ke alamat email tertentu">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Query Parameters</p>
                  <ParamTable rows={[
                    { name: "email", type: "string", required: true, desc: "Alamat email yang inbox-nya ingin dilihat." },
                  ]} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contoh Response</p>
                  <CodeBlock lang="json">{`{
  "email": "john@tmpmail.dev",
  "messages": [
    {
      "id": "uuid-pesan-1",
      "from": "newsletter@github.com",
      "subject": "Verifikasi akun Anda",
      "preview": "Halo, terima kasih telah mendaftar...",
      "receivedAt": "2026-04-25T03:25:00.000Z",
      "isRead": false,
      "hasAttachments": false
    }
  ],
  "total": 1,
  "unreadCount": 1
}`}</CodeBlock>
                </div>
              </Endpoint>
            </section>

            {/* Message */}
            <section id="message" className="space-y-4 scroll-mt-20">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <FileText className="h-6 w-6 text-primary" /> Baca Detail Pesan
              </h2>
              <Endpoint method="GET" path="/api/email/message?id=...&email=..." title="Mengambil isi lengkap sebuah pesan termasuk HTML body dan lampiran">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Query Parameters</p>
                  <ParamTable rows={[
                    { name: "id", type: "string", required: true, desc: "ID pesan dari endpoint /inbox." },
                    { name: "email", type: "string", required: true, desc: "Alamat email pemilik pesan." },
                  ]} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contoh Response</p>
                  <CodeBlock lang="json">{`{
  "id": "uuid-pesan-1",
  "email": "john@tmpmail.dev",
  "from": "newsletter@github.com",
  "to": "john@tmpmail.dev",
  "subject": "Verifikasi akun Anda",
  "textBody": "Kode verifikasi: 482917",
  "htmlBody": "<html>...</html>",
  "receivedAt": "2026-04-25T03:25:00.000Z",
  "isRead": false,
  "attachments": []
}`}</CodeBlock>
                </div>
              </Endpoint>
            </section>

            {/* Domains */}
            <section id="domains" className="space-y-4 scroll-mt-20">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Globe className="h-6 w-6 text-primary" /> Daftar Domain
              </h2>
              <Endpoint method="GET" path="/api/email/domains" title="Mengambil daftar domain yang tersedia untuk membuat alamat email">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contoh Response</p>
                  <CodeBlock lang="json">{`{
  "domains": ["tmpmail.dev", "quickmail.io", "throwaway.net"]
}`}</CodeBlock>
                </div>
              </Endpoint>
            </section>

            {/* Stats */}
            <section id="stats" className="space-y-4 scroll-mt-20">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Server className="h-6 w-6 text-primary" /> Statistik Email
              </h2>
              <Endpoint method="GET" path="/api/email/stats?email=..." title="Mengambil statistik penggunaan untuk satu alamat email (jumlah pesan, pengirim teratas, dll)">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Query Parameters</p>
                  <ParamTable rows={[
                    { name: "email", type: "string", required: true, desc: "Alamat email yang ingin dilihat statistiknya." },
                  ]} />
                </div>
              </Endpoint>
            </section>

            {/* Extend */}
            <section id="extend" className="space-y-4 scroll-mt-20">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Zap className="h-6 w-6 text-primary" /> Perpanjang Masa Aktif
              </h2>
              <Endpoint method="POST" path="/api/email/extend" title="Memperpanjang masa aktif alamat email sebelum kedaluwarsa">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Body (JSON)</p>
                  <ParamTable rows={[
                    { name: "email", type: "string", required: true, desc: "Alamat email yang ingin diperpanjang." },
                  ]} />
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Contoh Request</p>
                  <CodeBlock lang="curl">{`curl -X POST "${window.location.origin}/api/email/extend" \\
  -H "X-API-Key: tmk_xxx" \\
  -H "Content-Type: application/json" \\
  -d '{"email":"john@tmpmail.dev"}'`}</CodeBlock>
                </div>
              </Endpoint>
            </section>

            {/* Reset */}
            <section id="reset" className="space-y-4 scroll-mt-20">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-primary" /> Hapus Semua Pesan
              </h2>
              <Endpoint method="DELETE" path="/api/email/reset?email=..." title="Menghapus semua pesan dari inbox sebuah alamat email">
                <ParamTable rows={[
                  { name: "email", type: "string", required: true, desc: "Alamat email yang inbox-nya ingin dikosongkan." },
                ]} />
              </Endpoint>
            </section>

            {/* Blacklist */}
            <section id="blacklist" className="space-y-4 scroll-mt-20">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <AlertCircle className="h-6 w-6 text-primary" /> Blacklist Pengirim
              </h2>
              <p className="text-sm text-muted-foreground">Blokir email dari domain atau pengirim tertentu agar tidak masuk inbox.</p>

              <Endpoint method="GET" path="/api/email/blacklist?email=..." title="Lihat daftar pengirim yang diblokir">
                <ParamTable rows={[
                  { name: "email", type: "string", required: true, desc: "Alamat email pemilik blacklist." },
                ]} />
              </Endpoint>

              <Endpoint method="POST" path="/api/email/blacklist" title="Tambah pengirim ke blacklist">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Body (JSON)</p>
                <ParamTable rows={[
                  { name: "email", type: "string", required: true, desc: "Alamat email pemilik." },
                  { name: "pattern", type: "string", required: true, desc: "Email pengirim atau @domain.com (untuk blokir seluruh domain)." },
                ]} />
              </Endpoint>

              <Endpoint method="DELETE" path="/api/email/blacklist" title="Hapus pengirim dari blacklist">
                <ParamTable rows={[
                  { name: "email", type: "string", required: true, desc: "Alamat email pemilik." },
                  { name: "pattern", type: "string", required: true, desc: "Pattern yang ingin dihapus." },
                ]} />
              </Endpoint>
            </section>

            {/* Webhooks */}
            <section id="webhooks" className="space-y-4 scroll-mt-20">
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
    "to": "you@tmpmail.dev",
    "subject": "Hello",
    "preview": "Cuplikan singkat isi pesan...",
    "receivedAt": "2026-04-25T03:30:00.000Z"
  }
}`}</CodeBlock>
                <p className="text-xs text-muted-foreground">
                  Header <code className="bg-muted px-1 rounded">X-Webhook-Signature</code> berisi HMAC SHA-256
                  dari body, untuk verifikasi keaslian request. Daftarkan endpoint di halaman Developer Tools.
                </p>
              </div>
            </section>

            {/* Errors */}
            <section id="errors" className="space-y-4 scroll-mt-20">
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
              <div className="flex gap-2 justify-center">
                <Link href="/developer">
                  <Button className="gap-1.5">
                    <Key className="h-4 w-4" /> Dapatkan API Key
                  </Button>
                </Link>
                <Link href="/dashboard">
                  <Button variant="outline" className="gap-1.5">
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
