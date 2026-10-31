"use client";

// Step 5: share preview. The only place an ask can be posted, and only on tap.
// "Post" puts it on the needs board; if a group is picked, the bot also shares
// the same card there (one ask, one card). Then the asker lands on the task page.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";

import { useRequireNeed } from "@/components/ask/flow-provider";
import { MessagePreview } from "@/components/ask/message-preview";
import { StepHeader } from "@/components/ask/step-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { formatPostMessage } from "@/lib/ask/format";
import { findGroup, GROUPS } from "@/lib/ask/mock-data";
import { siteUrl } from "@/lib/site-url";
import type { AskCategory, AskPart } from "@/lib/ask/types";
import { scrubForAnonymous } from "@/server/actions/ask";
import { postToBoard, shareCardToGroup } from "@/server/actions/board";
import { getMe, type Me } from "@/server/actions/session";

function boardCategory(part: AskPart | undefined): AskCategory {
  const interests = part?.helper.interests ?? [];
  return interests.includes("rides") || interests.includes("moving") ? "errands" : "other";
}

function toMs(iso: string | undefined) {
  const ms = iso ? Date.parse(iso) : NaN;
  return Number.isFinite(ms) ? ms : undefined;
}

export default function SharePage() {
  const router = useRouter();
  const { state, update } = useRequireNeed();
  const [scrubbing, startScrub] = useTransition();
  const [posting, startPost] = useTransition();
  // Undo keeps the user anonymous but posts their original wording.
  const [undoScrub, setUndoScrub] = useState(false);
  // undefined while loading; null = signed out.
  const [me, setMe] = useState<Me | null>();

  useEffect(() => {
    getMe().then(setMe);
  }, []);

  const group = state.groupId ? findGroup(state.groupId) : undefined;
  const canShare = state.category === "none";
  const useScrubbed = state.anonymous && state.scrub && !undoScrub;
  const text = useScrubbed ? state.scrub!.text : state.ask;
  const displayName = state.anonymous ? null : (me?.firstName ?? null);
  const part = state.parts[state.activePart];
  const preview = formatPostMessage(text, displayName, `${siteUrl()}/h/••••••`);

  function setAnonymous(anonymous: boolean) {
    update({ anonymous });
    setUndoScrub(false);
    if (anonymous && !state.scrub) {
      startScrub(async () => update({ scrub: await scrubForAnonymous(state.ask) }));
    }
  }

  function post() {
    if (!me) return;
    startPost(async () => {
      const posted = await postToBoard({
        title: part?.what || text.slice(0, 80),
        text,
        category: boardCategory(part),
        minutes: part?.minutes ?? 30,
        price: part?.priceSet ?? 0,
        anonymous: state.anonymous,
        startsAt: toMs(part?.startsAt),
        expiresAt: toMs(part?.deadline),
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

  if (!canShare) {
    return (
      <>
        <StepHeader step={5} title="Share preview" backHref="/where" />
        <p className="text-muted-foreground">
          Group sharing is off for this ask because it includes personal details. Try the people or
          offices on the previous step instead.
        </p>
      </>
    );
  }

  return (
    <>
      <StepHeader step={5} title="Share preview" backHref="/where" />

      <section className="flex flex-col gap-2">
        <Label htmlFor="group">Group</Label>
        <select
          id="group"
          value={state.groupId ?? ""}
          onChange={(e) => update({ groupId: e.target.value })}
          className="h-11 rounded-lg border border-input bg-transparent px-3 text-base"
        >
          <option value="">Board only (no group)</option>
          {GROUPS.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name} ({g.platform === "groupme" ? "GroupMe" : "Slack"})
            </option>
          ))}
        </select>
      </section>

      <section className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1 text-sm">
          {[
            { label: "Use my first name", anon: false },
            { label: "Post anonymously", anon: true },
          ].map((o) => (
            <button
              key={o.label}
              type="button"
              aria-pressed={state.anonymous === o.anon}
              onClick={() => setAnonymous(o.anon)}
              className={
                state.anonymous === o.anon
                  ? "rounded-md bg-background py-2 font-medium shadow-sm"
                  : "rounded-md py-2 text-muted-foreground"
              }
            >
              {o.label}
            </button>
          ))}
        </div>
        {!state.anonymous && me && (
          <p className="text-sm text-muted-foreground">Shown as {me.firstName}.</p>
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-xl border p-3 text-sm">
        <h2 className="font-medium">Privacy check</h2>
        <p>✓ No visa, money, or health details detected</p>
        <p>
          {state.anonymous
            ? "✓ Your name is hidden. The group won't be told who helped you"
            : `• ${displayName ?? "Your first name"} will be shown on the board${group ? ` and to ${group.members} ${group.name} members` : ""}`}
        </p>
        {state.anonymous &&
          (scrubbing ? (
            <p className="text-muted-foreground">Checking for identifying details…</p>
          ) : state.scrub && state.scrub.removed.length > 0 ? (
            <div className="flex flex-col gap-1">
              <p>
                {undoScrub ? "• Kept your original wording:" : "✓ Removed identifying details:"}
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
            state.scrub && <p>✓ No identifying details found</p>
          ))}
      </section>

      {group && <MessagePreview groupName={group.name} message={preview} />}

      {me === null ? (
        <Link
          href="/signin?next=/share"
          className={buttonVariants({ size: "lg", className: "mt-auto h-12 text-base" })}
        >
          Sign in to post
        </Link>
      ) : (
        <Button
          size="lg"
          className="mt-auto h-12 text-base"
          disabled={!me || posting || scrubbing}
          onClick={post}
        >
          {posting
            ? "Posting…"
            : group
              ? `Post to the board and ${group.name}`
              : "Post to the board"}
        </Button>
      )}
      <p className="text-center text-xs text-muted-foreground">
        Posts once, as shown. The Ask bot can&apos;t read any group.
      </p>
    </>
  );
}
