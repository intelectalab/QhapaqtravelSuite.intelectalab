"use client";

import { CheckCircle2, Loader2, Send } from "lucide-react";
import Link from "next/link";
import { useActionState, useState, type ReactNode } from "react";
import { sendClaim, sendContact, sendLead } from "@/app/(sitio)/sitio/[agencia]/actions";
import { Captcha } from "@/components/ui/Captcha";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { formatDate, formatDateTime } from "@/lib/format";
import { IDLE, type Option, type SiteFormState } from "@/lib/site";
import { CheckBox, ChipGroup, Consent, FieldError, FormAlert } from "./FormBits";
import { Stepper } from "./SearchBar";
import { useSite } from "./SiteContext";

const INTERESTS = ["Cultura e historia", "Naturaleza", "Aventura", "Gastronomía", "Fotografía", "Bienestar", "Viaje en familia"].map((value) => ({ value, label: value }));

function Field({ children, error }: { children: ReactNode; error?: string }) {
  return (
    <div>
      {children}
      <FieldError message={error} />
    </div>
  );
}

function Submit({ pending, label }: { pending: boolean; label: string }) {
  return (
    <>
      <Captcha />
      <button type="submit" disabled={pending} className="inline-flex h-12 items-center justify-center gap-2 rounded-control bg-brand px-6 text-[15px] font-semibold text-brand-fg shadow-[0_10px_24px_-12px_var(--brand)] transition hover:-translate-y-0.5 hover:brightness-110 disabled:opacity-60">
        {pending ? <Loader2 size={17} className="animate-spin" /> : <Send size={16} />}
        {pending ? "Enviando…" : label}
      </button>
    </>
  );
}

export function Done({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-[color-mix(in_srgb,var(--ok)_30%,transparent)] bg-[color-mix(in_srgb,var(--ok)_7%,var(--surface))] p-6 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
      <CheckCircle2 size={28} className="text-ok" />
      <h2 className="mt-3 text-[20px] font-bold tracking-tight text-fg">{title}</h2>
      <div className="mt-2 text-[14px] leading-relaxed text-fg-2">{children}</div>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="rounded-card border border-line bg-surface p-5 shadow-card">
      <h2 className="text-[16px] font-semibold text-fg">{title}</h2>
      {hint && <p className="mt-0.5 text-[12.5px] text-fg-3">{hint}</p>}
      <div className="mt-4 grid gap-4">{children}</div>
    </section>
  );
}

function errorsOf(state: SiteFormState): Record<string, string> {
  return state.errors ?? {};
}

