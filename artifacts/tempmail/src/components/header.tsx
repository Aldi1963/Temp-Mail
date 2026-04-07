import { ReactNode } from "react";
import { Link } from "wouter";
import { Mail, Moon, Sun, Volume2, VolumeX, LogIn, User, ShieldCheck, LayoutDashboard, LogOut, Code2, UserCircle } from "lucide-react";
import { useTheme } from "./theme-provider";
import { useSound } from "@/hooks/use-sound";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

interface HeaderProps {
  rightSlot?: ReactNode;
}

export function Header({ rightSlot }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const { enabled: soundEnabled, setEnabled: setSoundEnabled } = useSound();
  const { user, logout, isLoading } = useAuth();

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

          {!isLoading && (
            user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2">
                    <User className="h-4 w-4" />
                    <span className="hidden sm:inline text-xs max-w-24 truncate">{user.email.split("@")[0]}</span>
                    {user.role === "admin" && (
                      <Badge variant="default" className="text-[9px] h-4 px-1 hidden sm:flex">Admin</Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-3 py-2 border-b border-border">
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    <div className="flex items-center gap-1 mt-0.5">
                      <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-[10px] h-4 px-1.5">
                        {user.role === "admin" ? "Admin" : "User"}
                      </Badge>
                    </div>
                  </div>
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer">
                      <LayoutDashboard className="h-4 w-4" />
                      Dashboard Saya
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/profile" className="flex items-center gap-2 cursor-pointer">
                      <UserCircle className="h-4 w-4" />
                      Profil & Keamanan
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/developer" className="flex items-center gap-2 cursor-pointer">
                      <Code2 className="h-4 w-4" />
                      Developer Tools
                    </Link>
                  </DropdownMenuItem>
                  {user.role === "admin" && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="flex items-center gap-2 cursor-pointer">
                        <ShieldCheck className="h-4 w-4" />
                        Panel Admin
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={logout}
                    className="text-destructive focus:text-destructive gap-2 cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login">
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <LogIn className="h-3.5 w-3.5" />
                  Masuk
                </Button>
              </Link>
            )
          )}
        </div>
      </div>
    </header>
  );
}
