// The task page: one ask, one card. Two ways in, same page: the link in a
// GroupMe post, or tapping a card on the board. Anyone can view it; claiming
// and every asker step need sign-in (checked again in each server action).
// Each viewer and state gets its own screen, matching the design.
import Link from "next/link";

import { BottomActions, TaskHeader } from "@/components/task/task-parts";
import { AutoRefresh } from "@/components/task/use-task-action";
import { buttonVariants } from "@/components/ui/button";
import type { PublicCard } from "@/lib/ask/types";
import { getCard } from "@/server/actions/board";
import { listMessages } from "@/server/actions/inbox";
import { getMe, getMyProfile } from "@/server/actions/session";

import { AskerClaimed } from "./asker-claimed";
import { AskerConfirmed } from "./asker-confirmed";
import { AskerDone } from "./asker-done";
import { AskerExpired } from "./asker-expired";
import { AskerWaiting } from "./asker-waiting";
import { Closed } from "./closed";
import { HelperActive } from "./helper-active";
import { HelperDetail } from "./helper-detail";
import { HelperOffered } from "./helper-offered";
import { MessagesRow } from "./messages-row";

export default async function TaskPage({ params }: PageProps<"/h/[token]">) {
  const { token } = await params;
  const [card, me, profile] = await Promise.all([getCard(token), getMe(), getMyProfile()]);

  if (!card) {
    return (
      <>
        <TaskHeader
          status="Not found"
          title="This ask isn't here"
          subtitle="It expired, or the link is wrong."
        />
        <BottomActions>
          <Link href="/" className={buttonVariants({ size: "lg", className: "h-12 text-base" })}>
            Back to the board
          </Link>
        </BottomActions>
      </>
    );
  }

  const party = card.viewer === "asker" || card.viewer === "helper";
  const live = card.status === "open" || card.status === "held" || card.status === "confirmed";
  // Messages open once both have said yes.
  const thread =
    party && (card.status === "confirmed" || card.status === "done")
      ? await listMessages(token)
      : null;
  const messages = thread && "messages" in thread && (
    <MessagesRow
      token={token}
      otherFirstName={thread.otherFirstName}
      latest={thread.messages.at(-1)}
    />
  );

  return (
    <>
      {party && live && <AutoRefresh />}
      <Screen
        card={card}
        messages={messages || null}
        signedIn={Boolean(me)}
        needsPaymentSetup={card.price > 0 && !(profile?.canAcceptPayment && profile.payoutHandle)}
      />
    </>
  );
}

function Screen({
  card,
  messages,
  signedIn,
  needsPaymentSetup,
}: {
  card: PublicCard;
  messages: React.ReactNode;
  signedIn: boolean;
  needsPaymentSetup: boolean;
}) {
  const { viewer, status } = card;

  if (status === "cancelled") return <Closed card={card} reason="cancelled" />;

  if (viewer === "asker") {
    if (status === "expired") return <AskerExpired card={card} />;
    if (status === "open" || status === "held") return <AskerWaiting card={card} />;
    if (status === "confirmed") {
      // Paid asks start once the money is held (Pay to hold, /h/[token]/pay).
      return card.price > 0 && card.payment?.status !== "held" ? (
        <AskerClaimed card={card} messages={messages} />
      ) : (
        <AskerConfirmed card={card} messages={messages} />
      );
    }
    return <AskerDone card={card} />;
  }

  if (viewer === "helper") {
    if (status === "expired") return <Closed card={card} reason="expired" />;
    if (status === "held") return <HelperOffered card={card} />;
    return <HelperActive card={card} messages={messages} />;
  }

  // Anyone else: the card's detail, or why it's gone.
  if (status === "expired") return <Closed card={card} reason="expired" />;
  if (status !== "open") return <Closed card={card} reason="taken" />;
  return <HelperDetail card={card} signedIn={signedIn} needsSetup={needsPaymentSetup} />;
}
