import { SearchX } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { getSiteListing, siteBase } from "@/lib/server/site";
import { listingQuery, siteHref, type ListingKey } from "@/lib/site";
import { ProductCard } from "./Cards";
import { Breadcrumbs, PageHero } from "./Hero";
import { ListingFilters, SortSelect } from "./ListingFilters";
import { SearchBar } from "./SearchBar";

const KIND_TITLE: Record<string, { title: string; description: string }> = {
  tours: { title: "Tours y excursiones", description: "Salidas de medio día y día completo con guía oficial." },
  paquetes: { title: "Paquetes y circuitos", description: "Programas de varios días con traslados, tours y alojamiento opcional." },
  experiencias: { title: "Experiencias", description: "Cocina, cultura viva y actividades para conocer el destino desde adentro." },
  traslados: { title: "Traslados", description: "Recojo en aeropuerto y estaciones, con vehículo privado." },
};

export async function ListingView({ agencia, params, mode }: { agencia: string; params: Partial<Record<ListingKey, string>>; mode: "catalogo" | "busqueda" }) {
  const [data, base] = await Promise.all([getSiteListing(agencia, params), siteBase(agencia)]);
  const heading = params.tipo ? KIND_TITLE[params.tipo] : null;
  const title = mode === "busqueda" ? "Buscar disponibilidad" : data.destination ? `Qué hacer en ${data.destination.name}` : (heading?.title ?? "Todo el catálogo");
  const description = mode === "busqueda" ? "Filtra por fecha y número de viajeros: solo verás lo que tiene cupo ese día, con su precio." : (heading?.description ?? "Tours, paquetes y experiencias con precio por fecha y salidas confirmadas.");
  const hasFilters = Object.keys(params).some((key) => key !== "orden");

  return (
    <>
      <PageHero eyebrow={mode === "busqueda" ? "Búsqueda" : "Catálogo"} title={title} description={description}>
        <div className="mt-5">
          <Breadcrumbs items={[{ label: "Inicio", href: siteHref(base) }, { label: mode === "busqueda" ? "Buscar" : "Catálogo" }]} />
        </div>
      </PageHero>
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        {mode === "busqueda" && <SearchBar destinations={data.facets.destinations.map(({ value, label }) => ({ value, label }))} initial={params} className="-mt-8 relative z-10" />}
        <div className="grid gap-6 pt-10 lg:grid-cols-[290px_1fr]">
          <ListingFilters facets={data.facets} params={params} />
          <section aria-live="polite">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[14px] text-fg-2">
                <b className="text-fg">{data.total === 1 ? "1 resultado" : `${data.total} resultados`}</b>
                {params.fecha && ` disponibles el ${formatDate(params.fecha, "long")}`}
                {params.viajeros && ` para ${params.viajeros} ${params.viajeros === "1" ? "viajero" : "viajeros"}`}
              </p>
              <SortSelect sorts={data.facets.sorts} params={params} />
            </div>
            {data.invalid && <p className="mb-4 rounded-xl bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-4 py-3 text-[13px] text-warn">Algunos filtros no eran válidos; mostramos todo el catálogo.</p>}
            {data.items.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {data.items.map((product, index) => (
                  <ProductCard key={product.slug} product={product} base={base} index={index} />
                ))}
              </div>
            ) : (
              <div className="grid place-items-center rounded-card border border-dashed border-line px-6 py-14 text-center">
                <SearchX size={30} className="text-fg-3" />
                <h2 className="mt-3 text-[18px] font-bold text-fg">No encontramos opciones con esos filtros</h2>
                <p className="mt-1 max-w-[46ch] text-[14px] text-fg-2">Prueba otra fecha o quita algún filtro. Si prefieres, te armamos un viaje a medida con lo que buscas.</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {hasFilters && (
                    <Link href={siteHref(base, mode === "busqueda" ? "/buscar" : "/tours")} className="inline-flex h-10 items-center rounded-control border border-line px-4 text-[13.5px] font-semibold text-fg transition hover:bg-surface-2">
                      Limpiar filtros
                    </Link>
                  )}
                  <Link href={siteHref(base, `/viajes-a-medida${listingQuery({ destino: params.destino, fecha: params.fecha, viajeros: params.viajeros })}`)} className="inline-flex h-10 items-center rounded-control bg-brand px-4 text-[13.5px] font-semibold text-brand-fg transition hover:-translate-y-0.5">
                    Cotizar a medida
                  </Link>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
