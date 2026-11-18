import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { InfoTip } from "@/components/ui/InfoTip";
import { TabbedCard } from "@/components/ui/RouteTabs";
import { ExportsTable, MappingEditor, NewExportAction } from "@/features/growth-ops/AccountingExport";
import type { AccountingExportRow, AccountingKpis, AccountMappings, CursorPage, Option } from "@/lib/growth-ops";
import { growthRead } from "@/lib/server/growth-ops";
import { comingSoon } from "@/features/integrations/FeatureGate";

export const metadata: Metadata = { title: "Exportación contable" };

const BASE = "/finanzas/exportacion-contable";

export default async function AccountingExportPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const soon = await comingSoon("accounting", "Exportación contable");
  if (soon) return soon;
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
      <TabbedCard tabs={[{ href: BASE, label: "Exportaciones", count: exports.data.data.length }, { href: `${BASE}?tab=plan`, label: "Plan de cuentas" }]} active={active}>
        {tab === "plan" ? <MappingEditor data={mappings.data} /> : <ExportsTable rows={exports.data.data} kpis={kpis} plans={{ ready: ready.length, incomplete }} />}
      </TabbedCard>
    </>
  );
}
