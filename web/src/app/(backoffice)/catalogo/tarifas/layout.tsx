import { CalendarRange, CircleCheck, Hourglass, Percent, Tags } from "lucide-react";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { TintTile } from "@/components/ui/Tinted";
import { RateCreateAction, SeasonCreateAction } from "@/features/catalog-rates/RateForms";
import { daysBetween } from "@/lib/catalog-rates";
import { formatDate } from "@/lib/format";
import { getPricing, getRates } from "@/lib/server/catalog-board";

export default async function TarifasLayout({ children }: { children: ReactNode }) {
  const [overview, pricing] = await Promise.all([getRates(), getPricing()]);
  if (!overview) return <PageHeader title="Tarifas y temporadas" subtitle="Tu rol no tiene acceso a esta sección." />;

  const live = overview.rates.filter((rate) => rate.state === "vigente");
  const expiring = live.filter((rate) => daysBetween(overview.today, rate.valid_to) <= 30);
  const margins = live.map((rate) => rate.margin_pct).filter((value): value is number => value !== null);
  const average = margins.length ? margins.reduce((sum, value) => sum + value, 0) / margins.length : null;
  const season = overview.current_season;
  const products = new Set(live.map((rate) => rate.product.id)).size;

  return (
    <>
      <PageHeader
        title="Tarifas y temporadas"
        subtitle="Precios por producto, segmento y canal, las temporadas que los ajustan y las reglas que arman el precio final."
        info={<InfoTip>Solo las tarifas vigentes se pueden elegir al cotizar o reservar. Cuando dos temporadas activas se cruzan, manda la de prioridad con número menor.</InfoTip>}
        actions={
          overview.can.manage ? (
            <>
              <SeasonCreateAction seasonTypes={overview.options.season_types} />
              <RateCreateAction overview={overview} />
            </>
          ) : undefined
        }
      />
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={CircleCheck} tone="ok" label="Productos cotizables" value={products} note={`${Math.max(0, overview.options.products.length - products)} sin tarifa vigente`} info={<p>Productos con al menos una tarifa activa cuya vigencia incluye hoy. Sin tarifa vigente, un producto no se puede cotizar.</p>} />
        <TintTile icon={CalendarRange} tone="t1" label="Temporada de hoy" value={season ? season.name : "Tarifa base"} note={season ? `×${season.factor.toFixed(2)} hasta el ${formatDate(season.date_to)}` : "Sin temporada activa"} info={<p>La temporada activa que cubre la fecha de hoy. Si hay varias, se aplica la de prioridad con número menor.</p>} />
        <TintTile icon={Hourglass} tone="sun" label="Vencen en 30 días" value={expiring.length} note={expiring.length ? `La primera, ${formatDate(expiring.map((rate) => rate.valid_to).sort()[0])}` : "Nada por renovar"} info={<p>Tarifas vigentes cuya vigencia termina en los próximos 30 días.</p>} />
        {average !== null ? (
          <TintTile icon={Percent} tone="violet" label="Margen promedio" value={`${average.toFixed(1)} %`} note="Sobre tarifas vigentes" info={<p>Promedio simple de (venta − costo) / venta en las tarifas vigentes. Solo lo ve quien tiene acceso a la rentabilidad.</p>} />
        ) : (
          <TintTile icon={Tags} tone="violet" label="Canales con tarifa" value={new Set(live.map((rate) => rate.channel)).size} note={[...new Set(live.map((rate) => rate.channel))].slice(0, 3).join(", ") || "Ninguno"} info={<p>Canales de venta distintos que tienen al menos una tarifa vigente hoy.</p>} />
        )}
      </section>
      <TabbedCard
        tabs={[
          { href: "/catalogo/tarifas", label: "Tarifas consolidadas" },
          { href: "/catalogo/tarifas/temporadas", label: "Temporadas" },
          ...(pricing ? [{ href: "/catalogo/tarifas/reglas", label: "Reglas de pricing" }] : []),
        ]}
      >
        {children}
      </TabbedCard>
    </>
  );
}
