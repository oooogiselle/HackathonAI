// Fictional campus, people, and group chats for the demo. All names are made up.
import type { BoardCard, Group, Helper, Office } from "./types";

export const CAMPUS = "Northfield University";
export const SCHOOL_EMAIL_DOMAIN = "northfield.edu";

// 16 seeded helpers. Some can't accept payment (e.g. F-1 students), so they only see $0 favors.
// `busy` is seeded weekly free/busy (no event titles), standing in for Google Calendar tonight.
export const HELPERS: Helper[] = [
  {
    id: "mei",
    firstName: "Mei",
    year: "Junior",
    blurb: "Has a car, drives to Bradley Airport most breaks",
    tags: ["ride", "airport", "car", "drive", "break", "luggage"],
    interests: ["rides"],
    busy: [
      { day: 1, start: "09:00", end: "12:00" },
      { day: 3, start: "09:00", end: "12:00" },
      { day: 5, start: "13:00", end: "17:00" },
    ],
    weeklyLimit: 3,
    canAcceptPayment: true,
  },
  {
    id: "tomas",
    firstName: "Tomás",
    year: "Senior",
    blurb: "Got an SSN last year, knows the Social Security office",
    tags: ["ssn", "social security", "paperwork", "office", "bank", "id"],
    interests: ["us-paperwork", "opt"],
    busy: [
      { day: 2, start: "10:00", end: "15:00" },
      { day: 4, start: "10:00", end: "15:00" },
    ],
    weeklyLimit: 2,
    canAcceptPayment: false,
  },
  {
    id: "priya",
    firstName: "Priya",
    year: "Sophomore",
    blurb: "RA in Kessler Hall, has a dolly for moving",
    tags: ["move", "moving", "fridge", "furniture", "lift", "dorm", "storage"],
    interests: ["moving"],
    busy: [
      { day: 1, start: "18:00", end: "22:00" },
      { day: 2, start: "18:00", end: "22:00" },
      { day: 3, start: "18:00", end: "22:00" },
    ],
    weeklyLimit: 3,
    canAcceptPayment: true,
  },
  {
    id: "jonah",
    firstName: "Jonah",
    year: "Grad student",
    blurb: "Lives off campus, happy to help with groceries and errands",
    tags: ["groceries", "errand", "store", "shopping", "pharmacy", "ride"],
    interests: ["rides", "cooking"],
    busy: [
      { day: 1, start: "08:00", end: "17:00" },
      { day: 2, start: "08:00", end: "17:00" },
      { day: 3, start: "08:00", end: "17:00" },
      { day: 4, start: "08:00", end: "17:00" },
    ],
    weeklyLimit: 4,
    canAcceptPayment: true,
  },
  {
    id: "aiko",
    firstName: "Aiko",
    year: "Senior",
    blurb: "Peer mentor for international students, went through OPT",
    tags: ["opt", "cpt", "work", "job", "internship", "paperwork"],
    interests: ["opt", "us-paperwork", "course-advice"],
    busy: [
      { day: 1, start: "13:00", end: "16:00" },
      { day: 3, start: "13:00", end: "16:00" },
    ],
    weeklyLimit: 2,
    canAcceptPayment: false,
  },
  {
    id: "diego",
    firstName: "Diego",
    year: "Junior",
    blurb: "Drives a minivan, can fit a lot of luggage",
    tags: ["ride", "airport", "van", "luggage", "move", "drive"],
    interests: ["rides", "moving"],
    busy: [
      { day: 2, start: "09:00", end: "13:00" },
      { day: 4, start: "09:00", end: "13:00" },
      { day: 6, start: "10:00", end: "14:00" },
    ],
    weeklyLimit: 3,
    canAcceptPayment: true,
  },
  {
    id: "fatima",
    firstName: "Fatima",
    year: "Sophomore",
    blurb: "Cooks for friends every Sunday, can show you the grocery store",
    tags: ["cook", "cooking", "groceries", "recipe", "food", "store"],
    interests: ["cooking"],
    busy: [
      { day: 1, start: "09:00", end: "15:00" },
      { day: 3, start: "09:00", end: "15:00" },
      { day: 5, start: "09:00", end: "15:00" },
    ],
    weeklyLimit: 2,
    canAcceptPayment: true,
  },
  {
    id: "lucas",
    firstName: "Lucas",
    year: "Senior",
    blurb: "Tutors intro CS and knows which courses to pair",
    tags: ["course", "class", "schedule", "major", "cs", "advice"],
    interests: ["course-advice"],
    busy: [
      { day: 2, start: "14:00", end: "18:00" },
      { day: 4, start: "14:00", end: "18:00" },
    ],
    weeklyLimit: 3,
    canAcceptPayment: true,
  },
  {
    id: "yuna",
    firstName: "Yuna",
    year: "Junior",
    blurb: "Speaks Korean and English, likes language practice",
    tags: ["language", "english", "korean", "practice", "conversation"],
    interests: ["language"],
    busy: [
      { day: 1, start: "10:00", end: "12:00" },
      { day: 3, start: "10:00", end: "12:00" },
      { day: 5, start: "10:00", end: "12:00" },
    ],
    weeklyLimit: 2,
    canAcceptPayment: false,
  },
  {
    id: "samir",
    firstName: "Samir",
    year: "Grad student",
    blurb: "Opened a US bank account and phone plan in week one",
    tags: ["bank", "account", "phone", "sim", "paperwork", "credit"],
    interests: ["us-paperwork"],
    busy: [
      { day: 1, start: "09:00", end: "18:00" },
      { day: 2, start: "09:00", end: "18:00" },
    ],
    weeklyLimit: 2,
    canAcceptPayment: false,
  },
  {
    id: "grace",
    firstName: "Grace",
    year: "Sophomore",
    blurb: "Strong and free most evenings, happy to carry boxes",
    tags: ["move", "moving", "boxes", "lift", "carry", "dorm"],
    interests: ["moving"],
    busy: [
      { day: 1, start: "09:00", end: "16:00" },
      { day: 2, start: "09:00", end: "16:00" },
      { day: 3, start: "09:00", end: "16:00" },
      { day: 4, start: "09:00", end: "16:00" },
    ],
    weeklyLimit: 4,
    canAcceptPayment: true,
  },
  {
    id: "ivan",
    firstName: "Ivan",
    year: "Junior",
    blurb: "Speaks Russian and Spanish, can help with forms in either",
    tags: ["language", "spanish", "russian", "forms", "translate"],
    interests: ["language", "us-paperwork"],
    busy: [
      { day: 2, start: "08:00", end: "12:00" },
      { day: 4, start: "08:00", end: "12:00" },
    ],
    weeklyLimit: 2,
    canAcceptPayment: true,
  },
  {
    id: "chloe",
    firstName: "Chloe",
    year: "Senior",
    blurb: "Has a car most weekends, goes to the outlet mall",
    tags: ["ride", "car", "shopping", "weekend", "store"],
    interests: ["rides"],
    busy: [
      { day: 1, start: "08:00", end: "18:00" },
      { day: 2, start: "08:00", end: "18:00" },
      { day: 3, start: "08:00", end: "18:00" },
      { day: 4, start: "08:00", end: "18:00" },
      { day: 5, start: "08:00", end: "14:00" },
    ],
    weeklyLimit: 2,
    canAcceptPayment: true,
  },
  {
    id: "kwame",
    firstName: "Kwame",
    year: "Alum (Class of 2025)",
    blurb: "Works nearby, mentors on internships and OPT timing",
    tags: ["opt", "internship", "job", "resume", "career"],
    interests: ["opt", "course-advice"],
    busy: [
      { day: 1, start: "09:00", end: "17:00" },
      { day: 2, start: "09:00", end: "17:00" },
      { day: 3, start: "09:00", end: "17:00" },
      { day: 4, start: "09:00", end: "17:00" },
      { day: 5, start: "09:00", end: "17:00" },
    ],
    weeklyLimit: 1,
    canAcceptPayment: true,
  },
  {
    id: "nadia",
    firstName: "Nadia",
    year: "Junior",
    blurb: "Has storage space over the summer and a hand truck",
    tags: ["storage", "summer", "move", "boxes", "fridge"],
    interests: ["moving"],
    busy: [
      { day: 3, start: "12:00", end: "18:00" },
      { day: 5, start: "12:00", end: "18:00" },
    ],
    weeklyLimit: 2,
    canAcceptPayment: false,
  },
  {
    id: "ben",
    firstName: "Ben",
    year: "Sophomore",
    blurb: "Bakes and cooks, can show you how to use the dorm kitchen",
    tags: ["cook", "cooking", "kitchen", "bake", "food"],
    interests: ["cooking", "language"],
    busy: [
      { day: 2, start: "10:00", end: "14:00" },
      { day: 4, start: "10:00", end: "14:00" },
    ],
    weeklyLimit: 3,
    canAcceptPayment: true,
  },
];

