import { CalendarCheck, FileText, History, LayoutDashboard, Mail, Receipt, Route, Target, Ticket, UserRound, Users, Wallet } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, LiveTag } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SectionTitle, StatCard } from "@/components/ui/Details";
import { SectionLayout, SectionNav } from "@/components/ui/SectionNav";
import { formatMoney } from "@/lib/format";
import { resolveSections } from "@/lib/sections";
import { getClient, getClientFormOptions, getClientTab } from "@/lib/server/clients";
import { getOpportunityFormOptions } from "@/lib/server/opportunities";
import { getRelatedOptions } from "@/lib/server/activities";
import { ActivityCreateAction } from "@/features/activities/ActivityForms";
import { OpportunityCreateAction } from "@/features/opportunities/OpportunityForms";
import { ClientArchiveAction, ClientDataRightsCard, ClientEditAction } from "@/features/clients/ClientForms";
import { ClientCommunicationAction } from "@/features/clients/ClientContactForms";
import { CurrentTrip, TripList } from "@/features/clients/ClientSections";
import { ClientPortalAccessCard } from "@/features/clients/ClientPortalAccess";
import { ActivitiesSection, ClientSummaryExtras, CommunicationsSection, ContactsSection, DocumentsSection, HistorySection, LeadsSection, OpportunitiesSection, PassengersSection, PaymentsSection, QuotesSection, ReservationsSection } from "@/features/clients/ClientTabSections";

export async function generateMetadata({ params }: PageProps<"/crm/clientes/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: (await getClient(id)).name };
}

