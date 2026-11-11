import type { Metadata } from "next";
import { SectionHeading } from "@/features/site/Bits";
import { DepartureCard } from "@/features/site/Cards";
import { Breadcrumbs, PageHero } from "@/features/site/Hero";
import { Newsletter } from "@/features/site/Newsletter";
import { OfferGrid, PromoCodes } from "@/features/site/Offers";
import { getSiteOffers, siteBase, siteLocale } from "@/lib/server/site";
import { siteHref } from "@/lib/site";
import { siteText } from "@/lib/site-i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: siteText(await siteLocale()).offers.title };
}

export default async function OffersPage({ params }: PageProps<"/sitio/[agencia]/ofertas">) {
  const { agencia } = await params;
  const [data, base, locale] = await Promise.all([getSiteOffers(agencia), siteBase(agencia), siteLocale()]);
  const site = siteText(locale);
  const t = site.offers;
  const empty = data.offers.length === 0 && data.codes.length === 0;

  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} description={t.description}>
        <div className="mt-5">
          <Breadcrumbs items={[{ label: site.common.home, href: siteHref(base) }, { label: t.eyebrow }]} />
        </div>
      </PageHero>
      <div className="mx-auto flex max-w-[1240px] flex-col gap-16 px-5 pt-12 sm:px-8">
        {empty && <p className="rounded-2xl border border-dashed border-line px-5 py-8 text-center text-[14px] text-fg-2">{t.empty}</p>}
        {data.codes.length > 0 && (
          <section>
            <SectionHeading title={t.codesTitle} description={t.codesBody} />
            <PromoCodes codes={data.codes} base={base} />
          </section>
        )}
        {data.offers.length > 0 && (
          <section>
            <SectionHeading eyebrow={site.home.offers.eyebrow} title={site.home.offers.title} description={site.home.offers.description} />
            <OfferGrid offers={data.offers} base={base} />
          </section>
        )}
        {data.departures.length > 0 && (
          <section>
            <SectionHeading title={t.departuresTitle} description={t.departuresBody} />
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.departures.map((departure, index) => (
                <DepartureCard key={departure.ref} departure={departure} base={base} index={index} />
              ))}
            </div>
          </section>
        )}
      </div>
      <div className="mt-16">
        <Newsletter />
      </div>
    </>
  );
}
