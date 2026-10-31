// "For you" on the needs board: asks that match what a helper said they'd
// enjoy come first, and those they're free for come before those they aren't.
// Order inside each group stays newest first. Client-safe.
import { categoryForInterest, interestForCategory, rankCategoriesByKeyword } from "./categories";
import { isBusyAt } from "./free-busy";
import type { BusySlot, Interest, PublicCard } from "./types";

export type ViewerPrefs = { interests: Interest[]; busy: BusySlot[] };

/** A preset category the helper picked, or a typed one whose words point to it. */
export function matchesInterests(
  card: Pick<PublicCard, "category" | "title" | "text">,
  interests: Interest[],
) {
  if (interests.length === 0) return false;
  const interest = interestForCategory(card.category);
  if (interest) return interests.includes(interest);
  const labels = interests.map(categoryForInterest);
  return rankCategoriesByKeyword(`${card.title} ${card.text}`, labels, 1).length > 0;
}

export function rankForViewer(cards: PublicCard[], prefs: ViewerPrefs): PublicCard[] {
  if (prefs.interests.length === 0) return cards;
  const group = (card: PublicCard) => {
    if (card.viewer === "asker" || !matchesInterests(card, prefs.interests)) return 2;
    const busy =
      card.startsAt !== undefined && isBusyAt(prefs.busy, new Date(card.startsAt), card.minutes);
    return busy ? 1 : 0;
  };
  return cards
    .map((card) => ({ card, group: group(card) }))
    .sort((a, b) => a.group - b.group) // stable, so newest first holds inside a group
    .map(({ card, group }) => (group < 2 ? { ...card, forYou: true } : card));
}
