// Server actions for the Ask flow. No auth yet (TODO(auth)), so anything the
// client sends is re-checked here: safety runs again on the exact text before
// any post, and only explicit taps (Post to group, I can help) call postToGroup.
"use server";

import { randomBytes } from "node:crypto";
import { z } from "zod";

import { assistAsk as assistAskAI } from "@/lib/ai/ask/assist-ask";
import { clarify } from "@/lib/ai/ask/clarify";
import { matchCommonNeed } from "@/lib/ai/ask/common-need";
import { draftAsk as draftAskAI } from "@/lib/ai/ask/draft-ask";
import { privacyScrub } from "@/lib/ai/ask/privacy-scrub";
import { keywordCheck, safetyCheck } from "@/lib/ai/ask/safety-check";
import { type RewriteSuggestion, suggestRewrite } from "@/lib/ai/ask/suggest-rewrite";
import { suggestCategories as suggestCategoriesAI } from "@/lib/ai/ask/suggest-category";
import { suggestWhere as suggestWhereAI } from "@/lib/ai/ask/suggest-where";
import { COVERED_MESSAGE, formatPostMessage } from "@/lib/ask/format";
import { findGroup, HELPERS, MEETING_SPOTS } from "@/lib/ask/mock-data";
import {
  listBoardCategories,
  MAX_POSTS_PER_GROUP_PER_DAY,
  takeRateLimit,
} from "@/lib/ask/board-store";
import { getPost, savePost } from "@/lib/ask/store";
import type {
  AssistSuggestions,
  ClarifyAnswer,
  CommonNeedMatch,
  DraftResult,
  Post,
} from "@/lib/ask/types";
import { postToGroup } from "@/lib/groups";
import { siteUrl } from "@/lib/site-url";

const text = z.string().trim().min(1).max(1000);

export async function checkSafety(need: string) {
  return safetyCheck(text.parse(need));
}

/**
 * "Try this instead" for an ask Quick check blocked as graded work: an honest
 * version a classmate can help with. Only offered for academic asks (never
 * crisis), and the rewrite itself always passes the keyword check. Read-only:
 * nothing changes until the student taps "Use this rewrite".
 */
export async function getRewrite(need: string): Promise<RewriteSuggestion | null> {
  const parsed = text.safeParse(need);
  if (!parsed.success) return null;
  const safety = await safetyCheck(parsed.data);
  if (safety.category !== "academic") return null;
  return suggestRewrite(parsed.data);
}

export async function getClarifyQuestions(need: string) {
  return clarify(text.parse(need));
}

const answersSchema = z
  .array(z.object({ question: z.string().max(300), answer: z.string().max(300) }))
  .max(2);

export async function draftAsk(need: string, answers: ClarifyAnswer[]): Promise<DraftResult> {
  const cleanNeed = text.parse(need);
  const cleanAnswers = answersSchema.parse(answers);
  // Home already redirects these; never break them into asks or price them.
  // Answers can be typed freely on Clarify, so they're checked with the need.
  const { category } = await safetyCheck(
    [cleanNeed, ...cleanAnswers.map((a) => a.answer)].join("\n"),
  );
  if (category === "academic" || category === "crisis") return { parts: [] };
  return draftAskAI(cleanNeed, cleanAnswers);
}

const assistInput = z.object({
  what: z.string().trim().max(120),
  details: z.string().trim().max(1000),
  when: z.string().trim().max(80).optional(),
  where: z.string().trim().max(80).optional(),
  minutes: z.number().int().min(5).max(240),
});

export type AssistAskResult =
  { suggestions: AssistSuggestions } | { redirect: "crisis" | "tutoring" };

// The form's "Get suggestions" button. Safety runs first, same as Home.
export async function assistAsk(input: z.input<typeof assistInput>): Promise<AssistAskResult> {
  const fields = assistInput.parse(input);
  const { category } = await safetyCheck(text.parse(`${fields.what}. ${fields.details}`));
  if (category === "crisis") return { redirect: "crisis" };
  if (category === "academic") return { redirect: "tutoring" };
  return { suggestions: await assistAskAI(fields) };
}

// The form's Category row: ranks presets and categories already on the board
// against the ask (or the asker's typed "Other"). Shown only; picked on a tap.
export async function suggestCategories(input: string): Promise<string[]> {
  const value = z.string().trim().max(1000).parse(input);
  if (value.length < 3) return [];
  return suggestCategoriesAI(value, await listBoardCategories());
}

