import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { RateCreateAction, SeasonCreateAction } from "@/features/catalog-rates/RateForms";
import { getPricing, getRates } from "@/lib/server/catalog-board";

export default async function TarifasLayout({ children }: { children: ReactNode }) {
  const [overview, pricing] = await Promise.all([getRates(), getPricing()]);
  if (!overview) return <PageHeader title="Tarifas y temporadas" subtitle="Tu rol no tiene acceso a esta sección." />;

  return (
    <>
      <PageHeader
        title="Tarifas y temporadas"
        subtitle="Precios por producto, segmento y canal, las temporadas que los ajustan y las reglas que arman el precio final."
        info={<InfoTip>Solo las tarifas vigentes se pueden elegir al cotizar o reservar. Cuando dos temporadas activas se cruzan, manda la de prioridad con número menor.</InfoTip>}
        actions={
          overview.can.manage ? (
            <>
              <SeasonCreateAction seasonTypes={overview.options.season_types} seasons={overview.seasons} />
              <RateCreateAction overview={overview} />
            </>
          ) : undefined
        }
      />
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
