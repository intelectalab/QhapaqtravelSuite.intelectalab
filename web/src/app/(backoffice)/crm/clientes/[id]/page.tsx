import { Plus, Send } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/PageHeader";
import { Avatar } from "@/components/ui/Avatar";
import { Badge, LiveTag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { formatDate, formatMoney, shortName } from "@/lib/format";
import { getClient, getClientFormOptions } from "@/lib/server/clients";
import { ClientArchiveAction, ClientEditAction } from "@/features/clients/ClientForms";
import { FieldList, SectionTitle, StatCard } from "@/components/ui/Details";
import { CurrentTrip, QuoteList, TripList } from "@/features/clients/ClientSections";

export async function generateMetadata({ params }: PageProps<"/crm/clientes/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: (await getClient(id)).name };
}

export default async function ClientePage({ params }: PageProps<"/crm/clientes/[id]">) {
  const { id } = await params;
  const [client, options] = await Promise.all([getClient(id), getClientFormOptions()]);

  const otherTrips = client.history.filter((trip) => trip.id !== client.currentTrip?.trip.id);
  const since = new Intl.DateTimeFormat("es-PE", { month: "long", year: "numeric" }).format(new Date(`${client.createdAt}T12:00:00`));

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
            <Button iconOnlyOnMobile icon={<Send size={16} />}>Escribirle</Button>
            <Button variant="primary" iconOnlyOnMobile icon={<Plus size={16} strokeWidth={2.4} />}>
              Nueva cotización
            </Button>
            {options.canManage && (
              <>
                <ClientEditAction client={client} options={options} />
                <ClientArchiveAction client={client} />
              </>
            )}
          </>
        }
      />

      <div className="mb-3.5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Viajes con tu agencia" value={client.trips} note={client.trips === 1 ? "El primero" : undefined} />
        <StatCard label="Total comprado" value={formatMoney(client.totalPen)} />
        <StatCard
          label="Pagos"
          value={client.overduePen > 0 ? formatMoney(client.overduePen) : client.balancePen > 0 ? formatMoney(client.balancePen) : "Al día"}
          note={client.overduePen > 0 ? "Vencido" : client.balancePen > 0 ? "Por cobrar, aún sin vencer" : "No debe nada"}
          tone={client.overduePen > 0 ? "bad" : client.balancePen > 0 ? undefined : "ok"}
        />
        <StatCard label="Satisfacción" value={client.satisfaction === null ? "Sin encuesta" : `${client.satisfaction} / 10`} />
      </div>

      <div className="grid grid-cols-1 items-start gap-3.5 xl:grid-cols-[1fr_380px]">
        <Card padded={false}>
          <Tabs
            tabs={[
              {
                id: "summary",
                label: "Resumen",
                content: (
                  <>
                    {client.currentTrip && (
                      <div className="mb-5">
                        <SectionTitle title="Viaje en curso" href={`/reservas/${client.currentTrip.trip.id}`} linkLabel="Abrir reserva" />
                        <CurrentTrip current={client.currentTrip} />
                      </div>
                    )}
                    {(otherTrips.length > 0 || !client.currentTrip) && (
                      <>
                        <SectionTitle title={client.currentTrip ? "Otros viajes" : "Viajes"} />
                        <TripList trips={otherTrips.slice(0, 4)} />
                      </>
                    )}
                  </>
                ),
              },
              { id: "trips", label: "Viajes", count: client.history.length, content: <TripList trips={client.history} /> },
              { id: "quotes", label: "Cotizaciones", count: client.quotes.length, content: <QuoteList quotes={client.quotes} /> },
            ]}
          />
        </Card>

        <div className="flex flex-col gap-3.5">
          <Card>
            <SectionTitle title="Datos" />
            <FieldList
              fields={[
                { label: "Documento", value: client.document },
                { label: "Correo", value: client.email },
                { label: "Teléfono", value: client.phone },
                ...(client.birth ? [{ label: "Nacimiento", value: formatDate(client.birth) }] : []),
                {
                  label: "Asesor",
                  value: (
                    <span className="flex items-center gap-2">
                      <Avatar name={client.ownerName} size="xs" solid />
                      {shortName(client.ownerName)}
                    </span>
                  ),
                },
              ]}
            />
          </Card>
          {(client.tags.length > 0 || client.companions.length > 0) && (
            <Card>
              {client.tags.length > 0 && (
                <>
                  <SectionTitle title="Etiquetas" />
                  <div className="flex flex-wrap gap-1.5">
                    {client.tags.map((tag) => (
                      <Badge key={tag} dot={false}>
                        {tag}
                      </Badge>
                    ))}
                  </div>
                </>
              )}
              {client.companions.length > 0 && (
                <div className={client.tags.length > 0 ? "mt-5" : undefined}>
                  <SectionTitle title="Viaja con" />
                  <ul className="flex flex-col gap-2.5">
                    {client.companions.map((companion) => (
                      <li key={companion.name} className="flex items-center gap-2.5">
                        <Avatar name={companion.name} size="sm" />
                        <span className="min-w-0">
                          <b className="block truncate font-semibold">{companion.name}</b>
                          <span className="block truncate text-xs text-fg-3">
                            {companion.document}
                            {companion.diet ? ` · ${companion.diet}` : ""}
                          </span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>
    </>
  );
}
