// Public claim page linked from each group post. No account needed.
import { getPostStatus } from "@/server/actions/ask";

import { ClaimForm } from "./claim-form";

export default async function ClaimPage({ params }: PageProps<"/h/[token]">) {
  const { token } = await params;
  const post = await getPostStatus(token);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-6">
      <span className="text-sm font-semibold">Ask</span>
      {!post ? (
        <p className="text-muted-foreground">This ask has expired or doesn&apos;t exist.</p>
      ) : (
        <>
          <div className="flex flex-col gap-2">
            <span className="text-sm text-muted-foreground">
              A student in {post.groupName} asked:
            </span>
            <blockquote className="rounded-xl bg-muted px-4 py-3">{post.text}</blockquote>
          </div>
          {post.claim ? (
            <p className="rounded-xl border p-4">Someone already offered to help. Thank you!</p>
          ) : (
            <ClaimForm token={token} />
          )}
        </>
      )}
    </main>
  );
}
