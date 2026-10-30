"use client";

// Step 3: AI-drafted ask that the user can edit.
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { useRequireNeed } from "@/components/ask/flow-provider";
import { LoadingLines } from "@/components/ask/loading-line";
import { StepHeader } from "@/components/ask/step-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { draftAsk } from "@/server/actions/ask";

export default function DraftPage() {
  const router = useRouter();
  const { state, ready, update } = useRequireNeed();
  const [loading, startLoading] = useTransition();
  const [edited, setEdited] = useState<string | null>(null);
  const text = edited ?? state.ask;

  useEffect(() => {
    if (!ready || !state.need || state.ask) return;
    startLoading(async () => {
      update({ ask: await draftAsk(state.need, state.answers) });
    });
  }, [ready, state.need, state.answers, state.ask, update]);

  function redraft() {
    setEdited(null);
    startLoading(async () => {
      update({ ask: await draftAsk(state.need, state.answers) });
    });
  }

  function next() {
    // Edits invalidate earlier suggestions and scrub.
    if (text !== state.ask) update({ ask: text.trim(), where: undefined, scrub: undefined });
    router.push("/where");
  }

  return (
    <>
      <StepHeader
        step={3}
        title="Your ask"
        subtitle="Short and specific is easier to say yes to. Edit anything."
        backHref="/clarify"
      />
      {loading || !state.ask ? (
        <LoadingLines label="Drafting your ask…" />
      ) : (
        <>
          <Textarea
            value={text}
            onChange={(e) => setEdited(e.target.value)}
            className="min-h-36 text-base"
            maxLength={1000}
          />
          <span className="text-right text-xs text-muted-foreground">{text.length} characters</span>
        </>
      )}
      <div className="mt-auto flex flex-col gap-2">
        <Button
          size="lg"
          className="h-12 text-base"
          disabled={loading || !text.trim()}
          onClick={next}
        >
          Looks good
        </Button>
        <Button variant="ghost" disabled={loading} onClick={redraft}>
          Try another version
        </Button>
      </div>
    </>
  );
}
