// Shown instead of the flow for crisis asks (professional resources only,
// never matched or posted) and for "do my coursework" asks (tutoring).
import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";
import { CRISIS_RESOURCES, TUTORING_RESOURCES } from "@/lib/ask/mock-data";

export default async function ResourcesPage({ searchParams }: PageProps<"/resources">) {
  const { type } = await searchParams;
  const crisis = type !== "tutoring";
  const resources = crisis ? CRISIS_RESOURCES : TUTORING_RESOURCES;

  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">
        {crisis ? "You don't have to handle this alone" : "Let's get you the right kind of help"}
      </h1>
      <p className="text-muted-foreground">
        {crisis
          ? "Ask connects students for everyday favors, so it isn't the right place for this. These people are trained to help, right now:"
          : "Ask can't do graded work for you, but these can help you get it done yourself:"}
      </p>
      <ul className="flex flex-col gap-2">
        {resources.map((r) => (
          <li key={r.name} className="rounded-xl border p-3">
            <div className="font-medium">{r.name}</div>
            <div className="text-sm text-muted-foreground">{r.detail}</div>
          </li>
        ))}
      </ul>
      {!crisis && (
        <Link
          href="/ask"
          className={buttonVariants({ variant: "outline", className: "mt-auto h-11" })}
        >
          Ask for something else
        </Link>
      )}
    </>
  );
}
