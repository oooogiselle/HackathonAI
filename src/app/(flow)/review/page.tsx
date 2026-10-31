// Rate your helper (/review?token=): the asker, after an ask is done. Stars,
// "what went well", a comment, an optional tip (paid asks only) and whether to
// show their name. Editable for 24 hours.
import Link from "next/link";

import { SignInPrompt } from "@/components/ask/sign-in-prompt";
import { StepHeader } from "@/components/ask/step-header";
import { buttonVariants } from "@/components/ui/button";
import { getReviewPage } from "@/server/actions/reviews";
import { getMe } from "@/server/actions/session";

import { ReviewForm } from "./review-form";

export default async function ReviewPage({ searchParams }: PageProps<"/review">) {
  const { token } = await searchParams;
  const tok = typeof token === "string" ? token : "";
  const me = await getMe();
  if (!me) {
    return (
      <>
        <StepHeader title="Rate your helper" backHref="/" />
        <SignInPrompt
          next={`/review?token=${encodeURIComponent(tok)}`}
          why="Sign in to rate the classmate who helped you."
        />
      </>
    );
  }
  const result = await getReviewPage(tok);
  if ("error" in result) {
    return (
      <>
        <StepHeader title="Rate your helper" backHref={tok ? `/h/${tok}` : "/"} />
        <p className="text-muted-foreground">{result.error}</p>
        <Link href="/" className={buttonVariants({ variant: "outline", className: "h-11" })}>
          Back to the board
        </Link>
      </>
    );
  }
  // Rendered per request, so this is "now".
  // eslint-disable-next-line react-hooks/purity
  const now = Date.now();
  return <ReviewForm token={tok} page={result.page} now={now} />;
}
