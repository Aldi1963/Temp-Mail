import { ReactNode } from "react";
import { Mail, Moon, Sun, Volume2, VolumeX } from "lucide-react";
import { useTheme } from "./theme-provider";
import { useSound } from "@/hooks/use-sound";
import { Button } from "./ui/button";

interface HeaderProps {
  rightSlot?: ReactNode;
}

export function Header({ rightSlot }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const { enabled: soundEnabled, setEnabled: setSoundEnabled } = useSound();

  return (
    <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50">
      <div className="flex h-14 items-center justify-between px-4 md:px-6">
        <div className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <div className="bg-primary/10 p-1.5 rounded-md text-primary">
            <Mail className="h-5 w-5" />
          </div>
          TempMail
        </div>

        <div className="flex items-center gap-2">
          {rightSlot}

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Matikan suara" : "Aktifkan suara"}
            className="text-muted-foreground hover:text-foreground"
          >
            {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title="Ganti tema"
            className="text-muted-foreground hover:text-foreground"
          >
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
        </div>
      </div>
    </header>
  );
}
