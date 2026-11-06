import { AlarmClock, Building2, CalendarClock, HandCoins, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { CreateCostAction, PayablesTable } from "@/features/finance/Payables";
import { RankBars } from "@/features/finance/RankBars";
import type { PayablesOverview } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Cuentas por pagar" };

export default async function ProveedoresPage() {
  const data = await getResource<PayablesOverview>("/finance/payables", "No pudimos cargar las cuentas por pagar.");

  if (!data) {
    return <PageHeader title="Cuentas por pagar" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { kpis } = data;

  return (
    <>
      <PageHeader
        title="Cuentas por pagar"
        subtitle="Lo que se debe a cada proveedor, su aprobación y sus pagos."
        info={<InfoTip>Una obligación se paga solo después de aprobarla. Los costos adicionales impactan la rentabilidad de la reserva desde su aprobación.</InfoTip>}
        actions={data.can.operate ? <CreateCostAction data={data} /> : undefined}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Wallet} tone="t1" label="Por pagar" value={formatMoney(kpis.payable_pen, "PEN", { compact: true })} note={kpis.payable_count === 1 ? "1 obligación abierta" : `${kpis.payable_count} obligaciones abiertas`} />
        <TintTile icon={AlarmClock} tone="bad" label="Vencido" value={formatMoney(kpis.overdue_pen, "PEN", { compact: true })} note={kpis.overdue_count === 0 ? "Sin atrasos" : kpis.overdue_count === 1 ? "1 obligación" : `${kpis.overdue_count} obligaciones`} />
        <TintTile icon={CalendarClock} tone="sun" label="Vence en 7 días" value={formatMoney(kpis.due_week_pen, "PEN", { compact: true })} />
        <TintTile icon={HandCoins} tone="ok" label="Pagado este mes" value={formatMoney(kpis.paid_month_pen, "PEN", { compact: true })} />
      </section>
      <Card className="mb-5">
        <TintCardTitle icon={Building2} title="Saldo por proveedor" aside="En soles" />
        <RankBars
          tone="violet"
          empty="No hay saldos pendientes con proveedores."
          data={data.by_provider.map((item) => ({ label: item.name, value: item.pen, caption: formatMoney(item.pen), detail: item.count === 1 ? "1 obligación abierta" : `${item.count} obligaciones abiertas` }))}
        />
      </Card>
      <PayablesTable data={data} />
    </>
  );
}
