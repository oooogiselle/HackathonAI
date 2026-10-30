// Fictional campus, people, and group chats for the demo. All names are made up.
import type { Group, Helper, Office } from "./types";

export const CAMPUS = "Northfield University";
export const SCHOOL_EMAIL_DOMAIN = "northfield.edu";

export const HELPERS: Helper[] = [
  {
    id: "mei",
    firstName: "Mei",
    year: "Junior",
    blurb: "Has a car, drives to Bradley Airport most breaks",
    tags: ["ride", "airport", "car", "drive", "break", "luggage"],
  },
  {
    id: "tomas",
    firstName: "Tomás",
    year: "Senior",
    blurb: "Got an SSN last year, knows the Social Security office",
    tags: ["ssn", "social security", "paperwork", "office", "bank", "id"],
  },
  {
    id: "priya",
    firstName: "Priya",
    year: "Sophomore",
    blurb: "RA in Kessler Hall, has a dolly for moving",
    tags: ["move", "moving", "fridge", "furniture", "lift", "dorm", "storage"],
  },
  {
    id: "jonah",
    firstName: "Jonah",
    year: "Grad student",
    blurb: "Lives off campus, happy to help with groceries and errands",
    tags: ["groceries", "errand", "store", "shopping", "pharmacy", "ride"],
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
