import { BadgeCheck, CheckCircle2, Clock, ExternalLink, Languages, MapPin, Users } from "lucide-react";
import type { Metadata } from "next";
import { StructuredData } from "@/features/site/StructuredData";
import { BookingForm } from "@/features/rutas-libres/BookingForm";
import { Cover, Rating, TourCard } from "@/features/rutas-libres/Cards";
import { Crumbs } from "@/features/rutas-libres/Shell";
import { cityName, RL_LANGUAGES, rlPath } from "@/lib/rutas-libres";
import { getRlListing, getRlListings, listingQuery, rlBase, rlOrigin } from "@/lib/server/rutas-libres";

function nextDays(count: number): { value: string; weekday: string; day: string }[] {
  const today = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Lima" }));
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() + index + 1);
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
    return { value, weekday: date.toLocaleDateString("es-PE", { weekday: "short" }).replace(".", ""), day: String(date.getDate()) };
  });
}

export async function generateMetadata({ params }: PageProps<"/vitrina/tour/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const [listing, origin] = await Promise.all([getRlListing(slug), rlOrigin()]);
  const description = `${listing.highlights.slice(0, 3).join(" · ")}. ${listing.model === "pago" ? "Reserve en línea" : "Reserve gratis"} con ${listing.agency.name}.`;
  return { title: listing.title, description, alternates: { canonical: `${origin}/tour/${listing.slug}` }, openGraph: { title: listing.title, description, type: "website" } };
}

