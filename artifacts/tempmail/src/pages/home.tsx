import { useState, useEffect, useRef } from "react";
import { Header } from "@/components/header";
import { EmailPane } from "@/components/email-pane";
import { InboxList } from "@/components/inbox-list";
import { MessageViewer } from "@/components/message-viewer";
import { useLocalStorage } from "@/hooks/use-local-storage";
import { useSound } from "@/hooks/use-sound";
import { useToast } from "@/hooks/use-toast";
import { useGetInbox, getGetInboxQueryKey } from "@workspace/api-client-react";

export default function Home() {
  const [activeEmail, setActiveEmail] = useLocalStorage<string | null>("tempmail_active_email", null);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  
  const { playChime } = useSound();
  const { toast } = useToast();
  
  const prevTotalRef = useRef<number>(0);

  const { data: inbox, isLoading } = useGetInbox(
    { email: activeEmail! },
    { 
      query: { 
        enabled: !!activeEmail, 
        refetchInterval: 5000, 
        queryKey: getGetInboxQueryKey({ email: activeEmail! }) 
      } 
    }
  );

  // Handle new incoming mail notifications
  useEffect(() => {
    if (inbox && inbox.total > prevTotalRef.current) {
      // New mail arrived
      if (prevTotalRef.current > 0) { // Don't notify on initial load
        playChime();
        toast({
          title: "New Mail Arrived",
          description: "You have a new message in your inbox.",
        });
      }
      prevTotalRef.current = inbox.total;
    } else if (inbox && inbox.total < prevTotalRef.current) {
      // Mail was deleted/reset
      prevTotalRef.current = inbox.total;
    }
  }, [inbox?.total, playChime, toast]);

  // Reset selected message when email changes
  useEffect(() => {
    setSelectedMessageId(null);
    prevTotalRef.current = 0; // Reset counter for new inbox
  }, [activeEmail]);

  return (
    <div className="min-h-[100dvh] flex flex-col bg-background text-foreground">
      <Header />
      
      <main className="flex-1 container max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left/Top Pane: Controls & Stats */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-6">
          <EmailPane 
            activeEmail={activeEmail} 
            setActiveEmail={setActiveEmail} 
          />
        </div>
        
        {/* Right/Bottom Pane: Inbox & Viewer */}
        <div className="lg:col-span-8 xl:col-span-9 flex flex-col lg:flex-row gap-6 min-h-[500px]">
          
          {/* List view: Hide on mobile if a message is selected */}
          <div className={`w-full lg:w-[350px] xl:w-[400px] flex-shrink-0 flex flex-col ${selectedMessageId ? 'hidden lg:flex' : 'flex'}`}>
            <InboxList 
              messages={inbox?.messages || []} 
              isLoading={isLoading && !!activeEmail}
              selectedMessageId={selectedMessageId}
              onSelectMessage={setSelectedMessageId}
            />
          </div>
          
          {/* Detail view: Hide if no message selected (on mobile) */}
          <div className={`w-full flex-1 flex flex-col ${!selectedMessageId ? 'hidden lg:flex' : 'flex'}`}>
            {selectedMessageId ? (
              <MessageViewer 
                messageId={selectedMessageId} 
                email={activeEmail!} 
                onBack={() => setSelectedMessageId(null)}
              />
            ) : (
              <div className="hidden lg:flex flex-col items-center justify-center h-full bg-card/50 rounded-lg border border-border/50 text-center p-8">
                <div className="bg-muted p-6 rounded-full mb-6">
                  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-foreground">No message selected</h3>
                <p className="text-muted-foreground mt-2 max-w-sm">
                  Select a message from the list to read its contents. Your temporary email is active and receiving messages.
                </p>
              </div>
            )}
          </div>
          
        </div>
        
      </main>
    </div>
  );
}
