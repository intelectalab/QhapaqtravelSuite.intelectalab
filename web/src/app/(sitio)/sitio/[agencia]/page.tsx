import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, CalendarCheck2, Headset, Landmark } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { AndesBand, CommitmentGrid } from "@/features/site/AndesBlocks";
import { AndesHero, DepartureTable } from "@/features/site/AndesHome";
import { SectionHeading } from "@/features/site/Bits";
import { DepartureCard, DestinationTile, ProductCard } from "@/features/site/Cards";
import { NightBackdrop } from "@/features/site/Hero";
import { Newsletter } from "@/features/site/Newsletter";
import { OfferGrid } from "@/features/site/Offers";
import { PromoBanners } from "@/features/site/PromoBanners";
import { ReviewsSection } from "@/features/site/Reviews";
import { SearchBar } from "@/features/site/SearchBar";
import { cn } from "@/lib/cn";
import { getSiteHome, getSiteProfile, getSiteText, siteBase } from "@/lib/server/site";
import { siteHref } from "@/lib/site";
import { siteImageHref, type SiteSectionId } from "@/lib/site-design";

export async function generateMetadata({ params }: PageProps<"/sitio/[agencia]">): Promise<Metadata> {
  const { agencia } = await params;
  const [profile, site] = await Promise.all([getSiteProfile(agencia), getSiteText(agencia)]);
  return { title: { absolute: profile.design.seo.title || site.home.metaTitle(profile.agency.name) } };
}

