// Dartmouth names: house communities and their halls, Greek houses, and campus
// words that imply what kind of help an ask needs. One list feeds matching
// (who's close by, who's done this before) and the privacy scrub (halls become
// their house community, Greek houses become "a Greek house"). Client-safe.
//
// Sources (Oct 31, 2026): Dartmouth's house community announcement (2015) and
// "Marking Their First Decade" (Apr 2026, Fayerweather now in South House); the
// Greek list is from Wikipedia's "Dartmouth College fraternities and sororities".
// TODO(team): confirm both against Residential Life and the Office of Greek Life
// before recording. First-year halls move between houses some years.

export type HouseCommunity = {
  name: string;
  // Stored in users.tags; never shown to another student except "Also in <house>".
  tag: string;
  // Hall names. Ones that are also everyday words or common names only match
  // with "Hall" after them, so they're written that way here.
  halls: string[];
};

export const HOUSE_COMMUNITIES: HouseCommunity[] = [
  { name: "Allen House", tag: "allen house", halls: ["Gile", "Streeter", "Lord Hall"] },
  {
    name: "East Wheelock House",
    tag: "east wheelock house",
    halls: ["Andres Hall", "Zimmerman", "McCulloch", "Morton Hall"],
  },
  {
    name: "North Park House",
    tag: "north park house",
    halls: ["Ripley", "Woodward", "Smith Hall", "Brown Hall"],
  },
  {
    name: "School House",
    tag: "school house",
    halls: [
      "Massachusetts Hall",
      "North Massachusetts",
      "Mid Massachusetts",
      "South Massachusetts",
      "North Mass",
      "Mid Mass",
      "South Mass",
      "Mass Row",
      "Hitchcock",
      "Bissell",
      "Cohen Hall",
      "Little Hall",
    ],
  },
  {
    name: "South House",
    tag: "south house",
    halls: ["Topliff", "New Hampshire Hall", "Fayerweather"],
  },
  {
    name: "West House",
    tag: "west house",
    halls: ["Fahey", "McLane", "Butterfield", "Russell Sage"],
  },
];

// Residence halls and clusters not tied to one house in our sources.
export const OTHER_HALLS = ["McLaughlin", "Choates", "River Cluster", "Russo Hall"];

export type GreekHouse = {
  name: string;
  // Unambiguous nicknames only. "Theta", "Kappa", "Beta", "KD", "AKA" and "BG"
  // are left out: they collide with ordinary words.
  aliases: string[];
};

export const GREEK_HOUSES: GreekHouse[] = [
  // Interfraternity Council
  { name: "Alpha Chi Alpha", aliases: ["Alpha Chi"] },
  { name: "Beta Alpha Omega", aliases: [] },
  { name: "Bones Gate", aliases: [] },
  { name: "Gamma Delta Chi", aliases: ["GDX"] },
  { name: "Zeta Psi", aliases: ["Zete"] },
  { name: "Theta Delta Chi", aliases: ["Theta Delt", "TDX"] },
  { name: "Kappa Pi Kappa", aliases: ["Pi Kap", "Tri-Kap", "Tri Kap", "Kappa Kappa Kappa"] },
  { name: "Sigma Alpha Epsilon", aliases: ["SAE"] },
  { name: "Sigma Nu", aliases: ["Sig Nu"] },
  { name: "Sigma Phi Epsilon", aliases: ["Sig Ep", "SigEp"] },
  { name: "Phi Delta Alpha", aliases: ["Phi Delt"] },
  { name: "Chi Gamma Epsilon", aliases: ["Chi Gam"] },
  { name: "Chi Heorot", aliases: ["Heorot"] },
  { name: "Psi Upsilon", aliases: ["Psi U"] },
  // Inter-Sorority Council
  { name: "Alpha Xi Delta", aliases: ["AXID"] },
  { name: "Alpha Phi", aliases: [] },
  { name: "Kappa Delta Epsilon", aliases: ["KDE"] },
  { name: "Kappa Delta", aliases: [] },
  { name: "Kappa Kappa Gamma", aliases: ["KKG"] },
  { name: "Sigma Delta", aliases: ["Sigma Delt"] },
  { name: "Chi Delta", aliases: ["Chi Delt"] },
  // Gender-Inclusive Greek Council
  { name: "Alpha Theta", aliases: [] },
  { name: "The Tabard", aliases: ["Tabard"] },
  { name: "Phi Tau", aliases: [] },
  { name: "Epsilon Kappa Theta", aliases: ["EKT"] },
  // National Pan-Hellenic Council
  { name: "Alpha Phi Alpha", aliases: [] },
  { name: "Alpha Kappa Alpha", aliases: [] },
  { name: "Delta Sigma Theta", aliases: [] },
  // Multicultural Greek Council
  { name: "Sigma Lambda Beta", aliases: [] },
  { name: "Sigma Lambda Gamma", aliases: [] },
  // Undergraduate societies
  { name: "Amarna", aliases: [] },
  { name: "Panarchy", aliases: [] },
];

// Former houses people still name as places. Scrubbed, never offered as a tag.
const FORMER_GREEK = ["Alpha Delta", "Tri-Delt"];

