import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { CreateCostAction, PayablesTiles } from "@/features/finance/Payables";
import type { PayablesOverview } from "@/lib/finance";
import { getCachedResource } from "@/lib/server/resource";

export default async function PayablesLayout({ children }: { children: ReactNode }) {
  const data = await getCachedResource<PayablesOverview>("/finance/payables", "No pudimos cargar las cuentas por pagar.");

  if (!data) {
    return <PageHeader title="Cuentas por pagar" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const providers = new Set(data.rows.map((row) => row.provider.ref)).size;
  const costs = data.rows.filter((row) => row.kind === "costo_adicional").length;

  return (
    <>
      <PageHeader
        title="Cuentas por pagar"
        subtitle="Lo que se debe a cada proveedor, su aprobación y sus pagos."
        info={<InfoTip>Una obligación se paga solo después de aprobarla. Los costos adicionales impactan la rentabilidad de la reserva desde su aprobación.</InfoTip>}
        actions={data.can.operate ? <CreateCostAction data={data} /> : undefined}
      />
      <PayablesTiles data={data} />
      <TabbedCard
        tabs={[
          { href: "/finanzas/proveedores", label: "Por documento", count: data.rows.length },
          { href: "/finanzas/proveedores/por-proveedor", label: "Por proveedor", count: providers },
          { href: "/finanzas/proveedores/costos", label: "Costos registrados", count: costs },
        ]}
      >
        {children}
      </TabbedCard>
    </>
  );
}
