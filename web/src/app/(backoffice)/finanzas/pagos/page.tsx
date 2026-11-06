import { CircleCheck, CircleX, Hourglass, Undo2 } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
import { PaymentsTable } from "@/features/finance/Payments";
import type { PaymentsOverview } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Pagos y aplicaciones" };

export default async function PagosPage() {
  const data = await getResource<PaymentsOverview>("/finance/payments", "No pudimos cargar los pagos.");

  if (!data) {
    return <PageHeader title="Pagos y aplicaciones" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { kpis } = data;

  return (
    <>
      <PageHeader
        title="Pagos y aplicaciones"
        subtitle="Pagos recibidos, su validación y la cuota que saldan."
        info={<InfoTip>Un pago reportado por un asesor o por el cliente queda pendiente hasta que Finanzas lo valida. Revertir lo desaplica de la cuota y recalcula el saldo.</InfoTip>}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Hourglass} tone="warn" label="Por validar" value={formatMoney(kpis.pending_pen, "PEN", { compact: true })} note={kpis.pending_count === 1 ? "1 pago" : `${kpis.pending_count} pagos`} />
        <TintTile icon={CircleCheck} tone="ok" label="Aplicado este mes" value={formatMoney(kpis.applied_month_pen, "PEN", { compact: true })} note={kpis.applied_month_count === 1 ? "1 pago" : `${kpis.applied_month_count} pagos`} />
        <TintTile icon={Undo2} tone="bad" label="Revertidos" value={formatMoney(kpis.reverted_pen, "PEN", { compact: true })} note={kpis.reverted_count === 1 ? "1 pago" : `${kpis.reverted_count} pagos`} />
        <TintTile icon={CircleX} tone="mute" label="Rechazados" value={kpis.rejected_count} note="Con su motivo registrado" />
      </section>
      <PaymentsTable data={data} />
    </>
  );
}
