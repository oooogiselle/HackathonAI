// EXAMPLE (chat): page wrapper for the chat UI.
import { ChatView } from "@/components/chat/chat-view";

export default function ChatPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-semibold">Chat</h1>
      <ChatView />
    </div>
  );
}
