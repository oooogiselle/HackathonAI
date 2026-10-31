// Shown instead of the flow for crisis asks (professional resources only,
// never matched or posted) and for "do my coursework" asks (tutoring).
import { Phone } from "lucide-react";
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { CRISIS_RESOURCES, TUTORING_RESOURCES } from "@/lib/ask/mock-data";

// Phone numbers inside the team-confirmed resource text become tap-to-call
// links, so no number is typed twice.
const PHONE = /(\d{3}-\d{3}-\d{4}|\b988\b|\b911\b)/;

function WithCallLinks({ text }: { text: string }) {
  return text.split(PHONE).map((piece, i) =>
    i % 2 === 1 ? (
      <a
        key={i}
        href={`tel:${piece.replaceAll("-", "")}`}
        className="inline-flex min-h-11 items-center gap-1 font-bold text-primary underline underline-offset-4"
      >
        <Phone aria-hidden className="size-3.5" />
        {piece}
      </a>
    ) : (
      piece
    ),
  );
}

export default async function ResourcesPage({ searchParams }: PageProps<"/resources">) {
  const { type } = await searchParams;
  const crisis = type !== "tutoring";
  const resources = crisis ? CRISIS_RESOURCES : TUTORING_RESOURCES;

  return (
    <>
      <header className="flex flex-col gap-2 pt-2">
        <span className="text-sm font-bold text-primary">{crisis ? "Support" : "Schoolwork"}</span>
        <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">
          {crisis ? "You don't have to handle this alone" : "Let's get you the right kind of help"}
        </h1>
        <p className="text-muted-foreground">
          {crisis
            ? "Classmates can't help with this kind of need, so it isn't posted or matched. These people are trained to help, right now:"
            : "DartAsk can't do graded work for you, but these can help you get it done yourself:"}
        </p>
      </header>

      {crisis && (
        <p className="rounded-3xl bg-destructive/10 p-4 font-semibold text-destructive">
          In immediate danger? Call{" "}
          <a href="tel:911" className="underline underline-offset-4">
            911
          </a>
          .
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {resources.map((r) => (
          <li key={r.name} className="flex flex-col gap-0.5 rounded-3xl bg-card p-4">
            <span className="font-bold">{r.name}</span>
            <span className="text-[15px] text-muted-foreground">
              {crisis ? <WithCallLinks text={r.detail} /> : r.detail}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto flex flex-col gap-2">
        {!crisis && (
          <Link href="/ask" className={buttonVariants({ variant: "outline" })}>
            Ask for something else
          </Link>
        )}
        <Link href="/" className={buttonVariants({ variant: "ghost" })}>
          Back to the needs board
        </Link>
      </div>
    </>
  );
}
