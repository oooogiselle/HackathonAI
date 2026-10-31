"use client";

// Share to GroupMe: pick the group and see exactly what the bot will post.
// Nothing is posted here; "Use this group" goes back to Where it goes, and the
// post happens there on the Post tap.
import { useRouter } from "next/navigation";
import { useState } from "react";

import { useRequireNeed } from "@/components/ask/flow-provider";
import { MessagePreview } from "@/components/ask/message-preview";
import { StepHeader } from "@/components/ask/step-header";
import { Button } from "@/components/ui/button";
import { formatPostMessage } from "@/lib/ask/format";
import { GROUPS } from "@/lib/ask/mock-data";
import { siteUrl } from "@/lib/site-url";

export default function SharePage() {
  const router = useRouter();
  const { state, update } = useRequireNeed();
  const [groupId, setGroupId] = useState(state.groupId ?? GROUPS[0].id);
  const group = GROUPS.find((g) => g.id === groupId) ?? GROUPS[0];

  const canShare = state.category === "none" && !state.keepPrivate;
  const text = state.anonymous && state.scrub ? state.scrub.text : state.ask;
  const preview = formatPostMessage(text, null, `${siteUrl()}/h/••••••`);

  function useGroup() {
    update({ groupId: group.id, toBoard: true });
    router.push("/where");
  }

  if (!canShare) {
    return (
      <>
        <StepHeader title="Share to GroupMe" backHref="/where" />
        <p className="text-muted-foreground">
          Group sharing is off for this ask because it&apos;s a personal topic. Ask a few helpers
          privately instead.
        </p>
      </>
    );
  }

  return (
    <>
      <StepHeader title="Post to a group" eyebrow="Share to GroupMe" backHref="/where" />

      <section className="flex flex-col gap-2">
        <h2 className="text-[15px] font-bold">
          Choose a group
        </h2>
        {GROUPS.map((g) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={g.id === group.id}
            onClick={() => setGroupId(g.id)}
            className={`flex flex-col rounded-3xl border-2 bg-card p-4 text-left ${
              g.id === group.id ? "border-primary" : "border-transparent"
            }`}
          >
            <span className="font-semibold">{g.name}</span>
            <span className="text-sm text-muted-foreground">
              {g.platform === "groupme" ? "GroupMe" : "Slack"} · {g.members} members
            </span>
          </button>
        ))}
      </section>

      <MessagePreview groupName={group.name} message={preview} />

      <p className="text-xs text-muted-foreground">
        The bot only posts. It can&apos;t read messages in the group. It posts only when you tap
        Post, and each group gets up to 3 posts a day. Group hasn&apos;t added the bot? Post to the
        board and paste your ask&apos;s link yourself.
      </p>

      <Button size="lg" className="mt-auto h-12 text-base" onClick={useGroup}>
        Use this group
      </Button>
    </>
  );
}
