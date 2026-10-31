// Me tab: a live preview of your helper card (your alias, never your name), then
// what others see (year, a line about you, what you help with, when you're free)
// and what's private (name, payouts, contact, email updates, blocked people).
import { SignInPrompt } from "@/components/ask/sign-in-prompt";
import { TabBar } from "@/components/ask/tab-bar";
import { TopBar } from "@/components/ask/top-bar";
import { countUnread } from "@/server/actions/inbox";
import { getMyProfile, getMyThanks, listBlockedPeople } from "@/server/actions/session";

import { ProfileForm } from "./profile-form";

export default async function MePage() {
  const [profile, unread, thanks, blocked] = await Promise.all([
    getMyProfile(),
    countUnread(),
    getMyThanks(),
    listBlockedPeople(),
  ]);

  return (
    <>
      <TopBar title="Me" firstName={profile?.firstName} next="/me" />
      {profile ? (
        <ProfileForm
          profile={profile}
          thanks={thanks}
          blocked={"error" in blocked ? [] : blocked.blocked}
        />
      ) : (
        <SignInPrompt next="/me" why="Set what you'd like to help with and how often." />
      )}
      <TabBar active="Me" unread={unread} />
    </>
  );
}
