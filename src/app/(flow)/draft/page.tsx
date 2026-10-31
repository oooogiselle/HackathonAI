"use client";

// Step 3: the AI breaks the need into small asks the user can edit, each with
// who'd be a good fit and a suggested price. They send one at a time.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { useRequireNeed } from "@/components/ask/flow-provider";
import { LoadingLines } from "@/components/ask/loading-line";
import { PartCard } from "@/components/ask/part-card";
import { StepHeader } from "@/components/ask/step-header";
import { Button, buttonVariants } from "@/components/ui/button";
import type { AskPart } from "@/lib/ask/types";
import { draftAsk } from "@/server/actions/ask";

export default function DraftPage() {
  const router = useRouter();
  const { state, ready, update } = useRequireNeed();
  const [loading, startLoading] = useTransition();
  // Drafting can legitimately return no parts (academic/crisis); don't retry in a loop.
  const tried = useRef(false);
  const [empty, setEmpty] = useState(false);
  const { parts, activePart, sentParts } = state;

  function draft() {
    startLoading(async () => {
      const result = await draftAsk(state.need, state.answers);
      setEmpty(result.parts.length === 0);
      update({ parts: result.parts, activePart: 0, sentParts: [] });
    });
  }

  useEffect(() => {
    if (!ready || !state.need || parts.length > 0 || tried.current) return;
    tried.current = true;
    draft();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once when the flow is ready
  }, [ready, state.need, parts.length]);

  function editPart(index: number, part: AskPart) {
    update({ parts: parts.map((p, i) => (i === index ? part : p)) });
  }

  function next() {
    const part = parts[activePart];
    if (!part) return;
    update({ ask: part.text.trim(), where: undefined, scrub: undefined, groupId: undefined });
    router.push("/check");
  }

  const many = parts.length > 1;
  const active = parts[activePart];

  return (
    <>
      <StepHeader
        title={many ? `We broke this into ${parts.length} small asks` : "Your ask"}
        subtitle={
          many
            ? "Small, specific asks are easier to say yes to. Send one now, the rest later."
            : "Short and specific is easier to say yes to. Edit anything."
        }
        backHref="/clarify"
      />
      {loading || (!empty && parts.length === 0) ? (
        <LoadingLines label="Breaking it down…" />
      ) : empty ? (
        <p className="text-sm text-muted-foreground">
          This isn&apos;t something to ask a peer for.{" "}
          <Link href="/ask" className="underline">
            Start over
          </Link>
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {parts.map((part, i) => (
            <PartCard
              key={i}
              part={part}
              index={i}
              selectable={many}
              selected={i === activePart}
              sent={sentParts.includes(i)}
              onSelect={() => update({ activePart: i })}
              onChange={(p) => editPart(i, p)}
            />
          ))}
        </div>
      )}
      <div className="mt-auto flex flex-col gap-2">
        {empty ? (
          <Link href="/ask" className={buttonVariants({ size: "lg", className: "h-12 text-base" })}>
            Start over
          </Link>
        ) : (
          <Button
            size="lg"
            className="h-12 text-base"
            disabled={loading || !active?.text.trim() || sentParts.includes(activePart)}
            onClick={next}
          >
            {many ? "Continue with this ask" : "Looks good"}
          </Button>
        )}
        <Button variant="ghost" disabled={loading} onClick={draft}>
          Try another version
        </Button>
      </div>
    </>
  );
}
