import type { Metadata } from "next";
import { DestinationTile } from "@/features/site/Cards";
import { Breadcrumbs, PageHero } from "@/features/site/Hero";
import { getSiteDestinations, siteBase } from "@/lib/server/site";
import { siteHref } from "@/lib/site";

export const metadata: Metadata = { title: "Destinos" };

export default async function DestinationsPage({ params }: PageProps<"/sitio/[agencia]/destinos">) {
  const { agencia } = await params;
  const [{ items }, base] = await Promise.all([getSiteDestinations(agencia), siteBase(agencia)]);
  const withProducts = items.filter((item) => item.count > 0);
  const tailored = items.filter((item) => item.count === 0);

  return (
    <>
      <PageHero eyebrow="Destinos" title="Elige por dónde empezar" description="Cada destino reúne sus tours, la altitud, el clima y la mejor época para viajar.">
        <div className="mt-5">
          <Breadcrumbs items={[{ label: "Inicio", href: siteHref(base) }, { label: "Destinos" }]} />
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
            <h2 className="text-[20px] font-bold tracking-tight text-fg">También organizamos viajes a medida</h2>
            <p className="mt-1 text-[14px] text-fg-2">Aún no publicamos salidas en línea para estos destinos; te armamos el itinerario.</p>
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
