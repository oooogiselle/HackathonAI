"use client";

// Step 2: at most 2 quick questions, answered with chips.
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ChipGroup } from "@/components/ask/chip-group";
import { useRequireNeed } from "@/components/ask/flow-provider";
import { LoadingLines } from "@/components/ask/loading-line";
import { StepHeader } from "@/components/ask/step-header";
import { Button } from "@/components/ui/button";
import type { ClarifyAnswer } from "@/lib/ask/types";
import { getClarifyQuestions } from "@/server/actions/ask";

export default function ClarifyPage() {
  const router = useRouter();
  const { state, ready, update } = useRequireNeed();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const questions = state.questions;

  useEffect(() => {
    if (!ready || !state.need || questions) return;
    getClarifyQuestions(state.need).then((q) => update({ questions: q }));
  }, [ready, state.need, questions, update]);

  function next() {
    const picked: ClarifyAnswer[] = (questions ?? [])
      .filter((q) => answers[q.question])
      .map((q) => ({ question: q.question, answer: answers[q.question] }));
    // Clear the old draft so it's regenerated with the new answers.
    update({
      answers: picked,
      parts: [],
      activePart: 0,
      sentParts: [],
      ask: "",
      where: undefined,
      scrub: undefined,
    });
    router.push("/draft");
  }

  return (
    <>
      <StepHeader
        step={2}
        title="A couple quick questions"
        subtitle={`“${state.need}”`}
        backHref="/describe"
      />
      {!questions ? (
        <LoadingLines label="Figuring out what a helper would need to know…" />
      ) : (
        questions.map((q) => (
          <div key={q.question} className="flex flex-col gap-3">
            <span className="font-medium">{q.question}</span>
            <ChipGroup
              options={q.options}
              value={answers[q.question]}
              onChange={(a) => setAnswers((prev) => ({ ...prev, [q.question]: a }))}
            />
          </div>
        ))
      )}
      <div className="mt-auto flex flex-col gap-2">
        <Button size="lg" className="h-12 text-base" disabled={!questions} onClick={next}>
          Next
        </Button>
        <Button variant="ghost" disabled={!questions} onClick={next}>
          Skip
        </Button>
      </div>
    </>
  );
}