// Quick check's "You're not the only one": a need others asked about last term,
// with a helper's tip. Read-only and stores nothing about the asker. Never for
// crisis or schoolwork (the page redirects those first; this checks again).
export async function findCommonNeed(need: string): Promise<CommonNeedMatch | null> {
  const value = text.parse(need);
  const { category } = keywordCheck(value);
  if (category === "crisis" || category === "academic") return null;
  const match = await matchCommonNeed(value);
  const helper = match && HELPERS.find((h) => h.id === match.helperId);
  if (!match || !helper) return null;
  return {
    id: match.id,
    label: match.label,
    askedLastTerm: match.askedLastTerm,
    tip: match.tip,
    from: { id: helper.id, firstName: helper.firstName, year: helper.year },
  };
}

export async function suggestWhere(ask: string) {
  const { category } = await safetyCheck(text.parse(ask));
  return { category, ...(await suggestWhereAI(ask, category, HELPERS)) };
}

export async function scrubForAnonymous(ask: string) {
  return privacyScrub(text.parse(ask));
}

export type PostAskResult = { token: string } | { error: string };

const postAskSchema = z.object({
  groupId: z.string(),
  text,
  anonymous: z.boolean(),
  name: z.string().trim().max(40).optional(),
});

/** @deprecated Old group-first flow ("Post to group"); no screen calls it. Use board.ts. */
export async function postAsk(input: z.input<typeof postAskSchema>): Promise<PostAskResult> {
  const parsed = postAskSchema.safeParse(input);
  if (!parsed.success) return { error: "Something's missing from your ask." };
  const { groupId, anonymous, name } = parsed.data;

  const group = findGroup(groupId);
  if (!group) return { error: "That group isn't available." };

  const safety = await safetyCheck(parsed.data.text);
  if (safety.category !== "none") {
    return { error: "This ask is better shared one-on-one, so we won't post it to a group." };
  }

  if (!(await takeRateLimit(group.id))) {
    return {
      error: `${group.name} already has ${MAX_POSTS_PER_GROUP_PER_DAY} asks today. Try another group or tomorrow.`,
    };
  }

  const token = randomBytes(9).toString("base64url");
  const message = formatPostMessage(
    parsed.data.text,
    anonymous ? null : name || null,
    `${siteUrl()}/h/${token}`,
  );

  try {
    await postToGroup(group, message);
  } catch (error) {
    console.error("postToGroup failed:", error);
    return { error: "Couldn't reach the group chat. Please try again." };
  }

  savePost({ token, groupId, text: parsed.data.text, anonymous, createdAt: Date.now() });
  return { token };
}

export type PublicPost = Pick<Post, "token" | "text" | "claim" | "thanks"> & { groupName: string };

/** @deprecated Old group-first flow; no screen calls it. Use board.ts. */
export async function getPostStatus(token: string): Promise<PublicPost | null> {
  const post = getPost(token);
  if (!post) return null;
  return {
    token: post.token,
    text: post.text,
    claim: post.claim,
    thanks: post.thanks,
    groupName: findGroup(post.groupId)?.name ?? "",
  };
}

export type ClaimResult = { ok: true } | { error: string };

const claimSchema = z.object({
  token: z.string(),
  firstName: z.string().trim().min(1, "Add your first name.").max(40),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("That doesn't look like an email.")
    .refine((e) => e.endsWith(".edu"), "Please use your school (.edu) email."),
});

/** @deprecated Old group-first flow ("I can help"); no screen calls it. Use board.ts. */
export async function claimAsk(input: z.input<typeof claimSchema>): Promise<ClaimResult> {
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const post = getPost(parsed.data.token);
  if (!post) return { error: "This ask has expired." };
  if (post.claim) return { error: "Someone already offered to help. Thank you!" };

  // TODO(auth): verify the school email (magic link) before trusting a claim.
  post.claim = {
    firstName: parsed.data.firstName,
    email: parsed.data.email,
    meetingSpot: MEETING_SPOTS[Math.floor(Math.random() * MEETING_SPOTS.length)],
    claimedAt: Date.now(),
  };
  savePost(post);

  const group = findGroup(post.groupId);
  if (group) {
    // Never names the asker (or the helper), anonymous or not.
    await postToGroup(group, COVERED_MESSAGE).catch((error) =>
      console.error("Covered follow-up failed:", error),
    );
  }
  return { ok: true };
}

/** @deprecated Old group-first flow; no screen calls it. Use board.ts. */
export async function saveThanks(token: string, note: string) {
  const post = getPost(token);
  if (!post?.claim) return;
  // TODO(notifications): actually deliver the note to the helper.
  post.thanks = text.parse(note);
  savePost(post);
}
