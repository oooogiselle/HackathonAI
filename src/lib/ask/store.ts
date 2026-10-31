// In-memory store for posted asks, claims, and rate limits.
// Lives on globalThis so it survives dev hot reloads.
// TODO(db): this resets on restart and isn't shared across serverless
// instances. Move to Postgres before anyone relies on it.
import "server-only";

import type { Post } from "./types";

export const MAX_POSTS_PER_GROUP_PER_DAY = 3;

type Store = {
  posts: Map<string, Post>;
  // key: `${groupId}:${YYYY-MM-DD}` → count
  postCounts: Map<string, number>;
};

const g = globalThis as typeof globalThis & { __askStore?: Store };
const store: Store = (g.__askStore ??= { posts: new Map(), postCounts: new Map() });

function dayKey(groupId: string) {
  return `${groupId}:${new Date().toISOString().slice(0, 10)}`;
}

export function getPost(token: string): Post | undefined {
  return store.posts.get(token);
}

export function savePost(post: Post) {
  store.posts.set(post.token, post);
}

/** Returns false (and doesn't count) if the group already hit today's limit. */
export function takeRateLimit(groupId: string): boolean {
  const key = dayKey(groupId);
  const count = store.postCounts.get(key) ?? 0;
  if (count >= MAX_POSTS_PER_GROUP_PER_DAY) return false;
  store.postCounts.set(key, count + 1);
  return true;
}

/** Gives back a slot taken by takeRateLimit when the post itself failed. */
export function refundRateLimit(groupId: string) {
  const key = dayKey(groupId);
  const count = store.postCounts.get(key) ?? 0;
  if (count > 0) store.postCounts.set(key, count - 1);
}
