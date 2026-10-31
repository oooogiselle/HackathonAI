"use client";

// Step 1: Home. Safety check runs first, before anything else happens.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { ChipGroup } from "@/components/ask/chip-group";
import { useAskFlow } from "@/components/ask/flow-provider";
import { StepHeader } from "@/components/ask/step-header";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { checkSafety } from "@/server/actions/ask";

const EXAMPLES = [
  "need ride to airport for break",
  "how do I get an SSN",
  "move mini-fridge to new dorm",
];

export default function Home() {
  const router = useRouter();
  const { reset } = useAskFlow();
  const [need, setNeed] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = need.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const safety = await checkSafety(trimmed);
      if (safety.category === "crisis") return router.push("/resources?type=crisis");
      if (safety.category === "academic") return router.push("/resources?type=tutoring");
      reset({ need: trimmed, category: safety.category });
      router.push("/clarify");
    });
  }

  // The form path; anything typed so far carries over into Details.
  function writeMyself() {
    reset({ mode: "form", need: need.trim() });
    router.push("/write");
  }

  return (
    <>
      <StepHeader
        step={1}
        title="What do you need help with?"
        subtitle="Messy is fine. We'll help you turn it into a clear, small ask."
      />
      <Textarea
        value={need}
        onChange={(e) => setNeed(e.target.value)}
        placeholder="e.g. i need to get to the airport on dec 18 but don't know anyone with a car"
        className="min-h-32 text-base"
        maxLength={1000}
        autoFocus
      />
      <div className="flex flex-col gap-2">
        <span className="text-xs text-muted-foreground">Or try one</span>
        <ChipGroup options={EXAMPLES} onChange={setNeed} value={need} />
      </div>
      <Button
        size="lg"
        className="mt-auto h-12 text-base"
        disabled={!need.trim() || pending}
        onClick={submit}
      >
        {pending ? "Thinking…" : "Continue"}
      </Button>
      <Button variant="ghost" disabled={pending} onClick={writeMyself}>
        I&apos;d rather fill in a form
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Real people do the helping. Nothing is sent without your OK.
      </p>
    </>
  );
}
