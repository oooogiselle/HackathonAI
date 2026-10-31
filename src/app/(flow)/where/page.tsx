"use client";

// Where it goes: pick the board, a GroupMe group (the bot shares the same
// card), or a few matched helpers privately, plus when the ask comes down.
// Private topics ("Kept private") lock the board and groups. Posting happens
// here, only on the Post tap; anonymous posts show what the privacy check
// removed, with Undo.
import { Check, Lock, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { type ExpiryChoice, useRequireNeed } from "@/components/ask/flow-provider";
import { PartTicket } from "@/components/ask/part-ticket";
import { StepHeader } from "@/components/ask/step-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { guessCategory, whenLabel } from "@/lib/ask/card-format";
import { findGroup } from "@/lib/ask/mock-data";
import { scrubForAnonymous } from "@/server/actions/ask";
import { postToBoard, shareCardToGroup } from "@/server/actions/board";
import { getMe, type Me } from "@/server/actions/session";

const EXPIRY: { value: ExpiryChoice; label: string }[] = [
  { value: "3h", label: "3 h" },
  { value: "deadline", label: "Needed by" },
  { value: "24h", label: "24 h" },
  { value: "3d", label: "3 days" },
];

function toMs(iso: string | undefined) {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? ms : undefined;
}

export default function WherePage() {
  const router = useRouter();
  const { state, update } = useRequireNeed();
  const [scrubbing, startScrub] = useTransition();
  const [posting, startPost] = useTransition();
  // Undo keeps the user anonymous but posts their original wording.
  const [undoScrub, setUndoScrub] = useState(false);
  // undefined while loading; null = signed out.
  const [me, setMe] = useState<Me | null>();

  const part = state.parts[state.activePart];
  const isPrivate = state.keepPrivate || state.category === "sensitive";
  const group = !isPrivate && state.groupId ? findGroup(state.groupId) : undefined;
  const deadline = toMs(part?.deadline);

  useEffect(() => {
    getMe().then(setMe);
  }, []);

  // Anonymous is on by default, so run the privacy check as soon as it's needed.
  useEffect(() => {
    if (isPrivate || !state.anonymous || state.scrub || !state.ask) return;
    startScrub(async () => update({ scrub: await scrubForAnonymous(state.ask) }));
  }, [isPrivate, state.anonymous, state.scrub, state.ask, update]);

  if (!part) return null;
  const useScrubbed = state.anonymous && state.scrub && !undoScrub;
  const text = useScrubbed ? state.scrub!.text : state.ask;
  const backHref = "/check";

  function setAnonymous(anonymous: boolean) {
    update({ anonymous });
    setUndoScrub(false);
  }

  function toggleGroup() {
    if (group) return update({ groupId: undefined });
    router.push("/share");
  }

  function post() {
    if (!me || !part) return;
    if (!state.toBoard) return void toast.error("Pick the needs board, or ask helpers privately.");
    startPost(async () => {
      const expiry =
        state.expiry === "deadline"
          ? { expiresAt: deadline }
          : { expiresIn: state.expiry as "3h" | "24h" | "3d" };
      const posted = await postToBoard({
        title: part.what || text.slice(0, 80),
        text,
        category: part.askCategory ?? guessCategory(part),
        payType: part.payType,
        minutes: part.minutes,
        price: part.priceSet,
        anonymous: state.anonymous,
        startsAt: toMs(part.startsAt),
        neededBy: deadline,
        ...expiry,
      });
      if ("error" in posted) return void toast.error(posted.error);
      update({ token: posted.token });

      if (group) {
        const shared = await shareCardToGroup({ token: posted.token, groupId: group.id });
        // The card is already on the board, so go on either way.
        if ("error" in shared) toast.error(`Posted to the board, but: ${shared.error}`);
      }
      router.push(`/h/${posted.token}`);
    });
  }

  return (
    <>
      <StepHeader
        backHref={backHref}
        eyebrow={
          isPrivate ? (
            <span className="flex items-center gap-1">
              <Lock className="size-3.5" /> Private topic
            </span>
          ) : (
            "✓ Everyday ask"
          )
        }
        title={isPrivate ? "This one stays private" : "Where should it go?"}
        subtitle={
          isPrivate
            ? "Personal asks aren't posted to the board or to groups. Only the helpers you pick will see it."
            : undefined
        }
      />

      <PartTicket part={part} />

      <section className="flex flex-col divide-y divide-background overflow-hidden rounded-3xl bg-card">
        <Option
          title="Needs board"
          detail={
            isPrivate ? "Not available for private asks" : "Classmates browsing the board can claim it"
          }
          checked={!isPrivate && state.toBoard}
          disabled={isPrivate}
          onToggle={() =>
            update({ toBoard: !state.toBoard, groupId: state.toBoard ? undefined : state.groupId })
          }
        />
        <Option
          title="Share to GroupMe"
          detail={
            isPrivate
              ? "Not available for private asks"
              : group
                ? `${group.name} · the bot posts once with a claim link`
                : "Bot posts once with a claim link · up to 3 posts per group a day"
          }
          checked={Boolean(group)}
          disabled={isPrivate || !state.toBoard}
          onToggle={toggleGroup}
          action={
            !isPrivate && state.toBoard ? (
              <Link href="/share" className="text-sm font-semibold text-primary">
                Preview
              </Link>
            ) : undefined
          }
        />
        <div className="flex items-center gap-3 p-4">
          <span className="flex size-6 shrink-0 items-center justify-center text-primary">
            <Users className="size-5" />
          </span>
          <span className="flex flex-1 flex-col">
            <span className="font-semibold">Ask matched helpers privately</span>
            <span className="text-sm text-muted-foreground">
              We suggest 2 to 3 people likely to say yes
            </span>
          </span>
          <Link
            href="/private"
            className={buttonVariants({
              variant: isPrivate ? "default" : "outline",
              className: "h-9 px-4",
            })}
          >
            {isPrivate ? "Choose helpers" : "Choose"}
          </Link>
        </div>
      </section>

      {!isPrivate && (
        <>
          <section className="flex flex-col gap-2">
            <h2 className="text-[15px] font-bold">
              Expires in
            </h2>
            <div className="grid grid-cols-4 gap-1 rounded-2xl bg-card p-1">
              {EXPIRY.map((e) => (
                <button
                  key={e.value}
                  type="button"
                  aria-pressed={state.expiry === e.value}
                  disabled={e.value === "deadline" && !deadline}
                  onClick={() => update({ expiry: e.value })}
                  className={`rounded-xl py-2 text-sm font-semibold ${
                    state.expiry === e.value
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground"
                  }`}
                >
                  {e.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              {state.expiry === "deadline" && deadline
                ? `Comes down ${whenLabel(deadline)}, your Needed by time. `
                : ""}
              After that it leaves the board, and the GroupMe link says it expired.
            </p>
          </section>

          <section className="flex flex-col gap-3 rounded-3xl bg-card p-4 text-sm">
            <button
              type="button"
              aria-pressed={state.anonymous}
              onClick={() => setAnonymous(!state.anonymous)}
              className="flex items-center gap-3 text-left"
            >
              <span className="flex flex-1 flex-col">
                <span className="font-semibold">Post anonymously</span>
                <span className="text-muted-foreground">
                  {state.anonymous
                    ? "Your name is hidden on the board and in the group"
                    : `Shown as ${me?.firstName ?? "your first name"}`}
                </span>
              </span>
              <Switch on={state.anonymous} />
            </button>
            {state.anonymous &&
              (scrubbing ? (
                <p className="text-muted-foreground">Checking for identifying details…</p>
              ) : state.scrub && state.scrub.removed.length > 0 ? (
                <div className="flex flex-col gap-1 rounded-2xl bg-muted p-3">
                  <p className="font-semibold">
                    {undoScrub ? "Kept your original wording:" : "Removed identifying details:"}
                  </p>
                  <ul className="ml-5 list-disc text-muted-foreground">
                    {state.scrub.removed.map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                  <Button
                    variant="link"
                    className="self-start px-0"
                    onClick={() => setUndoScrub(!undoScrub)}
                  >
                    {undoScrub ? "Remove them again" : "Undo"}
                  </Button>
                </div>
              ) : (
                state.scrub && (
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <Check className="size-4 text-primary" /> No identifying details found
                  </p>
                )
              ))}
          </section>
        </>
      )}

      <div className="mt-auto flex flex-col gap-2">
        {isPrivate ? null : me === null ? (
          <Link
            href="/signin?next=/where"
            className={buttonVariants({ size: "lg", className: "h-12 text-base" })}
          >
            Sign in to post
          </Link>
        ) : (
          <Button
            size="lg"
            className="h-12 text-base"
            disabled={!me || posting || scrubbing || !state.toBoard}
            onClick={post}
          >
            {posting ? "Posting…" : group ? `Post to the board and ${group.name}` : "Post to the board"}
          </Button>
        )}
        <p className="text-center text-xs text-muted-foreground">
          Nothing is posted until you tap. The DartAsk bot only posts; it can&apos;t read any group.
        </p>
      </div>
    </>
  );
}

function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition-colors ${
        on ? "justify-end bg-primary" : "justify-start bg-input"
      }`}
    >
      <span className="size-5 rounded-full bg-white shadow" />
    </span>
  );
}

function Option({
  title,
  detail,
  checked,
  disabled,
  onToggle,
  action,
}: {
  title: string;
  detail: string;
  checked: boolean;
  disabled?: boolean;
  onToggle: () => void;
  action?: React.ReactNode;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-4 ${disabled ? "opacity-60" : ""}`}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={title}
        disabled={disabled}
        onClick={onToggle}
        className={`flex size-6 shrink-0 items-center justify-center rounded-lg border-2 ${
          checked ? "border-primary bg-primary text-primary-foreground" : "border-input"
        }`}
      >
        {disabled ? <Lock className="size-3" /> : checked && <Check className="size-4" />}
      </button>
      <span className="flex flex-1 flex-col">
        <span className="font-semibold">{title}</span>
        <span className="text-sm text-muted-foreground">{detail}</span>
      </span>
      {action}
    </div>
  );
}
