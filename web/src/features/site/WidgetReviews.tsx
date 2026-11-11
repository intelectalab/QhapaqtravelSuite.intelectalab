"use client";

import { ExternalLink, Quote } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import type { ReviewWidgetFeed } from "@/lib/site";
import { Stars } from "./Bits";
import { useSite } from "./SiteContext";

export function WidgetReviews({ feed }: { feed: ReviewWidgetFeed }) {
  const { t, dateLocale } = useSite();
  const grid = feed.settings.layout === "cuadricula";

  return (
    <section>
      <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-[20px] font-bold tracking-tight text-fg">{t.widget.reviewsTitle}</h1>
        <ul className="flex flex-wrap gap-2">
          {feed.sources.map((source) => (
            <li key={source.provider} className="lift inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[12.5px]">
              <b className="font-semibold text-fg">{source.name}</b>
              {source.rating !== null && (
                <>
                  <Stars value={source.rating} size={12} />
                  <span className="tabular-nums text-fg-2">{source.rating.toFixed(1)}</span>
                </>
              )}
              <span className="text-fg-3">{t.widget.reviewsSummary(source.count)}</span>
            </li>
          ))}
        </ul>
      </header>
      {feed.items.length === 0 ? (
        <p className="rounded-card bg-surface-2 px-4 py-3 text-[13.5px] text-fg-2">{t.widget.reviewsEmpty}</p>
      ) : (
        <ul className={cn("grid gap-3", grid && "sm:grid-cols-2 lg:grid-cols-3")}>
          {feed.items.map((review, index) => (
            <li key={review.id} className="lift flex flex-col rounded-card border border-line bg-surface p-4 shadow-card animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${index * 50}ms` }}>
              <div className="flex items-center justify-between gap-2">
                <Stars value={review.rating} size={13} />
                <Quote size={16} className="text-fg-3/40" />
              </div>
              {review.title && <b className="mt-2 text-[14px] font-semibold leading-snug text-fg">{review.title}</b>}
              {review.body && <p className={cn("mt-1.5 text-[13px] leading-relaxed text-fg-2", grid && "line-clamp-5")}>{review.body}</p>}
              <div className="mt-auto flex flex-wrap items-end justify-between gap-2 pt-3 text-[12px]">
                <span>
                  <b className="block font-semibold text-fg">{review.author}</b>
                  <span className="text-fg-3">
                    {formatDate(review.date, "short", dateLocale)}
                    {review.product ? ` · ${review.product}` : ""}
                  </span>
                </span>
                {review.url ? (
                  <a href={review.url} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 font-semibold text-accent hover:underline" title={t.widget.readMore}>
                    {t.widget.reviewsOn(review.source.name)}
                    <ExternalLink size={12} />
                  </a>
                ) : (
                  <span className="text-fg-3">{t.widget.reviewsOn(review.source.name)}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
