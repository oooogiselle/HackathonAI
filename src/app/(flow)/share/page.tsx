"use client";

// Step 5: share preview. The only place an ask can be posted, and only on tap.
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";

import { useRequireNeed } from "@/components/ask/flow-provider";
import { MessagePreview } from "@/components/ask/message-preview";
import { StepHeader } from "@/components/ask/step-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatPostMessage } from "@/lib/ask/format";
import { findGroup, GROUPS } from "@/lib/ask/mock-data";
import { siteUrl } from "@/lib/site-url";
import { postAsk, scrubForAnonymous } from "@/server/actions/ask";

export default function SharePage() {
  const router = useRouter();
  const { state, update } = useRequireNeed();
  const [scrubbing, startScrub] = useTransition();
  const [posting, startPost] = useTransition();
  // Undo keeps the user anonymous but posts their original wording.
  const [undoScrub, setUndoScrub] = useState(false);

  const group = state.groupId ? findGroup(state.groupId) : undefined;
  const canShare = state.category === "none";
  const useScrubbed = state.anonymous && state.scrub && !undoScrub;
  const text = useScrubbed ? state.scrub!.text : state.ask;
  const displayName = state.anonymous ? null : state.name.trim() || null;
  const preview = formatPostMessage(text, displayName, `${siteUrl()}/h/••••••`);

  function setAnonymous(anonymous: boolean) {
    update({ anonymous });
    setUndoScrub(false);
    if (anonymous && !state.scrub) {
      startScrub(async () => update({ scrub: await scrubForAnonymous(state.ask) }));
    }
  }

  function post() {
    if (!group) return;
    startPost(async () => {
      const result = await postAsk({
        groupId: group.id,
        text,
        anonymous: state.anonymous,
        name: displayName ?? undefined,
      });
      if ("error" in result) return void toast.error(result.error);
      update({ token: result.token });
      router.push(`/matched/${result.token}`);
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
          <option value="" disabled>
            Pick a group
          </option>
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
        {!state.anonymous && (
          <Input
            value={state.name}
            onChange={(e) => update({ name: e.target.value })}
            placeholder="Your first name"
            className="h-11"
            maxLength={40}
          />
        )}
      </section>

      <section className="flex flex-col gap-2 rounded-xl border p-3 text-sm">
        <h2 className="font-medium">Privacy check</h2>
        <p>✓ No visa, money, or health details detected</p>
        <p>
          {state.anonymous
            ? "✓ Your name is hidden. The group won't be told who helped you"
            : `• ${displayName ?? "Add your first name"} will be shown to ${group?.members ?? "the"} members`}
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

      <Button
        size="lg"
        className="mt-auto h-12 text-base"
        disabled={!group || posting || scrubbing}
        onClick={post}
      >
        {posting ? "Posting…" : group ? `Post to ${group.name}` : "Pick a group"}
      </Button>
      <p className="text-center text-xs text-muted-foreground">
        Posts once, as shown. The Ask bot can&apos;t read the group.
      </p>
    </>
  );
}
