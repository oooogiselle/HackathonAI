// Ratings on the Me tab: my average as a helper (last 90 days), what askers
// said went well, recent comments, and trust points (earned only).
import { Star } from "lucide-react";

import type { MyRatings } from "@/lib/ask/types";

function stars(n: number) {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

export function Ratings({ ratings: r }: { ratings: MyRatings }) {
  return (
    <section className="flex flex-col gap-4 rounded-3xl bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold">Ratings</h2>
        <span className="text-xs text-muted-foreground">Last 90 days</span>
      </div>

      {r.count === 0 ? (
        <p className="text-sm text-muted-foreground">
          No reviews yet. After you help someone, they can rate how it went.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-extrabold">{r.average.toFixed(1)}</span>
            <span className="flex flex-col">
              <span aria-label={`${r.average} of 5 stars`} className="flex gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <Star
                    key={n}
                    aria-hidden
                    className={
                      n <= Math.round(r.average)
                        ? "size-4 fill-amber-400 text-amber-400"
                        : "size-4 text-muted-foreground/40"
                    }
                  />
                ))}
              </span>
              <span className="text-sm text-muted-foreground">
                From {r.count} {r.count === 1 ? "review" : "reviews"} as a helper
              </span>
            </span>
          </div>
          {r.tagCounts.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {r.tagCounts.map((t) => (
                <li key={t.tag} className="rounded-full bg-pay px-3 py-1 text-[13px] font-semibold">
                  {t.tag} · {t.count}
                </li>
              ))}
            </ul>
          )}
          {r.recent.map((c) => (
            <figure key={c.at} className="flex flex-col gap-1 rounded-2xl bg-muted/60 p-3 text-sm">
              <blockquote>&ldquo;{c.comment}&rdquo;</blockquote>
              <figcaption className="text-xs text-muted-foreground">
                <span className="text-amber-500">{stars(c.stars)}</span> · {c.by} ·{" "}
                {new Date(c.at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
              </figcaption>
            </figure>
          ))}
        </>
      )}

      <div className="flex items-center justify-between rounded-2xl bg-pay/60 px-4 py-3">
        <span className="flex flex-col">
          <span className="text-sm font-semibold">Trust points</span>
          <span className="text-xs text-muted-foreground">
            Earned from reviews and finished help. Can&apos;t be bought or sold.
          </span>
        </span>
        <span className="text-2xl font-extrabold">{r.trustPoints}</span>
      </div>
      {!r.showReviews && (
        <p className="text-xs text-muted-foreground">
          Hidden from askers. Turn on &ldquo;Show reviews on my profile&rdquo; below to share them.
        </p>
      )}
    </section>
  );
}
