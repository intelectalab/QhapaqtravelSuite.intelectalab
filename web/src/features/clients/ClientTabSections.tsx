import { CalendarCheck, FileText, Globe2, History, Mail, MapPin, MessageSquareHeart, Receipt, Route, Target, TicketCheck, Users, Wallet } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { InfoTip } from "@/components/ui/InfoTip";
import { DownloadButton } from "@/components/ui/DownloadButton";
import { EmptyState } from "@/components/ui/EmptyState";
import { MiniTable } from "@/components/ui/MiniTable";
import { SOFT_TINT, TintCardTitle } from "@/components/ui/Tinted";
import type { ClientDetail, ClientTabData } from "@/lib/clients";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { DOC_TYPE, PAX_TYPE } from "@/lib/reservations";
import { statusLabel } from "@/lib/tone";
import { ClientContactFormAction, ClientContactRowActions } from "./ClientContactForms";

const ACTIVITY_TYPE: Record<string, string> = { llamada: "Llamada", reunion: "Reunión", email: "Correo", whatsapp: "WhatsApp", tarea: "Tarea", visita: "Visita" };
const RELATED: Record<string, string> = { client: "del cliente", opportunity: "de una oportunidad", quote: "de una cotización", lead: "de un lead" };

function Empty({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <Card>
      <EmptyState icon={icon} title={title} description={description} />
    </Card>
  );
}

function activityState(activity: { status: string; due_at?: string | null }): string {
  return activity.status === "pendiente" && activity.due_at && new Date(activity.due_at).getTime() < Date.now() ? "vencida" : activity.status;
}