export default async function TourPage({ params }: PageProps<"/vitrina/tour/[slug]">) {
  const { slug } = await params;
  const [listing, base, origin] = await Promise.all([getRlListing(slug), rlBase(), rlOrigin()]);
  const others = (await getRlListings(listingQuery({ city: listing.city }))).items.filter((item) => item.code !== listing.code).slice(0, 4);
  const url = `${origin}/tour/${listing.slug}`;

  return (
    <>
      <StructuredData
        data={[
          {
            "@context": "https://schema.org",
            "@type": "TouristTrip",
            name: listing.title,
            url,
            description: listing.highlights.join(". "),
            touristType: listing.theme ?? undefined,
            itinerary: { "@type": "ItemList", itemListElement: listing.highlights.map((item, index) => ({ "@type": "ListItem", position: index + 1, name: item })) },
            provider: { "@type": "TravelAgency", name: listing.agency.name },
            offers: { "@type": "Offer", price: listing.model === "pago" ? listing.price : "0", priceCurrency: listing.currency, availability: "https://schema.org/InStock", url },
            ...(listing.reviews && listing.rating ? { aggregateRating: { "@type": "AggregateRating", ratingValue: listing.rating, reviewCount: listing.reviews } } : {}),
          },
          { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Inicio", item: origin }, { "@type": "ListItem", position: 2, name: cityName(listing.city), item: `${origin}/${listing.city}` }, { "@type": "ListItem", position: 3, name: listing.title }] },
        ]}
      />
      <section className="rl-wrap pt-8">
        <Crumbs items={[{ label: "Inicio", href: rlPath(base) }, { label: cityName(listing.city), href: rlPath(base, `/${listing.city}`) }, { label: listing.title }]} />
        <div className="mt-4 flex flex-wrap gap-2">
          <span className={`rl-tag ${listing.model === "pago" ? "rl-tag-coral" : "rl-tag-cobalt"}`}>{listing.model === "pago" ? "Experiencia de pago" : "Free tour"}</span>
          {listing.agency.verified && <span className="rl-tag rl-tag-verified"><BadgeCheck size={13} />Agencia verificada</span>}
          {listing.theme && <span className="rl-tag rl-tag-cobalt">{listing.theme}</span>}
        </div>
        <h1 className="rl-h1 mt-3 max-w-[22ch] text-[clamp(30px,4vw,46px)]">{listing.title}</h1>
        <p className="rl-muted mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px]">
          <Rating value={listing.rating} count={listing.reviews} />
          <span className="inline-flex items-center gap-1.5"><Clock size={15} />{listing.duration_hours} h</span>
          <span className="inline-flex items-center gap-1.5"><MapPin size={15} />{listing.zone ? `${listing.zone}, ` : ""}{cityName(listing.city)}</span>
          <span className="inline-flex items-center gap-1.5"><Languages size={15} />{listing.languages.map((code) => RL_LANGUAGES[code] ?? code).join(", ")}</span>
          <span className="inline-flex items-center gap-1.5"><Users size={15} />Hasta {listing.capacity} por salida</span>
        </p>
        <div className="mt-6 grid h-[240px] gap-3 sm:h-[340px] sm:grid-cols-[2fr_1fr]">
          <Cover city={listing.city} className="rounded-[1.75rem]"><div className="flex h-full items-end p-4"><span className="rl-tag rl-tag-glass">Fotos de {listing.agency.name}</span></div></Cover>
          <div className="hidden gap-3 sm:grid sm:grid-rows-2">
            <Cover city={listing.city} className="rounded-[1.75rem] [&>div:first-child]:hue-rotate-15" />
            <Cover city={listing.city} className="rounded-[1.75rem] [&>div:first-child]:brightness-110 [&>div:first-child]:saturate-75" />
          </div>
        </div>
      </section>

      <section className="rl-wrap grid gap-8 pt-10 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="flex flex-col gap-5">
          <article className="rl-card p-7">
            <h2 className="rl-h3">Lo que verá</h2>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {listing.highlights.map((item) => (
                <li key={item} className="flex gap-2.5 text-[15px]"><CheckCircle2 size={18} className="mt-0.5 flex-none text-[var(--rl-emerald)]" />{item}</li>
              ))}
            </ul>
          </article>
          <article className="rl-card p-7">
            <h2 className="rl-h3">Punto de encuentro</h2>
            <p className="mt-3 flex gap-2.5 text-[15px]"><MapPin size={18} className="mt-0.5 flex-none text-[var(--rl-cobalt)]" />{listing.meeting_point}</p>
            <p className="rl-muted mt-2 text-[14px]">El guía lleva una identificación de {listing.agency.name}. Llegue 10 minutos antes. Salidas: {listing.start_times.join(", ")}.</p>
          </article>
          <article className="rl-card p-7">
            <h2 className="rl-h3">Organiza</h2>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--rl-cobalt)] text-[18px] font-extrabold text-white">{listing.agency.name.slice(0, 2).toUpperCase()}</span>
              <div>
                <b className="text-[16px]">{listing.agency.name}</b>
                <div className="mt-1 flex flex-wrap items-center gap-3"><Rating value={listing.agency.rating} count={listing.agency.reviews} />{listing.agency.verified && <span className="rl-tag rl-tag-verified"><BadgeCheck size={13} />RUC y licencia verificados</span>}</div>
              </div>
            </div>
            {listing.attendance_rate !== null && <p className="rl-muted mt-4 text-[14px]">{listing.attendance_rate} % de los viajeros que reservaron asistieron al tour.</p>}
            {listing.agency_site && <a href={`https://${listing.agency_site}`} target="_blank" rel="noopener" className="rl-ghost -ml-3 mt-3">Más tours y paquetes en {listing.agency_site} <ExternalLink size={14} /></a>}
          </article>
        </div>
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="rl-panel p-6 sm:p-7" id="reservar">
            <BookingForm listing={listing} agency={listing.agency.name} days={nextDays(7)} base={base} />
          </div>
        </aside>
      </section>

      {others.length > 0 && (
        <section className="rl-wrap pt-16">
          <h2 className="rl-h2 mb-6 text-[26px]">Más en {cityName(listing.city)}</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{others.map((item, index) => <TourCard key={item.code} listing={item} base={base} index={index} />)}</div>
        </section>
      )}
    </>
  );
}
