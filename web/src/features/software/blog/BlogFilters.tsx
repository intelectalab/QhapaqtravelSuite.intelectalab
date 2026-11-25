import { Search, X } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/cn";
import { BLOG_BASE, type BlogList, blogHref } from "@/lib/landing-content";

const QUICK = ["SUNAT", "WhatsApp", "Cusco", "SEO"];

function Pill({ href, active, children, count }: { href: string; active: boolean; children: string; count?: number }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition", active ? "border-transparent bg-menu text-white" : "border-line bg-surface text-fg-2 hover:-translate-y-px hover:border-[color-mix(in_srgb,var(--t1)_35%,transparent)] hover:text-fg")}>
      {children}
      {count !== undefined && <span className={cn("font-mono text-[11.5px]", active ? "text-white/60" : "text-fg-3")}>{count}</span>}
    </Link>
  );
}

export function BlogSearch({ list }: { list: BlogList }) {
  const { filters } = list;
  const action = filters.category ? `${BLOG_BASE}/categoria/${filters.category}` : BLOG_BASE;
  return (
    <div>
      <form method="get" action={action} role="search" className="group flex items-center gap-2 rounded-[16px] border border-line bg-surface p-1.5 shadow-[var(--shadow-card)] transition focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15">
        <Search size={18} className="ml-2.5 flex-none text-fg-3" />
        <label htmlFor="blog-q" className="sr-only">
          Buscar en el blog
        </label>
        <input id="blog-q" name="q" defaultValue={filters.q ?? ""} placeholder="Busca guías de SUNAT, ventas por WhatsApp, SEO local…" className="h-11 min-w-0 flex-1 bg-transparent px-1 text-[15px] text-fg outline-none placeholder:text-fg-3" />
        {filters.site && <input type="hidden" name="sitio" value={filters.site} />}
        {filters.order !== "recientes" && <input type="hidden" name="orden" value={filters.order} />}
        <button type="submit" className="h-11 rounded-[12px] bg-brand px-5 text-[14px] font-semibold text-brand-fg transition hover:brightness-110">
          Buscar
        </button>
      </form>
      <p className="mt-3 flex flex-wrap items-center gap-2 text-[12.5px] text-fg-3">
        Búsquedas rápidas:
        {QUICK.map((term) => (
          <Link key={term} href={blogHref({ ...filters, category: null, q: term })} className="rounded-full bg-surface-2 px-2.5 py-1 font-semibold text-fg-2 transition hover:bg-[color-mix(in_srgb,var(--t1)_12%,transparent)] hover:text-t1">
            {term}
          </Link>
        ))}
      </p>
    </div>
  );
}

export function BlogFilters({ list }: { list: BlogList }) {
  const { filters } = list;
  const active = filters.site !== null || filters.category !== null || filters.q !== null;
  const allCount = list.sites.reduce((sum, site) => sum + site.count, 0);
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label="Sitio" className="inline-flex rounded-[14px] border border-line bg-surface p-1">
          {[{ value: null, label: "Todo", count: allCount }, ...list.sites].map((site) => (
            <Link key={site.label} href={blogHref({ ...filters, site: site.value, category: null })} className={cn("rounded-[10px] px-3.5 py-1.5 text-[13px] font-semibold transition", filters.site === site.value ? "bg-accent text-white" : "text-fg-2 hover:bg-surface-2 hover:text-fg")}>
              {site.label}
            </Link>
          ))}
        </nav>
        <nav aria-label="Orden" className="flex items-center gap-1 text-[13px]">
          <span className="mr-1 text-fg-3">Ordenar:</span>
          {list.orders.map((order) => (
            <Link key={order.value} href={blogHref({ ...filters, order: order.value })} rel="nofollow" className={cn("rounded-full px-3 py-1 font-semibold transition", filters.order === order.value ? "bg-surface-2 text-fg" : "text-fg-2 hover:text-fg")}>
              {order.label}
            </Link>
          ))}
        </nav>
      </div>
      <nav aria-label="Categorías" className="flex flex-wrap gap-2">
        <Pill href={blogHref({ ...filters, category: null })} active={filters.category === null} count={list.categories.reduce((sum, category) => sum + category.count, 0)}>
          Todas
        </Pill>
        {list.categories.map((category) => (
          <Pill key={`${category.site}-${category.value}`} href={blogHref({ ...filters, category: category.value })} active={filters.category === category.value} count={category.count}>
            {filters.site === null && category.site === "rutaslibres" ? `${category.label} · RL` : category.label}
          </Pill>
        ))}
      </nav>
      <p className="flex items-center gap-3 text-[13px] text-fg-3">
        <span>
          <b className="font-mono text-fg">{list.total}</b> {list.total === 1 ? "artículo" : "artículos"}
        </span>
        {active && (
          <Link href={BLOG_BASE} className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">
            <X size={13} />
            Quitar filtros
          </Link>
        )}
      </p>
    </div>
  );
}
