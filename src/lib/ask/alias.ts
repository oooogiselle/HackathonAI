// Every student is shown to other students by an alias, never their name,
// initial, email or phone. Derived from the user id, so it's stable and needs
// no column (works the same on PGlite and the shared Supabase database).

const ADJECTIVES = [
  "Steady",
  "Bright",
  "Quiet",
  "Brave",
  "Kind",
  "Swift",
  "Sunny",
  "Lucky",
  "Calm",
  "Clever",
  "Cozy",
  "Gentle",
  "Golden",
  "Happy",
  "Jolly",
  "Mellow",
  "Nimble",
  "Patient",
  "Plucky",
  "Bold",
  "Cheery",
  "Curious",
  "Daring",
  "Eager",
  "Friendly",
  "Hardy",
  "Merry",
  "Snowy",
  "Spry",
  "Warm",
] as const;

// Upper Valley woods and water.
const NOUNS = [
  "Loon",
  "Moose",
  "Otter",
  "Heron",
  "Maple",
  "Birch",
  "Fox",
  "Owl",
  "Beaver",
  "Trout",
  "Hawk",
  "Lynx",
  "Fern",
  "Pine",
  "Cedar",
  "Finch",
  "Hare",
  "Elk",
  "Wren",
  "Robin",
  "Aspen",
  "Willow",
  "Badger",
  "Chipmunk",
  "Marten",
  "Osprey",
  "Sparrow",
  "Thrush",
  "Hemlock",
  "Bobcat",
] as const;

// FNV-1a, 32-bit.
function hash(s: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** "Steady Loon 42": how other students see this user. */
export function aliasFor(userId: string): string {
  const h = hash(userId);
  const adjective = ADJECTIVES[h % ADJECTIVES.length];
  const noun = NOUNS[Math.floor(h / ADJECTIVES.length) % NOUNS.length];
  const number = 10 + (Math.floor(h / (ADJECTIVES.length * NOUNS.length)) % 90);
  return `${adjective} ${noun} ${number}`;
}
