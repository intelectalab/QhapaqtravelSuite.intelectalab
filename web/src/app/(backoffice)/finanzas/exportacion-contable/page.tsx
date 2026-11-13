import { CalendarCheck, FileSpreadsheet, ListChecks, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { TintTile } from "@/components/ui/Tinted";
import { ExportsTable, MappingEditor, NewExportAction } from "@/features/growth-ops/AccountingExport";
import type { AccountingExportRow, AccountingKpis, AccountMappings, CursorPage, Option } from "@/lib/growth-ops";
import { formatDate, formatNumber } from "@/lib/format";
import { growthRead } from "@/lib/server/growth-ops";

export const metadata: Metadata = { title: "Exportación contable" };

const BASE = "/finanzas/exportacion-contable";

export default async function AccountingExportPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { tab } = await searchParams;
  const [exports, mappings] = await Promise.all([
    growthRead<CursorPage<AccountingExportRow, AccountingKpis>>("/finance/accounting-exports?page[size]=100", "No pudimos cargar las exportaciones.", true),
    growthRead<AccountMappings>("/finance/account-mappings", "No pudimos cargar el plan de cuentas."),
  ]);

  if (!exports.data || !mappings.data) return <PageHeader title="Exportación contable" subtitle={exports.blocked ?? mappings.blocked ?? "Tu rol no tiene acceso a esta sección."} />;

  const { kpis } = exports.data.meta;
  const ready = mappings.data.targets.filter((item) => Object.values(item.ready).every(Boolean)).map((item) => item.target);
  const incomplete = mappings.data.targets.filter((item) => item.mapped > 0 && !ready.includes(item.target)).length;
  const active = tab === "plan" ? `${BASE}?tab=plan` : BASE;

  return (
    <>
      <PageHeader
        title="Exportación contable"
        subtitle="Ventas, cobros y compras listos para Contasis, Concar, Siigo, QuickBooks, Xero o CSV."
        info={<InfoTip>Primero define el plan de cuentas de tu sistema contable. Cada exportación genera asientos cuadrados (debe igual a haber) y guarda la huella del archivo para verificarlo después.</InfoTip>}
        actions={<NewExportAction targets={(exports.data.meta.targets ?? []) as Option[]} scopes={(exports.data.meta.scopes ?? []) as Option[]} ready={ready} />}
      />
      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={FileSpreadsheet} tone="ok" label="Exportaciones" value={kpis.generated} note="Archivos generados" info={<p>Exportaciones generadas con éxito desde esta pantalla.</p>} />
        <TintTile icon={ListChecks} tone="info" label="Asientos exportados" value={formatNumber(kpis.rows)} info={<p>Suma de líneas de asiento de todas las exportaciones.</p>} />
        <TintTile icon={CalendarCheck} tone="violet" label="Último periodo" value={kpis.last ? formatDate(kpis.last.period_to) : "Sin exportar"} note={kpis.last?.code} info={<p>Fecha final del periodo de la exportación más reciente.</p>} />
        <TintTile icon={TriangleAlert} tone="warn" label="Planes incompletos" value={incomplete} note={`${ready.length} listos para exportar`} info={<p>Sistemas contables con cuentas cargadas a los que les falta alguna cuenta requerida por ventas, cobros o compras.</p>} />
      </section>
      <TabbedCard tabs={[{ href: BASE, label: "Exportaciones", count: exports.data.data.length }, { href: `${BASE}?tab=plan`, label: "Plan de cuentas" }]} active={active}>
        {tab === "plan" ? <MappingEditor data={mappings.data} /> : <ExportsTable rows={exports.data.data} />}
      </TabbedCard>
    </>
  );
}
