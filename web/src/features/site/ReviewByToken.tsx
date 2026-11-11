"use client";

import { BadgeCheck, CalendarCheck, Loader2, Send } from "lucide-react";
import { useActionState, useState } from "react";
import { sendTokenReview } from "@/app/(sitio)/sitio/[agencia]/actions";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { SelectField } from "@/components/ui/SelectField";
import { StarRating } from "@/components/ui/StarRating";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { formatDate } from "@/lib/format";
import { IDLE, type ReviewInvite } from "@/lib/site";
import { FieldError, FormAlert } from "./FormBits";
import { Done } from "./Forms";
import { useSite } from "./SiteContext";

const LANGUAGES = [
  { value: "es", label: "Español" },
  { value: "en", label: "Inglés" },
  { value: "pt", label: "Portugués" },
  { value: "fr", label: "Francés" },
  { value: "de", label: "Alemán" },
];

export function ReviewByTokenForm({ invite, token }: { invite: ReviewInvite; token: string }) {
  const { agencia } = useSite();
  const [state, action, pending] = useActionState(sendTokenReview.bind(null, agencia), IDLE);
  const [consent, setConsent] = useState(false);
  const eligible = invite.items.filter((item) => item.eligible);
  const errors = state.errors ?? {};

  if (state.status === "done") {
    const published = state.data?.status === "publicada";
    return (
      <Done title="Gracias por tu opinión">
        <p>{published ? "Tu reseña ya se muestra en el sitio con el sello «Viaje verificado»." : consent ? "La revisaremos en breve y la publicaremos con el sello «Viaje verificado»." : "Solo la leerá el equipo de la agencia para mejorar el servicio."}</p>
      </Done>
    );
  }

  if (eligible.length === 0) {
    return (
      <div className="rounded-card border border-line bg-surface p-6 text-[14px] text-fg-2 shadow-card">
        {invite.items.some((item) => item.review) ? "Ya calificaste los servicios de este viaje. Gracias." : (invite.items[0]?.reason ?? "Este viaje no tiene servicios para calificar.")}
      </div>
    );
  }

  return (
    <form action={action} className="grid gap-5 rounded-card border border-line bg-surface p-5 shadow-card sm:p-6">
      <input type="hidden" name="code" value={invite.code} />
      <input type="hidden" name="t" value={token} />
      {eligible.length > 1 ? (
        <ChoiceGroup label="¿Qué quieres calificar?" name="product" options={eligible.map((item) => ({ value: item.product.code, label: item.product.name }))} />
      ) : (
        <div className="flex items-center gap-3 rounded-tile bg-surface-2 px-4 py-3">
          <input type="hidden" name="product" value={eligible[0].product.code} />
          <CalendarCheck size={17} className="text-brand" />
          <span className="min-w-0">
            <b className="block text-[14px] font-semibold text-fg">{eligible[0].product.name}</b>
            <span className="text-[12.5px] text-fg-3">{formatDate(eligible[0].date, "long")}</span>
          </span>
        </div>
      )}
      <div>
        <StarRating label="¿Cómo calificas tu experiencia?" name="stars" required />
        <FieldError message={errors.stars} />
      </div>
      {invite.subratings.length > 0 && (
        <div className="grid gap-3 rounded-tile bg-surface-2 p-4 sm:grid-cols-2">
          {invite.subratings.map((sub) => (
            <StarRating key={sub.key} label={sub.label} name={`sub_${sub.key}`} size={18} hint="Opcional" />
          ))}
        </div>
      )}
      <div>
        <TextField label="Título" name="title" required minLength={3} maxLength={120} placeholder="Por ejemplo: Una caminata inolvidable" />
        <FieldError message={errors.title} />
      </div>
      <div>
        <TextArea label="Tu reseña" name="body" rows={6} required minLength={20} maxLength={2000} placeholder="Qué te gustó, cómo fue el guía, si lo recomendarías." />
        <FieldError message={errors.body} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField label="Idioma" name="lang" defaultValue="es" options={LANGUAGES} />
        <TextField label="País" name="country" maxLength={60} placeholder="Opcional" />
      </div>
      <SwitchField label="Autorizo publicar mi reseña" name="consent_publish" checked={consent} onCheckedChange={setConsent} hint="Se muestra con tu nombre y la inicial del apellido. Sin tu autorización solo la lee la agencia." />
      {state.status === "error" && <FormAlert message={state.message} />}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-3">
          <BadgeCheck size={14} className="text-ok" />
          Viaje verificado · el enlace vence el {formatDate(invite.expires_at)}
        </span>
        <button type="submit" disabled={pending} className="inline-flex h-12 items-center justify-center gap-2 rounded-control bg-brand px-6 text-[15px] font-semibold text-brand-fg shadow-[0_10px_24px_-12px_var(--brand)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60">
          {pending ? <Loader2 size={17} className="animate-spin" /> : <Send size={16} />}
          {pending ? "Enviando…" : "Enviar mi opinión"}
        </button>
      </div>
    </form>
  );
}
