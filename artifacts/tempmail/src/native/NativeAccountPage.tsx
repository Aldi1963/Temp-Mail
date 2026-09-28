// Halaman Akun fullscreen khusus aplikasi native.
// Dibuka langsung dari tombol akun di header (tanpa lewat tab Lainnya).
import { ArrowLeft, LogOut, ShieldCheck } from "lucide-react";
import { useNativeAuth } from "./useNativeAuth";

export function NativeAccountPage({ onBack, onSwitchAccount }: { onBack: () => void; onSwitchAccount: () => void }) {
  const { user, logout } = useNativeAuth();

  const handleLogout = () => {
    void logout().then(() => onBack());
  };

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain bg-background">
      {/* Header halaman */}
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/60">
        <div className="flex items-center gap-1 pl-2 pr-1 h-14">
          <button
            aria-label="Kembali"
            onClick={onBack}
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-accent"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-[17px] font-extrabold tracking-tight flex-1">
            Akun Saya
          </span>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {user?.email ? (
          <>
            <div className="rounded-3xl bg-primary/[0.08] border border-primary/20 p-5 flex flex-col items-center text-center gap-2">
              <span className="w-16 h-16 rounded-full bg-primary/15 text-primary text-[26px] font-extrabold flex items-center justify-center">
                {user.email[0].toUpperCase()}
              </span>
              <div className="text-[16px] font-extrabold break-all">{user.email}</div>
              <div className="inline-flex items-center gap-1 text-[11px] text-muted-foreground bg-muted rounded-full px-2.5 py-1">
                <ShieldCheck className="h-3 w-3" />
                {user.role === "admin" ? "Administrator" : "Akun tersimpan permanen"}
              </div>
            </div>
            <button
              onClick={onSwitchAccount}
              className="w-full rounded-2xl border border-border p-4 text-[14px] font-bold active:bg-muted"
            >
              Ganti Akun
            </button>
            <button
              onClick={handleLogout}
              className="w-full rounded-2xl bg-destructive/10 text-destructive p-4 text-[14px] font-bold inline-flex items-center justify-center gap-2 active:scale-[0.99]"
            >
              <LogOut className="h-4 w-4" />
              Keluar
            </button>
          </>
        ) : (
          <div className="text-center text-muted-foreground text-[14px] py-8">
            Belum masuk.
          </div>
        )}
      </div>
    </div>
  );
}
