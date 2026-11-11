"use client";

import { BadgeCheck, CalendarCheck, Clock, Star } from "lucide-react";
import { useState } from "react";
import { sendReview } from "@/app/(portal)/portal/actions";
import { Badge } from "@/components/ui/Badge";
import { PanelAction, type PanelActionState } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { StarRating } from "@/components/ui/StarRating";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { LOCALES, REVIEW_STATUS, type PaxReviewOverview } from "@/lib/portal";
import { PortalTitle, RISE, rise, SectionCard } from "./PortalUi";

const initial: PanelActionState = { message: null, done: false };

type Item = PaxReviewOverview["items"][number];

function ReviewFields({ data, item }: { data: PaxReviewOverview; item: Item }) {
  const [consent, setConsent] = useState(false);
  return (
    <>
      <input type="hidden" name="trip" value={data.trip.code} />
      <input type="hidden" name="product" value={item.product.code} />
      <StarRating label="¿Cómo calificas tu experiencia?" name="stars" required />
      {data.subratings.length > 0 && (
        <div className="grid gap-3 rounded-xl bg-surface-2 p-3.5 sm:grid-cols-2">
          {data.subratings.map((sub) => (
            <StarRating key={sub.key} label={sub.label} name={`sub_${sub.key}`} size={18} hint="Opcional" />
          ))}
        </div>
      )}
      <TextField label="Título" name="title" required minLength={3} maxLength={120} placeholder="Ejemplo: Una caminata inolvidable" />
      <TextArea label="Tu reseña" name="body" rows={6} required minLength={20} maxLength={2000} placeholder="Qué te gustó, cómo fue el guía, si lo recomendarías." />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Idioma" name="lang" defaultValue="es" options={LOCALES.filter((language) => ["es", "en", "de", "fr", "pt"].includes(language.value))} />
        <TextField label="País" name="country" maxLength={60} placeholder="Opcional" />
      </div>
      <SwitchField label="Autorizo publicar mi reseña" name="consent_publish" checked={consent} onCheckedChange={setConsent} hint="Se muestra con tu nombre y la inicial del apellido, con el sello «Viaje verificado». Sin tu autorización solo la lee la agencia." />
    </>
  );
}

function ReviewAction({ data, item }: { data: PaxReviewOverview; item: Item }) {
  return (
    <PanelAction label="Calificar" icon={<Star size={15} />} variant="primary" size="sm" title={`Califica ${item.product.name}`} description={`Servicio del ${formatDate(item.date)}`} submitLabel="Enviar reseña" action={sendReview} initial={initial}>
      {() => <ReviewFields data={data} item={item} />}
    </PanelAction>
  );
}

export function PassengerReviewView({ data }: { data: PaxReviewOverview }) {
  return (
    <>
      <PortalTitle title="Califica tu viaje" subtitle="Tu opinión ayuda a otros viajeros y a nosotros a mejorar. Solo los pasajeros del viaje pueden calificarlo." />
      <SectionCard icon={BadgeCheck} title={data.trip.title}>
        <ul className="flex flex-col gap-3">
          {data.items.map((item, index) => {
            const status = item.review ? REVIEW_STATUS[item.review.status] ?? { label: item.review.status, tone: "mute" as const } : null;
            return (
              <li key={item.product.code} style={rise(index)} className={cn("lift flex flex-wrap items-center justify-between gap-3 rounded-tile border border-line bg-surface px-4 py-3.5", RISE)}>
                <span className="min-w-0">
                  <b className="block text-[14px] font-semibold">{item.product.name}</b>
                  <span className="flex items-center gap-1.5 text-[12.5px] text-fg-3"><CalendarCheck size={13} />{formatDate(item.date)}</span>
                </span>
                {item.review ? (
                  <span className="flex items-center gap-2">
                    <span className="text-[13px] font-semibold text-t2">{"★".repeat(item.review.stars)}</span>
                    {status && <Badge tone={status.tone}>{status.label}</Badge>}
                  </span>
                ) : item.eligible ? (
                  <ReviewAction data={data} item={item} />
                ) : (
                  <span className="flex items-center gap-1.5 text-[12.5px] text-fg-3"><Clock size={13} />{item.reason}</span>
                )}
              </li>
            );
          })}
          {data.items.length === 0 && <li className="text-[13px] text-fg-3">Este viaje no tiene servicios para calificar.</li>}
        </ul>
      </SectionCard>
    </>
  );
}
