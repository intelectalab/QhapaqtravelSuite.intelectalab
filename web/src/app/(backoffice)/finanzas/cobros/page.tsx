import { AlarmClock, CalendarClock, ChartColumnBig, HandCoins, Landmark } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { BarChart } from "@/components/ui/Charts";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { PickPaymentAction, ReceivablesTable, RequestAdvanceAction } from "@/features/finance/Receivables";
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
  const usdOpen = data.rows.filter((row) => row.currency === "USD" && row.status !== "pagada" && row.status !== "cancelada").reduce((sum, row) => sum + row.balance, 0);

  return (
    <>
      <PageHeader
        title="Cuentas por cobrar"
        subtitle="Cuotas de cada reserva, su vencimiento y lo que falta cobrar."
        info={<InfoTip>Los saldos en dólares se consolidan en soles con el tipo de cambio guardado en cada cuota. Registrar un pago lo confirma y lo aplica a la cuota en un solo paso.</InfoTip>}
        actions={
          data.can.register ? (
            <div className="flex flex-wrap items-center gap-2">
              <PickPaymentAction data={data} />
              <RequestAdvanceAction data={data} />
            </div>
          ) : undefined
        }
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Landmark} tone="t1" label="Por cobrar" value={formatMoney(kpis.receivable_pen, "PEN", { compact: true })} note={usdOpen > 0 ? `Incluye ${formatMoney(usdOpen, "USD", { compact: true })} en dólares` : "Todo en soles"} info={<p>Saldo pendiente de las cuotas abiertas, parciales y vencidas, en soles al tipo de cambio de cada cuota.</p>} />
        <TintTile icon={AlarmClock} tone="bad" label="Vencido" value={formatMoney(kpis.overdue_pen, "PEN", { compact: true })} note={kpis.receivable_pen > 0 ? `${Math.round((kpis.overdue_pen / kpis.receivable_pen) * 100)} % de lo que falta cobrar` : "Sin saldos pendientes"} info={<p>Saldo de las cuotas cuya fecha de vencimiento ya pasó y siguen sin pagarse completas.</p>} />
        <TintTile icon={CalendarClock} tone="sun" label="Vence en 7 días" value={formatMoney(kpis.due_week_pen, "PEN", { compact: true })} info={<p>Saldo de las cuotas que vencen entre hoy y los próximos 7 días.</p>} />
        <TintTile icon={HandCoins} tone="ok" label="Cobrado este mes" value={formatMoney(kpis.collected_month_pen, "PEN", { compact: true })} info={<p>Pagos de clientes aplicados desde el día 1 del mes, al tipo de cambio de cada pago.</p>} />
      </section>
      <Card className="mb-5">
        <TintCardTitle icon={ChartColumnBig} title="Antigüedad del saldo" aside="En soles" />
        <BarChart data={aging.map((bucket, index) => ({ label: bucket.label, value: bucket.pen, caption: formatMoney(bucket.pen, "PEN", { compact: true }), detail: `${bucket.count === 1 ? "1 cuota" : `${bucket.count} cuotas`} · ${formatMoney(bucket.pen)}`, highlight: index > 0 && bucket.pen > 0 }))} />
      </Card>
      <ReceivablesTable data={data} />
    </>
  );
}
