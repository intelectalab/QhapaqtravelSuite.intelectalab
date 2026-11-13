"use client";

import { Ban, CircleAlert, CircleCheck, CopyPlus, Eye, Handshake, MessagesSquare, RefreshCw, Send, ShieldCheck, ShieldQuestion, ThumbsUp, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { quoteStep, type QuoteStepState } from "@/app/(backoffice)/cotizaciones/actions";
import { RowIcon } from "@/components/table/RowActions";
import { Button } from "@/components/ui/Button";
import { ChipToggleGroup } from "@/components/ui/ChipToggleGroup";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { LockedButton } from "@/components/ui/ConsultMode";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
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
  { value: "Portal", label: "Publicar en el portal" },
];

function CheckRow({ ok, warn = false, title, detail }: { ok: boolean; warn?: boolean; title: string; detail: string }) {
  return (
    <li className={cn("flex items-start gap-2.5 rounded-xl px-3 py-2 text-[13px]", ok ? "bg-surface-2" : warn ? "bg-[color-mix(in_srgb,var(--warn)_10%,transparent)]" : "bg-[color-mix(in_srgb,var(--bad)_9%,transparent)]")}>
      <span className={cn("mt-0.5 flex-none", ok ? "text-ok" : warn ? "text-warn" : "text-bad")}>{ok ? <CircleCheck size={15} /> : <CircleAlert size={15} />}</span>
      <span className="min-w-0">
        <b className="block font-semibold">{title}</b>
        <span className="text-fg-3">{detail}</span>
      </span>
    </li>
  );
}

function NewVersionSwitch({ version }: { version: number }) {
  const [on, setOn] = useState(false);
  return <SwitchField label="Crear una nueva versión para ajustar" hint={`Se copia la versión ${version} como borrador para aplicar lo que pidió el cliente.`} name="new_version" checked={on} onCheckedChange={setOn} />;
}

function SendFields({ quote }: { quote: QuoteDetail }) {
  const internalOk = !quote.internal?.required || quote.internal.status === "aprobada";
  const valid = quote.days_left === null || quote.days_left >= 0;
  return (
    <>
      <ul className="flex flex-col gap-1.5" data-testid="quote-send-checklist">
        <CheckRow ok={internalOk} title="Versión validada" detail={internalOk ? `Versión ${quote.version} lista para el cliente.` : "Falta la aprobación de Gerencia por el descuento o el margen."} />
        <CheckRow ok title="Documento" detail={`Se comparte la propuesta de la versión ${quote.version} con su PDF.`} />
        <CheckRow ok title="Enlace con token" detail={quote.share?.active ? `Se usa el enlace activo, vigente hasta el ${formatDate(quote.share.expires_at ?? quote.valid_until)}.` : "Se crea al enviar y vence con la cotización."} />
        <CheckRow ok={valid} warn={!valid} title="Validez" detail={valid ? `Válida hasta el ${formatDate(quote.valid_until)}.` : "La validez ya pasó: se renueva al enviar el borrador."} />
      </ul>
      <ChipToggleGroup label="Canales" name="channels" options={SEND_CHANNELS} defaultValue={["Email"]} hint="Elige uno o varios. Se registra un envío por canal." />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Correo del cliente" name="recipient" type="email" defaultValue={quote.contact?.email ?? ""} maxLength={200} hint="Para el envío por correo." />
        <TextField label="Celular del cliente" name="phone" defaultValue={quote.contact?.phone ?? ""} maxLength={40} hint="Para el envío por WhatsApp." />
      </div>
      <TextArea label="Mensaje" name="message" rows={4} maxLength={2000} defaultValue={`Hola, te compartimos la propuesta «${quote.title}». Puedes revisarla en el enlace que va en este mensaje.`} />
    </>
  );
}

