# Hackathon Starter

Next.js 16 (App Router) · TypeScript · Tailwind + shadcn/ui · Supabase (auth, Postgres, storage) · Drizzle ORM · pgvector · Vercel AI SDK (Anthropic chat, OpenAI embeddings).

## Setup

Requires Node 22+ and pnpm.

```bash
pnpm install
cp .env.example .env.local   # fill in every value; comments say where to find each
pnpm db:migrate              # creates pgvector extension + tables in Supabase
pnpm dev                     # http://localhost:3000
```

The dev server is pinned to **port 3000** (`next dev -p 3000`). Supabase's redirect URL (`http://localhost:3000/auth/callback`) must match, so if you change the port, update Supabase → Authentication → URL Configuration too.

Chat works with just `ANTHROPIC_API_KEY`. `OPENAI_API_KEY` is only needed for RAG embeddings.

## Scripts

| Command            | What it does                                    |
| ------------------ | ----------------------------------------------- |
| `pnpm dev`         | Dev server on port 3000                         |
| `pnpm build`       | Production build                                |
| `pnpm lint`        | ESLint                                          |
| `pnpm typecheck`   | Generates Next route types, then `tsc --noEmit` |
| `pnpm format`      | Prettier                                        |
| `pnpm db:generate` | Generate a SQL migration from `src/db/schema`   |
| `pnpm db:migrate`  | Apply pending migrations (uses `DIRECT_URL`)    |
| `pnpm db:studio`   | Drizzle Studio DB browser                       |

## Database & migrations

- Schema lives in `src/db/schema/*.ts` (export every table from `src/db/schema/index.ts`).
- Change the schema → `pnpm db:generate` → commit the new file in `drizzle/` → `pnpm db:migrate`.
- Everyone shares one hosted Supabase DB, so **coordinate migrations**: one person generates + applies, others pull.
- `DATABASE_URL` (transaction pooler, 6543) is used by the app; `DIRECT_URL` (session pooler, 5432) is used by drizzle-kit.
- Drizzle connects as the `postgres` role and **bypasses RLS**. Tables have RLS enabled with no policies so they aren't exposed through Supabase's public API, so authorization happens in your server code: always filter by `user.id` (see `src/server/actions/items.ts`).

## Deploy to Vercel

1. Push this repo to GitHub, then import it at vercel.com/new (framework auto-detects as Next.js).
2. Add env vars in Vercel → Project → Settings → Environment Variables: everything in `.env.example` except `DIRECT_URL`. Set `NEXT_PUBLIC_SITE_URL` to your production URL (e.g. `https://your-app.vercel.app`).
3. In Supabase → Authentication → URL Configuration, add `https://your-app.vercel.app/auth/callback` to Redirect URLs.
4. Deploy. Migrations aren't run on deploy. Run `pnpm db:migrate` locally against the shared DB.

## Folder structure

```
src/
  app/                    routes (App Router)
    page.tsx              landing page
    login/                sign-in page (magic link + Google)
    auth/callback/        OAuth / magic-link code exchange
    app/                  authenticated area (layout = sidebar + header)
      items/              EXAMPLE: CRUD
      chat/               EXAMPLE: AI chat UI
    api/chat/             EXAMPLE: streaming chat endpoint (+ RAG)
  components/
    ui/                   shadcn/ui primitives (add more: pnpm dlx shadcn@latest add <name>)
    layout/               sidebar, header, nav links, sign-out
    auth/                 login form
    items/                EXAMPLE
    chat/                 EXAMPLE
  server/actions/         server actions ("use server")
  db/                     Drizzle client + schema
  lib/
    supabase/             server/browser clients + proxy session helper
    ai/models.ts          which chat + embedding models to use
    ai/rag.ts             EXAMPLE: chunk, embed, store, similarity search
  proxy.ts                (Next 16's name for middleware) refreshes session, guards /app/*
drizzle/                  generated SQL migrations
```

## Removing the examples

Every example file starts with an `EXAMPLE (...)` comment. `grep -rn "EXAMPLE (" src` lists them all.

**Items:** delete `src/app/app/items/`, `src/components/items/`, `src/server/actions/items.ts`, `src/db/schema/items.ts`; remove its line from `src/db/schema/index.ts` and `src/components/layout/nav-links.ts`; then `pnpm db:generate && pnpm db:migrate` to drop the table.

**Chat:** delete `src/app/app/chat/`, `src/components/chat/`, `src/app/api/chat/`; remove its nav link.

**RAG:** delete `src/lib/ai/rag.ts`, `src/db/schema/documents.ts`; remove its line from `src/db/schema/index.ts`; remove `retrieveContext` from the chat route; regenerate + migrate.

## Notes

- `cacheComponents` is off in `next.config.ts` so pages can read the session anywhere without extra `<Suspense>` boundaries.
- AI SDK 7 renamed `system` → `instructions` in `streamText`. Bundled docs: `node_modules/ai/docs/`. Next.js docs: `node_modules/next/dist/docs/`.
