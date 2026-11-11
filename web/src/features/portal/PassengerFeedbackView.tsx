"use client";

import { BookOpenText, MessageSquareHeart, MessageSquarePlus, Reply } from "lucide-react";
import { useState } from "react";
import { sendFeedback } from "@/app/(portal)/portal/actions";
import { Badge } from "@/components/ui/Badge";
import { PanelAction, type PanelActionState } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { StarRating } from "@/components/ui/StarRating";
import { TextArea } from "@/components/ui/TextArea";
import { cn } from "@/lib/cn";
import { formatDate, formatDateTime } from "@/lib/format";
import { FEEDBACK_STATUS, type PaxFeedbackOverview } from "@/lib/portal";
import { EmptyLine, PortalTitle, RISE, rise, SectionCard } from "./PortalUi";

const initial: PanelActionState = { message: null, done: false };

function FeedbackFields({ data }: { data: PaxFeedbackOverview }) {
  const [type, setType] = useState("comentario");
  const escalated = type === "reclamo" || type === "incidencia";
  return (
    <>
      <input type="hidden" name="trip" value={data.trip.code} />
      <SelectField label="¿Qué quieres contarnos?" name="type" value={type} onChange={setType} options={data.types} hint="Reclamo o incidencia si algo salió mal y necesitas que lo atendamos." />
      {data.services.length > 0 && <SelectField label="Servicio relacionado" name="service" clearable placeholder="Todo el viaje" options={data.services.map((service) => ({ value: service.code, label: service.name, hint: formatDate(service.date) }))} />}
      <StarRating label="Calificación" name="rating" hint="Opcional" />
      <TextArea label="Tu comentario" name="text" rows={5} required minLength={5} maxLength={1000} placeholder={escalated ? "Cuéntanos qué pasó, dónde y a qué hora." : "Lo que más te gustó o lo que podríamos mejorar."} />
      {escalated && (
        <p className="rounded-xl bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-3.5 py-2.5 text-[12.5px] text-fg-2">
          Lo recibe {type === "incidencia" ? "el coordinador de tu viaje" : "tu asesor"} como un mensaje y te responde por Mensajes.
          {type === "reclamo" && (
            <>
              {" "}Si quieres registrar un reclamo formal, usa el{" "}
              <a href={data.claims_book} target="_blank" rel="noreferrer" className="font-semibold text-t1 underline">Libro de Reclamaciones</a>.
            </>
          )}
        </p>
      )}
    </>
  );
}

export function PassengerFeedbackView({ data }: { data: PaxFeedbackOverview }) {
  return (
    <>
      <PortalTitle
        title="Comentarios"
        subtitle={`Cuéntanos cómo va ${data.trip.title}. Leemos cada comentario.`}
        actions={
          <PanelAction label="Nuevo comentario" icon={<MessageSquarePlus size={16} />} variant="primary" title="Nuevo comentario" description={data.trip.title} submitLabel="Enviar" action={sendFeedback} initial={initial}>
            {() => <FeedbackFields data={data} />}
          </PanelAction>
        }
      />
      <SectionCard icon={MessageSquareHeart} title="Tus comentarios" aside={data.history.length || undefined}>
        {data.history.length === 0 ? (
          <EmptyLine>Todavía no enviaste comentarios sobre este viaje.</EmptyLine>
        ) : (
          <ul className="flex flex-col gap-3">
            {data.history.map((item, index) => {
              const status = FEEDBACK_STATUS[item.status] ?? { label: item.status, tone: "mute" as const };
              return (
                <li key={item.code} style={rise(index)} className={cn("lift rounded-tile border border-line bg-surface px-4 py-3.5", RISE)}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <span className="text-[13.5px]">
                      <b className="font-semibold">{item.type_label}</b>
                      <span className="text-fg-3"> · {item.service ?? "Todo el viaje"} · {formatDateTime(item.created_at)}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      {item.rating && <span className="text-[12.5px] font-semibold text-t2">{"★".repeat(item.rating)}</span>}
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </span>
                  </div>
                  <p className="mt-1.5 whitespace-pre-line text-[13.5px] text-fg-2">{item.text}</p>
                  {item.reply && (
                    <div className="mt-3 rounded-xl bg-[color-mix(in_srgb,var(--t1)_7%,var(--surface))] px-3.5 py-2.5 text-[13px]">
                      <span className="mb-0.5 flex items-center gap-1.5 font-semibold text-t1"><Reply size={13} />Respuesta de la agencia{item.replied_at ? ` · ${formatDateTime(item.replied_at)}` : ""}</span>
                      <p className="whitespace-pre-line text-fg-2">{item.reply}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-4 flex items-center gap-1.5 text-[12px] text-fg-3"><BookOpenText size={13} />¿Un reclamo formal? Usa el <a href={data.claims_book} target="_blank" rel="noreferrer" className="font-semibold text-t1 hover:underline">Libro de Reclamaciones</a>.</p>
      </SectionCard>
    </>
  );
}
