"use client";

import { BookOpenCheck, FileLock2, FileText, Languages, Pencil, Printer, ShieldCheck, UserRound } from "lucide-react";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { FieldList } from "@/components/ui/Details";
import { PanelAction, type PanelActionState } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SidePanel } from "@/components/ui/SidePanel";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { requestDataRights, setConsent, updateProfile } from "@/app/(portal)/portal/actions";
import { FormError } from "@/features/auth/AuthForms";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { ARCO_RIGHTS, CONSENT_CHANNELS, LOCALES, type PortalClaim, type PortalProfile } from "@/lib/portal";
import { EmptyLine, PortalBadge, PortalTitle, RISE, rise, SectionCard } from "./PortalUi";

const initial: PanelActionState = { message: null, done: false };

function ClaimReceipt({ claim }: { claim: PortalClaim }) {
  const [open, setOpen] = useState(false);
  const { receipt } = claim;
  const kind = claim.type === "queja" ? "Queja" : "Reclamo";
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12.5px] font-semibold text-t1 transition hover:bg-surface-2">
        <FileText size={14} /> Ver constancia
      </button>
      <SidePanel
        open={open}
        onOpenChange={setOpen}
        title={`Constancia ${claim.number ?? claim.code}`}
        description={`${kind} registrado${claim.received_at ? ` el ${formatDate(claim.received_at)}` : ""}`}
        footer={
          <Button variant="secondary" icon={<Printer size={15} />} onClick={() => window.print()}>
            Imprimir o guardar en PDF
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <FieldList
            fields={[
              { label: "Agencia", value: receipt.agency },
              { label: "Sede", value: receipt.sede ?? "—" },
              { label: "Tipo", value: kind },
              { label: "Respuesta hasta", value: claim.due_date ? `${formatDate(claim.due_date)}${receipt.response_days ? ` · ${receipt.response_days} días hábiles` : ""}` : "—" },
            ]}
          />
          <FieldList
            fields={[
              { label: "Consumidor", value: receipt.consumer.name ?? "—" },
              { label: "Documento", value: receipt.consumer.document ?? "—" },
              { label: "Correo", value: receipt.consumer.email ?? "—" },
              { label: "Bien contratado", value: [receipt.good.kind, receipt.good.description].filter(Boolean).join(" · ") || "—" },
              ...(receipt.good.amount ? [{ label: "Monto", value: formatMoney(receipt.good.amount, receipt.good.currency ?? "PEN") }] : []),
            ]}
          />
          <div>
            <b className="mb-1 block text-[12.5px] font-semibold text-fg-2">Detalle</b>
            <p className="whitespace-pre-line text-[13px] text-fg-2">{receipt.detail || "—"}</p>
          </div>
          <div>
            <b className="mb-1 block text-[12.5px] font-semibold text-fg-2">Pedido</b>
            <p className="whitespace-pre-line text-[13px] text-fg-2">{receipt.request || "—"}</p>
          </div>
        </div>
      </SidePanel>
    </>
  );
}

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

function DataRightsRequest() {
  return (
    <PanelAction label="Solicitar" icon={<FileLock2 size={15} />} size="sm" title="Ejercer mis derechos" description="La agencia responde en 10 días hábiles, o en 20 si pides acceso a tus datos. Te avisaremos por este portal." submitLabel="Enviar solicitud" action={requestDataRights} initial={initial} testId="arco-request">
      {() => (
        <>
          <SelectField label="¿Qué necesitas?" name="type" defaultValue="acceso" options={ARCO_RIGHTS} />
          <TextArea label="Cuéntanos tu pedido" name="detail" rows={5} minLength={10} maxLength={2000} required hint="Por ejemplo, qué dato corregir o para qué no quieres que se usen tus datos." />
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
            <SectionCard icon={FileLock2} title="Tus derechos sobre tus datos" aside={<DataRightsRequest />}>
              <p className="mb-3 text-[13px] text-fg-2">Puedes pedir acceso a tus datos, corregirlos, que los eliminemos o que dejemos de usarlos para algo. Lo que exige la ley, como tus comprobantes de pago, se conserva.</p>
              {profile.arco_requests.length === 0 ? (
                <EmptyLine>No has enviado solicitudes.</EmptyLine>
              ) : (
                <ul className="flex flex-col gap-2">
                  {profile.arco_requests.map((request, index) => (
                    <li key={request.code} style={rise(index)} className={cn("lift rounded-tile border border-line bg-surface px-3.5 py-3", RISE)}>
                      <div className="flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <b className="block text-[13.5px] font-semibold">{request.subject.replace("Solicitud ARCO · ", "")}</b>
                          <span className="text-[12px] text-fg-3">
                            Enviada el {formatDate(request.created_at)}
                            {request.due_date && request.status !== "resuelta" && request.status !== "cerrada" ? ` · respuesta hasta el ${formatDate(request.due_date)}` : ""}
                          </span>
                        </span>
                        <PortalBadge status={request.status} scope="message" />
                      </div>
                      {request.resolution && <p className="mt-1.5 text-[12.5px] text-fg-2">{request.resolution}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </SectionCard>
          )}
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
                      {claim.response && (
                        <div className="mt-2.5 rounded-tile border border-line bg-surface-2 px-3 py-2.5">
                          <span className="flex flex-wrap items-center gap-2 text-[12px] text-fg-3">
                            <b className="font-semibold text-fg-2">Respuesta de la agencia</b>
                            {claim.response.decision && <span className={cn("rounded-full px-2 py-0.5 text-[11.5px] font-semibold", claim.response.decision === "No procedente" ? "bg-bad/10 text-bad" : "bg-ok/10 text-ok")}>{claim.response.decision}</span>}
                            {claim.response.answered_at && <span>{formatDate(claim.response.answered_at)}</span>}
                          </span>
                          <p className="mt-1 whitespace-pre-line text-[12.5px] text-fg-2">{claim.response.text}</p>
                          {claim.response.actions && <p className="mt-1 text-[12px] text-fg-3">Acciones: {claim.response.actions}</p>}
                        </div>
                      )}
                      <div className="mt-2 flex justify-end">
                        <ClaimReceipt claim={claim} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <p className="mt-3 text-[12px] text-fg-3">
                Atendemos cada hoja en el plazo de la Ley 29571. Para registrar una nueva, usa el{" "}
                <a href={profile.claims_book} target="_blank" rel="noreferrer" className="font-semibold text-t1 hover:underline">Libro de Reclamaciones</a>.
              </p>
            </SectionCard>
          )}
        </div>
      </div>
    </>
  );
}
