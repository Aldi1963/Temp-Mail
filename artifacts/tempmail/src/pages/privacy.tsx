import { ArrowLeft, Shield } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function PrivacyPage() {
  const [, navigate] = useLocation();

  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="container max-w-3xl mx-auto px-4 py-10">
        <Button variant="ghost" size="sm" className="mb-6 gap-2" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
          Kembali ke Beranda
        </Button>

        <div className="flex items-center gap-3 mb-8">
          <div className="bg-primary/10 p-2.5 rounded-lg">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Kebijakan Privasi</h1>
            <p className="text-sm text-muted-foreground">Terakhir diperbarui: April 2025</p>
          </div>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-lg font-semibold mb-3">1. Pendahuluan</h2>
            <p className="text-muted-foreground leading-relaxed">
              TempMail menyediakan layanan email sementara yang memungkinkan Anda menerima email tanpa perlu mendaftarkan alamat email pribadi.
              Kami berkomitmen untuk melindungi privasi Anda. Kebijakan ini menjelaskan informasi apa yang kami kumpulkan dan cara kami menggunakannya.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">2. Informasi yang Kami Kumpulkan</h2>
            <ul className="space-y-2 text-muted-foreground list-disc list-inside">
              <li><strong className="text-foreground">Alamat Email Sementara:</strong> Alamat yang dibuat secara acak untuk sesi Anda.</li>
              <li><strong className="text-foreground">Konten Email:</strong> Isi pesan yang masuk ke alamat email sementara Anda disimpan sementara.</li>
              <li><strong className="text-foreground">Data Akun (Opsional):</strong> Jika Anda mendaftar, kami menyimpan email, nama, dan kata sandi yang dienkripsi.</li>
              <li><strong className="text-foreground">Log Teknis:</strong> Alamat IP dan data penggunaan untuk keperluan keamanan dan performa.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">3. Cara Kami Menggunakan Informasi</h2>
            <ul className="space-y-2 text-muted-foreground list-disc list-inside">
              <li>Menyampaikan email yang masuk ke inbox sementara Anda.</li>
              <li>Mengelola akun dan autentikasi pengguna.</li>
              <li>Mendeteksi dan mencegah penyalahgunaan layanan.</li>
              <li>Meningkatkan performa dan keandalan platform.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">4. Penyimpanan dan Penghapusan Data</h2>
            <p className="text-muted-foreground leading-relaxed">
              Email yang masuk ke alamat sementara Anda akan otomatis dihapus setelah masa aktif berakhir (biasanya 24–72 jam tergantung pengaturan).
              Data akun disimpan selama akun masih aktif. Anda dapat menghapus akun kapan saja melalui halaman profil.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">5. Keamanan Data</h2>
            <p className="text-muted-foreground leading-relaxed">
              Kami menggunakan enkripsi untuk kata sandi, sesi terautentikasi, dan koneksi HTTPS. Meski demikian, tidak ada sistem yang 100% aman.
              Kami menyarankan Anda untuk tidak menggunakan layanan ini untuk informasi yang sangat sensitif.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">6. Berbagi Data dengan Pihak Ketiga</h2>
            <p className="text-muted-foreground leading-relaxed">
              Kami tidak menjual, menyewakan, atau membagikan data pribadi Anda kepada pihak ketiga untuk tujuan pemasaran.
              Data hanya dapat dibagikan jika diwajibkan oleh hukum yang berlaku.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">7. Cookie</h2>
            <p className="text-muted-foreground leading-relaxed">
              TempMail menggunakan cookie yang diperlukan untuk autentikasi dan menjaga sesi pengguna. Kami tidak menggunakan cookie pihak ketiga untuk iklan.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">8. Hak Pengguna</h2>
            <p className="text-muted-foreground leading-relaxed">
              Anda berhak untuk mengakses, mengubah, atau menghapus data pribadi Anda. Untuk permintaan penghapusan data atau pertanyaan privasi,
              silakan hubungi kami melalui saluran dukungan yang tersedia.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">9. Perubahan Kebijakan</h2>
            <p className="text-muted-foreground leading-relaxed">
              Kami dapat memperbarui kebijakan ini dari waktu ke waktu. Perubahan signifikan akan diberitahukan melalui notifikasi di aplikasi.
              Penggunaan layanan setelah pembaruan berarti Anda menyetujui kebijakan yang baru.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} TempMail</span>
          <a href="/terms" className="hover:text-foreground transition-colors">Syarat Layanan →</a>
        </div>
      </div>
    </div>
  );
}