export function QuoteTokenAction({ code, lockVersion, regenerate }: { code: string; lockVersion: number; regenerate: boolean }) {
  const router = useRouter();
  return (
    <StepPanel
      code={code}
      step="token"
      lockVersion={lockVersion}
      label={regenerate ? "Regenerar enlace" : "Generar enlace"}
      icon={<RefreshCw size={15} />}
      title={regenerate ? "Regenerar el enlace seguro" : "Generar el enlace seguro"}
      description={regenerate ? "Se crea un enlace nuevo y el anterior deja de funcionar. Queda registrado en la actividad." : "Se crea un enlace que el cliente abre sin cuenta. Vence junto con la cotización."}
      submitLabel={regenerate ? "Regenerar" : "Generar"}
      trigger={(open) => (
        <Button size="sm" variant="ghost" icon={<RefreshCw size={14} />} onClick={open} data-testid="quote-token">
          {regenerate ? "Regenerar" : "Generar"}
        </Button>
      )}
      onDone={() => router.refresh()}
    />
  );
}

function ApproveFields({ quote }: { quote: QuoteDetail }) {
  const needsInternal = quote.internal?.required && quote.internal.status !== "aprobada";
  const [internal, setInternal] = useState(false);
  return (
    <>
      <TextField label="Quién aprobó" name="approved_by_name" required maxLength={150} placeholder="Nombre de la persona del cliente" />
      <SelectField label="Evidencia" name="channel" options={quote.evidence_types.map((value) => ({ value, label: value }))} placeholder="Elegir el tipo de evidencia" />
      <TextField label="Referencia" name="ref" required minLength={3} maxLength={200} placeholder="Asunto del correo, número de orden o fecha del mensaje" />
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
        <SendFields quote={quote} />
      </StepPanel>,
    );
  }

  if ((status === "borrador" || live) && !can.send) {
    actions.push(
      <LockedButton key="send-locked" reason="Requiere el permiso quotes.send" testId="quote-send-locked">
        {status === "borrador" ? "Enviar al cliente" : "Reenviar"}
      </LockedButton>,
    );
  } else if (status === "borrador" && blockedInternal && can.send) {
    actions.push(
      <LockedButton key="send-blocked" reason={`Bloqueada: requiere la aprobación de Gerencia${quote.margin_pct !== null ? ` (margen ${quote.margin_pct} %)` : ""}`} testId="quote-send-blocked">
        Enviar al cliente
      </LockedButton>,
    );
  }

  if (live && can.send) {
    actions.push(
      <StepPanel key="negotiate" code={code} lockVersion={quote.lock_version} step="negotiate" label="Registrar negociación" icon={<MessagesSquare size={16} />} compact title="Registrar negociación" description="Anota lo que pidió el cliente. La oportunidad pasa a negociación." submitLabel="Registrar">
        <ChoiceGroup label="Canal" name="channel" options={[{ value: "Llamada", label: "Llamada" }, { value: "Reunión", label: "Reunión" }, { value: "WhatsApp", label: "WhatsApp" }, { value: "Email", label: "Correo" }]} defaultValue="Llamada" />
        <TextArea label="Qué pidió" name="note" rows={4} required minLength={3} maxLength={1000} placeholder="Por ejemplo: quiere hotel 4 estrellas en Cusco y bajar el total." />
        {can.edit && <NewVersionSwitch version={quote.version} />}
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

  if (live && !can.register_approval) {
    actions.push(
      <LockedButton key="approve-locked" reason="Requiere el permiso reservations.create" testId="quote-approve-locked">
        Cliente aprobó
      </LockedButton>,
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

export function QuoteRecordViewAction({ code }: { code: string }) {
  return (
    <StepPanel code={code} step="view" label="Registrar vista" icon={<Eye size={16} />} title="Registrar que el cliente la vio" description="Úsalo cuando el cliente confirma por otro medio que revisó la propuesta. Si estaba enviada, pasa a vista." submitLabel="Registrar vista">
      <TextArea label="Cómo lo supiste (opcional)" name="note" rows={3} maxLength={300} placeholder="Ejemplo: lo confirmó por teléfono y pidió revisar el hotel en Cusco." />
    </StepPanel>
  );
}
