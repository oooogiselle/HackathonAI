"use client";

// Quick check: both entry points (Post a need, and the AI path) land here, and
// checkSafety runs again on the final wording, so the check always sees what
// will actually be posted. Crisis goes to support resources. Graded work is
// never posted or matched: it gets "We can't post this" with an honest rewrite
// (getRewrite) and tutoring. Personal topics stay private.
import { Check, Lock, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useRequireNeed } from "@/components/ask/flow-provider";
import { LoadingLines } from "@/components/ask/loading-line";
import { PartTicket } from "@/components/ask/part-ticket";
import { StepHeader } from "@/components/ask/step-header";
import { Button } from "@/components/ui/button";
import type { RewriteSuggestion } from "@/lib/ai/ask/suggest-rewrite";
import type { SafetyResult } from "@/lib/ask/types";
import { checkSafety, getRewrite } from "@/server/actions/ask";

export default function QuickCheckPage() {
  const router = useRouter();
  const { state, ready, update } = useRequireNeed();
  const part = state.parts[state.activePart];
  const [safety, setSafety] = useState<SafetyResult | null>(null);
  // Graded work: the suggested rewrite (undefined while it loads).
  const [rewrite, setRewrite] = useState<RewriteSuggestion | null>();

  useEffect(() => {
    if (!ready || !part) return;
    let live = true;
    const need = `${part.what}. ${part.text}`;
    checkSafety(need).then((result) => {
      if (!live) return;
      if (result.category === "crisis") return router.replace("/resources?type=crisis");
      setSafety(result);
      if (result.category === "academic") {
        getRewrite(need).then((r) => live && setRewrite(r));
      }
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

  // Swaps in the rewrite; the effect above checks the new wording again.
  function applyRewrite(r: RewriteSuggestion) {
    const parts = state.parts.map((p, i) =>
      i === state.activePart ? { ...p, what: r.what, text: r.text, minutes: r.minutes } : p,
    );
    setSafety(null);
    setRewrite(undefined);
    update({ parts, ask: r.text });
  }

  if (safety?.category === "academic") {
    return (
      <>
        <StepHeader title="Quick check" backHref={editHref} />
        <PartTicket part={part} />
        <ul className="flex flex-col divide-y divide-background overflow-hidden rounded-3xl bg-card text-[15px]">
          <CheckRow ok>Something a classmate can help with</CheckRow>
          <CheckRow blocked>Asks someone to do graded work for you</CheckRow>
          <CheckRow ok>Not a personal topic</CheckRow>
        </ul>
        <section className="flex flex-col gap-1 rounded-3xl bg-card p-4">
          <h2 className="text-lg font-bold">We can&apos;t post this</h2>
          <p className="text-sm text-muted-foreground">
            Having someone do graded work for you breaks the honor code, so it won&apos;t go to the
            board, GroupMe or any helper.
          </p>
        </section>
        <section className="flex flex-col gap-3 rounded-3xl bg-pay p-4">
          <h2 className="text-xs font-bold tracking-wide text-secondary-foreground uppercase">
            Try this instead
          </h2>
          {rewrite === undefined ? (
            <LoadingLines label="Finding a way a classmate can help…" />
          ) : rewrite ? (
            <>
              <p className="font-semibold">{rewrite.what}</p>
              <p className="text-sm">&ldquo;{rewrite.text}&rdquo;</p>
              <Button className="h-11" onClick={() => applyRewrite(rewrite)}>
                Use this rewrite
              </Button>
            </>
          ) : (
            <p className="text-sm">Tutors can help you do it yourself.</p>
          )}
          <Button
            variant="outline"
            className="h-11"
            onClick={() => router.push("/resources?type=tutoring")}
          >
            Book tutoring
          </Button>
        </section>
        <p className="text-xs text-muted-foreground">
          We also can&apos;t post asks that are unsafe, illegal, or aimed at a specific person.
        </p>
        <div className="mt-auto flex flex-col gap-2">
          <Button size="lg" className="h-12 text-base" onClick={() => router.push(editHref)}>
            Rewrite my ask
          </Button>
        </div>
      </>
    );
  }

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

function CheckRow({
  ok,
  blocked,
  children,
}: {
  ok?: boolean;
  blocked?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-3.5">
      <span
        className={`flex size-6 shrink-0 items-center justify-center rounded-full ${
          ok
            ? "bg-primary text-primary-foreground"
            : blocked
              ? "bg-destructive text-white"
              : "bg-muted text-foreground"
        }`}
      >
        {ok ? (
          <Check className="size-3.5" />
        ) : blocked ? (
          <X className="size-3.5" />
        ) : (
          <Lock className="size-3.5" />
        )}
      </span>
      {children}
    </li>
  );
}
