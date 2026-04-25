import { ReactNode } from "react";
import { Link } from "wouter";
import { Mail, Moon, Sun, Volume2, VolumeX, LogIn, ShieldCheck, LayoutDashboard, LogOut, Code2, UserCircle } from "lucide-react";
import { useTheme } from "./theme-provider";
import { useSound } from "@/hooks/use-sound";
import { useAuth } from "@/hooks/use-auth";
import { useBranding } from "@/hooks/use-branding";
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
  const { branding } = useBranding();
  const siteName = (branding.site_name || "TempMail").trim();
  const siteLogo = (branding.site_logo_url || "").trim();

  return (
    <header className="border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 sticky top-0 z-50">
      <div className="flex h-14 items-center justify-between px-4 md:px-6 max-w-screen-2xl mx-auto">
        {/* Brand */}
        <Link href="/">
          <div className="flex items-center gap-2.5 cursor-pointer select-none group">
            <div className="relative">
              {siteLogo ? (
                <div className="relative h-9 w-9 rounded-lg overflow-hidden border border-border/60 bg-muted/30 flex items-center justify-center">
                  <img src={siteLogo} alt={siteName} className="h-full w-full object-contain" />
                </div>
              ) : (
                <>
                  <div className="absolute inset-0 bg-primary/30 rounded-lg blur group-hover:blur-md transition-all" />
                  <div className="relative bg-primary/10 p-1.5 rounded-lg text-primary border border-primary/20 group-hover:bg-primary/20 transition-colors">
                    <Mail className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                  </div>
                </>
              )}
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="font-bold text-base tracking-tight text-foreground">{siteName}</span>
              <span className="hidden sm:inline text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full leading-none">
                GRATIS
              </span>
            </div>
          </div>
        </Link>

        {/* Desktop nav links */}
        <nav className="hidden md:flex items-center gap-1 ml-6">
          <Link href="/tentang">
            <span className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer">
              Tentang
            </span>
          </Link>
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-1.5 ml-auto">
          {rightSlot}

          <div className="h-5 w-px bg-border/60 mx-1 hidden sm:block" />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Matikan suara" : "Aktifkan suara"}
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {soundEnabled
              ? <Volume2 className="h-4 w-4" />
              : <VolumeX className="h-4 w-4" />}
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title="Ganti tema"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {theme === "dark"
              ? <Sun className="h-4 w-4" />
              : <Moon className="h-4 w-4" />}
          </Button>

          {!isLoading && (
            user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-2 px-2 rounded-lg hover:bg-muted"
                  >
                    <div className="h-6 w-6 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-primary text-[10px] font-bold shrink-0">
                      {user.email.substring(0, 1).toUpperCase()}
                    </div>
                    <span className="hidden sm:inline text-xs max-w-24 truncate font-medium">
                      {user.email.split("@")[0]}
                    </span>
                    {user.role === "admin" && (
                      <Badge variant="default" className="text-[9px] h-4 px-1 hidden sm:flex">
                        Admin
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <div className="px-3 py-2.5 border-b border-border">
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center text-primary font-bold text-sm shrink-0">
                        {user.email.substring(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{user.email}</p>
                        <Badge variant={user.role === "admin" ? "default" : "secondary"} className="text-[10px] h-4 px-1.5 mt-0.5">
                          {user.role === "admin" ? "Admin" : "User"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="py-1">
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="flex items-center gap-2 cursor-pointer px-3 py-2">
                        <LayoutDashboard className="h-4 w-4 text-muted-foreground" />
                        Dashboard Saya
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/profile" className="flex items-center gap-2 cursor-pointer px-3 py-2">
                        <UserCircle className="h-4 w-4 text-muted-foreground" />
                        Profil & Keamanan
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/developer" className="flex items-center gap-2 cursor-pointer px-3 py-2">
                        <Code2 className="h-4 w-4 text-muted-foreground" />
                        Developer Tools
                      </Link>
                    </DropdownMenuItem>
                    {user.role === "admin" && (
                      <DropdownMenuItem asChild>
                        <Link href="/admin" className="flex items-center gap-2 cursor-pointer px-3 py-2">
                          <ShieldCheck className="h-4 w-4 text-muted-foreground" />
                          Panel Admin
                        </Link>
                      </DropdownMenuItem>
                    )}
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={logout}
                    className="text-destructive focus:text-destructive gap-2 cursor-pointer px-3 py-2"
                  >
                    <LogOut className="h-4 w-4" />
                    Keluar
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Link href="/login">
                <Button size="sm" className="h-8 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
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
