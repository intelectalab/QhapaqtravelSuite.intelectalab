"use client";

import { Ban, CopyPlus, Handshake, MessagesSquare, Send, ShieldCheck, ShieldQuestion, ThumbsUp, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { quoteStep, type QuoteStepState } from "@/app/(backoffice)/cotizaciones/actions";
import { RowIcon } from "@/components/table/RowActions";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { formatMoney } from "@/lib/format";
import type { QuoteDetail } from "@/lib/quotes";

const initial: QuoteStepState = { message: null, done: false };

interface StepPanelProps {
  code: string;
  step: string;
  label: string;
  icon: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  title: string;
  description?: ReactNode;
  submitLabel: string;
  trigger?: (open: () => void) => ReactNode;
  compact?: boolean;
  onDone?: () => void;
  children?: ReactNode;
  lockVersion?: number;
  version?: number;
}

const STEP_TEST_IDS: Record<string, string> = {
  send: "quote-send",
  approve: "quote-register-client-approval",
  request: "quote-request-internal-approval",
  decide: "quote-internal-approve",
};

function StepPanel({ code, step, label, icon, variant = "secondary", title, description, submitLabel, trigger, compact = false, onDone, children, lockVersion, version }: StepPanelProps) {
  const compactTrigger = compact ? (open: () => void) => <Button iconOnly icon={icon} label={label} variant={variant} onClick={open} data-testid={STEP_TEST_IDS[step]} className="transition-transform duration-300 hover:-translate-y-0.5" /> : undefined;
  return (
    <PanelAction<QuoteStepState> label={label} icon={icon} variant={variant} formId={`quote-${step}-${code}`} title={title} description={description} submitLabel={submitLabel} action={quoteStep} initial={initial} trigger={trigger ?? compactTrigger} onDone={onDone} testId={STEP_TEST_IDS[step]}>
      {() => (
        <>
          <input type="hidden" name="code" value={code} />
          <input type="hidden" name="step" value={step} />
          {lockVersion !== undefined && <input type="hidden" name="lock_version" value={lockVersion} />}
          {version !== undefined && <input type="hidden" name="version" value={version} />}
          {children}
        </>
      )}
    </PanelAction>
  );
}

const SEND_CHANNELS = [
  { value: "Email", label: "Correo" },
  { value: "WhatsApp", label: "WhatsApp" },
  { value: "Portal", label: "Enlace del portal" },
];

function SendFields({ contact }: { contact: QuoteDetail["contact"] }) {
  const [channel, setChannel] = useState("Email");
  const recipient = channel === "Email" ? contact?.email : channel === "WhatsApp" ? contact?.phone : contact?.email;
  return (
    <>
      <ChoiceGroup label="Cómo se envía" name="channel" options={SEND_CHANNELS} defaultValue="Email" onChange={setChannel} />
      <TextField key={channel} label={channel === "WhatsApp" ? "Número" : "Correo del cliente"} name="recipient" required defaultValue={recipient ?? ""} maxLength={200} />
      <TextArea label="Mensaje (opcional)" name="message" rows={4} maxLength={2000} placeholder="Unas líneas para acompañar la propuesta." />
    </>
  );
}

function ApproveFields({ quote }: { quote: QuoteDetail }) {
  const needsInternal = quote.internal?.required && quote.internal.status !== "aprobada";
  const [internal, setInternal] = useState(false);
  return (
    <>
      <TextField label="Quién aprobó" name="approved_by_name" required maxLength={150} placeholder="Nombre de la persona del cliente" />
      <ChoiceGroup label="Por dónde" name="channel" options={[{ value: "WhatsApp", label: "WhatsApp" }, { value: "Email", label: "Correo" }, { value: "Llamada", label: "Llamada" }, { value: "Presencial", label: "En la oficina" }]} defaultValue="WhatsApp" />
      <TextField label="Referencia (opcional)" name="ref" maxLength={200} placeholder="Por ejemplo: mensaje del 5 de noviembre" />
      {needsInternal && quote.can.approve_internal && (
        <>
          <SwitchField label="Aprobar internamente en el mismo paso" hint="Por el descuento o el margen, esta versión necesita el visto bueno de Gerencia." name="internal_approval" checked={internal} onCheckedChange={setInternal} />
          {internal && <TextArea label="Nota de la aprobación interna" name="internal_note" rows={2} maxLength={500} />}
        </>
      )}
    </>
  );
}

export function QuoteDeleteAction({ code, title, redirect = false, iconOnly = false, compact = false }: { code: string; title: string; redirect?: boolean; iconOnly?: boolean; compact?: boolean }) {
  const router = useRouter();
  return (
    <StepPanel
      code={code}
      step="delete"
      label="Eliminar"
      icon={<Trash2 size={16} />}
      variant="secondary"
      compact={compact}
      title="Eliminar cotización"
      description={`${code} · ${title}. Dejará de verse en la lista; queda en la auditoría.`}
      submitLabel="Eliminar cotización"
      trigger={iconOnly ? (open) => <RowIcon tone="delete" label="Eliminar" onClick={open} /> : undefined}
      onDone={() => (redirect ? router.push("/cotizaciones") : router.refresh())}
    >
      <TextArea label="Motivo" name="reason" rows={3} required minLength={3} maxLength={500} placeholder="Por ejemplo: se duplicó por error." />
    </StepPanel>
  );
}

export function QuoteLifecycleActions({ quote }: { quote: QuoteDetail }) {
  const { status, internal, can, code } = quote;
  const live = ["enviada", "vista", "negociacion"].includes(status);
  const blockedInternal = internal?.required && internal.status !== "aprobada";
  const actions: ReactNode[] = [];

  if (status === "borrador" && blockedInternal && internal?.status !== "pendiente" && can.edit) {
    actions.push(
      <StepPanel key="request" code={code} lockVersion={quote.lock_version} step="request" label="Pedir aprobación" icon={<ShieldQuestion size={16} />} title="Pedir aprobación a Gerencia" description={`El descuento o el margen de esta versión necesita visto bueno antes de enviarla. Total: ${formatMoney(quote.total, quote.currency)}.`} submitLabel="Enviar solicitud">
        <TextArea label="Por qué se necesita" name="note" rows={3} required minLength={5} maxLength={500} placeholder="Por ejemplo: cliente frecuente que viaja con un grupo grande." />
      </StepPanel>,
    );
  }

  if (blockedInternal && can.approve_internal && (status === "borrador" || live)) {
    actions.push(
      <StepPanel key="decide" code={code} lockVersion={quote.lock_version} version={quote.version} step="decide" label="Decidir aprobación" icon={<ShieldCheck size={16} />} title="Aprobación interna" description={internal?.note ? `Pedido: ${internal.note}` : "Revisa el descuento y el margen antes de decidir."} submitLabel="Guardar decisión">
        <ChoiceGroup label="Decisión" name="decision" options={[{ value: "approve", label: "Aprobar" }, { value: "reject", label: "No aprobar" }]} defaultValue="approve" />
        <TextArea label="Nota" name="note" rows={3} maxLength={500} hint="Obligatoria si no se aprueba." />
      </StepPanel>,
    );
  }

  if ((status === "borrador" && !blockedInternal && can.send) || (live && can.send)) {
    actions.push(
      <StepPanel key="send" code={code} lockVersion={quote.lock_version} step="send" label={status === "borrador" ? "Enviar al cliente" : "Reenviar"} icon={<Send size={16} />} variant={status === "borrador" ? "primary" : "secondary"} compact={status !== "borrador"} title={status === "borrador" ? "Enviar al cliente" : "Reenviar la cotización"} description={status === "borrador" ? "La versión queda congelada: para cambiarla después se crea una nueva versión." : `Se reenvía la versión ${quote.version}.`} submitLabel="Enviar">
        <SendFields contact={quote.contact} />
      </StepPanel>,
    );
  }

  if (live && can.send) {
    actions.push(
      <StepPanel key="negotiate" code={code} lockVersion={quote.lock_version} step="negotiate" label="Registrar negociación" icon={<MessagesSquare size={16} />} compact title="Registrar negociación" description="Anota lo que pidió el cliente. La oportunidad pasa a negociación." submitLabel="Registrar">
        <ChoiceGroup label="Canal" name="channel" options={[{ value: "Llamada", label: "Llamada" }, { value: "Reunión", label: "Reunión" }, { value: "WhatsApp", label: "WhatsApp" }, { value: "Email", label: "Correo" }]} defaultValue="Llamada" />
        <TextArea label="Qué pidió" name="note" rows={4} required minLength={3} maxLength={1000} placeholder="Por ejemplo: quiere hotel 4 estrellas en Cusco y bajar el total." />
      </StepPanel>,
    );
  }

  if ((live || status === "vencida") && can.send) {
    actions.push(
      <StepPanel key="reject" code={code} lockVersion={quote.lock_version} step="reject" label="El cliente la rechazó" icon={<Ban size={16} />} compact title="El cliente la rechazó" description="La cotización se cierra. Si el cliente vuelve, crea una nueva versión." submitLabel="Marcar como rechazada">
        <TextArea label="Motivo" name="reason" rows={3} required minLength={3} maxLength={500} placeholder="Por ejemplo: eligió otra fecha o otra agencia." />
      </StepPanel>,
    );
  }

  if (status !== "borrador" && status !== "convertida" && can.edit) {
    actions.push(
      <StepPanel key="version" code={code} lockVersion={quote.lock_version} step="version" label="Nueva versión" icon={<CopyPlus size={16} />} compact title="Crear una nueva versión" description={`Se copia la versión ${quote.version} como borrador para ajustarla. La actual queda como reemplazada y la vigencia se renueva.`} submitLabel="Crear versión" />,
    );
  }

  if (!["aprobada", "convertida"].includes(status) && can.edit) {
    actions.push(<QuoteDeleteAction key="delete" code={code} title={quote.title} redirect compact />);
  }

  if (live && can.register_approval) {
    actions.push(
      <StepPanel key="approve" code={code} lockVersion={quote.lock_version} step="approve" label="Cliente aprobó" icon={<ThumbsUp size={16} />} variant="primary" title="Registrar aprobación del cliente" description={`Versión ${quote.version} · ${formatMoney(quote.total, quote.currency)}. Queda como evidencia con fecha y huella.`} submitLabel="Registrar aprobación">
        <ApproveFields quote={quote} />
      </StepPanel>,
    );
  }

  if (internal?.status === "pendiente" && !can.approve_internal) {
    actions.unshift(
      <span key="waiting" className="inline-flex h-10 items-center gap-2 rounded-control bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-3.5 text-[13px] font-semibold text-warn">
        <Handshake size={16} />
        Esperando a Gerencia
      </span>,
    );
  }

  return <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>;
}
