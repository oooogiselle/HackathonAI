"use client";

// The asker ↔ helper chat on a claimed task (listMessages / sendMessage).
// Only the two of them can read it; the server checks.
import { SendHorizontal } from "lucide-react";
import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import type { Message } from "@/lib/ask/types";
import { listMessages, sendMessage } from "@/server/actions/inbox";
import { cn } from "cn";

import { Panel } from "./task-parts";

const POLL_MS = 3000;

export function MessageThread({ token }: { token: string }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState("");
  const [sending, startSend] = useTransition();

  const load = useCallback(async () => {
    const result = await listMessages(token);
    if ("ok" in result) setMessages(result.messages);
  }, [token]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first fetch, then poll
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    startSend(async () => {
      const result = await sendMessage({ token, body });
      if ("error" in result) return void toast.error(result.error);
      setBody("");
      await load();
    });
  }

  return (
    <Panel title="Messages">
      {messages.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No messages yet. Your school email stays hidden.
        </p>
      ) : (
        <ul aria-label="Messages" className="flex flex-col gap-2">
          {messages.map((m) => (
            <li
              key={m.id}
              className={cn(
                "max-w-[80%] rounded-2xl px-3.5 py-2 text-[15px]",
                m.fromMe
                  ? "self-end bg-primary text-primary-foreground"
                  : "self-start bg-background",
              )}
            >
              {!m.fromMe && <span className="sr-only">{m.senderFirstName}: </span>}
              {m.body}
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={send} className="mt-1 flex items-center gap-2">
        <label htmlFor={`message-${token}`} className="sr-only">
          Write a message
        </label>
        <input
          id={`message-${token}`}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write a message"
          maxLength={1000}
          className="h-11 min-w-0 flex-1 rounded-full bg-background px-4 text-[15px] outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={sending || !body.trim()}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground disabled:opacity-40"
        >
          <SendHorizontal className="size-4" />
        </button>
      </form>
    </Panel>
  );
}