export default async function SiteHomePage({ params }: PageProps<"/sitio/[agencia]">) {
  const { agencia } = await params;
  const [home, profile, base, site] = await Promise.all([getSiteHome(agencia), getSiteProfile(agencia), siteBase(agencia), getSiteText(agencia)]);
  const t = site.home;
  const { hero, sections, promos } = profile.design;
  const centered = hero.align === "centro";
  const image = hero.style === "imagen" && hero.image_id ? siteImageHref(base, hero.image_id) : null;
  const andes = profile.design.theme.style === "andes";
  const stats = hero.show_stats ? [t.statProducts(home.stats.products), t.statDestinations(home.stats.destinations), t.statDepartures(home.stats.departures)] : [];
  const reasons = [
    { icon: CalendarCheck2, title: t.priceTitle, text: t.priceText },
    { icon: Headset, title: t.teamTitle(profile.sedes.length), text: t.teamText(profile.sedes.map((sede) => sede.city ?? sede.name).join(", ")) },
    { icon: Landmark, title: t.formalTitle, text: [profile.agency.registry, t.ruc(profile.agency.ruc)].filter(Boolean).join(" · ") },
    { icon: BadgeCheck, title: t.reviewsTitle, text: home.reviews.count > 0 ? t.reviewsText(home.reviews.average?.toFixed(1) ?? "", home.reviews.count) : t.reviewsEmpty },
  ];

  const blocks: Record<SiteSectionId, ReactNode> = {
    destinations:
      home.destinations.length > 0 ? (
        <section>
          <SectionHeading eyebrow={t.destinations.eyebrow} title={t.destinations.title} description={t.destinations.description} action={<MoreLink href={siteHref(base, "/destinos")} label={t.destinations.more} />} />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {home.destinations.map((destination, index) => (
              <DestinationTile key={destination.slug} destination={destination} base={base} index={index} large={index === 0} />
            ))}
          </div>
        </section>
      ) : null,
    featured: (
      <section>
        <SectionHeading eyebrow={t.featured.eyebrow} title={t.featured.title} description={t.featured.description} action={<MoreLink href={siteHref(base, "/tours")} label={t.featured.more} />} />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {home.featured.map((product, index) => (
            <ProductCard key={product.slug} product={product} base={base} index={index} />
          ))}
        </div>
      </section>
    ),
    promos: promos.length > 0 ? <PromoBanners promos={promos} base={base} /> : null,
    offers:
      home.offers.length > 0 ? (
        <section>
          <SectionHeading eyebrow={t.offers.eyebrow} title={t.offers.title} description={t.offers.description} action={<MoreLink href={siteHref(base, "/ofertas")} label={site.offers.title} />} />
          <OfferGrid offers={home.offers} base={base} />
        </section>
      ) : null,
    departures:
      home.departures.length > 0 ? (
        <section>
          <SectionHeading eyebrow={t.departures.eyebrow} title={t.departures.title} description={t.departures.description} action={<MoreLink href={siteHref(base, "/buscar")} label={t.departures.more} />} />
          {andes ? (
            <DepartureTable departures={home.departures} />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {home.departures.map((departure, index) => (
                <DepartureCard key={departure.ref} departure={departure} base={base} index={index} />
              ))}
            </div>
          )}
        </section>
      ) : null,
    reasons: andes ? (
      <CommitmentGrid items={reasons} />
    ) : (
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
    ),
    reviews: (
      <section>
        <SectionHeading eyebrow={t.reviews.eyebrow} title={t.reviews.title} description={t.reviews.description} />
        <ReviewsSection reviews={home.reviews} base={base} />
      </section>
    ),
    newsletter: <Newsletter />,
  };

  const visible = sections.filter((section) => section.visible && blocks[section.id] !== null);

  if (andes) {
    return (
      <>
        <AndesHero
          title={t.heroTitle(profile.agency.name)}
          body={t.heroBody}
          seal={profile.agency.registry}
          image={image}
          overlay={hero.overlay}
          stats={stats}
          search={hero.show_search ? <SearchBar destinations={home.search.destinations} /> : null}
        />
        {visible.map((section, index) => (
          <AndesBand key={section.id} index={index}>
            <div data-testid={`site-section:${section.id}`}>{blocks[section.id]}</div>
          </AndesBand>
        ))}
      </>
    );
  }

  return (
    <>
      <section data-testid="site-hero" data-hero-style={hero.style} className="relative isolate overflow-hidden bg-menu text-white">
        {hero.style === "noche" && <NightBackdrop />}
        {hero.style === "color" && <div aria-hidden className="weave-tint pointer-events-none absolute inset-0 bg-white opacity-[0.05] [mask-size:36px_36px]" />}
        {image && (
          <>
            <span aria-hidden className="absolute inset-0 -z-10 bg-cover bg-center" style={{ backgroundImage: `url(${image})` }} />
            <span aria-hidden className="absolute inset-0 -z-10" style={{ background: `rgb(14 17 32 / ${hero.overlay / 100})` }} />
          </>
        )}
        <div className={cn("relative mx-auto max-w-[1240px] px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20", centered && "flex flex-col items-center text-center")}>
          <div className="max-w-[760px] animate-[rise-in_520ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold text-white/85 backdrop-blur">
              <span className="weave-line h-[3px] w-5 rounded-full" />
              {profile.agency.name} · {site.header.tagline}
            </span>
            <h1 className="text-[36px] font-bold leading-[1.05] tracking-tight sm:text-[56px]">{t.heroTitle(profile.agency.name)}</h1>
            <p className={cn("mt-4 max-w-[58ch] text-[16px] leading-relaxed text-white/75", centered && "mx-auto")}>{t.heroBody}</p>
          </div>
          {hero.show_search && <SearchBar destinations={home.search.destinations} className={cn("mt-8 w-full max-w-[980px] text-fg animate-[rise-in_620ms_cubic-bezier(0.22,1,0.36,1)_backwards]", centered && "text-left")} />}
          {hero.show_stats && (
            <ul className={cn("mt-7 flex flex-wrap gap-2.5 text-[13px]", centered && "justify-center")}>
              {[t.statProducts(home.stats.products), t.statDestinations(home.stats.destinations), t.statDepartures(home.stats.departures)].map((item, index) => (
                <li key={item} className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-white/80 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${300 + index * 80}ms` }}>
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <div className="mx-auto max-w-[1240px] space-y-20 px-5 pt-16 sm:px-8">
        {visible.map((section) => (
          <div key={section.id} data-testid={`site-section:${section.id}`}>
            {blocks[section.id]}
          </div>
        ))}
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
