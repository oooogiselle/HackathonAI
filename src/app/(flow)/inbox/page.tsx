// Inbox tab: All, Actions (needs your tap) and Updates (info only), narrowed by
// topic (Tasks, Groups, Payments). Asks sent to you privately (answer "I can
// help" or "Not this time", no reason needed) count as actions.
import Link from "next/link";

import { SignInPrompt } from "@/components/ask/sign-in-prompt";
import { TabBar } from "@/components/ask/tab-bar";
import { TopBar } from "@/components/ask/top-bar";
import type { InboxTopic } from "@/lib/ask/types";
import { listInbox } from "@/server/actions/inbox";
import { listMyRequests } from "@/server/actions/private";
import { getMe, getMyProfile } from "@/server/actions/session";
import { cn } from "cn";

import { InboxList, PrivateRequests } from "./inbox-list";

const TABS = [
  { id: "all", label: "All" },
  { id: "actions", label: "Actions" },
  { id: "updates", label: "Updates" },
] as const;
type Tab = (typeof TABS)[number]["id"];

const TOPICS: { id?: InboxTopic; label: string }[] = [
  { label: "Everything" },
  { id: "tasks", label: "Tasks" },
  { id: "groups", label: "Groups" },
  { id: "payments", label: "Payments" },
];

function inboxHref(tab: Tab, topic?: InboxTopic) {
  const q = new URLSearchParams();
  if (tab !== "all") q.set("tab", tab);
  if (topic) q.set("topic", topic);
  const query = q.toString();
  return query ? `/inbox?${query}` : "/inbox";
}

export default async function InboxPage({ searchParams }: PageProps<"/inbox">) {
  const params = await searchParams;
  const tab: Tab = TABS.find((t) => t.id === params.tab)?.id ?? "all";
  const topic = TOPICS.find((t) => t.id && t.id === params.topic)?.id;
  const [me, all, requests, profile] = await Promise.all([
    getMe(),
    listInbox(),
    listMyRequests(),
    getMyProfile(),
  ]);
  const unread = all.filter((i) => !i.read).length;
  const inTopic = topic ? all.filter((i) => i.topic === topic) : all;
  const actions = inTopic.filter((i) => i.kind === "action");
  const updates = inTopic.filter((i) => i.kind === "update");
  // Only requests still waiting on an answer; answered ones live on the Claimed tab.
  const waiting =
    "requests" in requests
      ? requests.requests.filter((r) => !r.response && r.card.status === "open")
      : [];
  const showRequests = tab !== "updates" && (!topic || topic === "tasks") && waiting.length > 0;
  const actionCount = all.filter((i) => i.kind === "action" && !i.read).length + waiting.length;

  return (
    <>
      <TopBar title="Inbox" firstName={me?.firstName} next="/inbox" />

      {!me ? (
        <SignInPrompt
          next="/inbox"
          why="When someone claims your ask, or a classmate asks you privately, you'll see it here."
        />
      ) : (
        <>
          <nav aria-label="Inbox" className="flex gap-1 rounded-2xl bg-card p-1">
            {TABS.map((t) => (
              <Link
                key={t.id}
                href={inboxHref(t.id, topic)}
                aria-current={tab === t.id ? "page" : undefined}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2 text-sm",
                  tab === t.id
                    ? "bg-primary font-bold text-primary-foreground"
                    : "font-semibold text-muted-foreground",
                )}
              >
                {t.label}
                {t.id === "actions" && actionCount > 0 && (
                  <span className="rounded-full bg-pay px-1.5 text-[11px] font-bold text-primary">
                    {actionCount}
                  </span>
                )}
              </Link>
            ))}
          </nav>
          <nav aria-label="Topic" className="-mx-4 flex gap-2 overflow-x-auto px-4">
            {TOPICS.map((t) => (
              <Link
                key={t.label}
                href={inboxHref(tab, t.id)}
                aria-current={topic === t.id ? "page" : undefined}
                className={cn(
                  "shrink-0 rounded-full px-3 py-1.5 text-[13px] font-bold",
                  topic === t.id
                    ? "bg-foreground text-background"
                    : "bg-card text-muted-foreground",
                )}
              >
                {t.label}
              </Link>
            ))}
          </nav>

          {showRequests && (
            <PrivateRequests
              requests={waiting}
              canAcceptPayment={Boolean(profile?.canAcceptPayment && profile.payoutHandle)}
            />
          )}
          {tab !== "updates" && (actions.length > 0 || tab === "actions") && (
            <InboxList
              items={actions}
              title={`Needs your tap · ${actions.length}`}
              empty={showRequests ? "That's everything else." : "That's everything that needs you."}
            />
          )}
          {tab !== "actions" && (
            <InboxList
              items={updates}
              empty={
                tab === "updates"
                  ? "Updates are for your info. Nothing here needs a tap."
                  : "Nothing yet. When someone claims your ask or it's marked done, you'll see it here."
              }
            />
          )}
        </>
      )}

      <TabBar active="Inbox" unread={unread} />
    </>
  );
}
