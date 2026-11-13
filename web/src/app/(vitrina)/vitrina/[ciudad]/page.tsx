import { X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StructuredData } from "@/features/site/StructuredData";
import { Cover, EmptyNote, TourCard } from "@/features/rutas-libres/Cards";
import { Crumbs } from "@/features/rutas-libres/Shell";
import { cityName, RL_LANGUAGES, rlPath, TURN_LABELS, turnOf } from "@/lib/rutas-libres";
import { getRlListings, listingQuery, rlBase, rlOrigin } from "@/lib/server/rutas-libres";

const FILTERS = ["zona", "tema", "idioma", "tipo", "turno"] as const;

type Filter = (typeof FILTERS)[number];

function pick(params: Record<string, string | string[] | undefined>): Partial<Record<Filter, string>> {
  return Object.fromEntries(FILTERS.map((key) => [key, typeof params[key] === "string" ? (params[key] as string) : undefined]).filter(([, value]) => value));
}

export async function generateMetadata({ params }: PageProps<"/vitrina/[ciudad]">): Promise<Metadata> {
  const { ciudad } = await params;
  const name = cityName(ciudad);
  return {
    title: `Free tours en ${name} (${new Date().getFullYear()})`,
    description: `Free walking tours y experiencias en ${name} con guías locales verificados. Reserve gratis con su nombre y correo.`,
    alternates: { canonical: `${await rlOrigin()}/${ciudad}` },
  };
}

export default async function CityPage({ params, searchParams }: PageProps<"/vitrina/[ciudad]">) {
  const { ciudad } = await params;
  const active = pick(await searchParams);
  const [all, filtered, base, origin] = await Promise.all([
    getRlListings(listingQuery({ city: ciudad })),
    getRlListings(listingQuery({ city: ciudad, zone: active.zona, theme: active.tema, lang: active.idioma, model: active.tipo })),
    rlBase(),
    rlOrigin(),
  ]);
  if (all.items.length === 0) notFound();

  const rows = active.turno ? filtered.items.filter((listing) => listing.start_times.some((time) => turnOf(time) === active.turno)) : filtered.items;
  const name = cityName(ciudad);
  const options: Record<Filter, { value: string; label: string }[]> = {
    zona: [...new Set(all.items.map((listing) => listing.zone).filter((zone): zone is string => Boolean(zone)))].map((value) => ({ value, label: value })),
    tema: [...new Set(all.items.map((listing) => listing.theme).filter((theme): theme is string => Boolean(theme)))].map((value) => ({ value, label: value })),
    idioma: [...new Set(all.items.flatMap((listing) => listing.languages))].map((value) => ({ value, label: RL_LANGUAGES[value] ?? value })),
    tipo: [{ value: "propina", label: "Free tour" }, { value: "pago", label: "De pago" }],
    turno: Object.entries(TURN_LABELS).map(([value, label]) => ({ value, label })),
  };
  const labels: Record<Filter, string> = { zona: "Zona", tema: "Tema", idioma: "Idioma", tipo: "Tipo", turno: "Turno" };
  const href = (key: Filter, value: string | undefined) => {
    const next = new URLSearchParams(Object.entries({ ...active, [key]: value }).filter((entry): entry is [string, string] => Boolean(entry[1])));
    const query = next.toString();
    return rlPath(base, `/${ciudad}${query ? `?${query}` : ""}`);
  };
  const rated = all.items.filter((listing) => listing.reviews > 0 && listing.rating !== null);
  const average = rated.length ? rated.reduce((sum, listing) => sum + (listing.rating ?? 0), 0) / rated.length : null;

  return (
    <>
      <StructuredData data={{ "@context": "https://schema.org", "@type": "ItemList", name: `Free tours en ${name}`, itemListElement: rows.map((listing, index) => ({ "@type": "ListItem", position: index + 1, url: `${origin}/tour/${listing.slug}`, name: listing.title })) }} />
      <div className="rl-wrap mt-6">
      <Cover city={ciudad} className="overflow-hidden rounded-[2rem]">
        <div className="px-6 py-12 sm:px-12 sm:py-16">
          <Crumbs items={[{ label: "Inicio", href: rlPath(base) }, { label: name }]} />
          <h1 className="rl-h1 mt-4 max-w-[18ch]">Free tours en {name}</h1>
          <p className="mt-3 max-w-[56ch] text-[16px] opacity-90">Tours a pie y experiencias con guías locales. Reserve gratis; en los free tours paga al final con propina.</p>
          <div className="mt-6 flex flex-wrap gap-2 text-[13px] font-semibold">
            <span className="rl-tag rl-tag-glass">{all.items.length} tours</span>
            <span className="rl-tag rl-tag-glass">{options.zona.length} zonas</span>
            {average !== null && <span className="rl-tag rl-tag-glass">★ {average.toFixed(1)} promedio</span>}
          </div>
        </div>
      </Cover>
      </div>

      <section className="rl-wrap pt-8">
        <div className="rl-card flex flex-col gap-4 p-5" role="search" aria-label="Filtros">
          {FILTERS.filter((key) => options[key].length > 1 || active[key]).map((key) => (
            <div key={key} className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <span className="w-20 flex-none text-[13px] font-semibold">{labels[key]}</span>
              <div className="flex gap-2 overflow-x-auto pb-1">
                <Link href={href(key, undefined)} scroll={false} aria-current={!active[key]} className="rl-chip">Todos</Link>
                {options[key].map((option) => (
                  <Link key={option.value} href={href(key, option.value)} scroll={false} aria-current={active[key] === option.value} className="rl-chip">{option.label}</Link>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mb-6 mt-8 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-[22px] font-bold tracking-tight">{rows.length} {rows.length === 1 ? "experiencia disponible" : "experiencias disponibles"}</h2>
          {Object.keys(active).length > 0 && <Link href={rlPath(base, `/${ciudad}`)} className="rl-ghost"><X size={15} />Quitar filtros</Link>}
        </div>
        {rows.length === 0 ? <EmptyNote>No hay tours con esos filtros. Pruebe con otro tema o turno.</EmptyNote> : <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{rows.map((listing, index) => <TourCard key={listing.code} listing={listing} base={base} index={index} />)}</div>}
      </section>
    </>
  );
}
