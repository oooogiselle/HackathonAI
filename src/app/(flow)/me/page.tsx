// Me tab: your balance (links to Payouts), your ratings and trust points, your
// name, the helper settings matching uses (what you'd enjoy, a weekly limit,
// whether you can accept payment), privacy, calendar, email updates, blocked
// people, sign out. ?next=/ask comes from "See when you're free" on Post a need.
import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { SignInPrompt } from "@/components/ask/sign-in-prompt";
import { TabBar } from "@/components/ask/tab-bar";
import { TopBar } from "@/components/ask/top-bar";
import { formatCents } from "@/lib/ask/fees";
import { listMyCards } from "@/server/actions/board";
import { countUnread } from "@/server/actions/inbox";
import { getMyRatings } from "@/server/actions/reviews";
import { getMyProfile, listBlockedPeople } from "@/server/actions/session";

import { BlockedPeople } from "./blocked-people";
import { earnings } from "./earnings";
import { ProfileForm } from "./profile-form";
import { Ratings } from "./ratings";

export default async function MePage({ searchParams }: PageProps<"/me">) {
  const [profile, unread, { next }, mine, blocked, ratings] = await Promise.all([
    getMyProfile(),
    countUnread(),
    searchParams,
    listMyCards(),
    listBlockedPeople(),
    getMyRatings(),
  ]);
  const money = earnings(mine.helping, ratings?.tipsCents);

  return (
    <>
      <TopBar title="Me" firstName={profile?.firstName} next="/me" />
      {profile ? (
        <>
          <Link
            href="/me/payouts"
            className="flex items-center gap-3 rounded-3xl bg-primary p-4 text-primary-foreground"
          >
            <span className="flex flex-1 flex-col">
              <span className="text-xs font-bold tracking-wide uppercase opacity-80">
                Available balance
              </span>
              <span className="text-3xl font-extrabold">{formatCents(money.availableCents)}</span>
              <span className="text-sm opacity-90">
                {money.heldCents > 0
                  ? `${formatCents(money.heldCents)} held until the asker confirms it's done`
                  : "Nothing held right now"}
              </span>
            </span>
            <ChevronRight aria-hidden className="size-5" />
            <span className="sr-only">Payouts</span>
          </Link>
          {ratings && <Ratings ratings={ratings} />}
          <ProfileForm profile={profile} backToAsk={next === "/ask"} />
          <BlockedPeople blocked={"blocked" in blocked ? blocked.blocked : []} />
        </>
      ) : (
        <SignInPrompt next="/me" why="Set what you'd like to help with and how often." />
      )}
      <TabBar active="Me" unread={unread} />
    </>
  );
}
