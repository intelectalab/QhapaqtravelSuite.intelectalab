import { CalendarX2, SearchX } from "lucide-react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { getSiteListing, siteBase, siteLocale } from "@/lib/server/site";
import { listingQuery, siteHref, type ListingKey } from "@/lib/site";
import { DATE_LOCALE, siteText, type SiteLocale } from "@/lib/site-i18n";
import { ProductCard } from "./Cards";
import { Breadcrumbs, PageHero } from "./Hero";
import { ListingFilters, SortSelect } from "./ListingFilters";
import { SearchBar } from "./SearchBar";
import { TrackEvent } from "./SiteAnalytics";

function NoDepartures({ base, path, params, nearby, locale }: { base: string; path: string; params: Partial<Record<ListingKey, string>>; nearby: { date: string; count: number }[]; locale: SiteLocale }) {
  const t = siteText(locale).listing;
  const { fecha, ...rest } = params;
  const day = formatDate(fecha ?? "", "long", DATE_LOCALE[locale]);
  return (
    <div data-testid="site-no-departures" className="rounded-card border border-dashed border-line px-6 py-10 text-center">
      <CalendarX2 size={30} className="mx-auto text-fg-3" />
      <h2 className="mt-3 text-[18px] font-bold text-fg">
        {t.noDepartures(day)}
        <span className="text-fg-3"> · </span>
        <Link href={siteHref(base, `${path}${listingQuery(rest)}`)} className="text-accent underline-offset-4 hover:underline">
          {t.withoutDate}
        </Link>
      </h2>
      {nearby.length > 0 && (
        <div className="mt-6">
          <p className="text-[13px] font-semibold text-fg-2">{t.nearbyTitle}</p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {nearby.map((option) => (
              <li key={option.date}>
                <Link href={siteHref(base, `${path}${listingQuery({ ...rest, fecha: option.date })}`)} className="lift flex flex-col items-center rounded-2xl border border-line bg-surface px-4 py-2.5 transition hover:border-accent">
                  <b className="text-[14px] text-fg">{formatDate(option.date, "long", DATE_LOCALE[locale])}</b>
                  <span className="text-[12px] text-fg-3">{t.nearbyCount(option.count)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export async function ListingView({ agencia, params, mode }: { agencia: string; params: Partial<Record<ListingKey, string>>; mode: "catalogo" | "busqueda" }) {
  const [data, base, locale] = await Promise.all([getSiteListing(agencia, params), siteBase(agencia), siteLocale()]);
  const t = siteText(locale).listing;
  const common = siteText(locale).common;
  const heading = params.tipo ? t.kinds[params.tipo] : null;
  const title = mode === "busqueda" ? t.searchTitle : data.destination ? t.whatToDo(data.destination.name) : (heading?.title ?? t.allCatalog);
  const description = mode === "busqueda" ? t.searchDescription : (heading?.description ?? t.catalogDescription);
  const hasFilters = Object.keys(params).some((key) => key !== "orden");

  return (
    <>
      <PageHero eyebrow={mode === "busqueda" ? t.searchEyebrow : t.catalogEyebrow} title={title} description={description}>
        <div className="mt-5">
          <Breadcrumbs items={[{ label: common.home, href: siteHref(base) }, { label: mode === "busqueda" ? t.searchCrumb : t.catalogEyebrow }]} />
        </div>
      </PageHero>
      {params.fecha && <TrackEvent event="select_date" params={{ date: params.fecha, pax: params.viajeros ? Number(params.viajeros) : null, available: data.total > 0, source: "buscador", destination: params.destino ?? null, type: params.tipo ?? null }} />}
      <div className="mx-auto max-w-[1240px] px-5 sm:px-8">
        {mode === "busqueda" && <SearchBar destinations={data.facets.destinations.map(({ value, label }) => ({ value, label }))} initial={params} className="-mt-8 relative z-10" />}
        <div className="grid gap-6 pt-10 lg:grid-cols-[290px_1fr]">
          <ListingFilters facets={data.facets} params={params} />
          <section aria-live="polite">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[14px] text-fg-2">
                <b className="text-fg">{t.results(data.total)}</b>
                {params.fecha && t.availableOn(formatDate(params.fecha, "long", DATE_LOCALE[locale]))}
                {params.viajeros && t.forTravelers(params.viajeros)}
              </p>
              <SortSelect sorts={data.facets.sorts} params={params} />
            </div>
            {data.invalid && <p className="mb-4 rounded-xl bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-4 py-3 text-[13px] text-warn">{t.invalid}</p>}
            {data.items.length > 0 ? (
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {data.items.map((product, index) => (
                  <ProductCard key={product.slug} product={product} base={base} index={index} />
                ))}
              </div>
            ) : params.fecha ? (
              <NoDepartures base={base} path={mode === "busqueda" ? "/buscar" : "/tours"} params={params} nearby={data.nearby_dates ?? []} locale={locale} />
            ) : (
              <div className="grid place-items-center rounded-card border border-dashed border-line px-6 py-14 text-center">
                <SearchX size={30} className="text-fg-3" />
                <h2 className="mt-3 text-[18px] font-bold text-fg">{t.emptyTitle}</h2>
                <p className="mt-1 max-w-[46ch] text-[14px] text-fg-2">{t.emptyBody}</p>
                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  {hasFilters && (
                    <Link href={siteHref(base, mode === "busqueda" ? "/buscar" : "/tours")} className="inline-flex h-10 items-center rounded-control border border-line px-4 text-[13.5px] font-semibold text-fg transition hover:bg-surface-2">
                      {t.clear}
                    </Link>
                  )}
                  <Link href={siteHref(base, `/viajes-a-medida${listingQuery({ destino: params.destino, fecha: params.fecha, viajeros: params.viajeros })}`)} data-site-cta className="inline-flex h-10 items-center rounded-control bg-brand px-4 text-[13.5px] font-semibold text-brand-fg transition hover:-translate-y-0.5">
                    {common.tailor}
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
