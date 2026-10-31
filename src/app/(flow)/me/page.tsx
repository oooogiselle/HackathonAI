// Me tab: your name, the helper settings matching uses (what you'd enjoy,
// a weekly limit, whether you can accept payment), email updates, sign out.
import { SignInPrompt } from "@/components/ask/sign-in-prompt";
import { TabBar } from "@/components/ask/tab-bar";
import { TopBar } from "@/components/ask/top-bar";
import { countUnread } from "@/server/actions/inbox";
import { getMyProfile } from "@/server/actions/session";

import { ProfileForm } from "./profile-form";

export default async function MePage() {
  const [profile, unread] = await Promise.all([getMyProfile(), countUnread()]);

  return (
    <>
      <TopBar title="Me" firstName={profile?.firstName} next="/me" />
      {profile ? (
        <ProfileForm profile={profile} />
      ) : (
        <SignInPrompt next="/me" why="Set what you'd like to help with and how often." />
      )}
      <TabBar active="Me" unread={unread} />
    </>
  );
}
