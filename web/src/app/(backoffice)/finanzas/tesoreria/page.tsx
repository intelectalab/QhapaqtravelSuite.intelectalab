import { ArrowDownUp, Calculator, CreditCard, Landmark, LayoutDashboard, LineChart, ListOrdered, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { SectionLayout, SectionNav } from "@/components/ui/SectionNav";
import { TintTile } from "@/components/ui/Tinted";
import { AccountCards, MovementsTable, RecordMovementAction } from "@/features/finance/Treasury";
import { TransferAction } from "@/features/finance/TreasuryOps";
import { AccountsTable, CashFlowSection, CashSection, TreasuryAlerts } from "@/features/finance/TreasurySections";
import type { CashFlowProjection, TreasuryOverview } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { resolveSections } from "@/lib/sections";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Tesorería (caja y bancos)" };

export default async function TesoreriaPage({ searchParams }: PageProps<"/finanzas/tesoreria">) {
  const [data, { seccion }] = await Promise.all([getResource<TreasuryOverview>("/treasury/accounts", "No pudimos cargar la tesorería."), searchParams]);

  if (!data) {
    return <PageHeader title="Tesorería (caja y bancos)" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { kpis } = data;
  const net = kpis.in_month_pen - kpis.out_month_pen;
  const pendingApprovals = data.counts.filter((count) => count.status === "pending_approval").length + data.replenishments.filter((item) => item.status === "requested").length;
  const { active, groups } = resolveSections(
    "/finanzas/tesoreria",
    [
      { group: "Tesorería", id: "resumen", label: "Resumen", icon: <LayoutDashboard size={15} />, count: data.alerts.length || undefined },
      { group: "Tesorería", id: "movimientos", label: "Movimientos", icon: <ListOrdered size={15} />, count: data.movements.length },
      { group: "Tesorería", id: "cajas", label: "Cajas y arqueos", icon: <Calculator size={15} />, count: pendingApprovals || undefined },
      { group: "Planificación", id: "flujo", label: "Flujo proyectado", icon: <LineChart size={15} /> },
      { group: "Configuración", id: "cuentas", label: "Cuentas", icon: <Landmark size={15} />, count: data.accounts.length },
    ],
    seccion,
  );

  const body = await (async () => {
    switch (active) {
      case "movimientos":
        return <MovementsTable data={data} />;
      case "cajas":
        return <CashSection data={data} editable={data.can.manage} />;
      case "flujo":
        return <CashFlowSection flow={await getResource<CashFlowProjection>("/treasury/cash-flow", "No pudimos calcular el flujo proyectado.")} />;
      case "cuentas":
        return <AccountsTable data={data} editable={data.can.manage} />;
      default:
        return (
          <div className="flex flex-col gap-5">
            <TreasuryAlerts data={data} />
            <AccountCards accounts={data.accounts} />
          </div>
        );
    }
  })();

  return (
    <>
      <PageHeader
        title="Tesorería (caja y bancos)"
        subtitle="Saldos de bancos, cajas chicas y pasarelas, con cada movimiento."
        info={<InfoTip>El saldo de cada cuenta es su apertura más ingresos menos egresos registrados. Los saldos en dólares se muestran en soles al tipo de cambio de hoy ({data.usd_rate}).</InfoTip>}
        actions={
          data.can.manage ? (
            <div className="flex flex-wrap items-center gap-2">
              <TransferAction data={data} />
              <RecordMovementAction data={data} />
            </div>
          ) : undefined
        }
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={Landmark} tone="t1" label="Bancos" value={formatMoney(kpis.bank_pen, "PEN", { compact: true })} note={`Total disponible ${formatMoney(kpis.total_pen, "PEN", { compact: true })}`} />
        <TintTile icon={Wallet} tone="sun" label="Cajas chicas" value={formatMoney(kpis.cash_pen, "PEN", { compact: true })} note={kpis.open_sessions === 1 ? "1 caja abierta hoy" : `${kpis.open_sessions} cajas abiertas`} />
        <TintTile icon={CreditCard} tone="violet" label="Pasarelas por liquidar" value={formatMoney(kpis.gateway_pen, "PEN", { compact: true })} />
        <TintTile icon={ArrowDownUp} tone={net >= 0 ? "ok" : "bad"} label="Flujo del mes" value={formatMoney(net, "PEN", { compact: true })} note={`Entró ${formatMoney(kpis.in_month_pen, "PEN", { compact: true })} · salió ${formatMoney(kpis.out_month_pen, "PEN", { compact: true })}`} />
      </section>
      <SectionLayout nav={<SectionNav label="Secciones de tesorería" groups={groups} active={active} testId="treasury-sections" />}>{body}</SectionLayout>
    </>
  );
}
