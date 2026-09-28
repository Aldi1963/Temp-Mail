import { Home, Mail, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

export type NativeTab = "beranda" | "alamat" | "lainnya";

interface Props {
  tab: NativeTab;
  onChange: (t: NativeTab) => void;
  unread: number;
}

export function TabBar({ tab, onChange, unread }: Props) {
  const items = [
    { id: "beranda" as const, label: "Beranda", icon: Home, badge: unread },
    { id: "alamat" as const, label: "Alamat Saya", icon: Mail, badge: 0 },
    { id: "lainnya" as const, label: "Lainnya", icon: MoreHorizontal, badge: 0 },
  ];
  return (
    <nav
      className="shrink-0 border-t border-border bg-background/95 backdrop-blur z-30"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex px-2 pt-1.5 pb-1">
        {items.map((it) => {
          const active = tab === it.id;
          const Icon = it.icon;
          return (
            <button
              key={it.id}
              onClick={() => onChange(it.id)}
              className={cn(
                "flex-1 flex flex-col items-center gap-1 py-1 rounded-xl relative",
                active ? "text-primary" : "text-muted-foreground"
              )}
            >
              <span className={cn("px-5 py-1 rounded-full", active && "bg-primary/15")}>
                <Icon className="h-5 w-5" />
              </span>
              <span className="text-[11px] font-semibold">{it.label}</span>
              {it.badge > 0 && (
                <span className="absolute top-0.5 right-1/2 translate-x-5 min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                  {it.badge > 99 ? "99+" : it.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
