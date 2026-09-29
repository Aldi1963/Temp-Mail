import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  ChevronRight,
  CircleUserRound,
  Code2,
  Flame,
  Inbox,
  Info,
  LifeBuoy,
  LogIn,
  LogOut,
  Moon,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  Trash2,
  Zap,
  LockKeyhole,
  PlugZap,
  Send,
  ShieldX,
  Webhook,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useNativeAuth } from "./useNativeAuth";
import { useTheme } from "@/components/theme-provider";
import { useToast } from "@/hooks/use-toast";
import type { NativePage } from "./NativeApp";
import { useNativeSettings, hashPin } from "./settings";
import { PinPad } from "./PinGate";

interface Props {
  onOpenPage: (p: NativePage) => void;
  onOpenLogin: () => void;
  pinFlash?: number;
  registerSubMenuCloser: (fn: (() => boolean) | null) => void;
}

function Toggle({ on, onChange, label }: { on: boolean; onChange: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onChange}
      className={cn(
        "w-11 h-6 rounded-full p-0.5 transition-colors shrink-0",
        on ? "bg-primary" : "bg-muted"
      )}
    >
      <span
        className={cn(
          "block w-5 h-5 rounded-full bg-white shadow transition-transform",
          on && "translate-x-5"
        )}
      />
    </button>
  );
}

function SettingRow({
  icon: Icon,
  label,
  desc,
  children,
}: {
  icon: typeof Zap;
  label: string;
  desc?: string;
  children: ReactNode;
}) {
  return (
    <div className="w-full flex items-center gap-3 rounded-2xl px-3 py-3">
      <span className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-[18px] w-[18px] text-foreground" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13.5px] font-bold">{label}</span>
        {desc && <span className="block text-[11px] text-muted-foreground">{desc}</span>}
      </span>
      {children}
    </div>
  );
}

function MenuRow({
  icon: Icon,
  label,
  desc,
  onClick,
}: {
  icon: typeof Zap;
  label: string;
  desc?: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 rounded-2xl px-3 py-3.5 active:bg-muted/70 text-left"
    >
      <span className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
        <Icon className="h-[18px] w-[18px] text-foreground" />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-[13.5px] font-bold">{label}</span>
        {desc && (
          <span className="block text-[11px] text-muted-foreground">{desc}</span>
        )}
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
    </button>
  );
}

function SubHeader({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack: () => void;
  children: ReactNode;
}) {
  return (
    <div>
      <div
        className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/60"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center gap-1 px-2 h-14">
          <button
            aria-label="Kembali"
            onClick={onBack}
            className="w-10 h-10 rounded-full flex items-center justify-center active:bg-muted"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-[16px] font-extrabold">{title}</span>
        </div>
      </div>
      <div className="px-3 py-3 pb-8">{children}</div>
    </div>
  );
}

type PinFlow = "setup" | "confirm" | "disable" | null;
type SubMenu = "akun" | "pengaturan" | "integrasi" | "pesan" | "bantuan" | null;

