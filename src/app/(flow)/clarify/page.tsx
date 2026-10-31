"use client";

// Step 2: at most 2 quick questions, answered with chips or in your own words.
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

import { ChipGroup } from "@/components/ask/chip-group";
import { useRequireNeed } from "@/components/ask/flow-provider";
import { LoadingLines } from "@/components/ask/loading-line";
import { StepHeader } from "@/components/ask/step-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ClarifyAnswer } from "@/lib/ask/types";
import { checkSafety, getClarifyQuestions } from "@/server/actions/ask";
import { NAV } from "@/lib/ask/nav";

export default function ClarifyPage() {
  const router = useRouter();
  const { state, ready, update } = useRequireNeed();
  const [answers, setAnswers] = useState<Record<string, string>>({});
  // Questions whose answer was typed rather than picked from a chip.
  const [typed, setTyped] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();
  const questions = state.questions;

  useEffect(() => {
    if (!ready || !state.need || questions) return;
    getClarifyQuestions(state.need).then((q) => update({ questions: q }));
  }, [ready, state.need, questions, update]);

  function setAnswer(question: string, answer: string, isTyped: boolean) {
    setAnswers((prev) => ({ ...prev, [question]: answer }));
    setTyped((prev) => ({ ...prev, [question]: isTyped }));
  }

  function next(skip = false) {
    const picked: ClarifyAnswer[] = skip
      ? []
      : (questions ?? [])
          .map((q) => ({ question: q.question, answer: (answers[q.question] ?? "").trim() }))
          .filter((a) => a.answer);
    startTransition(async () => {
      // Typed answers are new text from the student, so they get the same check as Home.
      const typedText = picked
        .filter((a) => typed[a.question])
        .map((a) => a.answer)
        .join("\n");
      if (typedText) {
        const safety = await checkSafety(typedText);
        if (safety.category === "crisis") return router.push("/resources?type=crisis");
        if (safety.category === "academic") return router.push("/resources?type=tutoring");
      }
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
      router.push("/draft", { transitionTypes: NAV.forward });
    });
  }

  return (
    <>
      <StepHeader
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
              value={typed[q.question] ? undefined : answers[q.question]}
              onChange={(a) => setAnswer(q.question, a, false)}
            />
            <Input
              aria-label={`${q.question} (your own answer)`}
              placeholder="Or type your own"
              maxLength={300}
              value={typed[q.question] ? answers[q.question] : ""}
              onChange={(e) => setAnswer(q.question, e.target.value, true)}
            />
          </div>
        ))
      )}
      <div className="mt-auto flex flex-col gap-2">
        <Button
          size="lg"
          className="h-12 text-base"
          disabled={!questions || pending}
          onClick={() => next()}
        >
          {pending ? "Checking…" : "Next"}
        </Button>
        <Button variant="ghost" disabled={!questions || pending} onClick={() => next(true)}>
          Skip
        </Button>
      </div>
    </>
  );
}
