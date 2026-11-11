import { CalendarRange, CircleCheck, Hourglass, Percent, Tags } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { Tabs } from "@/components/ui/Tabs";
import { TintTile } from "@/components/ui/Tinted";
import { RateCreateAction, SeasonCreateAction } from "@/features/catalog-rates/RateForms";
import { RatesTable } from "@/features/catalog-rates/RatesTable";
import { SeasonsBoard } from "@/features/catalog-rates/SeasonsBoard";
import { daysBetween, type RatesOverview } from "@/lib/catalog-rates";
import { formatDate } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Tarifas y temporadas" };

export default async function TarifasPage() {
  const overview = await getResource<RatesOverview>("/catalog/rates", "No pudimos cargar las tarifas.");

  if (!overview) {
    return <PageHeader title="Tarifas y temporadas" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const live = overview.rates.filter((rate) => rate.state === "vigente");
  const expiring = live.filter((rate) => daysBetween(overview.today, rate.valid_to) <= 30);
  const margins = live.map((rate) => rate.margin_pct).filter((value): value is number => value !== null);
  const average = margins.length ? margins.reduce((sum, value) => sum + value, 0) / margins.length : null;
  const season = overview.current_season;

  return (
    <>
      <PageHeader
        title="Tarifas y temporadas"
        subtitle="Precios por producto, segmento y canal, y las temporadas que los ajustan."
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
        <TintTile icon={CircleCheck} tone="ok" label="Tarifas vigentes" value={live.length} note={`de ${overview.rates.length} registradas`} />
        <TintTile icon={CalendarRange} tone="t1" label="Temporada de hoy" value={season ? season.name : "Tarifa base"} note={season ? `×${season.factor.toFixed(2)} hasta el ${formatDate(season.date_to)}` : "Sin temporada activa"} />
        <TintTile icon={Hourglass} tone="sun" label="Vencen en 30 días" value={expiring.length} note={expiring.length ? `La primera, ${formatDate(expiring.map((rate) => rate.valid_to).sort()[0])}` : "Nada por renovar"} />
        {average !== null ? (
          <TintTile icon={Percent} tone="violet" label="Margen promedio" value={`${average.toFixed(1)} %`} note="Sobre tarifas vigentes" />
        ) : (
          <TintTile icon={Tags} tone="violet" label="Productos con tarifa" value={new Set(live.map((rate) => rate.product.id)).size} note={`de ${overview.options.products.length} en catálogo`} />
        )}
      </section>
      <Card padded={false}>
        <Tabs
          tabs={[
            { id: "tarifas", label: "Tarifas", count: overview.rates.length, content: <RatesTable overview={overview} /> },
            { id: "temporadas", label: "Temporadas", count: overview.seasons.length, content: <SeasonsBoard overview={overview} /> },
          ]}
        />
      </Card>
    </>
  );
}