export function LainnyaTab({ onOpenPage, onOpenLogin, pinFlash, registerSubMenuCloser }: Props) {
  const { user, logout } = useNativeAuth();
  const { theme, setTheme } = useTheme();
  const { settings, patch } = useNativeSettings();
  const { toast } = useToast();
  const [pinFlow, setPinFlow] = useState<PinFlow>(null);
  const [firstPin, setFirstPin] = useState("");
  const [pinError, setPinError] = useState("");
  const [subMenu, setSubMenu] = useState<SubMenu>(null);
  const pinRowRef = useRef<HTMLDivElement>(null);
  const [pinHighlight, setPinHighlight] = useState(false);

  // Sorot baris PIN saat dibuka dari tombol kunci di Beranda:
  // buka sub-menu Pengaturan dulu, lalu scroll ke baris PIN.
  useEffect(() => {
    if (!pinFlash) return;
    setSubMenu("pengaturan");
    const t1 = window.setTimeout(() => {
      pinRowRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setPinHighlight(true);
    }, 250);
    const t2 = window.setTimeout(() => setPinHighlight(false), 4250);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [pinFlash]);

  // Daftarkan penutup sub-menu ke handler tombol back HP:
  // back dari sub-menu / panel PIN kembali ke daftar menu dulu,
  // bukan langsung loncat ke Beranda.
  useEffect(() => {
    registerSubMenuCloser(() => {
      if (pinFlow) {
        setPinFlow(null);
        setPinError("");
        setFirstPin("");
        return true;
      }
      if (subMenu) {
        setSubMenu(null);
        return true;
      }
      return false;
    });
    return () => registerSubMenuCloser(null);
  }, [registerSubMenuCloser, pinFlow, subMenu]);
  const dark = theme === "dark";

  const pinComplete = async (pin: string) => {
    setPinError("");
    if (pinFlow === "setup") {
      setFirstPin(pin);
      setPinFlow("confirm");
      return;
    }
    try {
      const h = await hashPin(pin);
      if (pinFlow === "confirm") {
        if (pin !== firstPin) {
          setPinError("PIN tidak sama, ulangi dari awal");
          setPinFlow("setup");
          setFirstPin("");
          return;
        }
        patch({ pinEnabled: true, pinHash: h });
        toast({ title: "Kunci PIN diaktifkan" });
        setPinFlow(null);
        setFirstPin("");
      } else if (pinFlow === "disable") {
        if (settings.pinHash && h === settings.pinHash) {
          patch({ pinEnabled: false, pinHash: null });
          toast({ title: "Kunci PIN dimatikan" });
          setPinFlow(null);
        } else {
          setPinError("PIN salah, coba lagi");
        }
      }
    } catch {
      setPinError("Gagal memproses PIN");
    }
  };

  const pinHint =
    pinFlow === "setup"
      ? "Buat PIN 6 digit"
      : pinFlow === "confirm"
        ? "Ulangi PIN untuk konfirmasi"
        : "Masukkan PIN saat ini";

  const accountCard = user?.email ? (
    <div className="rounded-3xl bg-primary/[0.08] border border-primary/20 p-4 flex items-center gap-3">
      <span className="w-11 h-11 rounded-full bg-primary/15 text-primary text-[18px] font-extrabold flex items-center justify-center shrink-0">
        {user.email[0].toUpperCase()}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[14px] font-extrabold truncate">{user.email}</div>
        <div className="text-[11px] text-muted-foreground">
          {user.role === "admin" ? "Administrator" : "Akun tersimpan permanen"}
        </div>
      </div>
      <button
        onClick={() => { void logout(); }}
        className="inline-flex items-center gap-1.5 text-[12px] font-bold text-destructive bg-destructive/10 rounded-xl px-3 py-2 active:scale-[0.97]"
      >
        <LogOut className="h-3.5 w-3.5" />
        Keluar
      </button>
    </div>
  ) : (
    <button
      onClick={onOpenLogin}
      className="w-full rounded-3xl bg-primary text-primary-foreground p-4 flex items-center gap-3 active:scale-[0.99]"
    >
      <span className="w-11 h-11 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
        <LogIn className="h-5 w-5" />
      </span>
      <span className="text-left flex-1">
        <span className="block font-extrabold text-[14px]">Masuk / Daftar</span>
        <span className="block text-[11px] opacity-80">
          Simpan alamat & riwayat pesan permanen
        </span>
      </span>
      <ChevronRight className="h-5 w-5 opacity-70" />
    </button>
  );

  // ---------- Sub-menu: Akun ----------
  if (subMenu === "akun") {
    return (
      <SubHeader title="Akun" onBack={() => setSubMenu(null)}>
        <div className="space-y-1">{accountCard}</div>
      </SubHeader>
    );
  }

  // ---------- Sub-menu: Pengaturan ----------
  if (subMenu === "pengaturan") {
    return (
      <SubHeader title="Pengaturan" onBack={() => setSubMenu(null)}>
        <div className="space-y-0.5">
          <SettingRow
            icon={Zap}
            label="Salin OTP otomatis"
            desc="Kode langsung disalin saat pesan masuk"
          >
            <Toggle
              on={settings.autoCopyOtp}
              onChange={() => patch({ autoCopyOtp: !settings.autoCopyOtp })}
              label="Salin OTP otomatis"
            />
          </SettingRow>
          <SettingRow
            icon={Flame}
            label="Hapus OTP otomatis"
            desc="Pesan OTP dihapus setelah dibaca"
          >
            <Toggle
              on={settings.autoDestroyOtp}
              onChange={() => patch({ autoDestroyOtp: !settings.autoDestroyOtp })}
              label="Hapus OTP otomatis"
            />
          </SettingRow>
          <div
            ref={pinRowRef}
            className={cn(
              "rounded-2xl transition-colors",
              pinHighlight && "ring-2 ring-primary bg-primary/[0.06]"
            )}
          >
            <SettingRow
              icon={LockKeyhole}
              label="Kunci aplikasi dengan PIN"
              desc={settings.pinEnabled ? "Aktif" : "Nonaktif"}
            >
              <Toggle
                on={settings.pinEnabled}
                onChange={() => {
                  setPinError("");
                  setFirstPin("");
                  setPinFlow(settings.pinEnabled ? "disable" : "setup");
                }}
                label="Kunci aplikasi dengan PIN"
              />
            </SettingRow>
          </div>
          <MenuRow
            icon={dark ? Sun : Moon}
            label="Mode gelap"
            desc={dark ? "Aktif" : "Nonaktif"}
            onClick={() => setTheme(dark ? "light" : "dark")}
          />
        </div>

        {pinFlow && (
          <div className="mt-2 rounded-2xl border border-primary/30 bg-primary/[0.05] p-4">
            <div className="flex items-center justify-between mb-4">
              <p className="text-[13px] font-extrabold">
                {settings.pinEnabled ? "Matikan kunci PIN" : "Aktifkan kunci PIN"}
              </p>
              <button
                type="button"
                aria-label="Batal"
                onClick={() => {
                  setPinFlow(null);
                  setPinError("");
                  setFirstPin("");
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground active:bg-muted"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <PinPad onComplete={pinComplete} hint={pinHint} />
            {pinError ? (
              <p className="text-[12px] font-bold text-destructive text-center mt-3">{pinError}</p>
            ) : (
              <p className="text-[12px] text-transparent select-none text-center mt-3">.</p>
            )}
          </div>
        )}
      </SubHeader>
    );
  }

  // ---------- Sub-menu: Integrasi ----------
  if (subMenu === "integrasi") {
    return (
      <SubHeader title="Integrasi" onBack={() => setSubMenu(null)}>
        <div className="space-y-0.5">
          <MenuRow
            icon={Send}
            label="Telegram"
            desc="Pesan diteruskan otomatis ke Telegram"
            onClick={() => onOpenPage("telegram")}
          />
          <MenuRow
            icon={Webhook}
            label="Developer"
            desc="Webhook & API key"
            onClick={() => onOpenPage("developer")}
          />
        </div>
      </SubHeader>
    );
  }

  // ---------- Sub-menu: Pesan ----------
  if (subMenu === "pesan") {
    return (
      <SubHeader title="Pesan" onBack={() => setSubMenu(null)}>
        <div className="space-y-0.5">
          <MenuRow
            icon={Trash2}
            label="Tong Sampah"
            desc="Pesan terhapus, bisa dikembalikan"
            onClick={() => onOpenPage("trash")}
          />
          <MenuRow
            icon={ShieldX}
            label="Blokir Pengirim"
            desc="Sembunyikan pesan dari pengirim tertentu"
            onClick={() => onOpenPage("blocked-senders")}
          />
        </div>
      </SubHeader>
    );
  }

  // ---------- Sub-menu: Bantuan ----------
  if (subMenu === "bantuan") {
    return (
      <SubHeader title="Bantuan" onBack={() => setSubMenu(null)}>
        <div className="space-y-0.5">
          <MenuRow
            icon={Code2}
            label="Dokumentasi API"
            desc="Coba endpoint langsung"
            onClick={() => onOpenPage("api-docs")}
          />
          <MenuRow
            icon={Activity}
            label="Status server"
            desc="Cek kondisi layanan"
            onClick={() => onOpenPage("status")}
          />
          <MenuRow
            icon={Info}
            label="Tentang"
            desc="Info aplikasi TempMail"
            onClick={() => onOpenPage("tentang")}
          />
          <MenuRow
            icon={ShieldCheck}
            label="Privasi"
            desc="Kebijakan privasi"
            onClick={() => onOpenPage("privacy")}
          />
        </div>
      </SubHeader>
    );
  }

  // ---------- Halaman utama: 3 grup menu ----------
  const groups: { key: SubMenu; icon: typeof Zap; label: string; desc: string }[] = [
    {
      key: "akun",
      icon: CircleUserRound,
      label: "Akun",
      desc: user?.email ? user.email : "Masuk / Daftar",
    },
    {
      key: "pengaturan",
      icon: SlidersHorizontal,
      label: "Pengaturan",
      desc: "OTP otomatis, kunci PIN & mode gelap",
    },
    {
      key: "integrasi",
      icon: PlugZap,
      label: "Integrasi",
      desc: "Telegram & Developer",
    },
    {
      key: "pesan",
      icon: Inbox,
      label: "Pesan",
      desc: "Tong sampah & blokir pengirim",
    },
    {
      key: "bantuan",
      icon: LifeBuoy,
      label: "Bantuan",
      desc: "API, status server & info aplikasi",
    },
  ];

  return (
    <div>
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/60"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <div className="flex items-center h-14 px-4">
          <span className="text-[17px] font-extrabold tracking-tight">Lainnya</span>
        </div>
      </div>

      <div className="px-3 py-3 space-y-2.5">
        {groups.map((g) => {
          const Icon = g.icon;
          return (
            <button
              key={g.key}
              onClick={() => setSubMenu(g.key)}
              className="w-full flex items-center gap-3.5 rounded-3xl border border-border/70 bg-card px-4 py-4 active:bg-muted/60 text-left shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <span className="w-11 h-11 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Icon className="h-5 w-5" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[15px] font-extrabold">{g.label}</span>
                <span className="block text-[12px] text-muted-foreground truncate">{g.desc}</span>
              </span>
              <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0" />
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground text-center pb-8">TempMail · v1.3.0</p>
    </div>
  );
}
