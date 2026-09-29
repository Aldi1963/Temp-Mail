// Halaman Developer: kelola webhook & API key. Dibuka dari tab Lainnya.
import { useNativeAuth } from "./useNativeAuth";
import { DeveloperWebhooks } from "./DeveloperWebhooks";
import { DeveloperApiKeys } from "./DeveloperApiKeys";

export function NativeDeveloperPage({ onOpenLogin }: { onOpenLogin: () => void }) {
  const { user } = useNativeAuth();

  if (!user) {
    return (
      <div className="p-4">
        <div className="rounded-3xl border border-border/60 bg-card p-5 text-center">
          <p className="text-[14px] font-extrabold">Masuk dulu untuk membuka Developer</p>
          <p className="text-[12.5px] text-muted-foreground mt-1.5 leading-relaxed">
            Webhook dan API key hanya tersedia untuk akun yang sudah masuk.
          </p>
          <button
            type="button"
            onClick={onOpenLogin}
            className="mt-4 rounded-2xl bg-primary text-primary-foreground text-[13.5px] font-bold px-6 py-2.5 active:scale-[0.97]"
          >
            Masuk / Daftar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4">
      <DeveloperWebhooks />
      <DeveloperApiKeys />
    </div>
  );
}