// Campus words → helper tags they imply. "DOC" is case-sensitive so "doc"
// (a doctor, a document) doesn't count.
export const CAMPUS_TERMS: { pattern: RegExp; tags: string[] }[] = [
  { pattern: /\b(logan|dartmouth coach|bus to boston)\b/i, tags: ["airport", "ride"] },
  { pattern: /\b(lebanon airport|manchester airport|west leb(anon)?)\b/i, tags: ["ride"] },
  { pattern: /\badvance transit\b/i, tags: ["ride"] },
  { pattern: /\b(hanover )?co-?op\b/i, tags: ["groceries", "store"] },
  { pattern: /\b(foco|'?53 commons|novack|collis cafe)\b/i, tags: ["food"] },
  { pattern: /\b(cosc|cs) ?\d{1,3}\b/i, tags: ["cs", "course"] },
  { pattern: /\bmath ?\d{1,3}\b/i, tags: ["course"] },
  { pattern: /\b(d-?plan|off-?term|timetable)\b/i, tags: ["course", "schedule"] },
  { pattern: /\bsophomore summer\b/i, tags: ["summer", "storage"] },
  { pattern: /\bDOC\b/, tags: ["gear", "outdoors"] },
  { pattern: /\b(outing club|gear room|moosilauke)\b/i, tags: ["gear", "outdoors"] },
  {
    pattern: /\b(winter carnival|first snow|snow boots|parka)\b/i,
    tags: ["winter", "coat", "boots"],
  },
  { pattern: /\bovis\b/i, tags: ["opt", "paperwork"] },
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
// Letters or digits on either side mean it's inside another word.
const word = (body: string) => `(?<![\\p{L}\\p{N}])(?:${body})(?![\\p{L}\\p{N}])`;

/** Whole-word, case-insensitive: "car" is in "need a car", not in "carry". Plurals count. */
export function mentionsTag(text: string, tag: string) {
  const t = tag.trim();
  if (!t) return false;
  return new RegExp(word(`${escape(t)}(?:s|es)?`), "iu").test(text);
}

/** Tags the ask's campus words imply ("Dartmouth Coach to Logan" → airport, ride). */
export function campusTags(text: string): string[] {
  return [...new Set(CAMPUS_TERMS.filter((t) => t.pattern.test(text)).flatMap((t) => t.tags))];
}

// A hall name with an optional " Hall" after it ("Fahey", "Fahey Hall").
const hallBody = (halls: string[]) =>
  halls
    .map((h) => escape(h).replace(/ /g, "\\s+"))
    .sort((a, b) => b.length - a.length)
    .join("|");

const HOUSE_NAME = new RegExp(
  word(
    `(?:allen|east\\s+wheelock|north\\s+park|school|south|west)\\s+house|east\\s+wheelock|north\\s+park`,
  ),
  "iu",
);

/** Regex (global) for one house's halls, with an optional "Hall" after. */
export function hallPattern(halls: string[], flags = "giu") {
  return new RegExp(word(`(?:${hallBody(halls)})(?:\\s+hall)?`), flags);
}

/** The house community a text names, by house name or by one of its halls. */
export function houseIn(text: string): HouseCommunity | null {
  const named = text.match(HOUSE_NAME)?.[0].toLowerCase().replace(/\s+/g, " ");
  if (named) {
    const key = named.replace(/ house$/, "");
    return HOUSE_COMMUNITIES.find((h) => h.tag.replace(/ house$/, "") === key) ?? null;
  }
  return HOUSE_COMMUNITIES.find((h) => hallPattern(h.halls, "iu").test(text)) ?? null;
}

export function findHouseByTag(tag: string) {
  return HOUSE_COMMUNITIES.find((h) => h.tag === tag);
}

export const greekTag = (g: GreekHouse) => g.name.toLowerCase();

const GREEK_NAMES = [...GREEK_HOUSES.flatMap((g) => [g.name, ...g.aliases]), ...FORMER_GREEK];

/** Every Greek house name or nickname (longest first so "Alpha Phi Alpha" wins). */
export const GREEK_PATTERN = new RegExp(
  word(
    `(?:the\\s+)?(?:${GREEK_NAMES.map((n) => escape(n).replace(/[ -]/g, "[\\s-]?"))
      .sort((a, b) => b.length - a.length)
      .join("|")})(?:\\s+house)?`,
  ),
  "giu",
);

/** The Greek house a text names, if any. */
export function greekIn(text: string): GreekHouse | null {
  const hit = text.match(new RegExp(GREEK_PATTERN.source, "iu"))?.[0];
  if (!hit) return null;
  const norm = (s: string) => s.toLowerCase().replace(/[\s-]+/g, "");
  const key = norm(hit.replace(/^the\s+/i, "").replace(/\s+house$/i, ""));
  // Former houses match the pattern but aren't offered as a community.
  return GREEK_HOUSES.find((g) => [g.name, ...g.aliases].some((n) => norm(n) === key)) ?? null;
}

/** "Also in South House" is fine to say; a Greek house name never is. */
export function stripGreek(text: string) {
  return text.replace(GREEK_PATTERN, "a Greek house");
}

const COMMUNITY_TAGS = new Set([
  ...HOUSE_COMMUNITIES.map((h) => h.tag),
  ...GREEK_HOUSES.map(greekTag),
]);

/** House and Greek tags mark where someone lives, not what they can help with. */
export function isCommunityTag(tag: string) {
  return COMMUNITY_TAGS.has(tag);
}

/**
 * A tag someone typed, in its stored form: "Psi U" → "psi upsilon",
 * "Fahey" → "west house". Anything else comes back as is.
 */
export function canonicalTag(tag: string) {
  const house = houseIn(tag);
  if (house) return house.tag;
  const greek = greekIn(tag);
  return greek ? greekTag(greek) : tag;
}

export function findGreekByTag(tag: string) {
  return GREEK_HOUSES.find((g) => greekTag(g) === tag);
}

/** House and Greek tags a text points at, for the community boost in matching. */
export function communityTagsIn(text: string): string[] {
  const house = houseIn(text);
  const greek = greekIn(text);
  return [house?.tag, greek && greekTag(greek)].filter((t): t is string => Boolean(t));
}
