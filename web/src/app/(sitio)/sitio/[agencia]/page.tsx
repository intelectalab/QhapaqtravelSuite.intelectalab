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
import { getSiteHome, getSiteProfile, siteBase } from "@/lib/server/site";
import { siteHref } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/sitio/[agencia]">): Promise<Metadata> {
  const { agencia } = await params;
  const profile = await getSiteProfile(agencia);
  return { title: { absolute: `${profile.agency.name} · Tours, paquetes y experiencias en el Perú` } };
}

export default async function SiteHomePage({ params }: PageProps<"/sitio/[agencia]">) {
  const { agencia } = await params;
  const [home, profile, base] = await Promise.all([getSiteHome(agencia), getSiteProfile(agencia), siteBase(agencia)]);
  const reasons = [
    { icon: CalendarCheck2, title: "Precio por fecha, sin sorpresas", text: "El calendario muestra el precio de cada día según la temporada, calculado al momento." },
    { icon: Headset, title: `Equipo local en ${profile.sedes.length === 1 ? "1 sede" : `${profile.sedes.length} sedes`}`, text: profile.sedes.map((sede) => sede.city ?? sede.name).join(", ") + ". Te acompañamos antes y durante el viaje." },
    { icon: Landmark, title: "Agencia formal", text: [profile.agency.registry, `RUC ${profile.agency.ruc}`].filter(Boolean).join(" · ") },
    { icon: BadgeCheck, title: "Opiniones reales", text: home.reviews.count > 0 ? `${home.reviews.average?.toFixed(1)} de 5 en ${home.reviews.count} opiniones publicadas.` : "Publicamos las opiniones de nuestros pasajeros." },
  ];

  return (
    <>
      <section className="relative overflow-hidden bg-menu text-white">
        <NightBackdrop />
        <div className="relative mx-auto max-w-[1240px] px-5 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-20">
          <div className="max-w-[760px] animate-[rise-in_520ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
            <span className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold text-white/85 backdrop-blur">
              <span className="weave-line h-[3px] w-5 rounded-full" />
              {profile.agency.name} · Viajes por el Perú
            </span>
            <h1 className="text-[36px] font-bold leading-[1.05] tracking-tight sm:text-[56px]">Descubre el Perú con {profile.agency.name}</h1>
            <p className="mt-4 max-w-[58ch] text-[16px] leading-relaxed text-white/75">Elige destino, fecha y viajeros: te mostramos solo lo que está disponible, con el precio de ese día.</p>
          </div>
          <SearchBar destinations={home.search.destinations} className="mt-8 max-w-[980px] text-fg animate-[rise-in_620ms_cubic-bezier(0.22,1,0.36,1)_backwards]" />
          <ul className="mt-7 flex flex-wrap gap-2.5 text-[13px]">
            {[
              `${home.stats.products} experiencias en línea`,
              `${home.stats.destinations} destinos`,
              `${home.stats.departures} salidas con cupos en los próximos 60 días`,
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
            <SectionHeading eyebrow="Destinos" title="A dónde viajar este año" description="Cada destino reúne sus tours, la mejor época y las preguntas frecuentes." action={<MoreLink href={siteHref(base, "/destinos")} label="Ver todos los destinos" />} />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {home.destinations.map((destination, index) => (
                <DestinationTile key={destination.slug} destination={destination} base={base} index={index} large={index === 0} />
              ))}
            </div>
          </section>
        )}

        <section>
          <SectionHeading eyebrow="Recomendados" title="Tours y paquetes destacados" description="Los programas que más recomendamos, con salidas confirmadas y guías locales." action={<MoreLink href={siteHref(base, "/tours")} label="Ver todo el catálogo" />} />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {home.featured.map((product, index) => (
              <ProductCard key={product.slug} product={product} base={base} index={index} />
            ))}
          </div>
        </section>

        {home.offers.length > 0 && (
          <section>
            <SectionHeading eyebrow="Ofertas vigentes" title="Promociones con fecha de cierre" description="Descuentos activos para compras en línea. El precio final se calcula al elegir la fecha." />
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {home.offers.map((offer, index) => (
                <div key={offer.slug} className="flex flex-col gap-2">
                  {offer.promotion && (
                    <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[color-mix(in_srgb,var(--brand)_25%,transparent)] bg-[color-mix(in_srgb,var(--brand)_6%,var(--surface))] px-3.5 py-2.5">
                      <span className="inline-flex items-center gap-2 text-[13px] font-semibold text-fg">
                        <Tag size={14} className="text-brand" />
                        {offer.promotion.name} · {offer.promotion.percent ? `${offer.promotion.value} %` : `S/ ${offer.promotion.value}`}
                        {offer.promotion.code ? <Chip tone="brand">Código {offer.promotion.code}</Chip> : offer.promotion.min_pax ? <Chip tone="t4">Desde {offer.promotion.min_pax} viajeros</Chip> : null}
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
            <SectionHeading eyebrow="Salidas grupales" title="Próximas salidas con cupos" description="Grupos ya formados: reserva tu lugar antes de que se completen." action={<MoreLink href={siteHref(base, "/buscar")} label="Buscar por fecha" />} />
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
          <SectionHeading eyebrow="Opiniones" title="Lo que cuentan nuestros viajeros" description="Reseñas de pasajeros con viaje verificado y de las plataformas donde publicamos." />
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
