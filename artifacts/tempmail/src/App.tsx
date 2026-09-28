import React, { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { ApplyBranding } from "@/hooks/use-branding";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import LandingPage from "@/pages/landing";
import VerifyEmailPage from "@/pages/verify-email";
import LoginPage from "@/pages/login";
import RegisterPage from "@/pages/register";
import DashboardPage from "@/pages/dashboard";
import AdminPage from "@/pages/admin";
import DeveloperPage from "@/pages/developer";
import ApiDocsPage from "@/pages/api-docs";
import StatusPage from "@/pages/status";
import ProfilePage from "@/pages/profile";
import PrivacyPage from "@/pages/privacy";
import TermsPage from "@/pages/terms";

// Error Boundary to catch any render errors and prevent white blank screens
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("TempMail App Render Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6 text-center">
          <div className="max-w-md w-full p-6 rounded-2xl border border-destructive/30 bg-destructive/5 space-y-4">
            <h2 className="text-lg font-bold text-destructive">Terjadi Kesalahan Aplikasi</h2>
            <p className="text-xs text-muted-foreground font-mono bg-background p-3 rounded-lg border border-border overflow-auto max-h-32 text-left">
              {this.state.error?.message || "Unknown error"}
            </p>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.reload();
              }}
              className="w-full py-2.5 px-4 bg-primary text-primary-foreground font-semibold rounded-xl text-sm shadow-sm hover:bg-primary/90 transition-all cursor-pointer"
            >
              Reset Cache & Muat Ulang
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component, adminOnly }: { component: React.ComponentType; adminOnly?: boolean }) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading) {
      if (!user) navigate("/login");
      else if (adminOnly && user.role !== "admin") navigate("/dashboard");
    }
  }, [user, isLoading, adminOnly]);

  if (isLoading || !user) return null;
  if (adminOnly && user.role !== "admin") return null;
  return <Component />;
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/login" component={LoginPage} />
      <Route path="/register" component={RegisterPage} />
      <Route path="/dashboard">
        {() => <ProtectedRoute component={DashboardPage} />}
      </Route>
      <Route path="/admin">
        {() => <ProtectedRoute component={AdminPage} adminOnly />}
      </Route>
      <Route path="/developer">
        {() => <ProtectedRoute component={DeveloperPage} />}
      </Route>
      <Route path="/profile">
        {() => <ProtectedRoute component={ProfilePage} />}
      </Route>
      <Route path="/privacy" component={PrivacyPage} />
      <Route path="/terms" component={TermsPage} />
      <Route path="/api-docs" component={ApiDocsPage} />
      <Route path="/docs" component={ApiDocsPage} />
      <Route path="/status" component={StatusPage} />
      <Route path="/tentang" component={LandingPage} />
      <Route path="/verify-email" component={VerifyEmailPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <AuthProvider>
              <ApplyBranding />
              <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
                <Router />
              </WouterRouter>
            </AuthProvider>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
