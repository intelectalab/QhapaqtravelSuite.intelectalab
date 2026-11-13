import { ArrowRight, BadgeCheck, CalendarX2, MapPin, Plus, Search, Star, Wallet } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { StructuredData } from "@/features/site/StructuredData";
import { CityTile, EmptyNote, PostCard, TourCard } from "@/features/rutas-libres/Cards";
import { Section, SectionHead } from "@/features/rutas-libres/Shell";
import { formatNumber } from "@/lib/format";
import { cityName, rlPath } from "@/lib/rutas-libres";
import { getRlListings, getRlOverview, getRlPosts, listingQuery, rlBase, rlOrigin } from "@/lib/server/rutas-libres";

const FAQ: [string, string][] = [
  ["¿Los free tours son realmente gratis?", "Reservar no cuesta nada y no pedimos tarjeta. Al terminar el recorrido usted deja al guía la propina que le parezca justa."],
  ["¿Cómo sé que la agencia es confiable?", "Revisamos el RUC, la licencia de turismo y las fotos de cada tour antes de publicarlo. Las agencias verificadas llevan el sello verde."],
  ["¿Puedo cancelar?", "Sí, con un clic desde el correo de confirmación y sin penalidad."],
  ["¿Qué pasa con los tours de pago?", "Se reservan aquí y se pagan a la agencia que organiza, con las condiciones que muestra cada ficha."],
];

export async function generateMetadata(): Promise<Metadata> {
  return { alternates: { canonical: await rlOrigin() } };
}

