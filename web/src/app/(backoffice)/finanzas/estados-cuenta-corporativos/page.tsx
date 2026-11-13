import { CalendarClock, FileCheck2, FileClock, FileX2 } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintTile } from "@/components/ui/Tinted";
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
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={FileClock} tone="info" label="Generados sin enviar" value={meta.kpis.generated} info="Estados en estado generado: listos para revisar y enviar a la empresa." />
        <TintTile icon={FileCheck2} tone="ok" label="Enviados" value={meta.kpis.sent} info="Estados enviados por correo a los destinatarios de la cuenta." />
        <TintTile icon={FileX2} tone="mute" label="Anulados" value={meta.kpis.void} info="Estados anulados para regenerar el mes. Se conservan como historial." />
        <TintTile icon={CalendarClock} tone="t1" label="Cuentas con envío automático" value={meta.kpis.auto_accounts} note={`De ${meta.accounts.length} cuentas`} info="Cuentas corporativas activas o suspendidas con el envío automático encendido." />
      </section>
      <StatementsTable statements={data} accounts={meta.accounts} />
    </>
  );
}
