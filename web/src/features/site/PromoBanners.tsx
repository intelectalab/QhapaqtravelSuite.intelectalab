import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { siteHref } from "@/lib/site";
import { siteImageHref, type PromoTone, type SitePromo } from "@/lib/site-design";

const TONES: Record<PromoTone, string> = {
  marca: "bg-brand text-brand-fg",
  acento: "bg-[var(--site-accent)] text-white",
  menu: "bg-menu text-white",
};

export function PromoBanners({ promos, base }: { promos: SitePromo[]; base: string }) {
  if (promos.length === 0) return null;
  const wide = promos.length === 1;

  return (
    <section aria-label="Promociones" className={cn("grid gap-4", !wide && "md:grid-cols-2", promos.length >= 3 && "xl:grid-cols-3")}>
      {promos.map((promo, index) => {
        const href = promo.cta_href ? (promo.cta_href.startsWith("/") ? siteHref(base, promo.cta_href) : promo.cta_href) : null;
        const external = href?.startsWith("http") ?? false;
        return (
          <article
            key={promo.id}
            data-testid={`site-promo:${promo.id}`}
            className={cn("lift group relative isolate flex overflow-hidden rounded-card shadow-card animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]", wide ? "min-h-[260px]" : "min-h-[220px]", TONES[promo.tone])}
            style={{ animationDelay: `${index * 70}ms` }}
          >
            {promo.image_id && (
              <>
                <span aria-hidden className="absolute inset-0 -z-10 bg-cover bg-center transition-transform duration-700 group-hover:scale-105" style={{ backgroundImage: `url(${siteImageHref(base, promo.image_id)})` }} />
                <span aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-[rgb(14_17_32/0.78)] via-[rgb(14_17_32/0.45)] to-transparent" />
              </>
            )}
            {!promo.image_id && <span aria-hidden className="weave-tint absolute inset-0 -z-10 bg-white opacity-[0.07] [mask-size:36px_36px]" />}
            <div className={cn("flex flex-col justify-end gap-2 p-6 sm:p-8", wide ? "max-w-[640px]" : "max-w-[460px]", promo.image_id && "text-white")}>
              <h3 className={cn("font-bold leading-tight tracking-tight", wide ? "text-[28px] sm:text-[34px]" : "text-[22px]")}>{promo.title}</h3>
              {promo.body && <p className="text-[14px] leading-relaxed opacity-85">{promo.body}</p>}
              {href && promo.cta_label && (
                <Link href={href} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="mt-2 inline-flex w-fit items-center gap-2 rounded-control bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#141a33] transition hover:-translate-y-0.5 hover:shadow-[0_10px_24px_-12px_rgb(0_0_0/0.6)]">
                  {promo.cta_label}
                  <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
                </Link>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
