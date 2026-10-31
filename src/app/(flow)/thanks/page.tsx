"use client";

// Step 7: the user writes their own thank-you. No AI here on purpose.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { useRequireNeed } from "@/components/ask/flow-provider";
import { StepHeader } from "@/components/ask/step-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveThanks } from "@/server/actions/ask";

export default function ThanksPage() {
  const router = useRouter();
  const { state, update, reset } = useRequireNeed();
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function send() {
    if (!state.token) return;
    startTransition(async () => {
      await saveThanks(state.token!, note);
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
          step={7}
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
        step={7}
        title="Say thank you"
        subtitle="In your own words. A sentence is plenty."
        backHref={state.token ? `/matched/${state.token}` : "/"}
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
        disabled={!note.trim() || pending || !state.token}
        onClick={send}
      >
        {pending ? "Sending…" : "Send thank-you"}
      </Button>
    </>
  );
}
