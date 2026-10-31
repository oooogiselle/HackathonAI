// Inbox tab: asks sent to you privately (answer "I can help" or "Not this
// time", no reason needed), then updates on your asks, newest first.
import { SignInPrompt } from "@/components/ask/sign-in-prompt";
import { TabBar } from "@/components/ask/tab-bar";
import { TopBar } from "@/components/ask/top-bar";
import { listInbox } from "@/server/actions/inbox";
import { listMyRequests } from "@/server/actions/private";
import { getMe, getMyProfile } from "@/server/actions/session";

import { InboxList, PrivateRequests } from "./inbox-list";

export default async function InboxPage() {
  const [me, items, requests, profile] = await Promise.all([
    getMe(),
    listInbox(),
    listMyRequests(),
    getMyProfile(),
  ]);
  const unread = items.filter((i) => !i.read).length;
  // Only requests still waiting on an answer; answered ones live on the Claimed tab.
  const waiting =
    "requests" in requests
      ? requests.requests.filter((r) => !r.response && r.card.status === "open")
      : [];

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
          {waiting.length > 0 && (
            <PrivateRequests
              requests={waiting}
              canAcceptPayment={Boolean(profile?.canAcceptPayment && profile.payoutHandle)}
            />
          )}
          <InboxList items={items} />
        </>
      )}

      <TabBar active="Inbox" unread={unread} />
    </>
  );
}