export default async function ClientePage({ params, searchParams }: PageProps<"/crm/clientes/[id]">) {
  const { id } = await params;
  const { editar, seccion } = await searchParams;
  const [client, options, opportunityOptions, activityOptions] = await Promise.all([getClient(id), getClientFormOptions(), getOpportunityFormOptions(), getRelatedOptions()]);

  const otherTrips = client.history.filter((trip) => trip.id !== client.currentTrip?.trip.id);
  const since = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" }).format(new Date(`${client.createdAt}T12:00:00`));
  const ticket = client.trips > 0 ? Math.round(client.totalPen / client.trips) : 0;
  const opportunityAction = opportunityOptions ? <OpportunityCreateAction options={opportunityOptions} clientCode={client.id} /> : null;
  const activityPreset = { type: "client", code: client.id, name: client.name };
  const activityAction = (size: "sm" | "md") => (activityOptions ? <ActivityCreateAction options={activityOptions} preset={activityPreset} label="Registrar actividad" size={size} variant="secondary" /> : null);
  const writeAction = options.canManage ? <ClientCommunicationAction code={client.id} email={client.email || null} name={client.name} /> : null;
  const base = `/crm/clientes/${encodeURIComponent(client.id)}`;

  const { active, groups } = resolveSections(
    base,
    [
      { group: "Cliente", id: "resumen", label: "Resumen", icon: <LayoutDashboard size={15} /> },
      { group: "Cliente", id: "contactos", label: "Contactos y datos", icon: <UserRound size={15} />, count: client.contacts.length || undefined },
      { group: "Comercial", id: "leads", label: "Leads", icon: <Target size={15} /> },
      { group: "Comercial", id: "oportunidades", label: "Oportunidades", icon: <Target size={15} />, count: client.openOpportunities.length || undefined },
      { group: "Comercial", id: "cotizaciones", label: "Cotizaciones", icon: <FileText size={15} />, count: client.quotes.length },
      { group: "Viajes", id: "reservas", label: "Reservas", icon: <Route size={15} />, count: client.history.length },
      { group: "Viajes", id: "pasajeros", label: "Pasajeros", icon: <Users size={15} /> },
      { group: "Cobros y documentos", id: "pagos", label: "Pagos", icon: <Wallet size={15} /> },
      { group: "Cobros y documentos", id: "documentos", label: "Documentos", icon: <Receipt size={15} /> },
      { group: "Relación", id: "comunicaciones", label: "Comunicaciones", icon: <Mail size={15} /> },
      { group: "Relación", id: "actividades", label: "Actividades", icon: <CalendarCheck size={15} /> },
      { group: "Control", id: "historial", label: "Historial", icon: <History size={15} /> },
    ],
    editar ? undefined : seccion,
  );

  const body = await (async () => {
    switch (active) {
      case "contactos":
        return <ContactsSection client={client} canManage={options.canManage} />;
      case "leads":
        return <LeadsSection rows={await getClientTab(client.id, "leads")} />;
      case "oportunidades":
        return <OpportunitiesSection rows={await getClientTab(client.id, "opportunities")} action={opportunityAction} />;
      case "cotizaciones":
        return <QuotesSection rows={await getClientTab(client.id, "quotes")} />;
      case "reservas":
        return <ReservationsSection rows={await getClientTab(client.id, "reservations")} />;
      case "pasajeros":
        return <PassengersSection rows={await getClientTab(client.id, "passengers")} />;
      case "pagos": {
        const [receivables, payments] = await Promise.all([getClientTab(client.id, "receivables"), getClientTab(client.id, "payments")]);
        return <PaymentsSection receivables={receivables} payments={payments} />;
      }
      case "documentos": {
        const [invoices, vouchers] = await Promise.all([getClientTab(client.id, "invoices"), getClientTab(client.id, "vouchers")]);
        return <DocumentsSection invoices={invoices} vouchers={vouchers} />;
      }
      case "comunicaciones":
        return <CommunicationsSection rows={await getClientTab(client.id, "communications")} action={writeAction} />;
      case "actividades":
        return <ActivitiesSection rows={await getClientTab(client.id, "activities")} action={activityAction("sm")} />;
      case "historial": {
        const [timeline, audit] = await Promise.all([getClientTab(client.id, "timeline"), getClientTab(client.id, "audit")]);
        return <HistorySection timeline={timeline} audit={audit} />;
      }
      default:
        return (
          <div className="flex flex-col gap-5">
            <Card>
              {client.currentTrip && (
                <div className="mb-5">
                  <SectionTitle title="Viaje en curso" href={`/reservas/${client.currentTrip.trip.id}`} linkLabel="Abrir reserva" />
                  <CurrentTrip current={client.currentTrip} />
                </div>
              )}
              <SectionTitle title={client.currentTrip ? "Otros viajes" : "Últimos viajes"} href={client.history.length > 4 ? `${base}?seccion=reservas` : undefined} linkLabel="Ver todos" />
              <TripList trips={otherTrips.slice(0, 4)} />
            </Card>
            <ClientSummaryExtras client={client} />
            <div className="grid items-start gap-5 xl:grid-cols-2">
              <ClientPortalAccessCard client={client} canManage={options.canManage} />
              {options.canManage && <ClientDataRightsCard client={client} canErase={options.canReassign} />}
            </div>
          </div>
        );
    }
  })();

  return (
    <>
      <PageHeader
        back={{ href: "/crm/clientes", label: "Clientes" }}
        jump={false}
        leading={<Avatar name={client.name} size="lg" />}
        title={client.name}
        info={client.currentTrip ? <span className="ml-2 flex-none"><LiveTag>De viaje · día {client.currentTrip.dayNumber} de {client.currentTrip.days.length}</LiveTag></span> : null}
        subtitle={[client.id, client.segment, [client.city, client.country].filter(Boolean).join(", "), `Cliente desde ${since}`].join(" · ")}
        actions={
          <>
            {writeAction}
            {activityAction("md")}
            {opportunityAction}
            {options.canManage && (
              <>
                <ClientEditAction client={client} options={options} defaultOpen={editar === "1"} />
                <ClientArchiveAction client={client} />
              </>
            )}
          </>
        }
      />

      {client.tags.length > 0 && (
        <div className="-mt-2 mb-4 flex flex-wrap gap-1.5">
          {client.tags.map((tag) => (
            <Badge key={tag} dot={false}>
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {client.openCases.length > 0 && (
        <p className="mb-4 flex items-center gap-2 rounded-card border border-[color-mix(in_srgb,var(--warn)_35%,transparent)] bg-[color-mix(in_srgb,var(--warn)_10%,transparent)] px-4 py-3 text-[13.5px]">
          <Ticket size={16} className="flex-none text-warn" />
          <span>
            <b className="font-semibold">{client.openCases.length === 1 ? "Tiene un caso de postventa abierto:" : `Tiene ${client.openCases.length} casos de postventa abiertos:`}</b> {client.openCases.map((item) => item.subject).join(" · ")}
          </span>
        </p>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Viajes con tu agencia" value={client.trips} note={client.cancelledTrips > 0 ? `${client.cancelledTrips} cancelado${client.cancelledTrips === 1 ? "" : "s"}` : client.trips === 1 ? "El primero" : undefined} />
        <StatCard label="Total comprado" value={formatMoney(client.totalPen)} note={client.trips > 1 ? `Ticket promedio ${formatMoney(ticket)}` : undefined} />
        <StatCard
          label="Pagos"
          value={client.overduePen > 0 ? formatMoney(client.overduePen) : client.balancePen > 0 ? formatMoney(client.balancePen) : "Al día"}
          note={client.overduePen > 0 ? "Vencido" : client.balancePen > 0 ? "Por cobrar, aún sin vencer" : "No debe nada"}
          tone={client.overduePen > 0 ? "bad" : client.balancePen > 0 ? undefined : "ok"}
        />
        <StatCard label="Satisfacción" value={client.satisfaction === null ? "Sin encuesta" : `${client.satisfaction} / 10`} />
      </div>

      <SectionLayout nav={<SectionNav label="Secciones del cliente" groups={groups} active={active} testId="client-sections" />}>{body}</SectionLayout>
    </>
  );
}
