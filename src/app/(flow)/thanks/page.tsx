"use client";

// Step 7: the user writes their own thank-you. No AI here on purpose.
import Link from "next/link";
import { useState, useTransition } from "react";

import { useRequireNeed } from "@/components/ask/flow-provider";
import { StepHeader } from "@/components/ask/step-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { saveThanks } from "@/server/actions/ask";

export default function ThanksPage() {
  const { state, reset } = useRequireNeed();
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function send() {
    if (!state.token) return;
    startTransition(async () => {
      await saveThanks(state.token!, note);
      setSent(true);
    });
  }

  if (sent) {
    return (
      <>
        <StepHeader
          step={7}
          title="Thank-you sent 💛"
          subtitle="Asking for help takes courage. Nice work."
        />
        <Link
          href="/"
          onClick={() => reset()}
          className={buttonVariants({ size: "lg", className: "mt-auto h-12 text-base" })}
        >
          Start a new ask
        </Link>
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
