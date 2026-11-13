import { BadgeDollarSign, ChartColumn, ShoppingBag, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TabbedCard, type RouteTab } from "@/components/ui/RouteTabs";
import { TintTile } from "@/components/ui/Tinted";
import { CorporateApprovalsView } from "@/features/corporate/CorporateApprovalsView";
import { CorporateMovementsView } from "@/features/corporate/CorporateMovementsView";
import { CorporatePeriodPicker, CorporateSummaryView } from "@/features/corporate/CorporatePortal";
import { CorporateStatementsView } from "@/features/corporate/CorporateStatementsView";
import { CorporateTeamView } from "@/features/corporate/CorporateTeamView";
import { PortalTitle } from "@/features/portal/PortalUi";
import { num, type CorporateApproval, type CorporateApprovalsMeta, type CorporateMovements, type CorporatePanel, type CorporatePurchases, type CorporateStatements, type CorporateSummary, type CorporateTraveler, type CostCenter, type PortalUser } from "@/lib/corporate";
import { formatMoney } from "@/lib/format";
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
        actions={<CorporatePeriodPicker periods={panel.periods} value={summary.period.key} />}
      />
      <section className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={ShoppingBag} tone="t1" label="Total comprado" value={formatMoney(summary.kpis.total, cur)} note={`${summary.kpis.purchases} compras · ${summary.period.label}`} info="Suma de las reservas de tu empresa creadas en el período, convertidas a la moneda de la cuenta. Las compras de meses cerrados salen del estado de cuenta emitido." />
        <TintTile icon={Wallet} tone={num(summary.kpis.balance) > 0 ? "sun" : "ok"} label="Saldo por pagar" value={formatMoney(summary.kpis.balance, cur)} note="A la fecha, todas las compras" info="Compras menos pagos aplicados y notas de crédito, desde la primera compra hasta hoy." />
        <TintTile icon={Users} tone="info" label="Viajeros" value={summary.kpis.travelers} note="Personas distintas que viajaron" info="Pasajeros de las reservas del período y viajeros asignados en el reparto de costos." />
        <TintTile icon={ChartColumn} tone="violet" label="Ticket promedio" value={summary.kpis.average_ticket ? formatMoney(summary.kpis.average_ticket, cur) : "—"} note="Por compra" info="Total comprado dividido entre el número de compras del período." />
      </section>
      <TabbedCard tabs={tabs} active={link(section)}>
        {section === "resumen" && <CorporateSummaryView summary={summary} purchases={await portalData<CorporatePurchases>(`/corporate/purchases${query}`, "No pudimos cargar las compras.")} />}
        {section === "movimientos" && <CorporateMovementsView data={await portalData<CorporateMovements>(`/corporate/movements${query}`, "No pudimos cargar los movimientos.")} centers={summary.cost_centers} period={summary.period.key} />}
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
