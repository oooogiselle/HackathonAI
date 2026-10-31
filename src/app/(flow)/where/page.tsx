"use client";

// Step 4: who or where to ask. Sensitive asks get peers + offices, no group chats.
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useRequireNeed } from "@/components/ask/flow-provider";
import { HelperCard } from "@/components/ask/helper-card";
import { LoadingLines } from "@/components/ask/loading-line";
import { StepHeader } from "@/components/ask/step-header";
import { suggestWhere } from "@/server/actions/ask";

export default function WherePage() {
  const router = useRouter();
  const { state, ready, update } = useRequireNeed();
  const where = state.where;

  useEffect(() => {
    if (!ready || !state.ask || where) return;
    suggestWhere(state.ask).then((w) => update({ where: w, category: w.category }));
  }, [ready, state.ask, where, update]);

  function pickGroup(groupId: string) {
    update({ groupId, scrub: undefined });
    router.push("/share");
  }

  return (
    <>
      <StepHeader step={4} title="Where to ask" backHref={state.mode === "form" ? "/" : "/draft"} />
      <blockquote className="rounded-xl bg-muted px-4 py-3 text-sm">{state.ask}</blockquote>

      {!where ? (
        <LoadingLines label="Finding people and places that can help…" />
      ) : (
        <>
          {where.helpers.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-medium">People who might help</h2>
              {where.helpers.map((s) => (
                <HelperCard key={s.helper.id} suggestion={s} />
              ))}
              {/* TODO(helper-inbox): let the user send the ask to one person directly. */}
              <p className="text-xs text-muted-foreground">
                Asking one person directly is coming soon.
              </p>
            </section>
          )}

          {where.groups.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-medium">Partner group chats</h2>
              {where.groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => pickGroup(g.id)}
                  className="flex items-center justify-between gap-3 rounded-xl border p-3 text-left hover:bg-muted"
                >
                  <span className="flex flex-col gap-0.5">
                    <span className="font-medium">{g.name}</span>
                    <span className="text-sm text-muted-foreground">
                      {g.platform === "groupme" ? "GroupMe" : "Slack"} · {g.members} members ·{" "}
                      {g.description}
                    </span>
                  </span>
                  <span className="text-sm text-primary">Preview →</span>
                </button>
              ))}
            </section>
          )}

          {where.offices.length > 0 && (
            <section className="flex flex-col gap-2">
              <h2 className="font-medium">Campus offices</h2>
              <p className="text-sm text-muted-foreground">
                This ask has personal details (like visa, money, or health), so we won&apos;t
                suggest posting it in a group chat.
              </p>
              {where.offices.map((o) => (
                <div key={o.name} className="rounded-xl border p-3">
                  <div className="font-medium">{o.name}</div>
                  <div className="text-sm text-muted-foreground">{o.why}</div>
                </div>
              ))}
            </section>
          )}
        </>
      )}
    </>
  );
}