export function TailorMadeForm({ destinations, initial }: { destinations: Option[]; initial: { destino?: string; fecha?: string; viajeros?: string; producto?: string } }) {
  const { agencia, name, href } = useSite();
  const [state, action, pending] = useActionState(sendLead.bind(null, agencia), IDLE);
  const [adults, setAdults] = useState(Math.max(1, Number(initial.viajeros ?? 2)));
  const [children, setChildren] = useState(0);
  const [undefinedDates, setUndefinedDates] = useState(false);
  const errors = errorsOf(state);

  if (state.status === "done") {
    const sla = state.data?.sla_due_at as string | undefined;
    return (
      <Done title="Recibimos tu solicitud" action={<Link href={href("/tours")} className="inline-flex h-11 items-center rounded-control border border-line px-5 text-[14px] font-semibold text-fg transition hover:bg-surface-2">Ver tours mientras tanto</Link>}>
        <p>
          Tu código es <b className="text-fg">{String(state.data?.code)}</b>. Un asesor te escribirá con una propuesta {sla ? <>antes del <b className="text-fg">{formatDateTime(sla)}</b></> : "en las próximas 24 horas hábiles"}.
        </p>
      </Done>
    );
  }

  return (
    <form action={action} className="grid gap-6">
      {initial.producto && <input type="hidden" name="product" value={initial.producto} />}
      <Section title="Tu viaje" hint="Elige uno o varios destinos; armamos la ruta contigo.">
        <ChipGroup name="destinations" label="Destinos" options={destinations} defaultValue={initial.destino ? [initial.destino] : []} error={errors.destinations} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field error={errors.start_date}>
            <TextField label="Fecha de inicio" name="start_date" type="date" defaultValue={initial.fecha} disabled={undefinedDates} />
          </Field>
          <Field error={errors.end_date}>
            <TextField label="Fecha de regreso" name="end_date" type="date" disabled={undefinedDates} />
          </Field>
        </div>
        <CheckBox name="undefined_dates" label="Aún no defino las fechas" onChange={setUndefinedDates} />
        <SelectField label="Flexibilidad" name="flexibility" options={[{ value: "exactas", label: "Fechas exactas" }, { value: "3_dias", label: "± 3 días" }, { value: "semana", label: "± 1 semana" }, { value: "mes", label: "Cualquier fecha del mes" }]} defaultValue="3_dias" />
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex items-center justify-between rounded-control border border-line px-4 py-3">
            <span>
              <b className="block text-[13.5px] font-semibold text-fg">Adultos</b>
              <span className="text-[11.5px] text-fg-3">12 años o más</span>
            </span>
            <Stepper value={adults} min={1} max={40} onChange={setAdults} label="adulto" />
            <input type="hidden" name="adults" value={adults} />
          </div>
          <div className="flex items-center justify-between rounded-control border border-line px-4 py-3">
            <span>
              <b className="block text-[13.5px] font-semibold text-fg">Niños</b>
              <span className="text-[11.5px] text-fg-3">Menores de 12</span>
            </span>
            <Stepper value={children} min={0} max={20} onChange={setChildren} label="niño" />
            <input type="hidden" name="children" value={children} />
          </div>
        </div>
      </Section>

      <Section title="Preferencias" hint="Opcional: nos ayuda a acertar con la primera propuesta.">
        <ChipGroup name="interests" label="Intereses" options={INTERESTS} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field error={errors.budget}>
            <TextField label="Presupuesto por persona (US$)" name="budget" inputMode="numeric" placeholder="Ej. 1500" />
          </Field>
          <SelectField label="Hotel" name="hotel" placeholder="Sin preferencia" options={[{ value: "economico", label: "Económico" }, { value: "turista", label: "Turista (3 estrellas)" }, { value: "superior", label: "Superior (4 estrellas)" }, { value: "lujo", label: "Lujo (5 estrellas)" }, { value: "sin_hotel", label: "No necesito hotel" }]} />
        </div>
        <ChoiceGroup label="Tipo de servicio" name="service_mode" options={[{ value: "indistinto", label: "Indistinto" }, { value: "compartido", label: "Compartido" }, { value: "privado", label: "Privado" }]} defaultValue="indistinto" />
        <TextArea label="Cuéntanos más" name="comments" rows={4} placeholder="Ocasión especial, ritmo de viaje, restricciones alimentarias…" />
      </Section>

      <Section title="Tus datos">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field error={errors.name}>
            <TextField label="Nombres y apellidos" name="name" autoComplete="name" />
          </Field>
          <Field error={errors.email}>
            <TextField label="Correo electrónico" name="email" type="email" autoComplete="email" />
          </Field>
          <Field error={errors.phone}>
            <TextField label="Celular o WhatsApp" name="phone" type="tel" autoComplete="tel" />
          </Field>
          <TextField label="País" name="country" defaultValue="Perú" />
        </div>
        <ChoiceGroup label="¿Cómo prefieres que te contactemos?" name="preferred_contact" options={[{ value: "whatsapp", label: "WhatsApp" }, { value: "email", label: "Correo" }, { value: "llamada", label: "Llamada" }]} defaultValue="whatsapp" />
        <Consent agency={name} error={errors.consent} />
      </Section>

      {state.status === "error" && <FormAlert message={state.message} />}
      <Submit pending={pending} label="Enviar solicitud" />
    </form>
  );
}

export function ContactForm({ reasons }: { reasons: Option[] }) {
  const { agencia, name } = useSite();
  const [state, action, pending] = useActionState(sendContact.bind(null, agencia), IDLE);
  const [reason, setReason] = useState("cotizar");
  const errors = errorsOf(state);

  if (state.status === "done") {
    return (
      <Done title="Mensaje enviado">
        <p>
          Registramos tu consulta con el código <b className="text-fg">{String(state.data?.code)}</b>
          {state.data?.lead ? <> y una solicitud de cotización <b className="text-fg">{String(state.data.lead)}</b></> : null}. Te responderemos por correo en horario de oficina.
        </p>
      </Done>
    );
  }

  return (
    <form action={action} className="grid gap-4 rounded-card border border-line bg-surface p-5 shadow-card">
      <ChoiceGroup label="Motivo" name="reason" options={reasons} defaultValue="cotizar" onChange={setReason} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field error={errors.name}>
          <TextField label="Nombres y apellidos" name="name" autoComplete="name" />
        </Field>
        <Field error={errors.email}>
          <TextField label="Correo electrónico" name="email" type="email" autoComplete="email" />
        </Field>
        <Field error={errors.phone}>
          <TextField label="Celular (opcional)" name="phone" type="tel" autoComplete="tel" />
        </Field>
        {reason === "reserva" && (
          <TextField label="Código de reserva (opcional)" name="reservation" placeholder="RES-2026-…" />
        )}
      </div>
      <Field error={errors.message}>
        <TextArea label="Mensaje" name="message" rows={5} placeholder="Cuéntanos en qué te ayudamos." />
      </Field>
      <Consent agency={name} error={errors.consent} />
      {state.status === "error" && <FormAlert message={state.message} />}
      <div>
        <Submit pending={pending} label="Enviar mensaje" />
      </div>
    </form>
  );
}

