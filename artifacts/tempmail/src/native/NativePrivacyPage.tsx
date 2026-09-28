import { ShieldCheck } from "lucide-react";

const POINTS = [
  "Alamat email sementara dibuat tanpa data pribadi — cukup ketuk, langsung jadi.",
  "Isi pesan hanya tersimpan sementara di server dan terhapus otomatis setelah kedaluwarsa.",
  "Kode OTP yang disalin otomatis tidak pernah dikirim ke mana pun.",
  "Kunci PIN tersimpan hanya di HP ini, tidak dikirim ke server.",
  "Masuk akun bersifat opsional; mode guest tetap bisa dipakai penuh.",
  "Kami tidak menjual atau membagikan data pengguna ke pihak ketiga.",
  "Hapus alamat kapan saja dari tab Alamat Saya untuk memutus riwayatnya.",
];

export function NativePrivacyPage() {
  return (
    <div className="px-4 pt-4">
      <div className="rounded-3xl bg-primary/[0.08] border border-primary/20 p-4 flex items-center gap-3 mb-3">
        <span className="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center shrink-0">
          <ShieldCheck className="h-5 w-5 text-primary" />
        </span>
        <p className="text-[13px] font-bold leading-snug">
          Privasi kamu prioritas utama aplikasi ini.
        </p>
      </div>
      <div className="space-y-2">
        {POINTS.map((p, i) => (
          <div key={i} className="flex gap-3 rounded-2xl bg-card border border-border/70 px-4 py-3">
            <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-[12px] font-extrabold flex items-center justify-center shrink-0">
              {i + 1}
            </span>
            <p className="text-[13px] leading-relaxed text-muted-foreground">{p}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
