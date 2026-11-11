import { ArrowRight, CalendarRange, Coins, Layers, Percent, ShoppingBag, TriangleAlert, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { cn } from "@/lib/cn";
import { PRODUCT_STATUS, type ProductDetail, type ProductOverview, type ProductStatus } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";

const FLOW: { status: ProductStatus; label: string }[] = [
  { status: "DRAFT", label: "Borrador" },
  { status: "REVIEW", label: "En revisión" },
  { status: "APPROVED", label: "Aprobado" },
  { status: "ACTIVE", label: "Activo" },
];

function Kpi({ icon: Icon, label, value, tone, href, cta }: { icon: LucideIcon; label: string; value: string; tone?: "ok" | "bad"; href: string; cta: string }) {
  return (
    <Link href={href} scroll={false} title={cta} data-testid={`kpi:${label}`} className="lift group block rounded-tile border border-line bg-surface px-4 py-3 hover:border-accent/35">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-fg-3">
        <Icon size={14} className="transition-transform duration-300 group-hover:-rotate-12 group-hover:scale-125 group-hover:text-accent" />
        {label}
      </p>
      <p className={cn("mt-1 text-[18px] font-bold tracking-tight", tone === "ok" && "text-ok", tone === "bad" && "text-bad")}>{value}</p>
      <p className="mt-0.5 flex items-center gap-1 text-[11.5px] font-semibold text-accent opacity-0 transition group-hover:opacity-100">
        {cta}
        <ArrowRight size={12} />
      </p>
    </Link>
  );
}

export function ProductStatusNotice({ product, overview }: { product: ProductDetail; overview: ProductOverview }) {
  const status = PRODUCT_STATUS[product.status];
  if (product.status === "ACTIVE") return null;
  const blocked = ["SUSPENDED", "INACTIVE", "ARCHIVED"].includes(product.status);

  return (
    <div role="status" className={cn("mb-5 flex flex-wrap items-center gap-2 rounded-xl border px-4 py-3 text-[13.5px]", blocked ? "border-bad/30 bg-bad/[0.07] text-bad" : "border-t2/40 bg-t2/[0.1] text-fg")}>
      <TriangleAlert size={17} className={blocked ? "text-bad" : "text-t2"} />
      {blocked ? (
        <span>Producto {status.label.toLowerCase()}: no se puede elegir en nuevas cotizaciones ni reservas (PRD-BR-002). Los documentos anteriores conservan su copia.</span>
      ) : (
        <span>
          Producto en estado <b>{status.label}</b>: aún no se vende. Checklist de activación: {overview.checklist.passed} de {overview.checklist.total} validaciones cumplidas.{" "}
          <Link href={`/catalogo/productos/${encodeURIComponent(product.code)}#checklist`} className="font-semibold text-accent hover:underline">
            Ver checklist
          </Link>
        </span>
      )}
    </div>
  );
}

export function ProductLifecycle({ product, overview, seesCost, seesMargin }: { product: ProductDetail; overview: ProductOverview; seesCost: boolean; seesMargin: boolean }) {
  const index = FLOW.findIndex((step) => step.status === product.status);
  const extra = index === -1 ? PRODUCT_STATUS[product.status] : null;
  const link = `/catalogo/productos/${encodeURIComponent(product.code)}`;
  const base = product.rates.filter((rate) => rate.active && rate.type === "Venta" && ["Adulto", "Pasajero"].includes(rate.segment)).sort((a, b) => Number(a.price) - Number(b.price))[0];

  return (
    <section className="mb-5 rounded-card border border-line bg-surface p-5 shadow-card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[12.5px] font-semibold text-fg-3">Ciclo de vida del producto{overview.kpis.version ? ` · versión ${overview.kpis.version}` : ""}</p>
        <ol className="flex flex-wrap items-center gap-2" aria-label="Ciclo de vida">
          {FLOW.map((step, position) => {
            const current = position === index;
            const past = index === -1 || position < index;
            return (
              <Fragment key={step.status}>
                {position > 0 && <li aria-hidden className={cn("h-0.5 w-8 rounded-full", past || current ? "bg-accent" : "bg-line")} />}
                <li className={cn("flex items-center gap-2 rounded-full px-3 py-1 text-[12.5px] font-semibold", current ? "bg-t2/15 text-fg ring-2 ring-t2" : past ? "bg-accent text-white" : "bg-surface-2 text-fg-3")} aria-current={current ? "step" : undefined}>
                  {position + 1}. {step.label}
                </li>
              </Fragment>
            );
          })}
          {extra && (
            <>
              <li aria-hidden className="h-0.5 w-8 rounded-full bg-bad/50" />
              <li className="rounded-full bg-bad/12 px-3 py-1 text-[12.5px] font-semibold text-bad ring-2 ring-bad/40" aria-current="step">
                {extra.label}
              </li>
            </>
          )}
        </ol>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi icon={Coins} label="Precio desde" value={base ? formatMoney(base.price, base.currency) : "Sin tarifa"} href={`${link}?seccion=tarifas`} cta="Ver tarifas" />
        {seesMargin && <Kpi icon={Percent} label="Margen tarifa base" value={base?.margin_pct != null ? `${base.margin_pct} %` : "—"} href={`${link}?seccion=rentabilidad`} cta="Ver rentabilidad" />}
        {seesCost && <Kpi icon={Layers} label="Costo componentes" value={overview.kpis.components_cost !== null ? formatMoney(overview.kpis.components_cost) : "—"} href={`${link}?seccion=componentes`} cta="Ver el detalle" />}
        <Kpi icon={CalendarRange} label="Salidas futuras" value={String(overview.kpis.future_departures)} href={`${link}?seccion=salidas`} cta="Ver salidas" />
        <Kpi icon={ShoppingBag} label="Uso en ventas" value={`${overview.kpis.quotes} cot. · ${overview.kpis.reservations} res.`} href={`${link}?seccion=uso`} cta="Ver cotizaciones y reservas" />
        <Kpi icon={TriangleAlert} label="Comercializable" value={overview.kpis.sellable ? "Sí" : "No"} tone={overview.kpis.sellable ? "ok" : "bad"} href={`${link}#checklist`} cta="Ver checklist" />
      </div>
    </section>
  );
}
