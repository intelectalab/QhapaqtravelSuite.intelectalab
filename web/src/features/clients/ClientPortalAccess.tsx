"use client";

import { MailPlus, Send, ShieldOff } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { invitePortal, resendPortalInvitation, revokePortal, type ClientActionState } from "@/app/(backoffice)/crm/clientes/actions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { InfoTip } from "@/components/ui/InfoTip";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextArea } from "@/components/ui/TextArea";
import type { PortalAccess, PortalAccessStatus } from "@/lib/clients";
import { formatDateTime } from "@/lib/format";
import type { Tone } from "@/lib/tone";

const initial: ClientActionState = { message: null, done: false };

const STATUS: Record<PortalAccessStatus, { label: string; tone: Tone }> = {
  sin_acceso: { label: "Sin acceso", tone: "mute" },
  invitado: { label: "Invitado", tone: "warn" },
  activo: { label: "Activo", tone: "ok" },
  revocado: { label: "Revocado", tone: "bad" },
};

interface PortalClient {
  id: string;
  name: string;
  email: string;
  portalAccess: PortalAccess;
}

function summary(access: PortalAccess, email: string): string {
  if (access.status === "sin_acceso") return email ? "Aún no entra a su portal. Al invitarlo recibe un correo para crear su contraseña." : "Agrega su correo en los datos del cliente para invitarlo a su portal.";
  if (access.status === "invitado") return access.invitationExpired ? "La invitación venció sin que la aceptara. Reenvíale un enlace nuevo." : "Le enviamos la invitación y todavía no crea su contraseña.";
  if (access.status === "activo") return access.lastLoginAt ? "Entra a su portal con su correo y contraseña." : "Ya creó su contraseña y aún no ha ingresado.";
  return "Ya no puede entrar a su portal. Su usuario y su historial se conservan.";
}

function fields(access: PortalAccess): { label: string; value: ReactNode }[] {
  return [
    ...(access.email ? [{ label: "Correo de acceso", value: access.email }] : []),
    ...(access.invitedAt && access.status !== "activo" ? [{ label: "Invitado", value: formatDateTime(access.invitedAt) }] : []),
    ...(access.status === "invitado" && access.invitationExpiresAt ? [{ label: access.invitationExpired ? "Venció" : "Vence", value: formatDateTime(access.invitationExpiresAt) }] : []),
    ...(access.status !== "sin_acceso" ? [{ label: "Último ingreso", value: access.lastLoginAt ? formatDateTime(access.lastLoginAt) : "Nunca" }] : []),
    ...(access.revokedAt ? [{ label: "Revocado", value: formatDateTime(access.revokedAt) }] : []),
  ];
}

function InviteAction({ client, again }: { client: PortalClient; again: boolean }) {
  const router = useRouter();
  return (
    <PanelAction<ClientActionState>
      label={again ? "Invitar de nuevo" : "Invitar al portal"}
      icon={<Send size={15} />}
      size="sm"
      formId={`portal-invite-${client.id}`}
      title={again ? "Invitar de nuevo al portal" : "Invitar al portal"}
      description={`Enviaremos a ${client.email} un enlace para crear su contraseña. Vence en 72 horas.`}
      submitLabel="Enviar invitación"
      action={invitePortal}
      initial={initial}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={client.id} />
          <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">
            {client.name} verá sus propuestas, sus viajes, sus pagos y sus documentos. Nunca verá datos de otros clientes ni costos internos.
          </p>
        </>
      )}
    </PanelAction>
  );
}

function ResendAction({ client }: { client: PortalClient }) {
  const router = useRouter();
  return (
    <PanelAction<ClientActionState>
      label="Reenviar invitación"
      icon={<MailPlus size={15} />}
      size="sm"
      formId={`portal-resend-${client.id}`}
      title="Reenviar invitación"
      description={`Enviaremos un enlace nuevo a ${client.portalAccess.email ?? client.email}. El anterior deja de funcionar.`}
      submitLabel="Reenviar invitación"
      action={resendPortalInvitation}
      initial={initial}
      onDone={() => router.refresh()}
    >
      {() => <input type="hidden" name="code" value={client.id} />}
    </PanelAction>
  );
}

function RevokeAction({ client }: { client: PortalClient }) {
  const router = useRouter();
  return (
    <PanelAction<ClientActionState>
      label="Revocar acceso"
      icon={<ShieldOff size={15} />}
      variant="ghost"
      size="sm"
      formId={`portal-revoke-${client.id}`}
      title="Revocar acceso al portal"
      description={`${client.name} no podrá volver a entrar y sus sesiones abiertas se cierran. Su usuario y su historial se conservan; puedes invitarlo de nuevo cuando quieras.`}
      submitLabel="Revocar acceso"
      action={revokePortal}
      initial={initial}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={client.id} />
          <TextArea label="Motivo (opcional)" name="reason" rows={3} maxLength={300} placeholder="Por ejemplo: lo pidió el cliente o cambió de correo." />
        </>
      )}
    </PanelAction>
  );
}

export function ClientPortalAccessCard({ client, canManage }: { client: PortalClient; canManage: boolean }) {
  const access = client.portalAccess;
  const status = access.status === "invitado" && access.invitationExpired ? { label: "Invitación vencida", tone: "bad" as Tone } : STATUS[access.status];
  const canInvite = client.email !== "" && (access.status === "sin_acceso" || access.status === "revocado");

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-[15px] font-semibold">
          Acceso al portal
          <InfoTip label="Qué ve el cliente en su portal">
            En su portal el cliente aprueba o rechaza propuestas, revisa sus viajes, reporta pagos, descarga sus documentos y escribe a su asesor. Solo ve lo que es suyo.
          </InfoTip>
        </h3>
        <Badge tone={status.tone} testId="portal-access-status">
          {status.label}
        </Badge>
      </div>
      <p className="mb-2 text-[13px] text-fg-2">{summary(access, client.email)}</p>
      {fields(access).length > 0 && <FieldList fields={fields(access)} />}
      {canManage && (canInvite || access.status === "invitado" || access.status === "activo") && (
        <div className="mt-3 flex flex-wrap gap-2 border-t border-line-2 pt-3">
          {canInvite && <InviteAction client={client} again={access.status === "revocado"} />}
          {access.status === "invitado" && <ResendAction client={client} />}
          {(access.status === "invitado" || access.status === "activo") && <RevokeAction client={client} />}
        </div>
      )}
    </Card>
  );
}