export function ClaimForm({ sedes, responseDays }: { sedes: Option[]; responseDays: number }) {
  const { agencia } = useSite();
  const [state, action, pending] = useActionState(sendClaim.bind(null, agencia), IDLE);
  const [minor, setMinor] = useState(false);
  const errors = errorsOf(state);

  if (state.status === "done") {
    return (
      <Done title="Hoja de reclamación registrada">
        <p>
          Número de hoja <b className="text-fg">{String(state.data?.number)}</b>, registrada el {formatDateTime(String(state.data?.received_at))} en {String(state.data?.sede)}.
        </p>
        <p className="mt-2">
          Te responderemos a más tardar el <b className="text-fg">{formatDate(String(state.data?.due_date))}</b> ({responseDays} días hábiles). Enviamos la constancia a {String(state.data?.email)}.
        </p>
      </Done>
    );
  }

  return (
    <form action={action} className="grid gap-6">
      <Section title="1. Identificación del consumidor">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field error={errors.name}>
            <TextField label="Nombres y apellidos" name="name" autoComplete="name" />
          </Field>
          <div className="grid grid-cols-[130px_1fr] gap-2">
            <SelectField label="Documento" name="doc_type" options={[{ value: "DNI", label: "DNI" }, { value: "CE", label: "Carné ext." }, { value: "Pasaporte", label: "Pasaporte" }, { value: "RUC", label: "RUC" }]} defaultValue="DNI" />
            <Field error={errors.doc_number}>
              <TextField label="Número" name="doc_number" />
            </Field>
          </div>
          <Field error={errors.email}>
            <TextField label="Correo electrónico" name="email" type="email" autoComplete="email" />
          </Field>
          <Field error={errors.phone}>
            <TextField label="Teléfono" name="phone" type="tel" autoComplete="tel" />
          </Field>
          <div className="sm:col-span-2">
            <Field error={errors.address}>
              <TextField label="Domicilio" name="address" autoComplete="street-address" />
            </Field>
          </div>
        </div>
        <CheckBox name="minor" label="El consumidor es menor de edad (completa los datos del padre, madre o apoderado)" onChange={setMinor} />
        {minor && (
          <div className="grid gap-4 sm:grid-cols-2 animate-[rise-in_320ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
            <Field error={errors.guardian_name}>
              <TextField label="Nombre del apoderado" name="guardian_name" />
            </Field>
            <Field error={errors.guardian_doc}>
              <TextField label="Documento del apoderado" name="guardian_doc" />
            </Field>
          </div>
        )}
      </Section>

      <Section title="2. Bien contratado">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field error={errors.sede_id}>
            <SelectField label="Establecimiento" name="sede_id" options={sedes} placeholder="Elige la sede" />
          </Field>
          <ChoiceGroup label="Tipo de bien" name="good_kind" options={[{ value: "servicio", label: "Servicio" }, { value: "producto", label: "Producto" }]} defaultValue="servicio" />
          <div className="sm:col-span-2">
            <Field error={errors.good_description}>
              <TextField label="Descripción" name="good_description" placeholder="Ej. Tour Laguna Humantay del 10 de noviembre" />
            </Field>
          </div>
          <div className="grid grid-cols-[110px_1fr] gap-2">
            <SelectField label="Moneda" name="good_currency" options={[{ value: "PEN", label: "Soles" }, { value: "USD", label: "Dólares" }]} defaultValue="PEN" />
            <Field error={errors.good_amount}>
              <TextField label="Monto reclamado" name="good_amount" inputMode="decimal" />
            </Field>
          </div>
          <TextField label="Código de reserva (opcional)" name="reservation" placeholder="RES-2026-…" />
        </div>
      </Section>

      <Section title="3. Detalle de la reclamación" hint="Reclamo: disconformidad con el producto o servicio. Queja: malestar con la atención, sin relación directa con el servicio.">
        <ChoiceGroup label="Tipo" name="type" options={[{ value: "reclamo", label: "Reclamo" }, { value: "queja", label: "Queja" }]} defaultValue="reclamo" />
        <Field error={errors.detail}>
          <TextArea label="Detalle" name="detail" rows={5} placeholder="Describe lo ocurrido con fechas y personas involucradas." />
        </Field>
        <Field error={errors.request}>
          <TextArea label="Pedido del consumidor" name="request" rows={3} placeholder="¿Qué solicitas a la agencia?" />
        </Field>
      </Section>

      <div className="grid gap-3">
        <CheckBox name="declaration" error={errors.declaration} label="Declaro que la información es verdadera. La formulación del reclamo no impide acudir a otras vías de solución de controversias ni es requisito previo para interponer una denuncia ante el Indecopi." />
      </div>
      {state.status === "error" && <FormAlert message={state.message} />}
      <div>
        <Submit pending={pending} label="Registrar hoja de reclamación" />
      </div>
    </form>
  );
}
