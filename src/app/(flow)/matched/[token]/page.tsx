"use client";

// Step 6: waits for someone to tap "I can help", then shows who and where to meet.
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { StepHeader } from "@/components/ask/step-header";
import { Button, buttonVariants } from "@/components/ui/button";
import { getPostStatus, type PublicPost } from "@/server/actions/ask";

const POLL_MS = 3000;

export default function MatchedPage() {
  const router = useRouter();
  const { token } = useParams<{ token: string }>();
  const [post, setPost] = useState<PublicPost | null | undefined>(undefined);
  const claimed = Boolean(post?.claim);

  // TODO(notifications): replace polling with a push/realtime update.
  useEffect(() => {
    if (claimed) return;
    let active = true;
    const check = () =>
      getPostStatus(token).then((p) => {
        if (active) setPost(p);
      });
    check();
    const id = setInterval(check, POLL_MS);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [token, claimed]);

  if (post === null) {
    return (
      <>
        <StepHeader step={6} title="Ask not found" backHref="/" />
        <p className="text-muted-foreground">
          It may have expired (the demo store resets on restart).
        </p>
      </>
    );
  }

  if (!post?.claim) {
    return (
      <>
        <StepHeader
          step={6}
          title="Posted!"
          subtitle={post ? `Your ask is live in ${post.groupName}.` : undefined}
        />
        <div className="flex flex-col items-center gap-3 rounded-xl border p-6 text-center">
          <div className="size-3 animate-pulse rounded-full bg-primary" />
          <p>Waiting for someone to offer…</p>
          <p className="text-sm text-muted-foreground">
            We&apos;ll update this page when someone taps &ldquo;I can help.&rdquo;
          </p>
        </div>
        {/* Demo helper: lets the presenter open the helper's view in another tab. */}
        <Link
          href={`/h/${token}`}
          target="_blank"
          className="text-center text-sm text-muted-foreground underline"
        >
          Open the helper link (demo)
        </Link>
      </>
    );
  }

  return (
    <>
      <StepHeader step={6} title={`${post.claim.firstName} can help!`} />
      <div className="flex flex-col gap-3 rounded-xl border p-4">
        <div>
          <div className="text-sm text-muted-foreground">Suggested meeting spot (public)</div>
          <div className="font-medium">{post.claim.meetingSpot}</div>
        </div>
        <p className="text-sm text-muted-foreground">
          Meet somewhere public and tell a friend your plans. {post.groupName} has been told the ask
          is covered, without your name.
        </p>
      </div>
      {/* TODO(helper-inbox): in-app messaging to agree on a time. */}
      <Button size="lg" className="mt-auto h-12 text-base" onClick={() => router.push("/thanks")}>
        Say thank you
      </Button>
      <Link href="/" className={buttonVariants({ variant: "ghost" })}>
        Done for now
      </Link>
    </>
  );
}
