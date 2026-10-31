"use client";

// Ask privately: 2 to 3 helpers likely to say yes (matchHelpers: interests,
// free/busy, weekly limits, payment eligibility). Only the people picked see
// the ask; nothing is sent until "Send to N people". The only route for
// personal topics (visa, money, health), which never reach the board or a group.
import { Check, Lock } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { useRequireNeed } from "@/components/ask/flow-provider";
import { LoadingLines } from "@/components/ask/loading-line";
import { PartTicket } from "@/components/ask/part-ticket";
import { StepHeader } from "@/components/ask/step-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { guessCategory } from "@/lib/ask/card-format";
import type { MatchSuggestion } from "@/lib/ask/types";
import { createPrivateAsk } from "@/server/actions/board";
import { matchHelpers, sendPrivately } from "@/server/actions/private";
import { getMe, type Me } from "@/server/actions/session";
import { cn } from "cn";

const MAX_PICKS = 3;

function toMs(iso: string | undefined) {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? ms : undefined;
}

export default function PrivatePage() {
  const router = useRouter();
  const { state, ready, update } = useRequireNeed();
  const part = state.parts[state.activePart];
  const isPrivateTopic = state.keepPrivate || state.category === "sensitive";
  // undefined while loading.
  const [matches, setMatches] = useState<MatchSuggestion[]>();
  const [picked, setPicked] = useState<string[]>([]);
  const [me, setMe] = useState<Me | null>();
  const [sending, startSend] = useTransition();

  useEffect(() => {
    getMe().then(setMe);
  }, []);

  useEffect(() => {
    if (!ready || !part) return;
    let live = true;
    matchHelpers({
      // The title often carries the strongest hint ("Someone who has done OPT").
      text: `${part.what}. ${state.ask || part.text}`.slice(0, 1000),
      minutes: part.minutes,
      price: part.priceSet,
      startsAt: toMs(part.startsAt),
      interests: part.helper.interests,
      needs: part.helper.needs,
    }).then((found) => {
      if (!live) return;
      setMatches(found);
      // The two likeliest yeses, ready to send; the student can change it.
      setPicked(found.slice(0, 2).map((m) => m.helper.id));
    });
    return () => {
      live = false;
    };
  }, [ready, part, state.ask]);

  if (!part) return null;

  function toggle(id: string) {
    setPicked((p) =>
      p.includes(id) ? p.filter((x) => x !== id) : p.length < MAX_PICKS ? [...p, id] : p,
    );
  }

  function send() {
    if (!part || picked.length === 0) return;
    startSend(async () => {
      const deadline = toMs(part.deadline);
      const created = await createPrivateAsk({
        title: part.what || state.ask.slice(0, 80),
        text: state.ask || part.text,
        category: part.askCategory ?? guessCategory(part),
        payType: part.payType,
        minutes: part.minutes,
        price: part.priceSet,
        anonymous: state.anonymous,
        startsAt: toMs(part.startsAt),
        neededBy: deadline,
        ...(deadline ? { expiresAt: deadline } : { expiresIn: "24h" as const }),
      });
      if ("error" in created) return void toast.error(created.error);
      const sent = await sendPrivately({ token: created.token, helperIds: picked });
      if ("error" in sent) return void toast.error(sent.error);
      toast.success(`Sent to ${picked.length === 1 ? "1 person" : `${picked.length} people`}`);
      router.push(`/h/${created.token}`);
    });
  }

  const paid = part.priceSet > 0;

  // Paid asks only reach helpers who can accept payment; a favor reaches everyone.
  function makeFavor() {
    setMatches(undefined);
    update({
      parts: state.parts.map((p, i) =>
        i === state.activePart ? { ...p, priceSet: 0, payType: "free" as const } : p,
      ),
    });
  }

  return (
    <>
      <StepHeader
        backHref="/where"
        eyebrow={
          <span className="flex items-center gap-1">
            <Lock aria-hidden className="size-3.5" /> Ask privately
          </span>
        }
        title={
          matches && matches.length > 0
            ? `${matches.length} ${matches.length === 1 ? "person" : "people"} likely to say yes`
            : "People likely to say yes"
        }
        subtitle="Pick up to 3. Only they see your ask, and the first yes waits for you to confirm."
      />

      <PartTicket part={part} />

      {!matches ? (
        <LoadingLines label="Finding people who are free and like this kind of help…" />
      ) : matches.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl border border-dashed border-input p-6 text-center">
          <p className="text-sm text-muted-foreground">
            {paid
              ? "Nobody who can accept payment fits this right now. A $0 favor reaches every helper, including students who can't be paid."
              : "Nobody free fits this right now. Try a different time, or fewer must-haves."}
          </p>
          {paid ? (
            <Button variant="outline" onClick={makeFavor}>
              Make it a $0 favor
            </Button>
          ) : (
            <Link href="/ask" className={buttonVariants({ variant: "outline" })}>
              Edit my ask
            </Link>
          )}
        </div>
      ) : (
        <ul className="flex flex-col gap-2" aria-label="Suggested helpers">
          {matches.map(({ helper, why }) => {
            const on = picked.includes(helper.id);
            const full = !on && picked.length >= MAX_PICKS;
            return (
              <li key={helper.id}>
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={on}
                  disabled={full}
                  onClick={() => toggle(helper.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-3xl border-2 bg-card p-4 text-left transition-colors disabled:opacity-50",
                    on ? "border-primary" : "border-transparent",
                  )}
                >
                  <span
                    aria-hidden
                    className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary font-bold text-secondary-foreground"
                  >
                    {helper.firstName[0]}
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="font-semibold">
                      {helper.firstName}{" "}
                      <span className="font-normal text-muted-foreground">· {helper.year}</span>
                    </span>
                    <span className="text-sm text-muted-foreground">{why}</span>
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      "flex size-6 shrink-0 items-center justify-center rounded-lg border-2",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-input",
                    )}
                  >
                    {on && <Check className="size-4" />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {paid && matches && matches.length === 1 && (
        <Button variant="ghost" className="self-start px-0 text-primary" onClick={makeFavor}>
          Only 1 fits. Make it a $0 favor to reach more
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        Suggestions use interests and free/busy times only, never calendar details.
        {paid ? " Everyone listed can accept payment." : ""} Contact details stay hidden until you
        both say yes.
      </p>

      <div className="mt-auto flex flex-col gap-2">
        {me === null ? (
          <Link
            href="/signin?next=/private"
            className={buttonVariants({ size: "lg", className: "text-base" })}
          >
            Sign in to send
          </Link>
        ) : (
          <Button
            size="lg"
            className="text-base"
            disabled={!me || sending || picked.length === 0}
            onClick={send}
          >
            {sending
              ? "Sending…"
              : picked.length === 0
                ? "Pick at least 1 person"
                : `Send to ${picked.length === 1 ? "1 person" : `${picked.length} people`}`}
          </Button>
        )}
        {!isPrivateTopic && (
          <Link href="/where" className={buttonVariants({ variant: "ghost" })}>
            No one fits? Post to the board instead
          </Link>
        )}
      </div>
    </>
  );
}
