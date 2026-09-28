import {
  Activity,
  ChevronRight,
  Code2,
  Info,
  LogIn,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/theme-provider";
import type { NativePage } from "./NativeApp";

interface Props {
  onOpenPage: (p: NativePage) => void;
}

export function LainnyaTab({ onOpenPage }: Props) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const dark = theme === "dark";

  const menu = [
    {
      icon: dark ? Sun : Moon,
      label: "Mode gelap",
      desc: dark ? "Aktif" : "Nonaktif",
      action: () => setTheme(dark ? "light" : "dark"),
    },
    {
      icon: Code2,
      label: "Dokumentasi API",
      desc: "Coba endpoint langsung",
      action: () => onOpenPage("api-docs"),
    },
    {
      icon: Activity,
      label: "Status server",
      desc: undefined as string | undefined,
      action: () => onOpenPage("status"),
    },
    {
      icon: Info,
      label: "Tentang",
      desc: undefined as string | undefined,
      action: () => onOpenPage("tentang"),
    },
    {
      icon: ShieldCheck,
      label: "Privasi",
      desc: undefined as string | undefined,
      action: () => onOpenPage("privacy"),
    },
  ];

  return (
    <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
      <div className="sticky top-0 z-20 bg-background/95 backdrop-blur border-b border-border/60">
        <div className="flex items-center h-14 px-4">
          <span className="text-[17px] font-extrabold tracking-tight">Lainnya</span>
        </div>
      </div>

      <div className="p-3">
        {user?.email ? (
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
              onClick={() => logout()}
              className="inline-flex items-center gap-1.5 text-[12px] font-bold text-destructive bg-destructive/10 rounded-xl px-3 py-2 active:scale-[0.97]"
            >
              <LogOut className="h-3.5 w-3.5" />
              Keluar
            </button>
          </div>
        ) : (
          <button
            onClick={() => onOpenPage("login")}
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
        )}
      </div>

      <div className="px-3 pb-3 space-y-1">
        {menu.map((m) => {
          const Icon = m.icon;
          return (
            <button
              key={m.label}
              onClick={m.action}
              className="w-full flex items-center gap-3 rounded-2xl px-3 py-3.5 active:bg-muted/70 text-left"
            >
              <span className="w-9 h-9 rounded-xl bg-muted flex items-center justify-center shrink-0">
                <Icon className="h-[18px] w-[18px] text-foreground" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[13.5px] font-bold">{m.label}</span>
                {m.desc && (
                  <span className="block text-[11px] text-muted-foreground">{m.desc}</span>
                )}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          );
        })}
      </div>

      <p className="text-[11px] text-muted-foreground text-center pb-8">TempMail · v1.0.0</p>
    </div>
  );
}
