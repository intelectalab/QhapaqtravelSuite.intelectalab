import { CheckCircle2, Clock, Dumbbell, Languages, MapPin, ShieldCheck, Sparkles, Users, XCircle } from "lucide-react";
import type { Metadata } from "next";
import { Chip, RatingLine, SectionHeading } from "@/features/site/Bits";
import { DepartureCard, ProductCard } from "@/features/site/Cards";
import { Faq } from "@/features/site/Content";
import { Breadcrumbs } from "@/features/site/Hero";
import { AvailabilityCalendar, BookingPanel, BookingProvider, MobileBookingBar } from "@/features/site/ProductBooking";
import { ReviewsSection } from "@/features/site/Reviews";
import { Scenery } from "@/features/site/Scenery";
import { getSiteProduct, siteBase } from "@/lib/server/site";
import { LANGUAGE_LABEL, siteHref } from "@/lib/site";

export async function generateMetadata({ params }: PageProps<"/sitio/[agencia]/tours/[slug]">): Promise<Metadata> {
  const { agencia, slug } = await params;
  const { product } = await getSiteProduct(agencia, slug);
  return { title: product.seo.title, description: product.seo.description ?? undefined };
}

export default async function ProductPage({ params, searchParams }: PageProps<"/sitio/[agencia]/tours/[slug]">) {
  const [{ agencia, slug }, search] = await Promise.all([params, searchParams]);
  const fecha = typeof search.fecha === "string" ? search.fecha : undefined;
  const [detail, base] = await Promise.all([getSiteProduct(agencia, slug), siteBase(agencia)]);
  const { product } = detail;
  const facts = [
    { icon: Clock, label: "Duración", value: product.duration },
    { icon: Users, label: "Grupo", value: `${product.group.min} a ${product.group.max} viajeros · ${product.modality}` },
    { icon: Languages, label: "Idioma del guía", value: product.languages.map((code) => LANGUAGE_LABEL[code] ?? code).join(", ") || "Español" },
    { icon: Dumbbell, label: "Condición física", value: product.difficulty ?? "Sin exigencia especial" },
    { icon: MapPin, label: "Recojo", value: product.pickup ?? product.next_departure?.meeting_point ?? "Según programa" },
    { icon: ShieldCheck, label: "Reserva", value: product.advance_days > 0 ? `Con ${product.advance_days} ${product.advance_days === 1 ? "día" : "días"} de anticipación` : "Hasta el día anterior" },
  ];
  const promoCode = product.promotions.find((promotion) => promotion.code)?.code ?? null;

  return (
    <BookingProvider key={fecha ?? "sin-fecha"} detail={detail} initialDate={fecha}>
      <section className="relative">
        <Scenery seed={product.slug} label={product.name} className="h-[340px] sm:h-[400px]">
          <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-black/10" />
          <div className="relative mx-auto flex h-full max-w-[1240px] flex-col justify-end px-5 pb-8 text-white sm:px-8">
            <Breadcrumbs
              items={[
                { label: "Inicio", href: siteHref(base) },
                { label: "Destinos", href: siteHref(base, "/destinos") },
                ...product.breadcrumbs.map((crumb) => ({ label: crumb.name, href: siteHref(base, `/destinos/${crumb.slug}`) })),
                { label: product.name },
              ]}
            />
            <div className="flex flex-wrap gap-2">
              <Chip className="bg-white/15 text-white backdrop-blur">{product.category}</Chip>
              {product.tags.map((tag) => (
                <Chip key={tag.key} className="bg-white/15 text-white backdrop-blur">
                  {tag.label}
                </Chip>
              ))}
            </div>
            <h1 className="mt-3 max-w-[820px] text-[30px] font-bold leading-[1.1] tracking-tight sm:text-[44px] animate-[rise-in_520ms_cubic-bezier(0.22,1,0.36,1)_backwards]">{product.name}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[13.5px] text-white/85">
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={15} />
                {product.destination.name}
              </span>
              <span className="[&_*]:text-white/90">
                <RatingLine rating={product.rating} />
              </span>
            </div>
          </div>
        </Scenery>
      </section>

      <div className="mx-auto grid max-w-[1240px] gap-10 px-5 pb-24 pt-10 sm:px-8 lg:grid-cols-[1fr_380px] lg:pb-0">
        <div className="min-w-0 space-y-14">
          <section>
            <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {facts.map(({ icon: Icon, label, value }, index) => (
                <li key={label} className="lift flex gap-3 rounded-2xl border border-line bg-surface p-3.5 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${index * 40}ms` }}>
                  <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-[color-mix(in_srgb,var(--t1)_10%,transparent)] text-t1">
                    <Icon size={17} />
                  </span>
                  <span className="min-w-0 text-[13px] leading-snug">
                    <span className="block text-[11.5px] text-fg-3">{label}</span>
                    <b className="font-semibold text-fg">{value}</b>
                  </span>
                </li>
              ))}
            </ul>
            {product.description && <p className="mt-6 text-[15.5px] leading-relaxed text-fg-2">{product.description}</p>}
          </section>

          {detail.itinerary.length > 0 && (
            <section>
              <SectionHeading eyebrow="Itinerario" title="Día a día" className="mb-5" />
              <ol className="space-y-6">
                {detail.itinerary.map((day) => (
                  <li key={day.day} className="rounded-card border border-line bg-surface p-5 shadow-card">
                    <h3 className="flex items-center gap-3 text-[15.5px] font-semibold text-fg">
                      <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-brand text-[13px] font-bold text-brand-fg">{day.day}</span>
                      {day.title}
                    </h3>
                    {day.items.length > 0 && (
                      <ul className="relative mt-4 space-y-3 border-l-2 border-dashed border-line pl-5">
                        {day.items.map((item, index) => (
                          <li key={`${item.time}-${index}`} className="group relative text-[13.5px]">
                            <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full border-2 border-surface bg-t1 transition group-hover:scale-125" />
                            <span className="flex flex-wrap items-baseline gap-x-2">
                              {item.time && <b className="tabular-nums text-fg">{item.time}</b>}
                              <span className="text-fg-2">{item.activity}</span>
                            </span>
                            {item.location && <span className="text-[12px] text-fg-3">{item.location}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {(detail.inclusions.length > 0 || detail.exclusions.length > 0) && (
            <section className="grid gap-4 md:grid-cols-2">
              <List title="Incluye" items={detail.inclusions} icon={<CheckCircle2 size={16} className="text-ok" />} />
              <List title="No incluye" items={detail.exclusions} icon={<XCircle size={16} className="text-fg-3" />} />
            </section>
          )}

          {detail.requirements.length > 0 && (
            <section>
              <SectionHeading eyebrow="Antes de reservar" title="Requisitos y recomendaciones" className="mb-4" />
              <ul className="grid gap-2 sm:grid-cols-2">
                {detail.requirements.map((item) => (
                  <li key={item.text} className="flex gap-2.5 rounded-xl bg-surface-2 px-3.5 py-3 text-[13.5px] text-fg-2">
                    <Sparkles size={15} className="mt-0.5 flex-none text-t2" />
                    {item.text}
                  </li>
                ))}
                {product.ages.min > 0 && (
                  <li className="flex gap-2.5 rounded-xl bg-surface-2 px-3.5 py-3 text-[13.5px] text-fg-2">
                    <Sparkles size={15} className="mt-0.5 flex-none text-t2" />
                    Edad mínima: {product.ages.min} años.
                  </li>
                )}
              </ul>
            </section>
          )}

          <section id="calendario" className="scroll-mt-24">
            <SectionHeading eyebrow="Disponibilidad" title="Elige tu fecha" description="Cada día muestra el precio por adulto según su temporada. Los días sin cupo o fuera de plazo aparecen desactivados." className="mb-5" />
            <AvailabilityCalendar />
          </section>

          {detail.departures.length > 0 && (
            <section>
              <SectionHeading eyebrow="Salidas programadas" title="Próximas salidas con cupos" className="mb-5" />
              <div className="grid gap-4 md:grid-cols-2">
                {detail.departures.map((departure, index) => (
                  <DepartureCard key={departure.ref} departure={{ ...departure, product: { slug: product.slug, name: `Encuentro: ${departure.meeting_point}`, destination: product.destination.name } }} base={base} index={index} />
                ))}
              </div>
            </section>
          )}

          {Object.keys(detail.policies).length > 0 && (
            <section>
              <SectionHeading eyebrow="Condiciones" title="Políticas de la reserva" className="mb-4" />
              <dl className="divide-y divide-line rounded-card border border-line bg-surface shadow-card">
                {Object.entries(detail.policies).map(([label, text]) => (
                  <div key={label} className="grid gap-1 px-5 py-4 sm:grid-cols-[180px_1fr]">
                    <dt className="text-[13.5px] font-semibold text-fg">{label}</dt>
                    <dd className="text-[13.5px] leading-relaxed text-fg-2">{text}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {detail.faqs.length > 0 && (
            <section>
              <SectionHeading eyebrow="Preguntas frecuentes" title="Lo que más nos preguntan" className="mb-4" />
              <Faq items={detail.faqs} />
            </section>
          )}

          <section>
            <SectionHeading eyebrow="Opiniones" title="Reseñas de este viaje" className="mb-5" />
            <ReviewsSection reviews={detail.reviews} base={base} columns={2} />
          </section>
        </div>

        <aside>
          <div className="scroll-mt-24 lg:sticky lg:top-24">
            <BookingPanel promoHint={promoCode} />
          </div>
        </aside>
      </div>

      {detail.related.length > 0 && (
        <section className="mx-auto max-w-[1240px] px-5 pt-16 sm:px-8">
          <SectionHeading eyebrow="También te puede interesar" title="Combínalo con" />
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {detail.related.map((item, index) => (
              <ProductCard key={item.slug} product={item} base={base} index={index} />
            ))}
          </div>
        </section>
      )}
      <MobileBookingBar />
    </BookingProvider>
  );
}

function List({ title, items, icon }: { title: string; items: string[]; icon: React.ReactNode }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-card border border-line bg-surface p-5 shadow-card">
      <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
      <ul className="mt-3 grid gap-2">
        {items.map((item) => (
          <li key={item} className="flex gap-2.5 text-[13.5px] text-fg-2">
            <span className="mt-0.5 flex-none">{icon}</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
