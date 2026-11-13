import { ArrowDownUp, Calculator, Coins, Landmark, LayoutDashboard, LineChart, ListOrdered, PieChart, Scale, Settings2, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { SectionLayout, SectionNav } from "@/components/ui/SectionNav";
import { Card } from "@/components/ui/Card";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { BalanceComposition, BalanceHistory } from "@/features/finance/TreasuryTables";
import { AccountCards, MovementsTable, RecordMovementAction } from "@/features/finance/Treasury";
import { SyncTreasuryAction } from "@/features/finance/TreasuryConfig";
import { TransferAction } from "@/features/finance/TreasuryOps";
import { AccountsTable, CashFlowSection, CashSection, FxSection, TreasuryAlerts, TreasurySettingsSection } from "@/features/finance/TreasurySections";
import type { CashFlowProjection, FxRevaluationPreview, TreasuryOverview, TreasurySettingsData } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { resolveSections } from "@/lib/sections";
import { getResource } from "@/lib/server/resource";

export const metadata: Metadata = { title: "Tesorería (caja y bancos)" };

export default async function TesoreriaPage({ searchParams }: PageProps<"/finanzas/tesoreria">) {
  const [data, { seccion, tc, vencidas, fijos }] = await Promise.all([getResource<TreasuryOverview>("/treasury/accounts", "No pudimos cargar la tesorería."), searchParams]);

  if (!data) {
    return <PageHeader title="Tesorería (caja y bancos)" subtitle="Tu rol no tiene acceso a esta sección." />;
  }

  const { kpis, accounts } = data;
  const net = kpis.in_month_pen - kpis.out_month_pen;
  const bankUsd = accounts.filter((account) => account.kind === "bank" && account.currency === "USD").reduce((sum, account) => sum + account.balance, 0);
  const cashAndGateway = kpis.cash_pen + kpis.gateway_pen;
  const pendingApprovals = data.counts.filter((count) => count.status === "pending_approval").length + data.replenishments.filter((item) => item.status === "requested").length;
  const { active, groups } = resolveSections(
    "/finanzas/tesoreria",
    [
      { group: "Tesorería", id: "resumen", label: "Resumen", icon: <LayoutDashboard size={15} />, count: data.alerts.length || undefined },
      { group: "Tesorería", id: "movimientos", label: "Movimientos", icon: <ListOrdered size={15} /> },
      { group: "Tesorería", id: "cajas", label: "Cajas y arqueos", icon: <Calculator size={15} />, count: pendingApprovals || undefined },
      { group: "Planificación", id: "flujo", label: "Flujo proyectado", icon: <LineChart size={15} /> },
      { group: "Planificación", id: "cambio", label: "Diferencia cambiaria", icon: <Coins size={15} /> },
      { group: "Configuración", id: "cuentas", label: "Cuentas", icon: <Landmark size={15} /> },
      { group: "Configuración", id: "configuracion", label: "Parámetros", icon: <Settings2 size={15} /> },
    ],
    seccion,
  );
  const closeRate = typeof tc === "string" && /^\d+(\.\d+)?$/.test(tc) ? `?close_rate=${tc}` : "";
  const flowQuery = new URLSearchParams({ include_overdue: vencidas === "0" ? "0" : "1", include_fixed: fijos === "0" ? "0" : "1" }).toString();
  const projected = kpis.projected_30_pen ?? null;

  const body = await (async () => {
    switch (active) {
      case "movimientos":
        return <MovementsTable data={data} />;
      case "cajas":
        return <CashSection data={data} editable={data.can.manage} />;
      case "flujo":
        return <CashFlowSection flow={await getResource<CashFlowProjection>(`/treasury/cash-flow?${flowQuery}`, "No pudimos calcular el flujo proyectado.")} />;
      case "cambio":
        return <FxSection preview={await getResource<FxRevaluationPreview>(`/treasury/fx/revaluation-preview${closeRate}`, "No pudimos calcular la diferencia cambiaria.")} />;
      case "cuentas":
        return <AccountsTable data={data} editable={data.can.manage} />;
      case "configuracion":
        return <TreasurySettingsSection settings={await getResource<TreasurySettingsData>("/treasury/settings", "No pudimos cargar los parámetros de tesorería.")} editable={data.can.settings} />;
      default:
        return (
          <div className="flex flex-col gap-5">
            <TreasuryAlerts data={data} />
            {(data.composition || data.balance_history) && (
              <div className="grid items-start gap-5 xl:grid-cols-2">
                {data.composition && (
                  <Card>
                    <TintCardTitle icon={PieChart} title="Composición del saldo" aside="En soles" />
                    <BalanceComposition items={data.composition} />
                  </Card>
                )}
                {data.balance_history && (
                  <Card>
                    <TintCardTitle icon={LineChart} title="Saldo consolidado" aside="Últimos 28 días" />
                    <BalanceHistory points={data.balance_history} />
                  </Card>
                )}
              </div>
            )}
            <AccountCards accounts={accounts} thresholdPct={data.options.threshold_pct} />
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
              <SyncTreasuryAction />
              <TransferAction data={data} />
              <RecordMovementAction data={data} />
            </div>
          ) : undefined
        }
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <TintTile icon={Scale} tone="t1" label="Saldo consolidado" value={formatMoney(kpis.total_pen, "PEN", { compact: true })} info={<p>Suma del saldo de todas las cuentas, en soles. Los dólares se convierten al tipo de cambio de hoy ({data.usd_rate}).</p>} />
        <TintTile icon={Landmark} tone="violet" label="Bancos" value={formatMoney(kpis.bank_pen, "PEN", { compact: true })} note={bankUsd > 0 ? `Incluye ${formatMoney(bankUsd, "USD", { compact: true })} en cuentas en dólares` : "Solo cuentas en soles"} info={<p>Saldo de las cuentas bancarias, consolidado en soles.</p>} />
        <TintTile icon={Wallet} tone="sun" label="Cajas y pasarelas" value={formatMoney(cashAndGateway, "PEN", { compact: true })} note={`Pasarelas por liquidar ${formatMoney(kpis.gateway_pen, "PEN", { compact: true })}`} info={<p>Efectivo en las cajas chicas más lo cobrado en las pasarelas que aún no se liquida al banco.</p>} />
        <TintTile icon={ArrowDownUp} tone={net >= 0 ? "ok" : "bad"} label="Flujo del mes" value={formatMoney(net, "PEN", { compact: true })} note={`Entró ${formatMoney(kpis.in_month_pen, "PEN", { compact: true })} · salió ${formatMoney(kpis.out_month_pen, "PEN", { compact: true })}`} info={<p>Ingresos menos egresos vigentes desde el día 1. No cuenta las transferencias, reposiciones ni liquidaciones entre cuentas propias.</p>} />
        {projected !== null && (
          <div className="col-span-2 lg:col-span-1">
            <TintTile icon={LineChart} tone={projected >= 0 ? "t4" : "bad"} label="Proyectado a 30 días" value={formatMoney(projected, "PEN", { compact: true })} note={projected >= kpis.total_pen ? "Sube frente al saldo de hoy" : "Baja frente al saldo de hoy"} info={<p>Saldo consolidado de hoy más las cuotas por cobrar y menos las cuentas por pagar, comisiones aprobadas y egresos fijos de los próximos 30 días. Sale del flujo proyectado.</p>} />
          </div>
        )}
      </section>
      <SectionLayout nav={<SectionNav label="Secciones de tesorería" groups={groups} active={active} testId="treasury-sections" />}>{body}</SectionLayout>
    </>
  );
}
