import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { ContractCreateAction } from "@/features/catalog-allotments/AllotmentForms";
import { AllotmentTiles } from "@/features/catalog-allotments/AllotmentTiles";
import { SupplyAlerts } from "@/features/catalog-shared/SupplyAlerts";
import { formatDate } from "@/lib/format";
import { getAllotments } from "@/lib/server/allotments";

export default async function CuposLayout({ children }: { children: ReactNode }) {
  const overview = await getAllotments();
  if (!overview) return <PageHeader title="Cupos y bloqueos" subtitle="Tu rol no tiene acceso a esta sección." />;
  const pending = overview.alerts.filter((alert) => alert.type === "vencido" && alert.date >= overview.today);
  const oversold = overview.alerts.filter((alert) => alert.type === "sobreventa" && alert.date >= overview.today);

  return (
    <>
      <PageHeader
        title="Cupos y bloqueos"
        subtitle="Cupos contratados con hoteles, tren y entradas: bloqueo por fecha, release, consumo y penalidades."
        info={<InfoTip>El consumo sale de las reservas con el servicio confirmado. Lo que no se vende ni se retiene antes del release vuelve al proveedor, y lo retenido sin usar genera penalidad.</InfoTip>}
        actions={overview.can.manage ? <ContractCreateAction options={overview.options} today={overview.today} /> : undefined}
      />
      <SupplyAlerts
        alerts={[
          ...(pending.length
            ? [{ key: "release", tone: "warn" as const, text: <><b className="font-semibold">{pending.length === 1 ? "1 fecha con release vencido sin liberar" : `${pending.length} fechas con release vencido sin liberar`}</b> ({[...new Set(pending.map((alert) => alert.contract))].join(", ")}). El release automático las devuelve al proveedor en su próxima ejecución.</> }]
            : []),
          ...(oversold.length
            ? [{ key: "over", tone: "bad" as const, text: <><b className="font-semibold">Sobreventa detectada:</b> {oversold.map((alert) => `${alert.contract} ${formatDate(alert.date)} (+${alert.units})`).join(", ")}. Pide una ampliación al proveedor o reubica las reservas.</> }]
            : []),
        ]}
      />
      <AllotmentTiles overview={overview} />
      <TabbedCard
        tabs={[
          { href: "/catalogo/cupos", label: "Grilla por fecha" },
          { href: "/catalogo/cupos/contratos", label: "Contratos" },
          { href: "/catalogo/cupos/release", label: "Alertas de release" },
          { href: "/catalogo/cupos/pickup", label: "Ritmo de ventas" },
        ]}
      >
        {children}
      </TabbedCard>
    </>
  );
}
