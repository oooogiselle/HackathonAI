"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Star, X } from "lucide-react";
import { toast } from "sonner";

import { ToggleChip } from "@/components/ask/form-bits";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { whenLabel } from "@/lib/ask/card-format";
import { formatCents } from "@/lib/ask/fees";
import type { ReviewContext } from "@/lib/ask/reviews";
import { REVIEW_TAGS, type ReviewTag } from "@/lib/ask/types";
import { submitReview } from "@/server/actions/reviews";
import { cn } from "cn";

const TIP_CHOICES = [
  { label: "None", cents: 0 },
  { label: "$2", cents: 200 },
  { label: "$5", cents: 500 },
];
const METHOD_LABEL = { venmo: "Venmo", paypal: "PayPal", card: "card" } as const;

// Same rules as the server (src/lib/ask/reviews.ts).
function pointsForStars(stars: number) {
  return stars >= 4 ? 10 : stars === 3 ? 5 : 0;
}

function Card({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3 rounded-3xl bg-card p-4">
      {title && <h2 className="text-[15px] font-bold">{title}</h2>}
      {children}
    </section>
  );
}

export function ReviewForm({
  token,
  page,
  now,
}: {
  token: string;
  page: ReviewContext;
  now: number;
}) {
  const router = useRouter();
  const existing = page.review;
  const editable = !existing || existing.editableUntil > now;
  const [stars, setStars] = useState(existing?.stars ?? 0);
  const [tags, setTags] = useState<ReviewTag[]>(existing?.tags ?? []);
  const [comment, setComment] = useState(existing?.comment ?? "");
  const [showName, setShowName] = useState(existing?.showName ?? false);
  const [tipChoice, setTipChoice] = useState<number | "other">(0);
  const [otherTip, setOtherTip] = useState("");
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();

  const canTip = Boolean(page.method) && !existing;
  const tipCents = tipChoice === "other" ? Math.round((Number(otherTip) || 0) * 100) : tipChoice;
  const helper = `${page.helperFirstName}${page.helperYear ? `, ${page.helperYear}` : ""}`;

  function toggle(tag: ReviewTag) {
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));
  }

  function submit() {
    setError(undefined);
    if (!stars) return setError("Pick 1 to 5 stars.");
    if (tipCents < 0 || tipCents > 5000) return setError("Tips are $0 to $50.");
    start(async () => {
      const result = await submitReview({
        token,
        stars,
        tags,
        comment: comment.trim() || undefined,
        showName,
        tipCents: canTip ? tipCents : 0,
      });
      if ("error" in result) return setError(result.error);
      toast.success(result.created ? "Thanks for rating your helper" : "Review updated");
      router.push(`/h/${token}`);
      router.refresh();
    });
  }

  return (
    <>
      <header className="flex items-center justify-between pt-2">
        <Link
          href={`/h/${token}`}
          aria-label="Close"
          className="flex size-11 items-center justify-center rounded-full bg-card shadow-sm"
        >
          <X aria-hidden className="size-5" />
        </Link>
        <h1 className="text-[17px] font-extrabold">Rate your helper</h1>
        <Link href={`/h/${token}`} className="text-sm font-semibold text-muted-foreground">
          Skip
        </Link>
      </header>

      <Card>
        <div className="flex items-center gap-3">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-lg font-bold text-primary-foreground">
            {page.helperFirstName.slice(0, 1).toUpperCase()}
          </span>
          <span className="flex flex-col">
            <span className="font-bold">{page.title}</span>
            <span className="text-sm text-muted-foreground">
              Helped by {helper}
              {page.startsAt ? ` · ${whenLabel(page.startsAt)}` : ""}
            </span>
          </span>
        </div>
      </Card>

      <Card title="How did it go?">
        <div role="radiogroup" aria-label="Stars" className="flex items-center gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={stars === n}
              aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
              disabled={!editable}
              onClick={() => setStars(n)}
              className="p-1"
            >
              <Star
                aria-hidden
                className={cn(
                  "size-9",
                  n <= stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/40",
                )}
              />
            </button>
          ))}
          <span className="ml-2 text-sm font-semibold text-muted-foreground">
            {stars ? `${stars} of 5` : "Tap to rate"}
          </span>
        </div>
      </Card>

      <Card title="What went well">
        <div className="flex flex-wrap gap-2">
          {REVIEW_TAGS.map((tag) => (
            <ToggleChip
              key={tag}
              label={tag}
              pressed={tags.includes(tag)}
              onClick={() => editable && toggle(tag)}
            />
          ))}
        </div>
      </Card>

      <Card title="Comment">
        <Textarea
          aria-label="Comment"
          value={comment}
          maxLength={500}
          disabled={!editable}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Optional. What made it easy?"
          className="min-h-24 text-base"
        />
        <p className="text-xs text-muted-foreground">
          Keep it respectful. No personal contact details.
        </p>
      </Card>

      <Card title="Credit for helper">
        {page.releasedCents !== undefined && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Payment released</span>
            <span className="font-semibold">{formatCents(page.releasedCents)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Trust points added</span>
          <span className="font-semibold">+{pointsForStars(stars)}</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Points show on the helper&apos;s profile and help other members choose who to trust.
          Points can&apos;t be bought or sold.
        </p>
      </Card>

      {canTip && (
        <Card title="Add a tip">
          <p className="-mt-2 text-xs text-muted-foreground">
            Optional. Goes 100% to the helper, minus payment fees.
          </p>
          <div className="flex flex-wrap gap-2">
            {TIP_CHOICES.map((t) => (
              <ToggleChip
                key={t.label}
                label={t.label}
                pressed={tipChoice === t.cents}
                onClick={() => setTipChoice(t.cents)}
              />
            ))}
            <ToggleChip
              label="Other"
              pressed={tipChoice === "other"}
              onClick={() => setTipChoice("other")}
            />
          </div>
          {tipChoice === "other" && (
            <Input
              aria-label="Tip in dollars"
              type="number"
              inputMode="decimal"
              min={0}
              max={50}
              step={1}
              value={otherTip}
              onChange={(e) => setOtherTip(e.target.value)}
              className="w-28"
            />
          )}
          {tipCents > 0 && (
            <p className="text-sm">
              Tip charged today: <span className="font-semibold">{formatCents(tipCents)}</span> +
              fees, to the {METHOD_LABEL[page.method!]} you used to hold this ask. Demo: no real
              payment is made.
            </p>
          )}
        </Card>
      )}
      {existing && existing.tipCents > 0 && (
        <p className="text-sm text-muted-foreground">
          You tipped {formatCents(existing.tipCents)}. Tips can&apos;t be changed.
        </p>
      )}

      <button
        type="button"
        role="switch"
        aria-checked={showName}
        disabled={!editable}
        onClick={() => setShowName(!showName)}
        className="flex items-center gap-3 rounded-3xl bg-card p-4 text-left"
      >
        <span className="flex flex-1 flex-col">
          <span className="font-semibold">Show my name</span>
          <span className="text-sm text-muted-foreground">Off means your review is anonymous</span>
        </span>
        <span
          aria-hidden
          className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
            showName ? "justify-end bg-primary" : "justify-start bg-input"
          }`}
        >
          <span className="size-5 rounded-full bg-white shadow" />
        </span>
      </button>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      <div className="mt-auto flex flex-col gap-2">
        {editable ? (
          <Button size="lg" className="h-12 text-base" disabled={pending} onClick={submit}>
            {pending ? "Sending…" : existing ? "Update review" : "Submit review"}
          </Button>
        ) : (
          <p className="text-center text-sm text-muted-foreground">
            This review can no longer be edited.
          </p>
        )}
        <p className="text-center text-xs text-muted-foreground">
          Reviews can be edited for 24 hours.
        </p>
      </div>
    </>
  );
}
