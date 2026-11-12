"use client";

import { BadgeCheck, CalendarCheck, Clock, ImagePlus, Star } from "lucide-react";
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

const MAX_PHOTOS = 4;

function ReviewPhotos() {
  const [previews, setPreviews] = useState<{ name: string; url: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const onChange = (files: FileList | null) => {
    previews.forEach((preview) => URL.revokeObjectURL(preview.url));
    const list = [...(files ?? [])];
    setError(list.length > MAX_PHOTOS ? `Elige hasta ${MAX_PHOTOS} fotos; solo se enviarán las primeras.` : list.some((file) => file.size > 5 * 1024 * 1024) ? "Cada foto puede pesar hasta 5 MB." : null);
    setPreviews(list.slice(0, MAX_PHOTOS).map((file) => ({ name: file.name, url: URL.createObjectURL(file) })));
  };
  return (
    <div>
      <span className="mb-1.5 block text-[13px] font-semibold text-fg-2">Fotos de tu viaje</span>
      <label className="lift flex cursor-pointer items-center gap-3 rounded-tile border border-dashed border-line px-3.5 py-3 transition hover:bg-surface-2">
        <span className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-surface-2 text-t1">
          <ImagePlus size={17} />
        </span>
        <span className="min-w-0 flex-1 text-[13px]">
          <b className="block font-semibold">{previews.length > 0 ? `${previews.length} ${previews.length === 1 ? "foto elegida" : "fotos elegidas"}` : "Agregar fotos"}</b>
          <span className="text-[12px] text-fg-3">Opcional · hasta {MAX_PHOTOS} fotos JPG, PNG o WebP de 5 MB</span>
        </span>
        <input type="file" name="photos" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => onChange(event.target.files)} />
      </label>
      {previews.length > 0 && (
        <ul className="mt-2 grid grid-cols-4 gap-2">
          {previews.map((preview) => (
            <li key={preview.url} role="img" aria-label={preview.name} className="aspect-square rounded-xl border border-line bg-surface-2 bg-cover bg-center" style={{ backgroundImage: `url(${preview.url})` }} />
          ))}
        </ul>
      )}
      {error && <p className="mt-1.5 text-[12px] text-warn">{error}</p>}
    </div>
  );
}

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
      <ReviewPhotos />
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
