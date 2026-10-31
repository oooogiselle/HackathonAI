"use client";

// Quick check: both entry points (Post a need, and the AI path) land here, and
// checkSafety runs again on the final wording, so the check always sees what
// will actually be posted. Crisis and schoolwork go to support resources and
// are never posted or matched; personal topics stay private.
import { Check, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useRequireNeed } from "@/components/ask/flow-provider";
import { LoadingLines } from "@/components/ask/loading-line";
import { PartTicket } from "@/components/ask/part-ticket";
import { StepHeader } from "@/components/ask/step-header";
import { Button } from "@/components/ui/button";
import type { SafetyResult } from "@/lib/ask/types";
import { checkSafety } from "@/server/actions/ask";

export default function QuickCheckPage() {
  const router = useRouter();
  const { state, ready, update } = useRequireNeed();
  const part = state.parts[state.activePart];
  const [safety, setSafety] = useState<SafetyResult | null>(null);

  useEffect(() => {
    if (!ready || !part) return;
    let live = true;
    checkSafety(`${part.what}. ${part.text}`).then((result) => {
      if (!live) return;
      if (result.category === "crisis") return router.replace("/resources?type=crisis");
      if (result.category === "academic") return router.replace("/resources?type=tutoring");
      setSafety(result);
    });
    return () => {
      live = false;
    };
    // Re-check only when the wording changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, part?.what, part?.text, router]);

  if (!part) return null;
  const sensitive = safety?.category === "sensitive";
  const editHref = state.mode === "ai" ? "/draft" : "/ask";

  function next() {
    if (!safety) return;
    const parts = state.parts.map((p, i) =>
      i === state.activePart ? { ...p, category: safety.category } : p,
    );
    update({
      parts,
      category: safety.category,
      keepPrivate: sensitive || state.keepPrivate,
      // Personal topics never reach the board or a group.
      toBoard: sensitive || state.keepPrivate ? false : state.toBoard,
      groupId: sensitive || state.keepPrivate ? undefined : state.groupId,
      where: undefined,
    });
    router.push("/where");
  }

  return (
    <>
      <StepHeader title="Quick check" backHref={editHref} />

      <PartTicket part={part} />

      {!safety ? (
        <LoadingLines label="Checking your ask…" />
      ) : (
        <>
          <ul className="flex flex-col divide-y divide-background overflow-hidden rounded-3xl bg-card text-[15px]">
            <CheckRow ok>Something a classmate can help with</CheckRow>
            <CheckRow ok>Not graded schoolwork</CheckRow>
            {sensitive ? (
              <CheckRow>Personal topic: it stays private</CheckRow>
            ) : (
              <CheckRow ok>Not a personal topic</CheckRow>
            )}
          </ul>

          <section className="flex flex-col gap-1 rounded-3xl bg-pay p-4">
            <h2 className="text-lg font-bold">{sensitive ? "Private topic" : "Everyday ask"}</h2>
            <p className="text-sm text-secondary-foreground">
              {sensitive
                ? "It won't go to the board or any group. Only helpers you pick will see it."
                : "You can post it to the needs board, share it to GroupMe, or ask a few helpers privately."}
            </p>
          </section>

          {!sensitive && (
            <button
              type="button"
              aria-pressed={state.keepPrivate}
              onClick={() => update({ keepPrivate: !state.keepPrivate })}
              className="flex items-center gap-3 rounded-3xl bg-card p-4 text-left"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
                <Lock className="size-4" />
              </span>
              <span className="flex flex-1 flex-col">
                <span className="font-semibold">Feels personal? Keep it private</span>
                <span className="text-sm text-muted-foreground">
                  Only helpers you pick will see it
                </span>
              </span>
              <span
                aria-hidden
                className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
                  state.keepPrivate ? "justify-end bg-primary" : "justify-start bg-input"
                }`}
              >
                <span className="size-5 rounded-full bg-white shadow" />
              </span>
            </button>
          )}

          <p className="text-xs text-muted-foreground">
            Personal topics stay private automatically. Graded schoolwork goes to tutoring, and if
            it sounds like you need support, we&apos;ll show support resources instead.
          </p>
        </>
      )}

      <div className="mt-auto flex flex-col gap-2">
        <Button size="lg" className="h-12 text-base" disabled={!safety} onClick={next}>
          Continue
        </Button>
        <Button variant="ghost" className="h-11" onClick={() => router.push(editHref)}>
          Edit my ask
        </Button>
      </div>
    </>
  );
}

function CheckRow({ ok, children }: { ok?: boolean; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
          ok ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        }`}
      >
        {ok ? <Check className="size-3.5" /> : <Lock className="size-3.5" />}
      </span>
      {children}
    </li>
  );
}
