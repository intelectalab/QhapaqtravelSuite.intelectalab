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
  const rejectedPen = data.rows.filter((row) => row.status === "rechazado").reduce((sum, row) => sum + row.pen, 0);

  return (
    <>
      <PageHeader
        title="Pagos y aplicaciones"
        subtitle="Pagos recibidos, su validación y la cuota que saldan."
        info={<InfoTip>Un pago reportado por un asesor o por el cliente queda pendiente hasta que Finanzas lo valida. Revertir lo desaplica de la cuota y recalcula el saldo.</InfoTip>}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Hourglass} tone="warn" label="Por validar" value={formatMoney(kpis.pending_pen, "PEN", { compact: true })} note="Esperan confirmarse en el banco" info={<p>Monto de los pagos reportados que aún no se validan contra el banco, en soles.</p>} />
        <TintTile icon={CircleCheck} tone="ok" label="Aplicado este mes" value={formatMoney(kpis.applied_month_pen, "PEN", { compact: true })} note={kpis.applied_month_count === 1 ? "1 pago este mes" : `${kpis.applied_month_count} pagos este mes`} info={<p>Pagos aplicados a una cuota con fecha desde el día 1 del mes.</p>} />
        <TintTile icon={Undo2} tone="bad" label="Revertidos" value={formatMoney(kpis.reverted_pen, "PEN", { compact: true })} note="Desaplicados de su cuota" info={<p>Monto de los pagos revertidos: dejaron de contar en el saldo de su cuota.</p>} />
        <TintTile icon={CircleX} tone="mute" label="Rechazados" value={formatMoney(rejectedPen, "PEN", { compact: true })} note="Se pueden reintentar" info={<p>Monto de los pagos rechazados al validar. Con una nueva constancia vuelven a pendiente con Reintentar validación.</p>} />
      </section>
      <PaymentsTable data={data} />
    </>
  );
}
