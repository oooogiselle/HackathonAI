// In-memory store for the old group-first flow (postAsk / claimAsk). The group
// rate limit now lives in the database (board-store.ts).
// Lives on globalThis so it survives dev hot reloads.
// TODO(db): this resets on restart and isn't shared across serverless
// instances. Move to Postgres before anyone relies on it.
import "server-only";

import type { Post } from "./types";

type Store = {
  posts: Map<string, Post>;
};

const g = globalThis as typeof globalThis & { __askStore?: Store };
const store: Store = (g.__askStore ??= { posts: new Map() });

export function getPost(token: string): Post | undefined {
  return store.posts.get(token);
}

export function savePost(post: Post) {
  store.posts.set(post.token, post);
}
