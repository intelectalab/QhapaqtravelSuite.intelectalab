import { BadgeDollarSign } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TabbedCard, type RouteTab } from "@/components/ui/RouteTabs";
import { ChartsPanel } from "@/components/ui/ChartsPanel";
import { CorporateApprovalsView } from "@/features/corporate/CorporateApprovalsView";
import { CorporateMovementsView } from "@/features/corporate/CorporateMovementsView";
import { CorporatePeriodPicker, CorporateSummaryCharts, CorporateSummaryView } from "@/features/corporate/CorporatePortal";
import { CorporateStatementsView } from "@/features/corporate/CorporateStatementsView";
import { CorporateTeamView } from "@/features/corporate/CorporateTeamView";
import { PortalTitle } from "@/features/portal/PortalUi";
import { type CorporateApproval, type CorporateApprovalsMeta, type CorporateMovements, type CorporatePanel, type CorporatePurchases, type CorporateStatements, type CorporateSummary, type CorporateTraveler, type CostCenter, type PortalUser } from "@/lib/corporate";
import { apiFetch } from "@/lib/server/api";
import { PORTAL_HOME, portalData } from "@/lib/server/portal";

export const metadata: Metadata = { title: "Panel corporativo" };

const SECTIONS = ["resumen", "movimientos", "estado", "aprobaciones", "usuarios"] as const;

type Section = (typeof SECTIONS)[number];

export default async function CorporatePanelPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const period = typeof params.periodo === "string" && /^\d{4}(-Q[1-4]|-\d{2})?$/.test(params.periodo) ? params.periodo : "";
  const query = period ? `?period=${period}` : "";
  const summaryResult = await apiFetch<CorporateSummary>(`/portal/client/corporate/summary${query}`, { raw: true });
  if (!summaryResult.ok || !summaryResult.data) redirect(PORTAL_HOME);
  const { data: summary, meta } = summaryResult.data as unknown as { data: CorporateSummary; meta: { panel: CorporatePanel } };
  const panel = meta.panel;

  const allowed: Record<Section, boolean> = { resumen: true, movimientos: true, estado: panel.can.statements, aprobaciones: panel.can.approvals, usuarios: panel.can.manage };
  const requested = typeof params.seccion === "string" && (SECTIONS as readonly string[]).includes(params.seccion) ? (params.seccion as Section) : "resumen";
  const section: Section = allowed[requested] ? requested : "resumen";
  const link = (target: Section) => `/portal/corporativo?seccion=${target}${period ? `&periodo=${period}` : ""}`;
  const tabs: RouteTab[] = [
    { href: link("resumen"), label: "Resumen de compras" },
    { href: link("movimientos"), label: "Movimientos" },
    ...(allowed.estado ? [{ href: link("estado"), label: "Estado de cuenta" }] : []),
    ...(allowed.aprobaciones ? [{ href: link("aprobaciones"), label: "Aprobaciones", count: panel.pending_approvals || undefined }] : []),
    ...(allowed.usuarios ? [{ href: link("usuarios"), label: "Usuarios y centros de costo" }] : []),
  ];
  const cur = summary.currency;

  return (
    <>
      <PortalTitle
        title="Panel corporativo"
        subtitle={
          <>
            {panel.client.name} · {panel.client.doc} · crédito {panel.credit_days} días · tu rol: <b className="text-fg">{panel.role_label}</b>
            {panel.scope ? ` · ${panel.scope}` : ""}
          </>
        }
        actions={
          <span className="flex flex-wrap items-center gap-2">
            {section === "resumen" && (
              <ChartsPanel title="Gráficos de compras" description={`Gasto de tu empresa en ${summary.period.label}: por mes, por centro de costo y por viajero.`}>
                <CorporateSummaryCharts summary={summary} />
              </ChartsPanel>
            )}
            <CorporatePeriodPicker periods={panel.periods} value={summary.period.key} />
          </span>
        }
      />
      {panel.read_only && (
        <p role="status" className="mb-5 rounded-[14px] border border-[color-mix(in_srgb,var(--warn)_30%,transparent)] bg-[color-mix(in_srgb,var(--warn)_7%,var(--surface))] px-4 py-3 text-[13px] text-fg-2">
          El panel está en solo lectura: puedes consultar compras, movimientos y estados de cuenta, pero no aprobar, invitar usuarios ni cambiar centros de costo. Escribe a tu agencia si necesitas hacerlo.
        </p>
      )}
      <TabbedCard tabs={tabs} active={link(section)}>
        {section === "resumen" && <CorporateSummaryView summary={summary} purchases={await portalData<CorporatePurchases>(`/corporate/purchases${query}`, "No pudimos cargar las compras.")} />}
        {section === "movimientos" && <CorporateMovementsView data={await portalData<CorporateMovements>(`/corporate/movements${query}`, "No pudimos cargar los movimientos.")} centers={summary.cost_centers} period={summary.period.key} balance={summary.kpis.balance} />}
        {section === "estado" && <CorporateStatementsView data={await portalData<CorporateStatements>("/corporate/statements", "No pudimos cargar los estados de cuenta.")} />}
        {section === "aprobaciones" && <ApprovalsSection />}
        {section === "usuarios" && <TeamSection currency={cur} />}
      </TabbedCard>
      <p className="mt-4 flex items-center gap-1.5 text-[12.5px] text-fg-3">
        <BadgeDollarSign size={14} />
        Importes de venta en {cur}. El panel no muestra costos de proveedores ni comisiones.
      </p>
    </>
  );
}

async function ApprovalsSection() {
  const result = await apiFetch<CorporateApproval[]>("/portal/client/corporate/approvals", { raw: true });
  if (!result.ok || !result.data) redirect(PORTAL_HOME);
  const payload = result.data as unknown as { data: CorporateApproval[]; meta: CorporateApprovalsMeta };
  return <CorporateApprovalsView approvals={payload.data} meta={payload.meta} />;
}

async function TeamSection({ currency }: { currency: string }) {
  const [users, centers, travelers] = await Promise.all([
    portalData<PortalUser[]>("/corporate/users", "No pudimos cargar los usuarios."),
    portalData<CostCenter[]>("/corporate/cost-centers", "No pudimos cargar los centros de costo."),
    portalData<CorporateTraveler[]>("/corporate/travelers", "No pudimos cargar los viajeros."),
  ]);
  return <CorporateTeamView users={users} centers={centers} travelers={travelers} currency={currency} />;
}