export const GROUPS: Group[] = [
  {
    id: "intl",
    name: "Northfield International Students",
    platform: "groupme",
    members: 412,
    description: "Partner group run by the International Student Association",
  },
  {
    id: "rides",
    name: "Northfield Rides & Errands",
    platform: "slack",
    members: 238,
    description: "Partner Slack channel for rides, errands, and quick favors",
  },
  {
    id: "kessler",
    name: "Kessler Hall Residents",
    platform: "groupme",
    members: 96,
    description: "Your dorm's group chat",
  },
];

// Shown instead of group chats when an ask is sensitive (visa, money, health).
export const OFFICES: Office[] = [
  { name: "International Student Office", why: "Visa, I-20, OPT/CPT, and work questions" },
  { name: "Financial Aid Office", why: "Emergency funds, loans, and payment plans" },
  { name: "Student Health Center", why: "Appointments, prescriptions, and insurance" },
];

export const MEETING_SPOTS = [
  "Front steps of Hadley Library",
  "Campus Center main lobby",
  "Kessler Hall front desk",
];

// Open asks already on the board when the server starts, so the landing page
// isn't empty. All anonymous. Times are relative to server start.
export type SeedCard = Pick<BoardCard, "text" | "minutes" | "price"> & {
  postedMinutesAgo: number;
  expiresInHours: number;
};