export default async function RutasLibresHome({ searchParams }: PageProps<"/vitrina">) {
  const { tema } = await searchParams;
  const theme = typeof tema === "string" ? tema : undefined;
  const [overview, listings, posts, base, origin] = await Promise.all([getRlOverview(), getRlListings(listingQuery({ theme })), getRlPosts(), rlBase(), rlOrigin()]);
  const featured = listings.items.slice(0, 8);

  return (
    <>
      <StructuredData data={{ "@context": "https://schema.org", "@type": "FAQPage", url: origin, mainEntity: FAQ.map(([q, a]) => ({ "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a } })) }} />
      <section className="relative overflow-hidden">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_85%_10%,rgba(249,87,56,0.16),transparent_40%),radial-gradient(circle_at_10%_30%,rgba(29,78,216,0.14),transparent_45%)]" />
        <div className="rl-wrap relative pb-10 pt-14 sm:pt-20">
          <span className="rl-tag rl-tag-verified rl-rise"><BadgeCheck size={14} />{overview.stats.tours > 0 ? `${formatNumber(overview.stats.agencies)} agencias verificadas · ${formatNumber(overview.stats.tours)} tours` : "La red de free walking tours del Perú"}</span>
          <h1 className="rl-h1 rl-rise mt-5 max-w-[17ch]" style={{ animationDelay: "60ms" }}>Descubra el Perú a pie con <span className="text-[var(--rl-cobalt)]">guías locales</span></h1>
          <p className="rl-muted rl-rise mt-5 max-w-[56ch] text-[18px]" style={{ animationDelay: "120ms" }}>Reserve gratis los mejores free walking tours y experiencias culturales. Sin cobros previos: usted decide la propina al final.</p>
          <div className="rl-glass rl-rise mt-8 flex flex-col gap-4 rounded-[1.75rem] p-4 sm:p-5 lg:flex-row lg:items-center" style={{ animationDelay: "180ms" }}>
            <span className="flex items-center gap-2 px-2 text-[14px] font-semibold"><Search size={18} className="text-[var(--rl-cobalt)]" />¿A dónde va?</span>
            <div className="flex flex-1 flex-wrap gap-2">
              {overview.cities.map((city) => (
                <Link key={city.id} href={rlPath(base, `/${city.id}`)} className="rl-chip"><MapPin size={14} />{cityName(city.id)} <span className="opacity-60">{city.tours}</span></Link>
              ))}
            </div>
            {overview.cities[0] && <Link href={rlPath(base, `/${overview.cities[0].id}`)} className="rl-cta">Ver experiencias <ArrowRight size={16} /></Link>}
          </div>
          <ul className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Wallet, title: "Reserva gratuita", note: "Sin tarjeta ni cargos sorpresa" },
              { icon: BadgeCheck, title: "Agencias verificadas", note: "RUC y licencia revisados" },
              { icon: CalendarX2, title: "Cancelación en un clic", note: "Desde su correo, sin penalidad" },
              { icon: Star, title: "Reseñas reales", note: "Solo de quienes asistieron" },
            ].map((item) => (
              <li key={item.title} className="rl-card rl-hover flex items-center gap-3 p-4">
                <span className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-[var(--rl-emerald-soft)] text-[var(--rl-emerald)]"><item.icon size={20} /></span>
                <span><b className="block text-[14px]">{item.title}</b><span className="rl-muted text-[12.5px]">{item.note}</span></span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <Section>
        <SectionHead kicker="Explore" title="Destinos favoritos" description="Ciudades con más salidas y guías bilingües listos para recibirle." />
        {overview.cities.length === 0 ? (
          <EmptyNote>Muy pronto habrá tours publicados.</EmptyNote>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            {overview.cities.map((city, index) => <CityTile key={city.id} city={city} base={base} large={index === 0} index={index} />)}
          </div>
        )}
      </Section>

      <Section>
        <SectionHead kicker="Experiencias destacadas" title="Los tours mejor valorados" description="Ordenados por destacados, reseñas verificadas y asistencia." />
        <div className="mb-6 flex gap-2 overflow-x-auto pb-1" role="group" aria-label="Temas">
          <Link href={rlPath(base)} scroll={false} aria-current={!theme} className="rl-chip">Todos</Link>
          {overview.themes.map((value) => (
            <Link key={value} href={rlPath(base, `?tema=${encodeURIComponent(value)}`)} scroll={false} aria-current={theme === value} className="rl-chip">{value}</Link>
          ))}
        </div>
        {featured.length === 0 ? <EmptyNote>Aún no hay tours de {theme}.</EmptyNote> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{featured.map((listing, index) => <TourCard key={listing.code} listing={listing} base={base} index={index} />)}</div>}
      </Section>

      <Section>
        <div className="text-center"><span className="rl-kicker">Cómo funciona</span><h2 className="rl-h2 mt-1">Tres pasos y está caminando</h2></div>
        <ol className="mt-10 grid gap-5 md:grid-cols-3">
          {[
            ["Elija su ruta", "Filtre por ciudad, tema, idioma y turno. Cada tour muestra el punto de encuentro y reseñas reales."],
            ["Reserve con su correo", "Solo nombre y correo. Recibe la confirmación al instante y puede cancelar con un clic."],
            ["Camine y decida la propina", "Al final del recorrido paga lo que le pareció justo, en efectivo o con Yape."],
          ].map(([title, note], index) => (
            <li key={title} className="rl-card rl-hover p-7">
              <span className="grid h-11 w-11 place-items-center rounded-full bg-[var(--rl-cobalt)] text-[17px] font-extrabold text-white">{index + 1}</span>
              <h3 className="rl-h3 mt-5">{title}</h3>
              <p className="rl-muted mt-2 text-[14.5px]">{note}</p>
            </li>
          ))}
        </ol>
      </Section>

      <Section>
        <div className="rl-band grid gap-8 overflow-hidden rounded-[2rem] p-8 sm:p-12 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <span className="rl-kicker text-emerald-300">Para agencias y guías</span>
            <h2 className="rl-h2 mt-2 text-white">¿Tiene una agencia o es guía?</h2>
            <p className="mt-4 max-w-[52ch] text-[16px] text-slate-300">Publique sus free tours sin costo y reciba reservas hoy. Cuando quiera vender más, KipuControl le da su propio sitio web con SEO, cobros en línea y paquetes.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link href={rlPath(base, "/agencias#registro")} className="rl-cta"><Plus size={16} />Publicar gratis</Link>
              <Link href={rlPath(base, "/agencias#planes")} className="inline-flex min-h-[46px] items-center rounded-full border border-white/20 px-5 text-[14px] font-semibold text-white transition hover:bg-white/10">Ver beneficios</Link>
            </div>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2">
            {overview.benefits.slice(0, 4).map(([title, note]) => (
              <li key={title} className="rounded-2xl border border-white/10 bg-white/5 p-4 transition hover:bg-white/10"><b className="block text-[14px] text-white">{title}</b><span className="text-[13px] text-slate-400">{note}</span></li>
            ))}
          </ul>
        </div>
      </Section>

      {posts.length > 0 && (
        <Section>
          <SectionHead kicker="Guías de viaje" title="Del blog de Rutas Libres" description="Escritas por guías locales para planear su viaje." action={<Link href={rlPath(base, "/blog")} className="rl-ghost">Ver el blog <ArrowRight size={15} /></Link>} />
          <div className="grid gap-5 md:grid-cols-3">{posts.slice(0, 3).map((post, index) => <PostCard key={post.slug} post={post} base={base} index={index} />)}</div>
        </Section>
      )}

      <Section>
        <div className="mx-auto max-w-[820px]">
          <div className="mb-6 text-center"><span className="rl-kicker">Preguntas frecuentes</span><h2 className="rl-h2 mt-1">Antes de reservar</h2></div>
          <div className="flex flex-col gap-3">
            {FAQ.map(([q, a]) => (
              <details key={q} className="rl-faq rl-card px-6 py-5">
                <summary className="flex items-center justify-between gap-4 text-[16px] font-semibold">{q}<Plus size={18} className="rl-faq-icon flex-none text-[var(--rl-cobalt)] transition-transform" /></summary>
                <p className="rl-muted mt-3 text-[14.5px]">{a}</p>
              </details>
            ))}
          </div>
        </div>
      </Section>
    </>
  );
}
