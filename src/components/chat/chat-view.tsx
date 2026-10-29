// EXAMPLE (chat): minimal chat UI on top of useChat (posts to /api/chat).
"use client";

import { useChat } from "@ai-sdk/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function ChatView() {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, error, stop } = useChat();
  const bottomRef = useRef<HTMLDivElement>(null);
  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    if (error) toast.error(error.message || "Something went wrong");
  }, [error]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function submit() {
    const text = input.trim();
    if (!text || busy) return;
    sendMessage({ text });
    setInput("");
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] flex-col gap-4">
      <div className="flex flex-1 flex-col gap-3 overflow-y-auto">
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">Ask anything to get started.</p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "max-w-[80%] rounded-lg px-4 py-2 text-sm whitespace-pre-wrap",
              message.role === "user"
                ? "self-end bg-primary text-primary-foreground"
                : "self-start bg-muted",
            )}
          >
            {message.parts.map((part, i) =>
              part.type === "text" ? <span key={i}>{part.text}</span> : null,
            )}
          </div>
        ))}
        {status === "submitted" && <Skeleton className="h-10 w-48 self-start" />}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className="flex items-end gap-2"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter adds a newline.
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
          placeholder="Send a message…"
          rows={2}
          className="flex-1 resize-none"
        />
        {busy ? (
          <Button type="button" variant="outline" onClick={() => stop()}>
            Stop
          </Button>
        ) : (
          <Button type="submit" disabled={!input.trim()}>
            Send
          </Button>
        )}
      </form>
    </div>
  );
}
