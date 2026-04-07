import { useEffect, useState } from "react";
import { Copy, RefreshCw, Trash2, Clock, Inbox, ChevronDown, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  useGenerateEmail,
  useGetAvailableDomains,
  useGetEmailStats,
  useResetInbox,
  getGetEmailStatsQueryKey,
  getGetInboxQueryKey
} from "@workspace/api-client-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { useQueryClient } from "@tanstack/react-query";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface EmailPaneProps {
  activeEmail: string | null;
  setActiveEmail: (email: string) => void;
}

export function EmailPane({ activeEmail, setActiveEmail }: EmailPaneProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDomain, setSelectedDomain] = useState<string | undefined>();
  const [generateTrigger, setGenerateTrigger] = useState(0);
  const [pendingDomain, setPendingDomain] = useState<string | undefined>();

  const { data: domainsData } = useGetAvailableDomains();
  const resetMutation = useResetInbox();
  const { data: stats } = useGetEmailStats(
    { email: activeEmail ?? "" },
    { query: { enabled: !!activeEmail, refetchInterval: 5000 } }
  );

  const { data: generatedEmailData, isFetching: isGenerating } = useGenerateEmail(
    { domain: pendingDomain || selectedDomain },
    { query: { enabled: generateTrigger > 0, staleTime: 0, gcTime: 0 } }
  );

  useEffect(() => {
    if (generatedEmailData?.email) {
      setActiveEmail(generatedEmailData.email);
      toast({
        title: "New email generated",
        description: generatedEmailData.email,
      });
    }
  }, [generatedEmailData?.email]);

  const [timeLeft, setTimeLeft] = useState<string>("Calculating...");

  useEffect(() => {
    if (!stats?.expiresAt) {
      setTimeLeft("Unknown");
      return;
    }

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(stats.expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeLeft("Expired");
        return;
      }

      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [stats?.expiresAt]);

  const domains = domainsData?.domains || [];

  const handleGenerate = (domain?: string) => {
    if (domain) setPendingDomain(domain);
    setGenerateTrigger((t) => t + 1);
  };

  // Generate on first load if none active
  useEffect(() => {
    if (!activeEmail && domains.length > 0 && !isGenerating && generateTrigger === 0) {
      handleGenerate(domains[0]);
    }
  }, [activeEmail, domains.length]);

  const copyToClipboard = () => {
    if (!activeEmail) return;
    navigator.clipboard.writeText(activeEmail);
    toast({
      title: "Copied to clipboard",
      description: "Email address copied successfully.",
      duration: 2000,
    });
  };

  const handleReset = () => {
    if (!activeEmail) return;
    resetMutation.mutate({ params: { email: activeEmail } }, {
      onSuccess: () => {
        toast({
          title: "Inbox cleared",
          description: "All messages have been deleted.",
        });
        queryClient.invalidateQueries({ queryKey: getGetInboxQueryKey({ email: activeEmail }) });
        queryClient.invalidateQueries({ queryKey: getGetEmailStatsQueryKey({ email: activeEmail }) });
      }
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="border-primary/20 bg-card/50 backdrop-blur">
        <CardHeader className="pb-4">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Your Temporary Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
            <div className="relative flex-1 group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/50 to-primary/30 rounded-lg blur opacity-20 group-hover:opacity-40 transition duration-500"></div>
              <div className="relative flex items-center justify-between bg-background border border-border/50 rounded-lg p-3 sm:p-4">
                {activeEmail ? (
                  <span className="text-lg sm:text-xl font-mono font-bold truncate select-all text-primary" data-testid="text-active-email">
                    {activeEmail}
                  </span>
                ) : (
                  <Skeleton className="h-8 w-full max-w-[250px]" />
                )}
                
                <Button 
                  size="icon" 
                  variant="ghost" 
                  onClick={copyToClipboard}
                  disabled={!activeEmail}
                  className="shrink-0 ml-2 hover:bg-primary/10 hover:text-primary transition-colors"
                  data-testid="button-copy-email"
                >
                  <Copy className="h-5 w-5" />
                </Button>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button 
              onClick={() => handleGenerate()} 
              disabled={isGenerating}
              className="flex-1 min-w-[140px] bg-primary text-primary-foreground hover:bg-primary/90"
              data-testid="button-generate-email"
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
              Generate New
            </Button>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex-1 min-w-[140px]" disabled={domains.length === 0}>
                  {selectedDomain || (domains.length > 0 ? domains[0] : "Domain")} <ChevronDown className="ml-2 h-4 w-4 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                {domains.map((domain) => (
                  <DropdownMenuItem 
                    key={domain} 
                    onClick={() => setSelectedDomain(domain)}
                    className={selectedDomain === domain ? "bg-accent" : ""}
                  >
                    @{domain}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-card/50 backdrop-blur">
        <CardContent className="p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-accent/50">
              <Inbox className="h-6 w-6 text-muted-foreground mb-2" />
              <div className="text-2xl font-bold" data-testid="text-stats-total">
                {stats ? stats.totalMessages : "0"}
              </div>
              <div className="text-xs text-muted-foreground">Total Messages</div>
            </div>
            <div className="flex flex-col items-center justify-center p-4 rounded-lg bg-primary/10 border border-primary/20">
              <Mail className="h-6 w-6 text-primary mb-2" />
              <div className="text-2xl font-bold text-primary" data-testid="text-stats-unread">
                {stats ? stats.unreadCount : "0"}
              </div>
              <div className="text-xs text-primary/80 font-medium">Unread</div>
            </div>
          </div>
          
          <div className="mt-6 flex items-center justify-between border-t border-border pt-4">
            <div className="flex items-center text-sm text-muted-foreground">
              <Clock className="mr-2 h-4 w-4" />
              <span>Expires in 2h 00m</span> {/* Static for now, no complex expiry hook yet */}
            </div>
            
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive hover:bg-destructive/10" disabled={!activeEmail || !stats?.totalMessages}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Clear Inbox
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete all messages in your current temporary inbox.
                    This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleReset} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete All
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
