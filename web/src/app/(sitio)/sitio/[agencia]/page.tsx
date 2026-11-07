import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, CalendarCheck2, Headset, Landmark, Tag } from "lucide-react";
import Link from "next/link";
import { Chip, SectionHeading } from "@/features/site/Bits";
import { DepartureCard, DestinationTile, ProductCard } from "@/features/site/Cards";
import { Countdown } from "@/features/site/Countdown";
import { NightBackdrop } from "@/features/site/Hero";
import { Newsletter } from "@/features/site/Newsletter";
import { ReviewsSection } from "@/features/site/Reviews";
import { SearchBar } from "@/features/site/SearchBar";
import { getSiteHome, getSiteProfile, siteBase, siteLocale } from "@/lib/server/site";
import { siteHref } from "@/lib/site";
import { siteText } from "@/lib/site-i18n";

export async function generateMetadata({ params }: PageProps<"/sitio/[agencia]">): Promise<Metadata> {
  const { agencia } = await params;
  const [profile, locale] = await Promise.all([getSiteProfile(agencia), siteLocale()]);
  return { title: { absolute: siteText(locale).home.metaTitle(profile.agency.name) } };
}

export default async function SiteHomePage({ params }: PageProps<"/sitio/[agencia]">) {
  const { agencia } = await params;
  const [home, profile, base, locale] = await Promise.all([getSiteHome(agencia), getSiteProfile(agencia), siteBase(agencia), siteLocale()]);
  const site = siteText(locale);
  const t = site.home;
  const reasons = [
    { icon: CalendarCheck2, title: t.priceTitle, text: t.priceText },
    { icon: Headset, title: t.teamTitle(profile.sedes.length), text: t.teamText(profile.sedes.map((sede) => sede.city ?? sede.name).join(", ")) },
    { icon: Landmark, title: t.formalTitle, text: [profile.agency.registry, t.ruc(profile.agency.ruc)].filter(Boolean).join(" · ") },
    { icon: BadgeCheck, title: t.reviewsTitle, text: home.reviews.count > 0 ? t.reviewsText(home.reviews.average?.toFixed(1) ?? "", home.reviews.count) : t.reviewsEmpty },
  ];

  return (
    <>
      <section className="relative overflow-hidden bg-menu text-white">
        <NightBackdrop />
        <div className="relative mx-auto max-w-[1240px] px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20">
          <div className="max-w-[760px] animate-[rise-in_520ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold text-white/85 backdrop-blur">
              <span className="weave-line h-[3px] w-5 rounded-full" />
              {profile.agency.name} · {site.header.tagline}
            </span>
            <h1 className="text-[36px] font-bold leading-[1.05] tracking-tight sm:text-[56px]">{t.heroTitle(profile.agency.name)}</h1>
            <p className="mt-4 max-w-[58ch] text-[16px] leading-relaxed text-white/75">{t.heroBody}</p>
          </div>
          <SearchBar destinations={home.search.destinations} className="mt-8 max-w-[980px] text-fg animate-[rise-in_620ms_cubic-bezier(0.22,1,0.36,1)_backwards]" />
          <ul className="mt-7 flex flex-wrap gap-2.5 text-[13px]">
            {[
              t.statProducts(home.stats.products),
              t.statDestinations(home.stats.destinations),
              t.statDepartures(home.stats.departures),
            ].map((item, index) => (
              <li key={item} className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-white/80 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${300 + index * 80}ms` }}>
                {item}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mx-auto max-w-[1240px] space-y-20 px-5 pt-16 sm:px-8">
        {home.destinations.length > 0 && (
          <section>
            <SectionHeading eyebrow={t.destinations.eyebrow} title={t.destinations.title} description={t.destinations.description} action={<MoreLink href={siteHref(base, "/destinos")} label={t.destinations.more} />} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {home.destinations.map((destination, index) => (
                <DestinationTile key={destination.slug} destination={destination} base={base} index={index} large={index === 0} />
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionHeading eyebrow={t.featured.eyebrow} title={t.featured.title} description={t.featured.description} action={<MoreLink href={siteHref(base, "/tours")} label={t.featured.more} />} />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {home.featured.map((product, index) => (
              <ProductCard key={product.slug} product={product} base={base} index={index} />
            ))}
          </div>
        </section>

        {home.offers.length > 0 && (
          <section>
            <SectionHeading eyebrow={t.offers.eyebrow} title={t.offers.title} description={t.offers.description} />
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {home.offers.map((offer, index) => (
                <div key={offer.slug} className="flex flex-col gap-2">
                  {offer.promotion && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[color-mix(in_srgb,var(--brand)_25%,transparent)] bg-[color-mix(in_srgb,var(--brand)_6%,var(--surface))] px-3.5 py-2.5">
                      <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-fg">
                        <Tag size={14} className="text-brand" />
                        {offer.promotion.name} · {offer.promotion.percent ? `${offer.promotion.value} %` : `S/ ${offer.promotion.value}`}
                        {offer.promotion.code ? <Chip tone="brand">{t.promoCode(offer.promotion.code)}</Chip> : offer.promotion.min_pax ? <Chip tone="t4">{t.minPax(offer.promotion.min_pax)}</Chip> : null}
                      </span>
                      <Countdown until={offer.promotion.ends_at} />
                    </div>
                  )}
                  <ProductCard product={offer} base={base} index={index} className="flex-1" />
                </div>
              ))}
            </div>
          </section>
        )}

        {home.departures.length > 0 && (
          <section>
            <SectionHeading eyebrow={t.departures.eyebrow} title={t.departures.title} description={t.departures.description} action={<MoreLink href={siteHref(base, "/buscar")} label={t.departures.more} />} />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {home.departures.map((departure, index) => (
                <DepartureCard key={departure.ref} departure={departure} base={base} index={index} />
              ))}
            </div>
          </section>
        )}

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {reasons.map(({ icon: Icon, title, text }, index) => (
            <article key={title} className="lift rounded-card border border-line bg-surface p-5 shadow-card animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${index * 60}ms` }}>
              <span className="grid h-11 w-11 place-items-center rounded-2xl bg-[color-mix(in_srgb,var(--t1)_11%,transparent)] text-t1">
                <Icon size={20} />
              </span>
              <h3 className="mt-4 text-[15px] font-semibold text-fg">{title}</h3>
              <p className="mt-1 text-[13px] leading-relaxed text-fg-2">{text}</p>
            </article>
          ))}
        </section>

        <section>
          <SectionHeading eyebrow={t.reviews.eyebrow} title={t.reviews.title} description={t.reviews.description} />
          <ReviewsSection reviews={home.reviews} base={base} />
        </section>

        <Newsletter />
      </div>
    </>
  );
}

function MoreLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="group inline-flex items-center gap-1.5 text-[13.5px] font-semibold text-accent">
      {label}
      <ArrowRight size={15} className="transition-transform group-hover:translate-x-1" />
    </Link>
  );
}
