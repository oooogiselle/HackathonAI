"use client";

// Step 7: the user writes their own thank-you. No AI here on purpose.
// Opened from the task page (?token=), so it works even without flow state.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useState, useTransition } from "react";
import { toast } from "sonner";

import { useAskFlow } from "@/components/ask/flow-provider";
import { StepHeader } from "@/components/ask/step-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveCardThanks } from "@/server/actions/board";

export default function ThanksPage({ searchParams }: PageProps<"/thanks">) {
  const router = useRouter();
  const { state, update, reset } = useAskFlow();
  const param = use(searchParams).token;
  const token = typeof param === "string" ? param : state.token;
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function send() {
    if (!token) return;
    startTransition(async () => {
      const result = await saveCardThanks(token, note);
      if ("error" in result) return void toast.error(result.error);
      if (!state.sentParts.includes(state.activePart)) {
        update({ sentParts: [...state.sentParts, state.activePart] });
      }
      setSent(true);
    });
  }

  // The next small ask from the same need, if the AI split it into several.
  const nextPart = state.parts.findIndex(
    (_, i) => i !== state.activePart && !state.sentParts.includes(i),
  );

  function sendNext() {
    update({
      activePart: nextPart,
      token: undefined,
      where: undefined,
      scrub: undefined,
      groupId: undefined,
    });
    router.push("/draft");
  }

  if (sent) {
    return (
      <>
        <StepHeader
          title="Thank-you sent"
          subtitle="Asking for help takes courage. Nice work."
        />
        <div className="mt-auto flex flex-col gap-2">
          {nextPart >= 0 && (
            <Button size="lg" className="h-12 text-base" onClick={sendNext}>
              Next: {state.parts[nextPart].what}
            </Button>
          )}
          <Link
            href="/"
            onClick={() => reset()}
            className={buttonVariants({
              size: "lg",
              variant: nextPart >= 0 ? "outline" : "default",
              className: "h-12 text-base",
            })}
          >
            Start a new ask
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <StepHeader
        title="Say thank you"
        subtitle="In your own words. A sentence is plenty."
        backHref={token ? `/h/${token}` : "/"}
      />
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Thank you so much for the ride!"
        className="min-h-32 text-base"
        maxLength={1000}
      />
      <Button
        size="lg"
        className="mt-auto h-12 text-base"
        disabled={!note.trim() || pending || !token}
        onClick={send}
      >
        {pending ? "Sending…" : "Send thank-you"}
      </Button>
    </>
  );
}
