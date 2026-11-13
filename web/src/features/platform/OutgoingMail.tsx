"use client";

import { AtSign, KeyRound, Lock, Send, Server } from "lucide-react";
import { useState } from "react";
import { saveOutgoingMail, sendOutgoingMailTest } from "@/app/plataforma/(consola)/configuracion/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldList } from "@/components/ui/Details";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { EditSection, SectionCard } from "@/features/admin/Settings";
import { ADMIN_INITIAL, type AdminActionState } from "@/lib/admin";
import { formatDateTime } from "@/lib/format";
import type { MailEncryption, OutgoingMailSummary } from "@/lib/platform";
import type { Tone } from "@/lib/tone";

const STATUS: Record<OutgoingMailSummary["status"], { label: string; tone: Tone }> = {
  activa: { label: "Activo", tone: "ok" },
  incompleta: { label: "Faltan datos", tone: "warn" },
  apagada: { label: "Apagado", tone: "mute" },
};

const ENCRYPTION: Record<MailEncryption, { label: string; port: number; hint: string }> = {
  ssl: { label: "SSL", port: 465, hint: "Conexión cifrada desde el inicio. Es lo habitual en cPanel." },
  tls: { label: "STARTTLS", port: 587, hint: "Empieza sin cifrar y se cifra antes de enviar la contraseña." },
  none: { label: "Sin cifrado", port: 25, hint: "Solo para servidores internos. La contraseña viaja sin protección." },
};

const OPTIONS = (Object.keys(ENCRYPTION) as MailEncryption[]).map((value) => ({ value, label: `${ENCRYPTION[value].label} · puerto ${ENCRYPTION[value].port}`, hint: ENCRYPTION[value].hint }));

function OutgoingMailFields({ mail }: { mail: OutgoingMailSummary }) {
  const [enabled, setEnabled] = useState(mail.enabled);
  const [encryption, setEncryption] = useState<MailEncryption>(mail.encryption);
  const [port, setPort] = useState(mail.port === null ? String(ENCRYPTION[mail.encryption].port) : String(mail.port));
  const choose = (next: string) => {
    const value = next as MailEncryption;
    if (Object.values(ENCRYPTION).some((option) => String(option.port) === port)) setPort(String(ENCRYPTION[value].port));
    setEncryption(value);
  };

  return (
    <>
      <SwitchField label="Enviar con esta cuenta" name="enabled" checked={enabled} onCheckedChange={setEnabled} hint="Apagado, los correos quedan en el registro del servidor y no salen." />
      <TextField label="Servidor de salida" name="host" required={enabled} defaultValue={mail.host} maxLength={190} autoComplete="off" spellCheck={false} placeholder="mail.tudominio.com" icon={<Server size={17} />} hint="En cPanel: Cuentas de correo → Conectar dispositivos → servidor saliente." />
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <SelectField label="Cifrado" name="encryption" options={OPTIONS} value={encryption} onChange={choose} hint={ENCRYPTION[encryption].hint} />
        <TextField label="Puerto" name="port" type="number" inputMode="numeric" min={1} max={65535} required={enabled} value={port} onChange={(event) => setPort(event.target.value)} />
      </div>
      <TextField label="Usuario" name="username" required={enabled} defaultValue={mail.username} maxLength={190} autoComplete="off" spellCheck={false} placeholder="avisos@tudominio.com" icon={<AtSign size={17} />} hint="Casi siempre es la dirección completa del buzón." />
      <TextField
        label="Contraseña"
        name="password"
        type="password"
        revealable
        maxLength={255}
        autoComplete="new-password"
        icon={<Lock size={17} />}
        placeholder={mail.password_set ? "Guardada. Déjala vacía para mantenerla." : "La contraseña del buzón"}
        hint="Se guarda cifrada y no se vuelve a mostrar. Al guardar probamos la conexión con el servidor."
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Remitente" name="from_address" type="email" required={enabled} defaultValue={mail.from_address} maxLength={190} placeholder="avisos@tudominio.com" hint="Debe ser el mismo buzón o uno que el servidor permita." />
        <TextField label="Nombre del remitente" name="from_name" defaultValue={mail.from_name} maxLength={120} placeholder="KipuControl" />
      </div>
      <div className="grid gap-3 border-t border-line-2 pt-4">
        <div>
          <p className="text-[13px] font-semibold text-fg">Acuses de entrega</p>
          <p className="mt-0.5 text-[12.5px] text-fg-2">Con estos secretos comprobamos la firma de los avisos de entrega, lectura y rebote que envían los proveedores. Las respuestas «BAJA» también llegan por aquí.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <WebhookSecretField label="Secreto del correo (SES)" name="ses_webhook_secret" saved={mail.webhook_secrets.ses} />
          <WebhookSecretField label="Secreto de push (FCM)" name="fcm_webhook_secret" saved={mail.webhook_secrets.fcm} />
        </div>
      </div>
    </>
  );
}

