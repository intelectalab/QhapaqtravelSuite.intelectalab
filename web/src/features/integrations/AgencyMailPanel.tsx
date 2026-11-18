"use client";

import { AtSign, KeyRound, Server, Unplug, UserRound } from "lucide-react";
import { useState, type ReactNode } from "react";
import { connectAgencyMail, disconnectAgencyMail } from "@/app/(backoffice)/admin/integraciones/correo-actions";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { ADMIN_INITIAL, type AdminActionState } from "@/lib/admin";
import type { AgencyMailSummary, MailProvider } from "@/lib/integrations";

const SHORT: Record<MailProvider, string> = { gmail: "Gmail", outlook: "Outlook", zoho: "Zoho", otro: "Otro" };

const ENCRYPTIONS = [
  { value: "ssl", label: "SSL · puerto 465" },
  { value: "tls", label: "STARTTLS · puerto 587" },
  { value: "none", label: "Sin cifrado · puerto 25" },
];

function MailFields({ mail }: { mail: AgencyMailSummary }) {
  const [provider, setProvider] = useState<MailProvider>(mail.provider ?? "gmail");
  const current = mail.providers.find((option) => option.value === provider) ?? mail.providers[0];
  const keepPassword = mail.password_set && mail.provider === provider;

  return (
    <>
      <ChoiceGroup label="¿Dónde está tu correo?" name="provider" options={mail.providers.map((option) => ({ value: option.value, label: SHORT[option.value] }))} defaultValue={provider} onChange={(value) => setProvider(value as MailProvider)} />
      <p className="-mt-2 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-fg-2" data-testid="mail-provider-help">
        <b className="font-semibold text-fg">{current?.label}.</b> {current?.help}
      </p>
      <TextField label="Tu correo" name="address" type="email" required defaultValue={mail.address} maxLength={150} autoComplete="off" spellCheck={false} placeholder="reservas@tuagencia.com" icon={<AtSign size={17} />} hint="Tus clientes verán este correo como remitente y te responderán ahí." />
      <TextField
        label="Clave de aplicación"
        name="password"
        type="password"
        revealable
        required={!keepPassword}
        maxLength={200}
        autoComplete="new-password"
        icon={<KeyRound size={17} />}
        placeholder={keepPassword ? "Guardada. Déjala vacía para mantenerla." : "La que generaste en tu proveedor"}
        hint="No es la contraseña con la que entras a tu correo. Se guarda cifrada y no se vuelve a mostrar."
      />
      <TextField label="Nombre del remitente" name="from_name" defaultValue={mail.from_name} maxLength={120} placeholder="Reservas Andes Travel" icon={<UserRound size={17} />} hint="Opcional. Si lo dejas vacío, se usa el nombre de tu agencia." />
      {provider === "otro" && (
        <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
          <TextField label="Servidor SMTP" name="host" required defaultValue={mail.host ?? ""} maxLength={150} spellCheck={false} placeholder="mail.tuagencia.com" icon={<Server size={17} />} />
          <TextField label="Puerto" name="port" type="number" inputMode="numeric" required defaultValue={String(mail.port ?? 465)} />
          <SelectField className="sm:col-span-2" label="Cifrado" name="encryption" options={ENCRYPTIONS} defaultValue={mail.encryption ?? "ssl"} />
        </div>
      )}
    </>
  );
}

export function AgencyMailPanel({ mail, trigger, defaultOpen = false }: { mail: AgencyMailSummary; trigger: (open: () => void) => ReactNode; defaultOpen?: boolean }) {
  return (
    <PanelAction<AdminActionState>
      label="Conectar correo"
      formId="agency-outgoing-mail"
      title={mail.status === "conectado" ? "Tu correo de salida" : "Conecta tu correo"}
      description="Las cotizaciones, vouchers y avisos que envías a tus clientes, pasajeros y proveedores salen desde tu propio correo. Al guardar te enviamos un correo de prueba para confirmar que la clave funciona."
      submitLabel={mail.status === "conectado" ? "Probar y guardar" : "Probar y conectar"}
      action={connectAgencyMail}
      initial={ADMIN_INITIAL}
      trigger={trigger}
      defaultOpen={defaultOpen}
      successToast="Tu correo quedó conectado. Revisa la bandeja: te enviamos un correo de prueba."
      testId="agency-mail-open"
    >
      {() => <MailFields mail={mail} />}
    </PanelAction>
  );
}

export function DisconnectAgencyMail({ address }: { address: string }) {
  return (
    <PanelAction<AdminActionState>
      label="Desconectar"
      formId="agency-outgoing-mail-off"
      title="Desconectar tu correo"
      description={`Desde ahora no saldrán correos a tus clientes desde ${address} hasta que conectes otro.`}
      submitLabel="Desconectar"
      action={disconnectAgencyMail}
      initial={ADMIN_INITIAL}
      successToast="Tu correo quedó desconectado."
      trigger={(open) => (
        <Button variant="ghost" size="sm" icon={<Unplug size={15} />} onClick={open}>
          Desconectar
        </Button>
      )}
    >
      {() => <p className="text-[13px] text-fg-2">La clave guardada se borra. Para volver a conectarlo tendrás que escribirla otra vez.</p>}
    </PanelAction>
  );
}
