"use client";

import { KeyRound, LifeBuoy, MailPlus, PlugZap, RefreshCw, Unplug } from "lucide-react";
import { connectReviewSource, disconnectReviewSource, escalateExternalReview, inviteReservationReview, syncReviewSource } from "@/app/(backoffice)/canales/resenas/actions";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { CheckChips, FieldLabel } from "@/features/admin/AdminParts";
import type { ExternalReview, ReviewSourceAdmin } from "@/lib/channels";
import type { StepResult } from "@/lib/server/resource";
import { Stars } from "./ChannelUi";

const initial: StepResult = { message: null, done: false };

function ConnectAction({ source }: { source: ReviewSourceAdmin }) {
  return (
    <PanelAction<StepResult>
      label="Conectar"
      formId={`rv-connect-${source.provider}`}
      title={`Conectar ${source.label}`}
      description={source.priority ? "Se leen las reseñas por la API oficial de la plataforma, sin copiar páginas." : "Plataforma de fase posterior: queda pendiente hasta que la plataforma apruebe los permisos."}
      submitLabel="Conectar"
      action={connectReviewSource}
      initial={initial}
      trigger={(open) => <RowIcon tone="view" label={`Conectar ${source.label}`} icon={<PlugZap size={15} />} onClick={open} />}
    >
      {() => (
        <>
          <input type="hidden" name="provider" value={source.provider} />
          <TextField label="Cuenta o identificador del negocio" name="account" required minLength={3} maxLength={120} defaultValue={source.account ?? undefined} placeholder="Ej.: andes-travel.pe" />
          <TextField label="Clave o token de la plataforma" name="credential" type="password" required minLength={8} autoComplete="off" icon={<KeyRound size={16} />} hint="Nunca se vuelve a mostrar: solo se conservan sus últimos cuatro caracteres para reconocerla." />
          <div>
            <FieldLabel hint="Concede solo lo que vas a usar.">Alcances</FieldLabel>
            <CheckChips name="scopes" options={source.available_scopes.map((scope) => ({ value: scope, label: scope }))} defaultValues={source.available_scopes} />
          </div>
          <div>
            <FieldLabel hint="Requisito de cumplimiento RV-01.">Declaración de contrato</FieldLabel>
            <CheckChips name="contract_ack" options={[{ value: "1", label: "La agencia tiene contrato o aprobación de la plataforma para usar su API" }]} />
          </div>
        </>
      )}
    </PanelAction>
  );
}

function SyncAction({ source }: { source: ReviewSourceAdmin }) {
  return (
    <PanelAction<StepResult>
      label="Sincronizar"
      formId={`rv-sync-${source.provider}`}
      title={`Sincronizar ${source.label}`}
      description="Trae las reseñas nuevas o editadas desde la última sincronización. Las respuestas ya guardadas no se tocan."
      submitLabel="Sincronizar ahora"
      action={syncReviewSource}
      initial={initial}
      trigger={(open) => <RowIcon tone="neutral" label={`Sincronizar ${source.label}`} icon={<RefreshCw size={15} />} onClick={open} />}
    >
      {() => <input type="hidden" name="provider" value={source.provider} />}
    </PanelAction>
  );
}

function DisconnectAction({ source }: { source: ReviewSourceAdmin }) {
  return (
    <PanelAction<StepResult>
      label="Desconectar"
      formId={`rv-off-${source.provider}`}
      title={`Desconectar ${source.label}`}
      description="Se revoca el acceso y se elimina la credencial. Las reseñas ya traídas siguen en la bandeja."
      submitLabel="Desconectar"
      action={disconnectReviewSource}
      initial={initial}
      trigger={(open) => <RowIcon tone="delete" label={`Desconectar ${source.label}`} icon={<Unplug size={15} />} onClick={open} />}
    >
      {() => <input type="hidden" name="provider" value={source.provider} />}
    </PanelAction>
  );
}

export function ReviewSourceActions({ source }: { source: ReviewSourceAdmin }) {
  const linked = source.status === "conectado" || source.status === "error";
  return (
    <RowActions>
      {source.status === "no_conectado" || source.status === "error" ? <ConnectAction source={source} /> : null}
      {linked && <SyncAction source={source} />}
      {source.status !== "no_conectado" && <DisconnectAction source={source} />}
    </RowActions>
  );
}

export function InviteReservationAction() {
  return (
    <PanelAction<StepResult>
      label="Invitar a reseñar"
      icon={<MailPlus size={16} />}
      formId="rv-invite"
      title="Invitar a reseñar"
      description="Envía ahora la invitación de una reserva cuyo viaje ya terminó. Se invita a todos por igual, sin filtrar por satisfacción ni ofrecer incentivos."
      submitLabel="Enviar invitación"
      action={inviteReservationReview}
      initial={initial}
    >
      {() => (
        <>
          <TextField label="Código de la reserva" name="reservation" required placeholder="RES-2026-000348" />
          <ChoiceGroup label="Canal" name="channel" options={[{ value: "email", label: "Correo" }, { value: "whatsapp", label: "WhatsApp" }]} defaultValue="email" />
          <p className="text-[12.5px] text-fg-3">Requiere la regla de invitación a reseña activa en Reglas de reserva.</p>
        </>
      )}
    </PanelAction>
  );
}

export function EscalateReviewAction({ review }: { review: ExternalReview }) {
  return (
    <PanelAction<StepResult>
      label="Derivar a postventa"
      formId={`xrv-esc-${review.id}`}
      title="Derivar a postventa"
      description="Se abre una conversación en la bandeja para que postventa contacte al viajero. La reseña queda vinculada."
      submitLabel="Derivar"
      action={escalateExternalReview}
      initial={initial}
      trigger={(open) => <RowIcon tone="neutral" label="Derivar a postventa" icon={<LifeBuoy size={15} />} onClick={open} />}
    >
      {() => (
        <>
          <input type="hidden" name="id" value={review.id} />
          <blockquote className="rounded-tile border-l-2 border-bad bg-surface-2 px-3 py-2 text-[13px] text-fg-2">
            <Stars value={review.rating} size={12} className="mb-1" />
            {review.body}
          </blockquote>
          <TextArea label="Nota interna (opcional)" name="note" rows={3} maxLength={1000} placeholder="Qué revisar o con quién hablar" />
        </>
      )}
    </PanelAction>
  );
}
