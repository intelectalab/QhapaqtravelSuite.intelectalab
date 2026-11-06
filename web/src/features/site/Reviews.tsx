import { BadgeCheck, MessageSquareQuote } from "lucide-react";
import type { ReviewBlock } from "@/lib/site";
import { Stars } from "./Bits";
import { ReviewCard } from "./Cards";

export function ReviewsSection({ reviews, base, columns = 3 }: { reviews: ReviewBlock; base: string; columns?: 2 | 3 }) {
  if (reviews.count === 0 || reviews.average === null) {
    return (
      <div className="flex items-center gap-3 rounded-card border border-dashed border-line p-6 text-[14px] text-fg-3">
        <MessageSquareQuote size={20} />
        Todavía no hay reseñas publicadas para esta selección.
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[280px_1fr]">
      <aside className="rounded-card border border-line bg-surface p-5 shadow-card">
        <div className="flex items-end gap-3">
          <b className="text-[44px] font-bold leading-none tracking-tight text-fg">{reviews.average.toFixed(1)}</b>
          <span className="pb-1">
            <Stars value={reviews.average} size={16} />
            <span className="mt-1 block text-[12.5px] text-fg-3">{reviews.count === 1 ? "1 opinión" : `${reviews.count} opiniones`}</span>
          </span>
        </div>
        <ul className="mt-5 grid gap-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = reviews.distribution[String(star)] ?? 0;
            const pct = Math.round((count / reviews.count) * 100);
            return (
              <li key={star} className="group grid grid-cols-[28px_1fr_28px] items-center gap-2 text-[12px] text-fg-3" title={`${count} con ${star} estrellas`}>
                <span>{star} ★</span>
                <span className="h-2 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full origin-left animate-[fill-x_800ms_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-full bg-t2 transition group-hover:brightness-110" style={{ width: `${pct}%` }} />
                </span>
                <span className="text-right tabular-nums">{count}</span>
              </li>
            );
          })}
        </ul>
        {reviews.verified > 0 && (
          <p className="mt-5 flex items-start gap-2 rounded-xl bg-[color-mix(in_srgb,var(--ok)_9%,transparent)] px-3 py-2.5 text-[12.5px] leading-relaxed text-fg-2">
            <BadgeCheck size={15} className="mt-0.5 flex-none text-ok" />
            {reviews.verified === 1 ? "1 opinión es" : `${reviews.verified} opiniones son`} de pasajeros con viaje verificado; el resto proviene de plataformas conectadas.
          </p>
        )}
      </aside>
      <div className={columns === 3 ? "grid gap-4 md:grid-cols-2 xl:grid-cols-3" : "grid gap-4 md:grid-cols-2"}>
        {reviews.items.map((review, index) => (
          <ReviewCard key={`${review.author}-${review.date}-${index}`} review={review} base={base} index={index} />
        ))}
      </div>
    </div>
  );
}
