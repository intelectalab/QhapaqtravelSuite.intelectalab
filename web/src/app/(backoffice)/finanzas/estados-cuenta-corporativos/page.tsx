import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { GenerateStatementAction, StatementsTable } from "@/features/corporate/CorporateStatementsAdmin";
import type { StatementsPage } from "@/lib/corporate";
import { apiFetch } from "@/lib/server/api";

export const metadata: Metadata = { title: "Estados de cuenta corporativos" };

export default async function CorporateStatementsPage() {
  const result = await apiFetch<StatementsPage>("/finance/corporate-statements?page[size]=100", { raw: true });

  if (!result.ok || !result.data) {
    return <PageHeader title="Estados de cuenta corporativos" subtitle={result.status === 403 ? result.error?.message ?? "Tu rol no tiene acceso a esta sección." : "No pudimos cargar los estados de cuenta."} />;
  }

  const { data, meta } = result.data;

  return (
    <>
      <PageHeader
        title="Estados de cuenta corporativos"
        subtitle="Estado mensual de cada empresa: saldo inicial, compras, pagos, notas de crédito y saldo final."
        info={<InfoTip>Al generar un mes se congelan sus movimientos. Si algo cambia después, anúlalo y vuelve a generarlo. Las cuentas con envío automático reciben el mes anterior el día configurado.</InfoTip>}
        actions={<GenerateStatementAction accounts={meta.accounts} />}
      />
      <StatementsTable statements={data} accounts={meta.accounts} kpis={meta.kpis} />
    </>
  );
}
