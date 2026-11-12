import { BellRing, CalendarX2, FileCheck2, FileWarning, HeartPulse, Phone, ShieldCheck, Ticket, TicketX, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SOFT_TINT, TintCardTitle, TintTile, ToneScope } from "@/components/ui/Tinted";
import { AttentionAction, ContactAction, RequestDocsAction } from "@/features/operations/TravelDocActions";
import { DocumentActions } from "@/features/operations/TravelDocs";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import type { TravelDocDetail } from "@/lib/operations";
import { PAX_TYPE } from "@/lib/reservations";
import { getResource } from "@/lib/server/resource";

const getChecklist = cache(async (code: string) => (await getResource<TravelDocDetail>(`/reservations/${encodeURIComponent(code)}/travel-docs`, "No pudimos cargar el checklist.")) ?? notFound());

export async function generateMetadata({ params }: PageProps<"/operaciones/documentos-viaje/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: `Documentos · ${(await getChecklist(code)).title}` };
}

export default async function DocumentosReservaPage({ params }: PageProps<"/operaciones/documentos-viaje/[code]">) {
  const { code } = await params;
  const data = await getChecklist(code);
  const documents = data.passengers.flatMap((passenger) => passenger.documents);
  const complete = documents.filter((document) => document.status === "completo").length;
  const contacts = data.passengers.filter((passenger) => passenger.contact).length;
  const passengerTarget = (id: string) => `${encodeURIComponent(data.code)}/travel-docs/${id}`;
  const attention = data.passengers.filter((passenger) => passenger.attention?.flag).length;
  const observed = documents.filter((document) => document.status === "observado").length;
  const expired = documents.filter((document) => document.status === "vencido").length;

  return (
    <ToneScope tone={complete === documents.length ? "ok" : "warn"}>
      <PageHeader
        back={{ href: "/operaciones/documentos-viaje", label: "Documentos de viaje" }}
        jump={false}
        leading={
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--tint)] text-white shadow-[0_10px_24px_-12px_var(--tint)]">
            <FileCheck2 size={24} />
          </span>
        }
        title={data.title}
        info={
          <span className="ml-2 flex-none">
            <StatusBadge status={data.status} />
          </span>
        }
        subtitle={
          <>
            <Link href={`/reservas/${data.code}`} className="hover:text-accent hover:underline">{data.code}</Link> · {data.client} · {formatDate(data.travel_from).replace(/ \d{4}$/, "")} al {formatDate(data.travel_to)}
          </>
        }
        actions={data.can.request ? <RequestDocsAction data={data} /> : undefined}
      />

      {data.mapi && !data.mapi.used && (
        <section className={cn("mb-5 flex items-start gap-3 rounded-tile border px-4 py-3", data.mapi.blocked ? "border-[color-mix(in_srgb,var(--bad)_35%,transparent)] bg-[color-mix(in_srgb,var(--bad)_7%,transparent)]" : "border-[color-mix(in_srgb,var(--ok)_35%,transparent)] bg-[color-mix(in_srgb,var(--ok)_7%,transparent)]")}>
          <span className={cn("grid h-9 w-9 flex-none place-items-center rounded-xl text-white", data.mapi.blocked ? "bg-bad" : "bg-ok")}>
            {data.mapi.blocked ? <TicketX size={17} /> : <Ticket size={17} />}
          </span>
          <div className="min-w-0 text-[13px]">
            <b className="block text-[14px] font-semibold">{data.mapi.blocked ? "Emisión de entradas nominativas bloqueada (DOC-BR-010)" : "Entradas nominativas listas para emitir"}</b>
            <span className="block text-fg-2">{data.mapi.services.map((service) => `${service.name} · ingreso ${formatDate(service.date)}`).join(" · ")}</span>
            {data.mapi.blocked && <span className="mt-1 block text-fg-3">Falta: {data.mapi.missing.map((person) => `${person.name} (${person.documents.join(", ")})`).join("; ")}</span>}
          </div>
        </section>
      )}

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3 2xl:grid-cols-6">
        <TintTile icon={ShieldCheck} tone="ok" label="Documentos completos" value={`${complete} de ${documents.length}`} info="Documentos que aplican a los pasajeros de la reserva y Operaciones ya validó. Los que no aplican por nacionalidad, edad o programa no se cuentan." />
        <TintTile icon={FileWarning} tone={observed > 0 ? "bad" : "ok"} label="Observados" value={observed} note={observed > 0 ? "Esperan corrección del cliente" : "Sin observaciones"} info="Documentos que Operaciones observó por ilegibles, datos incorrectos o archivo equivocado. El cliente recibe el motivo y debe volver a enviarlo." />
        <TintTile icon={CalendarX2} tone={expired > 0 ? "bad" : "ok"} label="Vencidos" value={expired} note="Vigencia insuficiente" info="Documentos cuya fecha de vencimiento no cubre el viaje con el margen que piden las reglas (por ejemplo, pasaporte con seis meses de vigencia)." />
        <TintTile icon={Users} tone="t1" label="Pasajeros" value={data.passengers.length} note={`${data.passengers.filter((passenger) => passenger.foreign).length} extranjeros`} info="Pasajeros registrados en la reserva. La nota cuenta a los extranjeros, que necesitan pasaporte con vigencia extendida y registro migratorio." />
        <TintTile icon={Phone} tone="t4" label="Contactos de emergencia" value={`${contacts} de ${data.passengers.length}`} info="Pasajeros con contacto de emergencia (nombre y teléfono). Es obligatorio para todos (DOC-BR-008)." />
        <TintTile icon={HeartPulse} tone="violet" label="Atención especial" value={attention} note="Indicaciones operativas" info="Pasajeros marcados con atención especial en la operación. Solo guarda la indicación operativa, sin datos clínicos." />
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="flex flex-col gap-4">
          {data.passengers.map((passenger, index) => (
            <div key={passenger.id} style={{ animationDelay: `${index * 60}ms` }} className="animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
            <Card>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <span>
                  <b className="text-[15px] font-semibold">{passenger.name}</b>
                  {passenger.is_lead && <span className="ml-1.5 text-[11.5px] font-medium text-[var(--tint)]">Titular</span>}
                  <span className="block text-xs text-fg-3">{[PAX_TYPE[passenger.pax_type] ?? passenger.pax_type, passenger.nationality].filter(Boolean).join(" · ")}</span>
                </span>
                <span className="text-[12.5px] text-fg-3">{passenger.documents.filter((document) => document.status === "completo").length} de {passenger.documents.length} completos</span>
              </div>
              <ul className="flex flex-col gap-1.5">
                {passenger.documents.map((document) => (
                  <li key={document.id} className={cn("flex items-center gap-3 rounded-[12px] px-3 py-2.5", SOFT_TINT)}>
                    <span className="min-w-0 flex-1">
                      <b className="block truncate text-[13.5px] font-semibold">{document.label}</b>
                      <span className={cn("block truncate text-xs", document.expires_before_return ? "font-semibold text-bad" : "text-fg-3")}>
                        {[document.number, document.expiry ? `vence ${formatDate(document.expiry)}` : null, document.file, document.validated_by ? `validó ${document.validated_by}` : null].filter(Boolean).join(" · ") || "Sin datos todavía"}
                      </span>
                      {(document.observation || document.note) && <span className="mt-0.5 block text-xs text-fg-2">{document.observation ?? document.note}</span>}
                    </span>
                    <StatusBadge status={document.status} />
                    {data.can.manage && <DocumentActions document={document} passenger={passenger.name} target={`${passengerTarget(passenger.id)}/${document.type}`} fileHref={`/operaciones/documentos-viaje/${encodeURIComponent(data.code)}/archivo/${passenger.id}/${document.type}`} />}
                  </li>
                ))}
              </ul>
              {passenger.not_applicable.length > 0 && <p className="mt-2 text-xs text-fg-3">No aplica: {passenger.not_applicable.join(" · ")}</p>}
              {data.can.manage && (
                <div className="mt-3 flex flex-wrap gap-2">
                  <ContactAction passenger={passenger} relations={data.relations} target={passengerTarget(passenger.id)} />
                  <AttentionAction passenger={passenger} target={passengerTarget(passenger.id)} />
                </div>
              )}
              {!passenger.contact && <p className="mt-3 text-[12.5px] font-medium text-warn">Falta el contacto de emergencia.</p>}
              {(passenger.contact || passenger.attention?.note) && (
                <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-fg-2">
                  {passenger.contact && (
                    <span className="inline-flex items-center gap-1.5">
                      <Phone size={13} className="text-[var(--tint)]" />
                      {passenger.contact.name} ({passenger.contact.relation.toLowerCase()}) · {passenger.contact.phone}
                    </span>
                  )}
                  {passenger.attention?.note && (
                    <span className={cn("inline-flex items-center gap-1.5", passenger.attention.flag && "font-semibold text-fg")}>
                      <HeartPulse size={13} className="text-[var(--violet)]" />
                      {passenger.attention.note}
                    </span>
                  )}
                </p>
              )}
            </Card>
            </div>
          ))}
        </div>

        <Card>
          <TintCardTitle icon={BellRing} title="Recordatorios enviados" aside={String(data.reminders.length)} />
          {data.reminders.length === 0 ? (
            <p className="text-[13.5px] text-fg-3">Todavía no se enviaron recordatorios para esta reserva.</p>
          ) : (
            <ol className="flex flex-col gap-3 border-l-2 border-line pl-5">
              {data.reminders.map((reminder) => (
                <li key={reminder.at} className="relative">
                  <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-[var(--tint)] ring-4 ring-surface" />
                  <p className="text-[13.5px]">
                    {reminder.trigger === "auto" ? `Recordatorio automático${reminder.days_before ? ` a ${reminder.days_before} días` : ""}` : "Solicitud manual"} por {reminder.channel}
                    {reminder.items > 0 && <span className="text-fg-3"> · {reminder.items === 1 ? "1 documento" : `${reminder.items} documentos`}</span>}
                  </p>
                  <p className="text-xs text-fg-3">
                    {reminder.to} · {reminder.by ?? "Sistema"} · {formatDateTime(reminder.at, false)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </ToneScope>
  );
}
