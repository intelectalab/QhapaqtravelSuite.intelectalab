import type { Metadata } from "next";
import { DestinationTile } from "@/features/site/Cards";
import { Breadcrumbs, PageHero } from "@/features/site/Hero";
import { getSiteDestinations, siteBase, siteLocale } from "@/lib/server/site";
import { siteHref } from "@/lib/site";
import { siteText } from "@/lib/site-i18n";

export async function generateMetadata(): Promise<Metadata> {
  return { title: siteText(await siteLocale()).destinations.eyebrow };
}

export default async function DestinationsPage({ params }: PageProps<"/sitio/[agencia]/destinos">) {
  const { agencia } = await params;
  const [{ items }, base, locale] = await Promise.all([getSiteDestinations(agencia), siteBase(agencia), siteLocale()]);
  const site = siteText(locale);
  const t = site.destinations;
  const withProducts = items.filter((item) => item.count > 0);
  const tailored = items.filter((item) => item.count === 0);

  return (
    <>
      <PageHero eyebrow={t.eyebrow} title={t.title} description={t.description}>
        <div className="mt-5">
          <Breadcrumbs items={[{ label: site.common.home, href: siteHref(base) }, { label: site.common.destinations }]} />
        </div>
      </PageHero>
      <div className="mx-auto max-w-[1240px] px-5 pt-12 sm:px-8">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {withProducts.map((destination, index) => (
            <DestinationTile key={destination.slug} destination={destination} base={base} index={index} large={index === 0} />
          ))}
        </div>
        {tailored.length > 0 && (
          <section className="mt-14">
            <h2 className="text-[20px] font-bold tracking-tight text-fg">{t.tailoredTitle}</h2>
            <p className="mt-1 text-[14px] text-fg-2">{t.tailoredBody}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {tailored.map((destination, index) => (
                <DestinationTile key={destination.slug} destination={destination} base={base} index={index} />
              ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
