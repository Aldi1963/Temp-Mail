import { MessageViewer } from "@/components/message-viewer";

interface Props {
  messageId: string;
  email: string;
  onBack: () => void;
}

// Halaman baca pesan fullscreen — tanpa popup.
export function MessagePage({ messageId, email, onBack }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 bg-background flex flex-col"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="flex-1 min-h-0 flex flex-col">
        <MessageViewer messageId={messageId} email={email} onBack={onBack} />
      </div>
    </div>
  );
}
