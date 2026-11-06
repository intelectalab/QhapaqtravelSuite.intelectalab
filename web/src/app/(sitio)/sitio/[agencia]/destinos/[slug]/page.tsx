import { Compass, Mountain, Sparkles, Thermometer } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SectionHeading } from "@/features/site/Bits";
import { ProductCard } from "@/features/site/Cards";
import { Faq, LocationMap, SeasonStrip } from "@/features/site/Content";
import { Breadcrumbs, PageHero } from "@/features/site/Hero";
import { ReviewsSection } from "@/features/site/Reviews";
import { formatMoney } from "@/lib/format";
import { getSiteDestination, siteBase } from "@/lib/server/site";
import { siteHref } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/sitio/[agencia]/destinos/[slug]">): Promise<Metadata> {
  const { agencia, slug } = await params;
  const { destination } = await getSiteDestination(agencia, slug);
  return { title: destination.name, description: destination.tagline ?? undefined };
}

export default async function DestinationPage({ params }: PageProps<"/sitio/[agencia]/destinos/[slug]">) {
  const { agencia, slug } = await params;
  const [data, base] = await Promise.all([getSiteDestination(agencia, slug), siteBase(agencia)]);
  const { destination } = data;
  const facts = [
    destination.altitude && { icon: Mountain, label: "Altitud", value: destination.altitude },
    { icon: Compass, label: "Experiencias", value: destination.count === 1 ? "1 en línea" : `${destination.count} en línea` },
    destination.from && { icon: Sparkles, label: "Desde", value: formatMoney(destination.from.amount, destination.from.currency) },
  ].filter((fact): fact is { icon: typeof Mountain; label: string; value: string } => Boolean(fact));

  return (
    <>
      <PageHero
        eyebrow={destination.region || "Destino"}
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
                Ver tours
              </Link>
              <Link href={siteHref(base, `/viajes-a-medida?destino=${destination.slug}`)} className="inline-flex h-10 flex-1 items-center justify-center rounded-control bg-brand px-4 text-[13.5px] font-semibold text-brand-fg transition hover:-translate-y-0.5 hover:brightness-110">
                Cotizar a medida
              </Link>
            </div>
          </div>
        }
      >
        <div className="mt-5">
          <Breadcrumbs items={[{ label: "Inicio", href: siteHref(base) }, { label: "Destinos", href: siteHref(base, "/destinos") }, { label: destination.name }]} />
        </div>
      </PageHero>

      <div className="mx-auto max-w-[1240px] space-y-16 px-5 pt-12 sm:px-8">
        <section className="grid gap-8 lg:grid-cols-[1.5fr_1fr]">
          <div>
            <SectionHeading eyebrow="Sobre el destino" title={`Conoce ${destination.name}`} className="mb-4" />
            {destination.description && <p className="text-[15.5px] leading-relaxed text-fg-2">{destination.description}</p>}
            {destination.climate && (
              <div className="mt-6 flex gap-3 rounded-card border border-line bg-surface p-4 shadow-card">
                <span className="grid h-10 w-10 flex-none place-items-center rounded-xl bg-[color-mix(in_srgb,var(--t4)_12%,transparent)] text-t4">
                  <Thermometer size={18} />
                </span>
                <p className="text-[14px] leading-relaxed text-fg-2">
                  <b className="block font-semibold text-fg">Clima</b>
                  {destination.climate}
                </p>
              </div>
            )}
          </div>
          {destination.lat !== null && destination.lng !== null && <LocationMap name={destination.name} lat={destination.lat} lng={destination.lng} />}
        </section>

        <section>
          <SectionHeading eyebrow="Mejor época" title="Temporadas de los próximos 12 meses" description="Los precios por fecha siguen estas temporadas: alta y fechas especiales suben; baja tiene mejores tarifas." />
          <SeasonStrip months={data.months} special={data.special} />
        </section>

        <section>
          <SectionHeading eyebrow="Qué hacer" title={`Tours y paquetes en ${destination.name}`} />
          {data.products.length > 0 ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {data.products.map((product, index) => (
                <ProductCard key={product.slug} product={product} base={base} index={index} />
              ))}
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-4 rounded-card border border-dashed border-line p-6">
              <p className="text-[14px] text-fg-2">Todavía no publicamos salidas en línea para este destino, pero lo organizamos a tu medida.</p>
              <Link href={siteHref(base, `/viajes-a-medida?destino=${destination.slug}`)} className="inline-flex h-10 items-center rounded-control bg-brand px-4 text-[13.5px] font-semibold text-brand-fg transition hover:-translate-y-0.5">
                Diseñar mi viaje
              </Link>
            </div>
          )}
        </section>

        {destination.faqs.length > 0 && (
          <section className="grid gap-6 lg:grid-cols-[1fr_1.6fr]">
            <SectionHeading eyebrow="Preguntas frecuentes" title={`Antes de viajar a ${destination.name}`} description="¿Otra duda? Escríbenos y te respondemos en horario de oficina." />
            <Faq items={destination.faqs} />
          </section>
        )}

        {data.reviews.count > 0 && (
          <section>
            <SectionHeading eyebrow="Opiniones" title={`Viajeros en ${destination.name}`} />
            <ReviewsSection reviews={data.reviews} base={base} columns={2} />
          </section>
        )}
      </div>
    </>
  );
}
