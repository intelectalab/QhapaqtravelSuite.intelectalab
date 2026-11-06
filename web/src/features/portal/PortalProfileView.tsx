"use client";

import { BookOpenCheck, Languages, Pencil, ShieldCheck, UserRound } from "lucide-react";
import { useState, useTransition } from "react";
import { FieldList } from "@/components/ui/Details";
import { PanelAction, type PanelActionState } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { setConsent, updateProfile } from "@/app/(portal)/portal/actions";
import { FormError } from "@/features/auth/AuthForms";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { CONSENT_CHANNELS, LOCALES, type PortalProfile } from "@/lib/portal";
import { EmptyLine, PortalBadge, PortalTitle, RISE, rise, SectionCard } from "./PortalUi";

const initial: PanelActionState = { message: null, done: false };

function EditProfile({ profile }: { profile: PortalProfile }) {
  const { client } = profile;
  return (
    <PanelAction label="Editar mis datos" icon={<Pencil size={15} />} title="Mis datos de contacto" description="Los usamos para enviarte confirmaciones, vouchers y avisos de tu viaje." submitLabel="Guardar cambios" action={updateProfile} initial={initial}>
      {() => (
        <>
          <TextField label="Correo de contacto" name="email" type="email" defaultValue={client.email ?? ""} maxLength={190} hint={`Para ingresar al portal sigues usando ${profile.login_email}.`} />
          <TextField label="Teléfono o WhatsApp" name="phone" defaultValue={client.phone ?? ""} maxLength={30} />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Ciudad" name="city" defaultValue={client.city ?? ""} maxLength={80} />
            <TextField label="País" name="country" defaultValue={client.country ?? ""} maxLength={60} />
          </div>
          <SelectField label="Idioma preferido" name="locale" defaultValue={profile.locale} options={LOCALES} />
        </>
      )}
    </PanelAction>
  );
}

function ConsentSwitch({ consent, disabled }: { consent: PortalProfile["consents"][number]; disabled: boolean }) {
  const [checked, setChecked] = useState(consent.granted);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const meta = CONSENT_CHANNELS[consent.channel];
  const change = (next: boolean) => {
    setChecked(next);
    setError(null);
    start(async () => {
      const result = await setConsent(consent.channel, next);
      if (!result.done) {
        setChecked(!next);
        setError(result.message);
      }
    });
  };
  return (
    <div className="lift rounded-tile border border-line bg-surface px-4 py-3.5">
      <SwitchField label={meta.label} name={`consent_${consent.channel}`} checked={checked} onCheckedChange={change} disabled={disabled || pending} hint={meta.hint} />
      <p className="mt-2 pl-14 text-[12px] text-fg-3">
        {consent.since ? `${consent.granted ? "Autorizado" : "Retirado"} el ${formatDate(consent.since)}${consent.source ? ` · ${consent.source}` : ""}` : "Sin autorización registrada"}
      </p>
      {error && (
        <div className="mt-2">
          <FormError message={error} />
        </div>
      )}
    </div>
  );
}

export function PortalProfileView({ profile }: { profile: PortalProfile }) {
  const { client } = profile;
  const locale = LOCALES.find((item) => item.value === profile.locale)?.label ?? profile.locale;
  return (
    <>
      <PortalTitle title="Mis datos" subtitle="Tu información de contacto, tus preferencias y tus autorizaciones." actions={profile.editable ? <EditProfile profile={profile} /> : undefined} />
      <div className="grid items-start gap-5 xl:grid-cols-2">
        <div className="flex flex-col gap-5">
          <SectionCard icon={UserRound} title="Datos personales">
            <FieldList
              fields={[
                { label: "Nombre", value: client.name },
                { label: "Documento", value: client.document ?? "—" },
                { label: "Correo", value: client.email ?? "—" },
                { label: "Teléfono", value: client.phone ?? "—" },
                { label: "Ciudad y país", value: [client.city, client.country].filter(Boolean).join(", ") || "—" },
                { label: "Fecha de nacimiento", value: client.birth_date ? formatDate(client.birth_date, "long") : "—" },
              ]}
            />
            {!profile.editable && <p className="mt-3 text-[12.5px] text-fg-3">Para cambiar estos datos, pide a quien hizo la reserva que los actualice o escríbenos.</p>}
          </SectionCard>
          <SectionCard icon={Languages} title="Preferencias">
            <FieldList
              fields={[
                { label: "Idioma", value: locale },
                { label: "Usuario del portal", value: profile.login_email },
              ]}
            />
          </SectionCard>
        </div>
        <div className="flex flex-col gap-5">
          <SectionCard icon={ShieldCheck} title="Autorizaciones de comunicación">
            <p className="mb-3 text-[13px] text-fg-2">Según la Ley 29733 de protección de datos personales, decides si quieres recibir promociones. Los avisos de tu viaje siempre te llegarán.</p>
            <div className="flex flex-col gap-2.5">
              {profile.consents.map((consent) => (
                <ConsentSwitch key={consent.channel} consent={consent} disabled={!profile.editable} />
              ))}
            </div>
          </SectionCard>
          {profile.editable && (
            <SectionCard icon={BookOpenCheck} title="Libro de reclamaciones" aside={profile.claims.length || undefined}>
              {profile.claims.length === 0 ? (
                <EmptyLine>No tienes reclamos ni quejas registrados.</EmptyLine>
              ) : (
                <ul className="flex flex-col gap-2">
                  {profile.claims.map((claim, index) => (
                    <li key={claim.code} style={rise(index)} className={cn("lift rounded-tile border border-line bg-surface px-3.5 py-3", RISE)}>
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <b className="block text-[13.5px] font-semibold">
                            {claim.type === "queja" ? "Queja" : "Reclamo"} {claim.number ?? claim.code}
                          </b>
                          <span className="text-[12px] text-fg-3">
                            {claim.received_at ? `Recibido el ${formatDate(claim.received_at)}` : ""}
                            {claim.due_date ? ` · respuesta hasta el ${formatDate(claim.due_date)}` : ""}
                          </span>
                        </span>
                        <PortalBadge status={claim.status} />
                      </div>
                      <p className="mt-1.5 line-clamp-2 text-[12.5px] text-fg-2">{claim.subject}</p>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[12px] text-fg-3">Atendemos cada hoja en el plazo de la Ley 29571. Para registrar una nueva, escríbenos desde Mensajes.</p>
            </SectionCard>
          )}
        </div>
      </div>
    </>
  );
}