export function ClientSummaryExtras({ client }: { client: ClientDetail }) {
  const satisfaction = client.satisfactionDetail;
  return (
    <div className="grid gap-5 xl:grid-cols-2">
      <Card>
        <TintCardTitle icon={Target} title="Oportunidades abiertas" aside={client.openOpportunities.length ? String(client.openOpportunities.length) : undefined} />
        {client.openOpportunities.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">No tiene oportunidades en curso.</p>
        ) : (
          <ul className="flex flex-col">
            {client.openOpportunities.map((opp) => (
              <li key={opp.code} className="flex items-center gap-3 border-t border-line-2 py-2.5 text-[13px] first:border-t-0">
                <span className="min-w-0 flex-1">
                  <Link href={`/crm/oportunidades/${opp.code}`} className="block truncate font-semibold hover:underline">
                    {opp.title}
                  </Link>
                  <span className="text-xs text-fg-3">
                    {opp.code}
                    {opp.expected_close_date && ` · cierre esperado ${formatDate(opp.expected_close_date)}`}
                  </span>
                </span>
                {opp.amount && <span className="font-mono">{formatMoney(opp.amount, opp.currency)}</span>}
                <StatusBadge status={opp.stage} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <TintCardTitle icon={CalendarCheck} title="Próximas actividades" />
        {client.nextActivities.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">No hay llamadas, reuniones ni tareas pendientes con este cliente.</p>
        ) : (
          <ul className="flex flex-col">
            {client.nextActivities.map((activity) => (
              <li key={activity.code} className="flex items-center gap-3 border-t border-line-2 py-2.5 text-[13px] first:border-t-0">
                <span className="min-w-0 flex-1">
                  <b className="block truncate font-semibold">{activity.subject}</b>
                  <span className="text-xs text-fg-3">
                    {ACTIVITY_TYPE[activity.type] ?? activity.type}
                    {activity.due_at && ` · ${formatDateTime(activity.due_at)}`}
                    {activity.owner && ` · ${activity.owner}`}
                  </span>
                </span>
                <StatusBadge status={activityState(activity)} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <TintCardTitle icon={MessageSquareHeart} title="Satisfacción" />
        {satisfaction ? (
          <>
            <div className="mb-3 flex items-end gap-6">
              <span>
                <span className="block text-[12px] text-fg-3">Última encuesta</span>
                <b className="text-[26px] font-bold tabular-nums">{satisfaction.last}</b>
                <span className="text-fg-3"> / 10</span>
              </span>
              <span>
                <span className="block text-[12px] text-fg-3">Promedio</span>
                <b className="text-[18px] font-semibold tabular-nums">{satisfaction.average}</b>
                <span className="text-[12px] text-fg-3"> en {satisfaction.count} {satisfaction.count === 1 ? "encuesta" : "encuestas"}</span>
              </span>
            </div>
            {satisfaction.comment && <p className={cn("rounded-[12px] px-3.5 py-2.5 text-[13px] italic text-fg-2", SOFT_TINT)}>«{satisfaction.comment}»</p>}
          </>
        ) : (
          <p className="text-[13.5px] text-fg-3">Todavía no respondió ninguna encuesta.</p>
        )}
      </Card>
      <Card>
        <TintCardTitle icon={Globe2} title="Destinos visitados" aside={<span className="flex items-center gap-2">{client.destinations.length > 0 && <span className="text-[12.5px] text-fg-3">{client.destinations.length}</span>}<InfoTip label="De dónde sale">Departamentos de los productos que reservó (sin borradores ni canceladas) y destinos de sus oportunidades ganadas.</InfoTip></span>} />
        {client.destinations.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">Aún no viajó con la agencia.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {client.destinations.map((destination, index) => {
              const most = Math.max(1, ...client.destinations.map((item) => item.trips + (item.won ?? 0)));
              const label = [destination.trips > 0 ? (destination.trips === 1 ? "1 viaje" : `${destination.trips} viajes`) : null, destination.won ? (destination.won === 1 ? "1 oportunidad ganada" : `${destination.won} oportunidades ganadas`) : null].filter(Boolean).join(" · ");
              return (
                <li key={destination.name} style={{ animationDelay: `${index * 50}ms` }} className="lift flex animate-[rise-in_380ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col gap-1.5 rounded-tile border border-line px-3 py-2.5">
                  <span className="flex items-center gap-1.5">
                    <MapPin size={14} className="flex-none text-[var(--tint,var(--t1))]" />
                    <b className="truncate text-[13px] font-semibold">{destination.name}</b>
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                      <span className="block h-full rounded-full bg-[var(--tint,var(--t1))]" style={{ width: `${Math.max(12, ((destination.trips + (destination.won ?? 0)) / most) * 100)}%` }} />
                    </span>
                    <span className="flex-none text-[12px] text-fg-3" title={label}>{destination.trips > 0 ? (destination.trips === 1 ? "1 viaje" : `${destination.trips} viajes`) : "Ganada"}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function ContactsSection({ client, canManage }: { client: ClientDetail; canManage: boolean }) {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
      <Card>
        <TintCardTitle icon={Users} title="Contactos" aside={canManage ? <ClientContactFormAction code={client.id} first={client.contacts.length === 0} /> : client.contacts.length ? String(client.contacts.length) : undefined} />
        {client.contacts.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">{client.rawKind === "empresa" ? "Agrega a las personas con las que coordinas por esta empresa." : "Sin contactos adicionales: se usa el correo y el teléfono del cliente."}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {client.contacts.map((contact) => (
              <li key={contact.id} className={cn("lift flex items-center gap-3 rounded-[12px] px-3.5 py-2.5 text-[13px]", SOFT_TINT)}>
                <span className="min-w-0 flex-1">
                  <b className="block font-semibold">
                    {contact.name}
                    {contact.is_primary && <span className="ml-1.5 text-[11.5px] font-medium text-[var(--tint)]">Principal</span>}
                  </b>
                  <span className="text-xs text-fg-3">{[contact.role, contact.email, contact.phone].filter(Boolean).join(" · ") || "Sin datos de contacto"}</span>
                </span>
                {canManage && <ClientContactRowActions code={client.id} contact={contact} />}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <TintCardTitle icon={FileText} title="Ficha" />
        <FieldList
          fields={[
            { label: "Tipo", value: client.kind },
            { label: "Documento", value: client.document },
            { label: "Correo", value: client.email || "—" },
            { label: "Teléfono", value: client.phone || "—" },
            { label: "Ubicación", value: [client.city, client.country].filter(Boolean).join(", ") || "—" },
            ...(client.birth ? [{ label: "Nacimiento", value: formatDate(client.birth) }] : []),
            { label: "Segmento", value: client.segment },
            { label: "Cliente desde", value: formatDate(client.createdAt) },
            { label: "Lead de origen", value: client.sourceLead ? <Link href={`/crm/leads/${client.sourceLead.code}`} className="hover:underline">{client.sourceLead.code}</Link> : "Alta directa" },
          ]}
        />
      </Card>
    </div>
  );
}

export function LeadsSection({ rows }: { rows: ClientTabData["leads"] }) {
  if (rows.length === 0) return <Empty icon={<Target size={20} />} title="Sin leads" description="No hay consultas registradas que se hayan convertido o asociado a este cliente." />;
  return (
    <Card>
      <TintCardTitle icon={Target} title="Leads" aside={String(rows.length)} />
      <MiniTable head={["Lead", "Fuente", "Interés", "Puntaje", "Estado"]} align={["left", "left", "left", "right", "left"]}>
        {rows.map((lead) => (
          <tr key={lead.code}>
            <td>
              <Link href={`/crm/leads/${lead.code}`} className="font-semibold hover:underline">
                {lead.full_name}
              </Link>
              <span className="block text-xs text-fg-3">
                {lead.code} · {formatDate(lead.created_at)}
              </span>
            </td>
            <td className="first-letter:uppercase">{lead.source_code ?? "—"}</td>
            <td>{[lead.interest_code, lead.destination_label].filter(Boolean).join(" · ") || "—"}</td>
            <td className="text-right tabular-nums">{lead.score ?? "—"}</td>
            <td>
              <StatusBadge status={lead.status} />
            </td>
          </tr>
        ))}
      </MiniTable>
    </Card>
  );
}

export function OpportunitiesSection({ rows, action }: { rows: ClientTabData["opportunities"]; action: ReactNode }) {
  return (
    <Card>
      <TintCardTitle icon={Target} title="Oportunidades" aside={action ?? (rows.length ? String(rows.length) : undefined)} />
      {rows.length === 0 ? (
        <p className="text-[13.5px] text-fg-3">No tiene oportunidades registradas.</p>
      ) : (
        <MiniTable head={["Oportunidad", "Monto", "Prob.", "Cierre", "Asesor", "Etapa"]} align={["left", "right", "right", "left", "left", "left"]}>
          {rows.map((opp) => (
            <tr key={opp.code}>
              <td>
                <Link href={`/crm/oportunidades/${opp.code}`} className="font-semibold hover:underline">
                  {opp.title}
                </Link>
                <span className="block text-xs text-fg-3">{opp.code}</span>
              </td>
              <td className="text-right font-mono">{opp.amount ? formatMoney(opp.amount, opp.currency) : "—"}</td>
              <td className="text-right tabular-nums">{opp.probability !== null ? `${opp.probability} %` : "—"}</td>
              <td className="whitespace-nowrap">{opp.closed_at ? `Cerrada ${formatDate(opp.closed_at)}` : opp.expected_close_date ? formatDate(opp.expected_close_date) : "—"}</td>
              <td>{opp.owner ?? "—"}</td>
              <td>
                <StatusBadge status={opp.stage} />
              </td>
            </tr>
          ))}
        </MiniTable>
      )}
    </Card>
  );
}

export function QuotesSection({ rows }: { rows: ClientTabData["quotes"] }) {
  if (rows.length === 0) return <Empty icon={<FileText size={20} />} title="Sin cotizaciones" description="Todavía no se le preparó ninguna propuesta." />;
  return (
    <Card>
      <TintCardTitle icon={FileText} title="Cotizaciones" aside={String(rows.length)} />
      <MiniTable head={["Cotización", "Versión", "Válida hasta", "Total", "Estado"]} align={["left", "right", "left", "right", "left"]}>
        {rows.map((quote) => (
          <tr key={quote.code}>
            <td>
              <Link href={`/cotizaciones/${quote.code}`} className="font-semibold hover:underline">
                {quote.title}
              </Link>
              <span className="block text-xs text-fg-3">{quote.code}</span>
            </td>
            <td className="text-right tabular-nums">{quote.version}</td>
            <td className="whitespace-nowrap">{formatDate(quote.valid_until)}</td>
            <td className="text-right font-mono">{quote.total ? formatMoney(quote.total, quote.currency) : "—"}</td>
            <td>
              <StatusBadge status={quote.status} />
            </td>
          </tr>
        ))}
      </MiniTable>
    </Card>
  );
}

export function ReservationsSection({ rows }: { rows: ClientTabData["reservations"] }) {
  if (rows.length === 0) return <Empty icon={<Route size={20} />} title="Sin reservas" description="Aún no tiene viajes reservados con la agencia." />;
  return (
    <Card>
      <TintCardTitle icon={Route} title="Reservas" aside={String(rows.length)} />
      <MiniTable head={["Reserva", "Fechas", "Canal", "Pax", "Total", "Pagado", "Estado"]} align={["left", "left", "left", "right", "right", "right", "left"]} minWidth={720}>
        {rows.map((reservation) => (
          <tr key={reservation.code}>
            <td>
              <Link href={`/reservas/${reservation.code}`} className="font-semibold hover:underline">
                {reservation.title}
              </Link>
              <span className="block text-xs text-fg-3">{reservation.code}</span>
            </td>
            <td className="whitespace-nowrap">
              {formatDate(reservation.travel_from).replace(/ \d{4}$/, "")} al {formatDate(reservation.travel_to)}
            </td>
            <td>{reservation.channel}</td>
            <td className="text-right tabular-nums">{reservation.pax}</td>
            <td className="text-right font-mono">{formatMoney(reservation.total, reservation.currency)}</td>
            <td className="text-right font-mono text-ok">{formatMoney(reservation.paid, reservation.currency)}</td>
            <td>
              <StatusBadge status={reservation.status} />
            </td>
          </tr>
        ))}
      </MiniTable>
    </Card>
  );
}

export function PassengersSection({ rows }: { rows: ClientTabData["passengers"] }) {
  if (rows.length === 0) return <Empty icon={<Users size={20} />} title="Sin pasajeros" description="Los pasajeros aparecen cuando el cliente tiene reservas confirmadas." />;
  return (
    <Card>
      <TintCardTitle icon={Users} title="Pasajeros" aside={String(rows.length)} />
      <MiniTable head={["Pasajero", "Documento", "Tipo", "Nacionalidad", "Nacimiento", "Observación", "Viajes"]} minWidth={760}>
        {rows.map((passenger) => (
          <tr key={`${passenger.name}-${passenger.document}`}>
            <td>
              <b className="block font-semibold">{passenger.name}</b>
              {passenger.relationship && <span className="text-xs text-fg-3">{passenger.relationship}</span>}
            </td>
            <td>{passenger.document ?? <span className="text-warn">Por completar</span>}</td>
            <td>{PAX_TYPE[passenger.pax_type] ?? passenger.pax_type}</td>
            <td>{passenger.nationality ?? "—"}</td>
            <td className="whitespace-nowrap">{passenger.birth_date ? formatDate(passenger.birth_date) : "—"}</td>
            <td className="text-xs">{passenger.notes ?? "—"}</td>
            <td className="text-xs">
              {passenger.reservations.map((code) => (
                <Link key={code} href={`/reservas/${code}`} className="block font-mono hover:underline">
                  {code}
                </Link>
              ))}
            </td>
          </tr>
        ))}
      </MiniTable>
    </Card>
  );
}

export function PaymentsSection({ receivables, payments }: { receivables: ClientTabData["receivables"]; payments: ClientTabData["payments"] }) {
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <TintCardTitle icon={Receipt} title="Cuentas por cobrar" aside={receivables.length ? String(receivables.length) : undefined} />
        {receivables.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">No tiene cuotas registradas.</p>
        ) : (
          <MiniTable head={["Cuota", "Reserva", "Vence", "Monto", "Pagado", "Saldo", "Estado"]} align={["left", "left", "left", "right", "right", "right", "left"]} minWidth={720}>
            {receivables.map((item) => {
              const balance = Number(item.amount) - Number(item.paid_amount);
              return (
                <tr key={item.code}>
                  <td>
                    <b className="block font-semibold">{item.concept}</b>
                    <span className="text-xs text-fg-3">{item.code}</span>
                  </td>
                  <td>
                    <Link href={`/reservas/${item.reservation}?seccion=pagos`} className="font-mono text-xs hover:underline">
                      {item.reservation}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">{formatDate(item.due_date)}</td>
                  <td className="text-right font-mono">{formatMoney(item.amount, item.currency)}</td>
                  <td className="text-right font-mono text-ok">{formatMoney(item.paid_amount, item.currency)}</td>
                  <td className={cn("text-right font-mono", balance > 0 && item.status === "vencida" && "text-bad")}>{formatMoney(balance, item.currency)}</td>
                  <td>
                    <StatusBadge status={item.status} />
                  </td>
                </tr>
              );
            })}
          </MiniTable>
        )}
      </Card>
      <Card>
        <TintCardTitle icon={Wallet} title="Pagos registrados" aside={payments.length ? String(payments.length) : undefined} />
        {payments.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">Todavía no hay pagos registrados.</p>
        ) : (
          <MiniTable head={["Pago", "Fecha", "Medio", "Reserva", "Monto", "Estado"]} align={["left", "left", "left", "left", "right", "left"]}>
            {payments.map((payment) => (
              <tr key={payment.code}>
                <td>
                  <b className="block font-semibold">{payment.code}</b>
                  {payment.reference && <span className="text-xs text-fg-3">Operación {payment.reference}</span>}
                </td>
                <td className="whitespace-nowrap">{formatDate(payment.paid_on)}</td>
                <td className="first-letter:uppercase">{payment.method.replaceAll("_", " ")}</td>
                <td className="font-mono text-xs">{payment.reservation}</td>
                <td className="text-right font-mono">{formatMoney(payment.amount, payment.currency)}</td>
                <td>
                  <StatusBadge status={payment.status} />
                </td>
              </tr>
            ))}
          </MiniTable>
        )}
      </Card>
    </div>
  );
}

export function DocumentsSection({ invoices, vouchers }: { invoices: ClientTabData["invoices"]; vouchers: ClientTabData["vouchers"] }) {
  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <Card>
        <TintCardTitle icon={Receipt} title="Comprobantes electrónicos" aside={invoices.length ? String(invoices.length) : undefined} />
        {invoices.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">No se le han emitido facturas, boletas ni notas de crédito.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {invoices.map((invoice) => (
              <li key={invoice.number} className="lift flex items-center gap-3 rounded-[12px] border border-line-2 px-3 py-2.5 text-[13px] hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <Link href={`/finanzas/facturacion/${invoice.number}`} className="block truncate font-semibold hover:underline">
                    {DOC_TYPE[invoice.doc_type] ?? "Comprobante"} {invoice.number}
                  </Link>
                  <span className="text-xs text-fg-3">
                    {formatDate(invoice.issue_date)}
                    {invoice.reservation && ` · ${invoice.reservation}`}
                  </span>
                </span>
                <span className="font-mono">{formatMoney(invoice.total_amount, invoice.currency)}</span>
                <StatusBadge status={invoice.status} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card>
        <TintCardTitle icon={TicketCheck} title="Vouchers" aside={vouchers.length ? String(vouchers.length) : undefined} />
        {vouchers.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">Los vouchers se emiten cuando el proveedor confirma cada servicio.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {vouchers.map((voucher) => (
              <li key={voucher.code} className="lift flex items-center gap-3 rounded-[12px] border border-line-2 px-3 py-2.5 text-[13px] hover:bg-surface-2">
                <span className="min-w-0 flex-1">
                  <b className="block truncate font-semibold">{voucher.service_label}</b>
                  <span className="text-xs text-fg-3">
                    {voucher.code} · {formatDate(voucher.service_date)} · {voucher.reservation}
                    {voucher.provider && ` · ${voucher.provider}`}
                  </span>
                </span>
                <StatusBadge status={voucher.status} />
                <DownloadButton href={`/operaciones/vouchers/${voucher.code}/pdf`} label={`Descargar voucher ${voucher.code}`} size="sm" variant="ghost" iconOnly />
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

export function CommunicationsSection({ rows, action }: { rows: ClientTabData["communications"]; action: ReactNode }) {
  return (
    <Card>
      <TintCardTitle icon={Mail} title="Comunicaciones" aside={action ?? (rows.length ? String(rows.length) : undefined)} />
      {rows.length === 0 ? (
        <p className="text-[13.5px] text-fg-3">No se le han enviado correos ni avisos desde la agencia.</p>
      ) : (
        <ul className="flex flex-col">
          {rows.map((message) => (
            <li key={message.code} className="flex items-start gap-3 border-t border-line-2 py-2.5 text-[13px] first:border-t-0">
              <span className="min-w-0 flex-1">
                <b className="block truncate font-semibold">{message.subject ?? message.event_code ?? "Mensaje"}</b>
                <span className="text-xs text-fg-3">
                  {message.channel === "email" ? "Correo" : message.channel === "whatsapp" ? "WhatsApp" : statusLabel(message.channel)}
                  {message.recipient_address && ` · ${message.recipient_address}`} · {formatDateTime(message.sent_at ?? message.created_at)}
                </span>
                {message.last_error && <span className="block text-xs text-bad">{message.last_error}</span>}
              </span>
              <StatusBadge status={message.status} />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

export function ActivitiesSection({ rows, action }: { rows: ClientTabData["activities"]; action?: ReactNode }) {
  if (rows.length === 0)
    return (
      <Card>
        <TintCardTitle icon={CalendarCheck} title="Actividades" aside={action} />
        <p className="text-[13.5px] text-fg-3">No hay llamadas, reuniones ni tareas ligadas al cliente, sus oportunidades o sus cotizaciones.</p>
      </Card>
    );
  return (
    <Card>
      <TintCardTitle icon={CalendarCheck} title="Actividades" aside={action} />
      <MiniTable head={["Actividad", "Tipo", "Fecha", "Responsable", "Estado"]}>
        {rows.map((activity) => (
          <tr key={activity.code}>
            <td>
              <b className="block font-semibold">{activity.subject}</b>
              <span className="text-xs text-fg-3">
                {activity.code} · {RELATED[activity.related_type] ?? activity.related_type}
              </span>
            </td>
            <td>{ACTIVITY_TYPE[activity.type] ?? activity.type}</td>
            <td className="whitespace-nowrap">{activity.due_at ? formatDateTime(activity.due_at) : "—"}</td>
            <td>{activity.owner ?? "—"}</td>
            <td>
              <StatusBadge status={activityState(activity)} />
            </td>
          </tr>
        ))}
      </MiniTable>
    </Card>
  );
}

const TIMELINE_TONE: Record<string, string> = { alta: "bg-t1", lead: "bg-violet", oportunidad: "bg-info", ganada: "bg-ok", perdida: "bg-bad", cotizacion: "bg-t4", aprobacion: "bg-ok", reserva: "bg-t1", pago: "bg-ok", encuesta: "bg-warn", caso: "bg-bad" };

export function HistorySection({ timeline, audit }: { timeline: ClientTabData["timeline"]; audit: ClientTabData["audit"] }) {
  return (
    <div className="flex flex-col gap-5">
      <Card>
        <TintCardTitle icon={History} title="Línea de tiempo" />
        <ol className="flex flex-col gap-3 border-l-2 border-line-2 pl-4">
          {timeline.map((event, index) => (
            <li key={`${event.code}-${event.kind}-${index}`} className="relative text-[13px]">
              <span className={cn("absolute -left-[22px] top-1 h-3 w-3 rounded-full ring-4 ring-surface", TIMELINE_TONE[event.kind] ?? "bg-fg-3")} />
              {event.href ? (
                <Link href={event.href} className="font-semibold hover:underline">
                  {event.title}
                </Link>
              ) : (
                <b className="font-semibold">{event.title}</b>
              )}
              <span className="block text-xs text-fg-3">{formatDateTime(event.at)}</span>
            </li>
          ))}
        </ol>
      </Card>
      <Card>
        <TintCardTitle icon={History} title="Auditoría" aside={audit.length ? `${audit.length} eventos` : undefined} />
        {audit.length === 0 ? (
          <p className="text-[13.5px] text-fg-3">Sin eventos de auditoría.</p>
        ) : (
          <MiniTable head={["Fecha", "Usuario", "Registro", "Acción", "Después"]} minWidth={620}>
            {audit.map((event) => (
              <tr key={event.id}>
                <td className="whitespace-nowrap text-xs">{formatDateTime(event.occurred_at)}</td>
                <td>{event.actor ?? (event.actor_type === "system" ? "Sistema" : "—")}</td>
                <td className="text-xs">
                  {event.entity}
                  <span className="block font-mono text-fg-3">{event.entity_id}</span>
                </td>
                <td className="font-semibold">{statusLabel(event.action.replaceAll("_", " "))}</td>
                <td className="max-w-[240px] whitespace-normal text-xs">{event.after ?? "—"}</td>
              </tr>
            ))}
          </MiniTable>
        )}
      </Card>
    </div>
  );
}