function WebhookSecretField({ label, name, saved }: { label: string; name: string; saved: boolean }) {
  return (
    <TextField
      label={label}
      name={name}
      type="password"
      revealable
      minLength={16}
      maxLength={255}
      autoComplete="new-password"
      icon={<KeyRound size={17} />}
      placeholder={saved ? "Guardado. Déjalo vacío para mantenerlo." : "Mínimo 16 caracteres"}
      hint="Se guarda cifrado y no se vuelve a mostrar."
    />
  );
}

function webhookStatus(secrets: OutgoingMailSummary["webhook_secrets"]) {
  if (secrets.ses && secrets.fcm) return "Correo y push configurados";
  if (secrets.ses) return "Correo configurado · push sin configurar";
  if (secrets.fcm) return "Push configurado · correo sin configurar";
  return "Sin configurar";
}

function TestMail({ mail }: { mail: OutgoingMailSummary }) {
  return (
    <PanelAction<AdminActionState>
      label="Enviar prueba"
      formId="settings-outgoing-mail-test"
      title="Enviar un correo de prueba"
      description="Lo enviamos en este momento con la cuenta guardada. Revisa también la carpeta de spam."
      submitLabel="Enviar prueba"
      action={sendOutgoingMailTest}
      initial={ADMIN_INITIAL}
      trigger={(open) => (
        <Button variant="secondary" size="sm" icon={<Send size={15} />} onClick={open}>
          Enviar prueba
        </Button>
      )}
    >
      {() => <TextField label="Enviar a" name="to" type="email" required defaultValue={mail.last_test?.to ?? ""} maxLength={190} placeholder="tu@correo.com" autoComplete="email" />}
    </PanelAction>
  );
}

export function OutgoingMailCard({ mail, version, index }: { mail: OutgoingMailSummary; version: number; index: number }) {
  const status = STATUS[mail.status];
  const test = mail.last_test;

  return (
    <SectionCard
      index={index}
      icon={Send}
      tone="t3"
      title="Correo de salida"
      action={
        <EditSection section="outgoing_mail" version={version} action={saveOutgoingMail} title="Correo de salida" description="La cuenta desde la que salen todos los correos de la plataforma: avisos a las agencias, invitaciones, recuperación de acceso, cotizaciones, comprobantes y reportes programados.">
          <OutgoingMailFields mail={mail} />
        </EditSection>
      }
    >
      <FieldList
        fields={[
          { label: "Estado", value: <Badge tone={status.tone}>{status.label}</Badge> },
          { label: "Remitente", value: mail.from_address ? (mail.from_name ? `${mail.from_name} · ${mail.from_address}` : mail.from_address) : "—" },
          { label: "Servidor", value: mail.host ? <span className="font-mono text-[12.5px]">{`${mail.host}:${mail.port ?? ENCRYPTION[mail.encryption].port} · ${ENCRYPTION[mail.encryption].label}`}</span> : "—" },
          { label: "Contraseña", value: mail.password_set ? "Guardada" : "Sin configurar" },
          { label: "Conexión probada", value: mail.verified_at ? formatDateTime(mail.verified_at) : "—" },
          { label: "Acuses de entrega", value: webhookStatus(mail.webhook_secrets) },
          ...(test ? [{ label: "Última prueba", value: <span className={test.ok ? "text-ok" : "text-bad"}>{`${test.ok ? "Enviada" : "Falló"} a ${test.to} · ${formatDateTime(test.at)}`}</span> }] : []),
        ]}
      />
      {mail.status === "activa" ? (
        <div className="mt-3 flex justify-end">
          <TestMail mail={mail} />
        </div>
      ) : (
        <p className="mt-3 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[12.5px] text-fg-2">Mientras esté apagado, nada falla: los correos se guardan en el registro del servidor y no salen.</p>
      )}
    </SectionCard>
  );
}
