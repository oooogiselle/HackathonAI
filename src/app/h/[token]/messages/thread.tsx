"use client";

// The messages and the reply box. Polls every few seconds, like the task page;
// there's no live connection, so no typing dots or read receipts.
// Scam guard: a message about paying outside Ask or an ID number asks the
// sender first ("Send anyway"), and shows the receiver a note under it.
import { ArrowUp, ShieldAlert } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FLAG_COPY, type MessageFlag } from "@/lib/ask/scam-check";
import type { Message } from "@/lib/ask/types";
import { listMessages, sendMessage } from "@/server/actions/inbox";
import { cn } from "cn";

const REFRESH_MS = 3000;
// A time stamp shows above a message when this much time has passed.
const GAP_MS = 10 * 60_000;
const MAX_LENGTH = 1000;

function timeLabel(ms: number) {
  return new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function Thread({
  token,
  otherAlias,
  initial,
  closed,
}: {
  token: string;
  otherAlias: string;
  initial: Message[];
  closed: boolean;
}) {
  const [messages, setMessages] = useState(initial);
  const [draft, setDraft] = useState("");
  const [sending, startSend] = useTransition();
  // Set when the scam guard caught the draft; cleared by editing or sending anyway.
  const [warning, setWarning] = useState<MessageFlag | null>(null);
  // Messages already on screen at load don't animate; new ones do.
  const [seen] = useState(() => new Set(initial.map((m) => m.id)));
  const endRef = useRef<HTMLDivElement>(null);

  async function refresh() {
    const result = await listMessages(token);
    if ("messages" in result) setMessages(result.messages);
  }

  useEffect(() => {
    if (closed) return;
    const id = setInterval(refresh, REFRESH_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [closed, token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  const body = draft.trim();

  function send(confirmed = false) {
    if (!body || sending) return;
    startSend(async () => {
      const result = await sendMessage({ token, body, confirmed });
      if ("warning" in result) {
        setWarning(result.warning);
        return;
      }
      setWarning(null);
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      setDraft("");
      await refresh();
    });
  }

  return (
    <>
      <ol
        aria-label={`Messages with ${otherAlias}`}
        className="flex flex-1 flex-col justify-end gap-1.5 px-4 pt-3 pb-4"
      >
        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const showTime = !prev || m.createdAt - prev.createdAt >= GAP_MS;
          const sameSide = prev && prev.fromMe === m.fromMe && !showTime;
          return (
            <li key={m.id} className={cn("flex flex-col", !sameSide && i > 0 && "mt-2")}>
              {showTime && (
                <time
                  dateTime={new Date(m.createdAt).toISOString()}
                  suppressHydrationWarning
                  className="mb-2 text-center text-xs text-muted-foreground"
                >
                  {timeLabel(m.createdAt)}
                </time>
              )}
              <p
                className={cn(
                  "max-w-[80%] rounded-[20px] px-3.5 py-2 text-[15px] leading-[1.45] break-words whitespace-pre-wrap",
                  m.fromMe
                    ? "self-end rounded-br-md bg-primary text-primary-foreground"
                    : "self-start rounded-bl-md bg-card shadow-[0_1px_2px_rgba(14,42,32,0.06),0_4px_12px_-8px_rgba(14,42,32,0.2)]",
                  !seen.has(m.id) &&
                    "animate-in duration-150 fade-in slide-in-from-bottom-1 motion-reduce:animate-none",
                )}
              >
                <span className="sr-only">{m.fromMe ? "You" : m.senderAlias}: </span>
                {m.body}
              </p>
              {m.flag && !m.fromMe && (
                <p
                  role="note"
                  className="mt-1 flex max-w-[80%] items-start gap-1.5 self-start text-xs text-muted-foreground"
                >
                  <ShieldAlert className="mt-px size-3.5 shrink-0" aria-hidden />
                  {FLAG_COPY[m.flag].receiver}
                </p>
              )}
            </li>
          );
        })}
      </ol>
      <div ref={endRef} />

      <div className="sticky bottom-0 bg-background px-4 pt-2 pb-[max(env(safe-area-inset-bottom),0.75rem)]">
        {closed ? (
          <p className="rounded-2xl bg-muted px-4 py-3 text-center text-sm text-muted-foreground">
            This ask was cancelled, so messages are closed.
          </p>
        ) : (
          <>
            {warning && (
              <div
                role="alert"
                className="mb-2 flex flex-col gap-3 rounded-3xl bg-card p-4 shadow-[0_1px_2px_rgba(14,42,32,0.06)]"
              >
                <p className="flex items-start gap-2 text-sm">
                  <ShieldAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                  {FLAG_COPY[warning].sender}
                </p>
                <div className="flex gap-2">
                  <Button variant="secondary" className="flex-1" onClick={() => setWarning(null)}>
                    Edit message
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1"
                    disabled={sending}
                    onClick={() => send(true)}
                  >
                    Send anyway
                  </Button>
                </div>
              </div>
            )}
            <form
              className="flex items-end gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
            >
              <label htmlFor="reply" className="sr-only">
                Message {otherAlias}
              </label>
              <textarea
                id="reply"
                rows={1}
                value={draft}
                maxLength={MAX_LENGTH}
                placeholder={`Message ${otherAlias}`}
                onChange={(e) => {
                  setDraft(e.target.value);
                  setWarning(null);
                }}
                onKeyDown={(e) => {
                  // Enter sends; Shift+Enter is a new line. Never mid-IME composition.
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }}
                className="field-sizing-content max-h-32 min-h-11 flex-1 resize-none rounded-[22px] border border-input bg-card px-4 py-2.5 text-base leading-snug outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
              />
              <Button
                type="submit"
                aria-label="Send"
                disabled={!body || sending}
                className="size-11 shrink-0 rounded-full p-0"
              >
                <ArrowUp className="size-5" />
              </Button>
            </form>
          </>
        )}
      </div>
    </>
  );
}
