import { Mail } from "lucide-react";

export const NATIVE_APP_VERSION = "v1.1.0";

export function NativeAboutPage() {
  return (
    <div className="px-6 pt-8 pb-4 flex flex-col items-center text-center">
      <span className="w-20 h-20 rounded-[22px] bg-primary flex items-center justify-center mb-4">
        <Mail className="h-9 w-9 text-primary-foreground" />
      </span>
      <h1 className="text-[22px] font-extrabold tracking-tight">TempMail</h1>
      <p className="text-[12px] text-muted-foreground mt-1 font-semibold">{NATIVE_APP_VERSION} · Android</p>

      <div className="mt-6 space-y-3 text-left w-full">
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
          TempMail membuat alamat email sekali pakai dalam sekali ketuk. Cocok untuk
          mendaftar layanan, menerima kode OTP, dan menghindari spam di inbox utama.
        </p>
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
          Masuk dengan akun untuk menyimpan alamat dan riwayat pesan permanen, lalu
          sinkronkan ke semua perangkat.
        </p>
        <p className="text-[13.5px] leading-relaxed text-muted-foreground">
          Pesan yang sudah kedaluwarsa terhapus otomatis dari server.
        </p>
      </div>

      <p className="text-[11px] text-muted-foreground mt-8">© 2026 TempMail</p>
    </div>
  );
}
