// Needs that come back every term ("No memory", PRD Background). When an ask on
// Quick check matches one, the student sees how many others asked last term and
// a tip a helper wrote. The AI only finds the match; the tips are written by
// people, never generated. Client-safe.
//
// Seeded tonight: counts and tips are sample data (TODO(db): count real past asks
// per need). Tips are attributed to fictional helpers in mock-data.ts; the team
// checks the wording before recording (docs/demo-script.md).

export type CommonNeed = {
  id: string;
  // Reads after "asked about": "getting an SSN".
  label: string;
  // What the need covers; embedded for matching.
  about: string;
  keywords: RegExp;
  askedLastTerm: number;
  tip: string;
  // A seeded helper (mock-data.ts HELPERS) whose blurb fits the tip.
  helperId: string;
};

export const COMMON_NEEDS: CommonNeed[] = [
  {
    id: "ssn",
    label: "getting an SSN",
    about: "getting a US Social Security number (SSN) as an international student",
    keywords: /\b(ssn|social security)\b/i,
    askedLastTerm: 6,
    tip: "You can apply once you have an on-campus job offer. Get the support letter from the international office first, then bring it with your passport, I-20 and I-94. The card comes by mail a few weeks later.",
    helperId: "tomas",
  },
  {
    id: "bank",
    label: "opening a US bank account",
    about: "opening a US bank account, checking account or debit card",
    keywords: /\b(bank( account)?|checking account|debit card)\b/i,
    askedLastTerm: 9,
    tip: "Bring your passport and I-20, and ask for a student checking account with no monthly fee. Many banks don't need an SSN to open one, but ask before you go.",
    helperId: "samir",
  },
  {
    id: "phone",
    label: "getting a US phone plan",
    about: "getting a US phone plan, SIM card, eSIM or phone number",
    keywords: /\b(phone plan|sim card|e-?sim|cell (plan|service)|us (phone )?number)\b/i,
    askedLastTerm: 7,
    tip: "A prepaid plan or an eSIM works without a US credit history. If you can, unlock your phone before you fly so any SIM works.",
    helperId: "samir",
  },
  {
    id: "airport",
    label: "rides to the airport at break",
    about: "a ride to the airport or bus station at the start or end of a break",
    keywords: /\b(airports?|logan|bus station|dartmouth coach)\b/i,
    askedLastTerm: 14,
    tip: "Ask about a week before break. Rides fill up fast on the last day of finals, and the buses to Boston sell out too.",
    helperId: "mei",
  },
  {
    id: "storage",
    label: "storing things over the summer",
    about: "storing belongings, boxes or furniture over the summer or between terms",
    keywords: /\b(storage|store my (stuff|things|boxes)|over the summer)\b/i,
    askedLastTerm: 8,
    tip: "Split a storage unit with a friend and book it before finals week. Keep your passport and documents with you, not in storage.",
    helperId: "diego",
  },
  {
    id: "moving",
    label: "moving out of a dorm",
    about: "moving out of a dorm room or between rooms, carrying boxes",
    keywords: /\b(move out|moving out|moving rooms?|carry (boxes|my stuff))\b/i,
    askedLastTerm: 11,
    tip: "Pack a few days early, then ask for help carrying, not packing. Most people happily give an hour to carry boxes.",
    helperId: "grace",
  },
  {
    id: "winter",
    label: "getting ready for winter",
    about: "winter clothes for a first New Hampshire winter: a warm coat, snow boots",
    keywords: /\b(winter (coat|jacket|boots|clothes|gear)|snow boots|warm coat|parka)\b/i,
    askedLastTerm: 10,
    tip: "Buy boots before the first snow, because sizes sell out. Lots of students lend coats to first-years, so it's okay to ask.",
    helperId: "chloe",
  },
];

/** The first common need whose keywords appear in the text, or null. */
export function matchCommonNeedByKeyword(text: string): CommonNeed | null {
  return COMMON_NEEDS.find((n) => n.keywords.test(text)) ?? null;
}

export function findCommonNeedById(id: string) {
  return COMMON_NEEDS.find((n) => n.id === id);
}
