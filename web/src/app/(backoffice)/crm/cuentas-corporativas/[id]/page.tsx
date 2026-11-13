import { CalendarClock, ClipboardCheck, Layers, ShieldCheck, ShoppingBag, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { TabbedCard, type RouteTab } from "@/components/ui/RouteTabs";
import { TintCardTitle, TintTile } from "@/components/ui/Tinted";
import { EditAccountAction, ImportTravelersAction, SuspendAccountAction } from "@/features/corporate/CorporateAccountForms";
import { AccountApprovals, AccountTravelers, AccountUsers } from "@/features/corporate/CorporateAccountDetail";
import { CostCenterList, type TeamActions } from "@/features/corporate/CorporateTeamView";
import { num, type CorporateAccount } from "@/lib/corporate";
import { formatDate, formatMoney } from "@/lib/format";
import { getResource } from "@/lib/server/resource";
import { importAccountTravelers, resendAccountInvite, saveAccountCenter, saveAccountTraveler, saveAccountUser, suspendAccount, updateAccount } from "../actions";

export const metadata: Metadata = { title: "Cuenta corporativa" };

const SECTIONS = ["condiciones", "centros", "viajeros", "usuarios"] as const;

type Section = (typeof SECTIONS)[number];

export default async function CorporateAccountPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { id } = await params;
  const query = await searchParams;
  const account = await getResource<CorporateAccount>(`/crm/corporate-accounts/${encodeURIComponent(id)}`, "No pudimos cargar la cuenta corporativa.");

  if (!account) {
    return <PageHeader title="Cuenta corporativa" subtitle="Tu rol no tiene acceso a esta cuenta." back={{ href: "/crm/cuentas-corporativas", label: "Cuentas corporativas" }} />;
  }

  const section: Section = typeof query.seccion === "string" && (SECTIONS as readonly string[]).includes(query.seccion) ? (query.seccion as Section) : "condiciones";
  const base = `/crm/cuentas-corporativas/${account.id}`;
  const link = (target: Section) => `${base}?seccion=${target}`;
  const centers = account.cost_centers ?? [];
  const travelers = account.travelers ?? [];
  const users = account.portal_users ?? [];
  const approvals = account.approvals ?? [];
  const tabs: RouteTab[] = [
    { href: link("condiciones"), label: "Condiciones y aprobaciones", count: account.counts.pending_approvals || undefined },
    { href: link("centros"), label: "Centros de costo", count: centers.length },
    { href: link("viajeros"), label: "Viajeros", count: travelers.length },
    { href: link("usuarios"), label: "Usuarios del panel", count: users.length },
  ];
  const actions: TeamActions = { saveUser: saveAccountUser.bind(null, account.id), saveCenter: saveAccountCenter.bind(null, account.id), saveTraveler: saveAccountTraveler.bind(null, account.id) };
  const cur = account.currency;

  return (
    <>
      <PageHeader
        title={account.client.name}
        subtitle={
          <span className="inline-flex flex-wrap items-center gap-2">
            {account.client.code} · RUC {account.client.doc_number}
            <Badge tone={account.status === "activa" ? "ok" : account.status === "suspendida" ? "warn" : "mute"}>{account.status_label}</Badge>
          </span>
        }
        back={{ href: "/crm/cuentas-corporativas", label: "Cuentas corporativas" }}
        actions={
          account.status !== "cerrada" ? (
            <>
              <SuspendAccountAction account={account} action={suspendAccount.bind(null, account.id)} />
              <EditAccountAction account={account} action={updateAccount.bind(null, account.id)} />
            </>
          ) : undefined
        }
      />
      <section className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <TintTile icon={ShoppingBag} tone="t1" label="Comprado en el año" value={formatMoney(account.purchases_year, cur)} info="Reservas de la empresa creadas este año, en la moneda de la cuenta, más el historial de los estados de cuenta emitidos." />
        <TintTile icon={Wallet} tone={num(account.balance) > 0 ? "sun" : "ok"} label="Saldo por cobrar" value={formatMoney(account.balance, cur)} info="Compras menos pagos aplicados y notas de crédito, desde la primera compra." />
        <TintTile icon={ClipboardCheck} tone={account.counts.pending_approvals ? "warn" : "ok"} label="Aprobaciones pendientes" value={account.counts.pending_approvals} info="Solicitudes que la empresa aún no decide. Vencen a las horas configuradas en la cuenta." />
        <TintTile icon={Users} tone="info" label="Usuarios del panel" value={account.counts.portal_users} note={`${account.counts.travelers} viajeros registrados`} info="Personas de la empresa con acceso al Panel corporativo, sin contar las inactivas." />
      </section>
      <TabbedCard tabs={tabs} active={link(section)}>
        {section === "condiciones" && (
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
            <div className="flex flex-col gap-4">
              <Card>
                <TintCardTitle icon={ShieldCheck} title="Condiciones" />
                <dl className="grid gap-2 text-[13px]">
                  {[
                    ["Moneda", cur],
                    ["Crédito", `${account.credit_days} días`],
                    ["Aprobación previa", account.require_approval && account.approval_threshold ? `Desde ${formatMoney(account.approval_threshold, cur)} · vence en ${account.approval_ttl_hours} h` : "No exige"],
                    ["Centro por defecto", account.default_cost_center ? `${account.default_cost_center.code} · ${account.default_cost_center.name}` : "Sin definir"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-3">
                      <dt className="text-fg-3">{label}</dt>
                      <dd className="text-right font-medium">{value}</dd>
                    </div>
                  ))}
                </dl>
              </Card>
              <Card>
                <TintCardTitle icon={CalendarClock} title="Estado de cuenta" />
                <p className="text-[13px] text-fg-2">
                  {account.statement_auto ? `Envío automático el día ${account.statement_day} a ${account.statement_recipients.join(", ")}.` : "Sin envío automático."}
                  {account.statement_last_sent_at ? ` Último envío: ${formatDate(account.statement_last_sent_at)}.` : ""}
                </p>
                {account.notes && <p className="mt-2 rounded-tile bg-surface-2 px-3 py-2 text-[12.5px] text-fg-2">{account.notes}</p>}
              </Card>
            </div>
            <AccountApprovals approvals={approvals} />
          </div>
        )}
        {section === "centros" && (
          <div>
            <TintCardTitle icon={Layers} title="Centros de costo y presupuesto" />
            <CostCenterList centers={centers} currency={cur} actions={actions} />
          </div>
        )}
        {section === "viajeros" && <AccountTravelers travelers={travelers} centers={centers} actions={actions} importAction={<ImportTravelersAction action={importAccountTravelers.bind(null, account.id)} />} />}
        {section === "usuarios" && <AccountUsers users={users} centers={centers} travelers={travelers} actions={actions} resend={resendAccountInvite.bind(null, account.id)} />}
      </TabbedCard>
    </>
  );
}