export const SEED_CARDS: SeedCard[] = [
  {
    text: "Could someone drive me to Bradley Airport Saturday morning? I have two suitcases. About 45 minutes.",
    minutes: 45,
    price: 15,
    postedMinutesAgo: 10,
    expiresInHours: 30,
  },
  {
    text: "First winter here. Could anyone lend me a warm coat for a weekend trip next week? I'll return it clean.",
    minutes: 15,
    price: 0,
    postedMinutesAgo: 35,
    expiresInHours: 48,
  },
  {
    text: "Need a hand carrying 4 boxes from my dorm to the storage place on Elm St this Friday afternoon.",
    minutes: 30,
    price: 10,
    postedMinutesAgo: 80,
    expiresInHours: 20,
  },
  {
    text: "Would anyone practice casual English conversation with me over coffee for 20 minutes this week?",
    minutes: 20,
    price: 0,
    postedMinutesAgo: 150,
    expiresInHours: 72,
  },
  {
    text: "Could someone show me how to cook rice without a rice cooker? Shared kitchen in my dorm, any evening.",
    minutes: 20,
    price: 5,
    postedMinutesAgo: 240,
    expiresInHours: 24,
  },
];

// Used by the fallback privacy scrub to catch dorm names.
export const DORMS = ["Kessler Hall", "Hadley House", "Birch Hall", "Oakwood Hall"];

export const CRISIS_RESOURCES = [
  { name: "988 Suicide & Crisis Lifeline", detail: "Call or text 988 (US), 24/7" },
  { name: "Northfield Counseling Center", detail: "Same-day appointments, (555) 010-2400" },
  { name: "Campus Safety", detail: "Emergencies: (555) 010-9111, or call 911" },
];

export const TUTORING_RESOURCES = [
  { name: "Northfield Writing Center", detail: "Free 1:1 sessions to help you write it yourself" },
  { name: "Peer Tutoring (Hadley Library, 2nd floor)", detail: "Drop-in, Sun–Thu 6–10pm" },
  { name: "Your professor's office hours", detail: "Ask for an extension if you're overwhelmed" },
];

export function findGroup(id: string): Group | undefined {
  return GROUPS.find((g) => g.id === id);
}
