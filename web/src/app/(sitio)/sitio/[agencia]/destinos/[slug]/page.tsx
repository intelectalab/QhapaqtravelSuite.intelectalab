import { Compass, Mountain, Sparkles, Thermometer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/features/site/Bits";
import { ProductCard } from "@/features/site/Cards";
import { Faq, LocationMap, SeasonStrip } from "@/features/site/Content";
import { ContentLocaleNotice } from "@/features/site/ContentLocaleNotice";
import { Breadcrumbs, PageHero } from "@/features/site/Hero";
import { ReviewsSection } from "@/features/site/Reviews";
import { StructuredData, breadcrumbNode, destinationNode, faqNode } from "@/features/site/StructuredData";
import { formatMoney } from "@/lib/format";
import { getSiteDestination, siteBase, siteLocale } from "@/lib/server/site";
import { siteOrigin } from "@/lib/server/site-seo";
import { siteHref } from "@/lib/site";
import { siteText } from "@/lib/site-i18n";

export async function generateMetadata({ params }: PageProps<"/sitio/[agencia]/destinos/[slug]">): Promise<Metadata> {
  const { agencia, slug } = await params;
  const { destination } = await getSiteDestination(agencia, slug);
  return { title: destination.name, description: destination.tagline ?? undefined };
}

export default async function DestinationPage({ params }: PageProps<"/sitio/[agencia]/destinos/[slug]">) {
  const { agencia, slug } = await params;
  const [data, base, locale, origin] = await Promise.all([getSiteDestination(agencia, slug), siteBase(agencia), siteLocale(), siteOrigin(agencia)]);
  const site = siteText(locale);
  const t = site.destinations;
  const { destination } = data;
  const facts = [
    destination.altitude && { icon: Mountain, label: t.altitude, value: destination.altitude },
    { icon: Compass, label: t.experiences, value: t.online(destination.count) },
    destination.from && { icon: Sparkles, label: site.common.from, value: formatMoney(destination.from.amount, destination.from.currency) },
  ].filter((fact): fact is { icon: typeof Mountain; label: string; value: string } => Boolean(fact));

  const faq = faqNode(destination.faqs);

  return (
    <>
      <StructuredData
        data={[
          destinationNode(data, `${origin}/destinos/${destination.slug}`),
          breadcrumbNode([{ name: site.common.home, url: origin || undefined }, { name: site.common.destinations, url: `${origin}/destinos` }, { name: destination.name }]),
          ...(faq ? [faq] : []),
        ]}
      />
      <PageHero
        eyebrow={destination.region || t.fallbackEyebrow}
        title={destination.name}
        description={destination.tagline}
        aside={
          <div className="grid gap-3 rounded-[22px] border border-white/15 bg-white/10 p-4 backdrop-blur">
            <ul className="grid grid-cols-3 gap-2">
              {facts.map(({ icon: Icon, label, value }) => (
                <li key={label} className="rounded-2xl bg-white/10 p-3 transition hover:bg-white/15">
                  <Icon size={16} className="text-t2" />
                  <span className="mt-2 block text-[11px] text-white/60">{label}</span>
                  <b className="block text-[13.5px] font-semibold leading-tight">{value}</b>
                </li>
              ))}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Link href={siteHref(base, `/tours?destino=${destination.slug}`)} className="inline-flex h-10 flex-1 items-center justify-center rounded-control bg-white px-4 text-[13.5px] font-semibold text-menu transition hover:-translate-y-0.5">
                {t.viewTours}
              </Link>
              <Link href={siteHref(base, `/viajes-a-medida?destino=${destination.slug}`)} data-site-cta className="inline-flex h-10 flex-1 items-center justify-center rounded-control bg-brand px-4 text-[13.5px] font-semibold text-brand-fg transition hover:-translate-y-0.5 hover:brightness-110">
                {site.common.tailor}
              </Link>
            </div>
          </div>
        }
      >
        <div className="mt-5">
          <Breadcrumbs items={[{ label: site.common.home, href: siteHref(base) }, { label: site.common.destinations, href: siteHref(base, "/destinos") }, { label: destination.name }]} />
        </div>
      </PageHero>

      <div className="mx-auto max-w-[1240px] space-y-16 px-5 pt-12 sm:px-8">
        <ContentLocaleNotice contentLocale={destination.content_locale} />
        <section className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <SectionHeading eyebrow={t.about.eyebrow} title={t.about.title(destination.name)} className="mb-4" />
            {destination.description && <p className="text-[15.5px] leading-relaxed text-fg-2">{destination.description}</p>}
            {destination.climate && (
              <div className="mt-6 flex gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[color-mix(in_srgb,var(--t4)_12%,transparent)] text-t4">
                  <Thermometer size={18} />
                </span>
                <p className="text-[14px] leading-relaxed text-fg-2">
                  <b className="block font-semibold text-fg">{t.climate}</b>
                  {destination.climate}
                </p>
              </div>
            )}
          </div>
          {destination.lat !== null && destination.lng !== null && <LocationMap name={destination.name} lat={destination.lat} lng={destination.lng} />}
        </section>

        <section>
          <SectionHeading eyebrow={t.seasons.eyebrow} title={t.seasons.title} description={t.seasons.description} />
          <SeasonStrip months={data.months} special={data.special} />
        </section>

        <section>
          <SectionHeading eyebrow={t.todo.eyebrow} title={t.todo.title(destination.name)} />
          {data.products.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.products.map((product, index) => (
                <ProductCard key={product.slug} product={product} base={base} index={index} />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-dashed border-line p-6">
              <p className="text-[14px] text-fg-2">{t.noProducts}</p>
              <Link href={siteHref(base, `/viajes-a-medida?destino=${destination.slug}`)} data-site-cta className="inline-flex h-10 items-center rounded-control bg-brand px-4 text-[13.5px] font-semibold text-brand-fg transition hover:-translate-y-0.5">
                {t.design}
              </Link>
            </div>
          )}
        </section>

        {destination.faqs.length > 0 && (
          <section className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
            <SectionHeading eyebrow={t.faq.eyebrow} title={t.faq.title(destination.name)} description={t.faq.description} />
            <Faq items={destination.faqs} />
          </section>
        )}

        {data.reviews.count > 0 && (
          <section>
            <SectionHeading eyebrow={t.reviews.eyebrow} title={t.reviews.title(destination.name)} />
            <ReviewsSection reviews={data.reviews} base={base} columns={2} />
          </section>
        )}
      </div>
    </>
  );
}
