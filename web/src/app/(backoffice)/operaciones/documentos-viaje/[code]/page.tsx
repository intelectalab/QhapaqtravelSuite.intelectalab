import { BellRing, FileCheck2, HeartPulse, Phone, ShieldCheck, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { SOFT_TINT, TintCardTitle, TintTile, ToneScope } from "@/components/ui/Tinted";
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
  const attention = data.passengers.filter((passenger) => passenger.attention?.flag).length;

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
      />

      <section className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TintTile icon={ShieldCheck} tone="ok" label="Documentos completos" value={`${complete} de ${documents.length}`} />
        <TintTile icon={Users} tone="t1" label="Pasajeros" value={data.passengers.length} />
        <TintTile icon={Phone} tone="t4" label="Contactos de emergencia" value={`${contacts} de ${data.passengers.length}`} />
        <TintTile icon={HeartPulse} tone="violet" label="Atención especial" value={attention} note="Indicaciones operativas" />
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
                    {data.can.manage && <DocumentActions document={document} passenger={passenger.name} target={`${encodeURIComponent(data.code)}/travel-docs/${passenger.id}/${document.type}`} />}
                  </li>
                ))}
              </ul>
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
