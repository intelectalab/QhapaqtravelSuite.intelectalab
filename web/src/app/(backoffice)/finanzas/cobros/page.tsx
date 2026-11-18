import { ChartColumnBig } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { BarChart } from "@/components/ui/Charts";
import { ChartsPanel } from "@/components/ui/ChartsPanel";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle } from "@/components/ui/Tinted";
import { PickPaymentAction, ReceivablesTable, RequestAdvanceAction } from "@/features/finance/Receivables";
import { formatMoney } from "@/lib/format";
import { getReceivablesOverview } from "@/lib/server/collections";

export const metadata: Metadata = { title: "Cuentas por cobrar" };

export default async function CobrosPage({ searchParams }: PageProps<"/finanzas/cobros">) {
  const [data, search] = await Promise.all([getReceivablesOverview(), searchParams]);
  const reservationFilter = search["filter[reservation]"];
  const reservation = typeof reservationFilter === "string" && reservationFilter.trim() !== "" ? reservationFilter.trim() : undefined;

  if (!data) {
    return <PageHeader title="Cuentas por cobrar" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { aging } = data;

  return (
    <>
      <PageHeader
        title="Cuentas por cobrar"
        subtitle="Cuotas de cada reserva, su vencimiento y lo que falta cobrar."
        info={
          <>
            <InfoTip>Los saldos en dólares se consolidan en soles con el tipo de cambio guardado en cada cuota. Registrar un pago lo confirma y lo aplica a la cuota en un solo paso.</InfoTip>
            <ChartsPanel title="Gráficos de cobros" description="Saldo pendiente de las cuotas, según cuánto tiempo lleva vencido.">
              <Card className="lift">
                <TintCardTitle icon={ChartColumnBig} title="Antigüedad del saldo" aside={<InfoTip label="De dónde sale">Saldo en soles de las cuotas con saldo, agrupado por los días que pasaron desde su vencimiento. Pasa el cursor por cada barra para ver cuántas cuotas suma.</InfoTip>} />
                <BarChart data={aging.map((bucket, index) => ({ label: bucket.label, value: bucket.pen, caption: formatMoney(bucket.pen, "PEN", { compact: true }), detail: `${bucket.count === 1 ? "1 cuota" : `${bucket.count} cuotas`} · ${formatMoney(bucket.pen)}`, highlight: index > 0 && bucket.pen > 0 }))} />
              </Card>
            </ChartsPanel>
          </>
        }
        actions={
          data.can.register ? (
            <div className="flex flex-wrap items-center gap-2">
              <PickPaymentAction data={data} />
              <RequestAdvanceAction data={data} />
            </div>
          ) : undefined
        }
      />
      <ReceivablesTable data={data} reservation={reservation} />
    </>
  );
}
