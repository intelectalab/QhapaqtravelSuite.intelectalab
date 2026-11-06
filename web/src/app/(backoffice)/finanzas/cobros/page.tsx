import { AlarmClock, CalendarClock, ChartColumnBig, HandCoins, Landmark } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { BarChart } from "@/components/ui/Charts";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { ReceivablesTable } from "@/features/finance/Receivables";
import type { ReceivablesOverview } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Cuentas por cobrar" };

export default async function CobrosPage() {
  const data = await getResource<ReceivablesOverview>("/finance/receivables", "No pudimos cargar las cuentas por cobrar.");

  if (!data) {
    return <PageHeader title="Cuentas por cobrar" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { kpis, aging } = data;

  return (
    <>
      <PageHeader
        title="Cuentas por cobrar"
        subtitle="Cuotas de cada reserva, su vencimiento y lo que falta cobrar."
        info={<InfoTip>Los saldos en dólares se consolidan en soles con el tipo de cambio guardado en cada cuota. Registrar un pago lo confirma y lo aplica a la cuota en un solo paso.</InfoTip>}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Landmark} tone="t1" label="Por cobrar" value={formatMoney(kpis.receivable_pen, "PEN", { compact: true })} note={kpis.receivable_count === 1 ? "1 cuota abierta" : `${kpis.receivable_count} cuotas abiertas`} />
        <TintTile icon={AlarmClock} tone="bad" label="Vencido" value={formatMoney(kpis.overdue_pen, "PEN", { compact: true })} note={kpis.overdue_count === 0 ? "Sin atrasos" : kpis.overdue_count === 1 ? "1 cuota atrasada" : `${kpis.overdue_count} cuotas atrasadas`} />
        <TintTile icon={CalendarClock} tone="sun" label="Vence en 7 días" value={formatMoney(kpis.due_week_pen, "PEN", { compact: true })} />
        <TintTile icon={HandCoins} tone="ok" label="Cobrado este mes" value={formatMoney(kpis.collected_month_pen, "PEN", { compact: true })} />
      </section>
      <Card className="mb-5">
        <TintCardTitle icon={ChartColumnBig} title="Antigüedad del saldo" aside="En soles" />
        <BarChart data={aging.map((bucket, index) => ({ label: bucket.label, value: bucket.pen, caption: formatMoney(bucket.pen, "PEN", { compact: true }), detail: `${bucket.count === 1 ? "1 cuota" : `${bucket.count} cuotas`} · ${formatMoney(bucket.pen)}`, highlight: index > 0 && bucket.pen > 0 }))} />
      </Card>
      <ReceivablesTable data={data} />
    </>
  );
}
