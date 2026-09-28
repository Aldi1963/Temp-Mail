import { ReactNode, useState, useEffect } from "react";
import { Link } from "wouter";
import { Mail, Moon, Sun, Volume2, VolumeX, LogIn, ShieldCheck, LayoutDashboard, LogOut, Code2, UserCircle, Activity, Download, MoreVertical } from "lucide-react";
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
  /** Slot khusus mobile (di-render apa adanya di deretan kontrol kanan) */
  mobileSlot?: ReactNode;
}

export function Header({ rightSlot, mobileSlot }: HeaderProps) {
  const { theme, setTheme } = useTheme();
  const { enabled: soundEnabled, setEnabled: setSoundEnabled } = useSound();
  const { user, logout, isLoading } = useAuth();
  const { branding } = useBranding();
  const siteName = (branding.site_name || "TempMail").trim();
  const siteLogo = (branding.site_logo_url || "").trim();
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  return (
    <header className="app-header border-b border-border/60 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 sticky top-0 z-50">
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
            <div className="hidden min-[400px]:flex items-baseline gap-1.5">
              <span className="font-bold text-base tracking-tight text-foreground truncate max-w-[42vw] sm:max-w-none">{siteName}</span>
              <span className="hidden sm:inline text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full leading-none">
                GRATIS
              </span>
            </div>
          </div>
        </Link>

        {/* Desktop-only text nav links */}
        <nav className="hidden md:flex items-center gap-1 ml-6">
          <Link href="/tentang">
            <span className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer">
              Tentang
            </span>
          </Link>
          <Link href="/api-docs">
            <span className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer inline-flex items-center gap-1">
              <Code2 className="h-3 w-3" />
              API
            </span>
          </Link>
          <Link href="/status">
            <span className="text-xs text-muted-foreground hover:text-foreground px-3 py-1.5 rounded-md hover:bg-muted transition-colors cursor-pointer inline-flex items-center gap-1">
              <Activity className="h-3 w-3" />
              Status
            </span>
          </Link>
        </nav>

        {/* Right controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 ml-auto">
          {deferredPrompt && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleInstallClick}
              className="hidden sm:inline-flex h-8 gap-1.5 px-2.5 rounded-lg text-xs font-semibold text-primary border-primary/40 bg-primary/5 hover:bg-primary/10 transition-all shrink-0 animate-pulse"
              title="Pasang aplikasi TempMail di HP"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden xs:inline sm:inline">Pasang App</span>
            </Button>
          )}

          {rightSlot}

          {mobileSlot}

          {/* Mobile-only quick link to API docs */}
          <Link href="/api-docs">
            <Button
              variant="ghost"
              size="icon"
              title="Dokumentasi API"
              aria-label="Dokumentasi API"
              className="hidden sm:flex md:hidden h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <Code2 className="h-4 w-4" />
            </Button>
          </Link>

          <div className="h-5 w-px bg-border/60 mx-1 hidden sm:block" />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
            title={soundEnabled ? "Matikan suara" : "Aktifkan suara"}
            className="hidden sm:flex h-8 w-8 text-muted-foreground hover:text-foreground"
          >
            {soundEnabled
              ? <Volume2 className="h-4 w-4" />
              : <VolumeX className="h-4 w-4" />}
          </Button>

          {/* Menu overflow khusus mobile: biar header tidak padat */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                title="Menu lainnya"
                aria-label="Menu lainnya"
                className="flex sm:hidden h-10 w-10 text-muted-foreground hover:text-foreground shrink-0"
              >
                <MoreVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {deferredPrompt && (
                <DropdownMenuItem onClick={handleInstallClick} className="gap-2 cursor-pointer px-3 py-2">
                  <Download className="h-4 w-4 text-muted-foreground" />
                  Pasang App
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => setSoundEnabled(!soundEnabled)} className="gap-2 cursor-pointer px-3 py-2">
                {soundEnabled
                  ? <Volume2 className="h-4 w-4 text-muted-foreground" />
                  : <VolumeX className="h-4 w-4 text-muted-foreground" />}
                {soundEnabled ? "Matikan suara" : "Aktifkan suara"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="gap-2 cursor-pointer px-3 py-2 min-[400px]:hidden"
              >
                {theme === "dark"
                  ? <Sun className="h-4 w-4 text-muted-foreground" />
                  : <Moon className="h-4 w-4 text-muted-foreground" />}
                {theme === "dark" ? "Mode terang" : "Mode gelap"}
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link href="/api-docs" className="flex items-center gap-2 cursor-pointer px-3 py-2">
                  <Code2 className="h-4 w-4 text-muted-foreground" />
                  Dokumentasi API
                </Link>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={theme === "dark" ? "Ganti ke mode terang" : "Ganti ke mode gelap"}
            className="hidden min-[400px]:flex h-10 w-10 sm:h-8 sm:w-8 text-muted-foreground hover:text-foreground shrink-0"
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
                <Button size="sm" title="Masuk" aria-label="Masuk" className="h-8 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm">
                  <LogIn className="h-3.5 w-3.5" />
                  <span className="hidden min-[400px]:inline">Masuk</span>
                </Button>
              </Link>
            )
          )}
        </div>
      </div>
    </header>
  );
}
