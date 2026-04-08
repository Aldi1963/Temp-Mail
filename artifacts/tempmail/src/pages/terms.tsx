import { ArrowLeft, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";

export default function TermsPage() {
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
            <FileText className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Syarat Layanan</h1>
            <p className="text-sm text-muted-foreground">Terakhir diperbarui: April 2025</p>
          </div>
        </div>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-lg font-semibold mb-3">1. Penerimaan Syarat</h2>
            <p className="text-muted-foreground leading-relaxed">
              Dengan menggunakan layanan TempMail, Anda menyetujui syarat dan ketentuan yang berlaku di halaman ini.
              Jika Anda tidak menyetujui syarat ini, harap tidak menggunakan layanan kami.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">2. Deskripsi Layanan</h2>
            <p className="text-muted-foreground leading-relaxed">
              TempMail adalah layanan email sementara yang memungkinkan pengguna menerima email tanpa menggunakan alamat email pribadi.
              Layanan ini gratis dan dimaksudkan untuk penggunaan sah seperti mendaftar ke situs web, uji coba, atau menghindari spam.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">3. Penggunaan yang Dilarang</h2>
            <p className="text-muted-foreground leading-relaxed mb-3">
              Anda dilarang menggunakan TempMail untuk aktivitas berikut:
            </p>
            <ul className="space-y-2 text-muted-foreground list-disc list-inside">
              <li>Penipuan, phishing, atau aktivitas ilegal lainnya.</li>
              <li>Mengirim atau menerima spam secara massal.</li>
              <li>Mendistribusikan malware, virus, atau kode berbahaya.</li>
              <li>Melanggar hak cipta atau kekayaan intelektual pihak lain.</li>
              <li>Menyalahgunakan API atau mengakses sistem secara tidak sah.</li>
              <li>Aktivitas apa pun yang melanggar hukum yang berlaku di negara Anda.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">4. Tidak Ada Jaminan Kerahasiaan</h2>
            <p className="text-muted-foreground leading-relaxed">
              Email sementara pada dasarnya bersifat publik dan tidak terenkripsi secara end-to-end. Jangan gunakan layanan ini untuk
              menerima informasi sensitif seperti data keuangan, dokumen rahasia, atau komunikasi bisnis penting.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">5. Ketersediaan Layanan</h2>
            <p className="text-muted-foreground leading-relaxed">
              Kami berusaha menjaga layanan tetap berjalan 24/7, namun tidak menjamin uptime 100%. Layanan dapat sewaktu-waktu mengalami
              gangguan untuk pemeliharaan, pembaruan, atau alasan teknis lainnya. TempMail tidak bertanggung jawab atas kerugian yang disebabkan
              oleh ketidaktersediaan layanan.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">6. Masa Aktif dan Penghapusan Email</h2>
            <p className="text-muted-foreground leading-relaxed">
              Alamat email sementara memiliki masa aktif terbatas. Email yang sudah kadaluarsa atau alamat yang tidak aktif akan otomatis
              dihapus dari sistem. Kami tidak menyimpan email setelah masa aktif berakhir.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">7. Akun Pengguna</h2>
            <p className="text-muted-foreground leading-relaxed">
              Jika Anda mendaftar akun, Anda bertanggung jawab atas keamanan kredensial login Anda. Akun yang terbukti melanggar syarat layanan
              dapat ditangguhkan atau dihapus tanpa pemberitahuan sebelumnya.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">8. Batasan Tanggung Jawab</h2>
            <p className="text-muted-foreground leading-relaxed">
              TempMail tidak bertanggung jawab atas kerusakan, kerugian, atau konsekuensi apa pun yang timbul dari penggunaan atau
              ketidakmampuan menggunakan layanan ini, termasuk hilangnya email atau data akun.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">9. Perubahan Layanan dan Syarat</h2>
            <p className="text-muted-foreground leading-relaxed">
              Kami berhak mengubah, menangguhkan, atau menghentikan layanan kapan saja. Syarat layanan juga dapat diperbarui; versi terbaru
              selalu tersedia di halaman ini. Penggunaan layanan setelah pembaruan berarti Anda menyetujui syarat yang baru.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold mb-3">10. Hukum yang Berlaku</h2>
            <p className="text-muted-foreground leading-relaxed">
              Syarat layanan ini tunduk pada hukum yang berlaku. Sengketa yang timbul akan diselesaikan melalui mekanisme yang disepakati bersama.
            </p>
          </section>
        </div>

        <div className="mt-10 pt-6 border-t border-border flex justify-between items-center text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} TempMail</span>
          <a href="/privacy" className="hover:text-foreground transition-colors">← Kebijakan Privasi</a>
        </div>
      </div>
    </div>
  );
}
