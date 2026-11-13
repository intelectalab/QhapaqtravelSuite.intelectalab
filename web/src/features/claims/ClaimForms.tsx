"use client";

import { Archive, BellRing, Link2, Plus, Reply, Send, StickyNote, UserRound } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { claimStep, saveClaim } from "@/app/(backoffice)/crm/reclamaciones/actions";
import { RowIcon } from "@/components/table/RowActions";
import { Badge } from "@/components/ui/Badge";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { GuardianFields } from "@/features/claims/GuardianFields";
import { BOOK_STATUS_TONE, DEADLINE, DECISIONS, DOC_TYPES, type ClaimSheet, type ClaimsOverview } from "@/lib/claims";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";

const initial: StepResult = { message: null, done: false };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_1fr] gap-2 border-t border-line-2 py-2 text-[13px] first:border-t-0">
      <span className="text-fg-3">{label}</span>
      <span className="min-w-0">{children}</span>
    </div>
  );
}

function MinorConsumerFields() {
  const [minor, setMinor] = useState(false);
  return (
    <>
      <SwitchField label="El consumidor es menor de edad" name="is_minor" checked={minor} onCheckedChange={setMinor} hint="Se exigen el nombre y el documento del padre, madre o apoderado." />
      {minor && <GuardianFields />}
    </>
  );
}

function ConsentField() {
  const [accepted, setAccepted] = useState(false);
  return <SwitchField label="Acepta recibir la respuesta por correo" name="email_consent" checked={accepted} onCheckedChange={setAccepted} hint="Requisito legal: la constancia y la respuesta se envían al correo consignado." />;
}

function GuardianSummary({ sheet }: { sheet: ClaimSheet }) {
  const guardian = sheet.consumer.guardian;
  return (
    <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px]">
      <b>Menor de edad.</b> {guardian ? `${guardian.relation ?? "Apoderado"}: ${guardian.name ?? ""} · ${[guardian.doc_type, guardian.doc_number].filter(Boolean).join(" ")}` : "Sin datos del apoderado."}
    </p>
  );
}

export function ClaimFormAction({ overview, sheet }: { overview: ClaimsOverview; sheet?: ClaimSheet }) {
  const editable = !sheet || sheet.book_status === "received" || sheet.book_status === "in_review";
  return (
    <PanelAction<StepResult>
      label="Registrar hoja"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId={sheet ? `hoja-${sheet.code}` : "nueva-hoja"}
      title={sheet ? `Editar ${sheet.book_number}` : "Registrar hoja presencial"}
      description={sheet ? "Solo se edita mientras no tenga respuesta." : `El plazo legal de respuesta es de ${overview.settings.response_days} días hábiles desde hoy.`}
      submitLabel={sheet ? "Guardar cambios" : "Registrar hoja"}
      action={saveClaim}
      initial={initial}
      trigger={sheet ? (open) => <RowIcon tone="edit" label="Editar hoja" onClick={open} disabledHint={editable ? undefined : "La hoja ya fue respondida"} /> : undefined}
    >
      {() => (
        <>
          {sheet && <input type="hidden" name="code" value={sheet.code} />}
          {!sheet && <SelectField label="Sede" name="sede_id" options={overview.options.sedes} defaultValue={overview.options.sedes[0]?.value} />}
          <ChoiceGroup label="Tipo" name="type" options={[{ value: "reclamo", label: "Reclamo" }, { value: "queja", label: "Queja" }]} defaultValue={sheet?.type_code ?? "reclamo"} hint="Reclamo: disconformidad con el servicio. Queja: malestar con la atención." />
          <p className="text-[12.5px] font-semibold text-fg-3">Consumidor</p>
          {sheet && <p className="text-[12.5px] text-fg-3">Los datos del consumidor, el detalle y el pedido quedan tal como se registraron en la hoja: no se modifican.</p>}
          <TextField label="Nombre completo" name="consumer_name" required minLength={3} defaultValue={sheet?.consumer.name} readOnly={Boolean(sheet)} icon={<UserRound size={17} />} />
          <div className="grid grid-cols-[150px_1fr] gap-3">
            {sheet ? (
              <>
                <input type="hidden" name="consumer_doc_type" value={sheet.consumer.doc_type ?? ""} />
                <TextField label="Documento" defaultValue={DOC_TYPES.find((option) => option.value === sheet.consumer.doc_type)?.label ?? sheet.consumer.doc_type ?? ""} readOnly />
              </>
            ) : (
              <SelectField label="Documento" name="consumer_doc_type" options={DOC_TYPES} defaultValue="DNI" />
            )}
            <TextField label="Número" name="consumer_doc_number" required defaultValue={sheet?.consumer.doc_number ?? undefined} readOnly={Boolean(sheet)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Correo" name="consumer_email" type="email" required={!sheet} defaultValue={sheet?.consumer.email ?? undefined} readOnly={Boolean(sheet)} hint={sheet ? undefined : "Ahí se envía la constancia y la respuesta."} />
            <TextField label="Teléfono" name="consumer_phone" defaultValue={sheet?.consumer.phone ?? undefined} readOnly={Boolean(sheet)} />
          </div>
          <TextField label="Domicilio" name="consumer_address" required={!sheet} minLength={5} defaultValue={sheet?.consumer.address ?? undefined} readOnly={Boolean(sheet)} />
          {sheet ? sheet.consumer.is_minor && <GuardianSummary sheet={sheet} /> : <MinorConsumerFields />}
          <p className="text-[12.5px] font-semibold text-fg-3">Bien contratado</p>
          <ChoiceGroup label="Tipo de bien" name="good_kind" options={[{ value: "Servicio", label: "Servicio" }, { value: "Producto", label: "Producto" }]} defaultValue={sheet?.good?.kind ?? "Servicio"} />
          <TextField label="Descripción" name="good_description" required defaultValue={sheet?.good?.description} />
          <div className="grid grid-cols-[1fr_130px] gap-3">
            <TextField label="Monto reclamado" name="good_amount" type="number" step="0.01" min="0" defaultValue={sheet?.good ? String(sheet.good.amount) : undefined} />
            <ChoiceGroup label="Moneda" name="good_currency" options={[{ value: "PEN", label: "S/" }, { value: "USD", label: "US$" }]} defaultValue={sheet?.good?.currency ?? "PEN"} />
          </div>
          <TextArea label="Detalle" name="detail" rows={4} required minLength={20} defaultValue={sheet?.detail} readOnly={Boolean(sheet)} />
          <TextArea label="Pedido del consumidor" name="request" rows={2} required minLength={5} defaultValue={sheet?.request ?? undefined} readOnly={Boolean(sheet)} />
          <SelectField label="Cliente (opcional)" name="client" options={overview.options.clients} defaultValue={sheet?.client?.code ?? ""} placeholder="Vincular a un cliente" />
          <SelectField label="Reserva (opcional)" name="reservation" options={overview.options.reservations} defaultValue={sheet?.reservation ?? ""} placeholder="Vincular a una reserva" />
          {!sheet && <ConsentField />}
        </>
      )}
    </PanelAction>
  );
}

export function ClaimResendAction({ sheet }: { sheet: ClaimSheet }) {
  const ready = Boolean(sheet.response) && Boolean(sheet.consumer.email);
  return (
    <PanelAction<StepResult>
      label="Reenviar respuesta"
      formId={`reenviar-${sheet.code}`}
      title={`Reenviar la respuesta de ${sheet.book_number}`}
      description={sheet.consumer.email ? `Se vuelve a enviar a ${sheet.consumer.email} y queda en el historial.` : ""}
      submitLabel="Reenviar"
      action={claimStep}
      initial={initial}
      trigger={(open) => <RowIcon tone="edit" label="Reenviar respuesta" icon={<Send size={15} />} onClick={open} disabledHint={ready ? undefined : sheet.response ? "El consumidor no dejó correo" : "Primero responde la hoja"} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={sheet.code} />
          <input type="hidden" name="step" value="resend" />
        </>
      )}
    </PanelAction>
  );
}

export function ClaimDetailAction({ sheet, canManage, owners = [], respondNow = false }: { sheet: ClaimSheet; canManage: boolean; owners?: { value: string; label: string }[]; respondNow?: boolean }) {
  const step = !canManage ? null : respondNow || sheet.book_status === "in_review" ? "respond" : sheet.book_status === "received" ? "evaluate" : null;
  const deadline = DEADLINE[sheet.deadline];
  return (
    <PanelAction<StepResult>
      label={respondNow ? "Responder" : "Ver hoja"}
      formId={`${respondNow ? "responder" : "ver"}-${sheet.code}`}
      title={sheet.book_number}
      description={`${sheet.type} · ${sheet.sede ?? ""} · ${sheet.channel_label}`}
      submitLabel={step === "evaluate" ? "Pasar a evaluación" : step === "respond" ? "Enviar respuesta" : "Listo"}
      action={claimStep}
      initial={initial}
      trigger={(open) => (respondNow ? <RowIcon tone="edit" label="Responder sin pasar por evaluación" icon={<Reply size={15} />} onClick={open} /> : <RowIcon tone="view" label="Ver hoja" onClick={open} />)}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={sheet.code} />
          <input type="hidden" name="step" value={step ?? "view"} />
          <input type="hidden" name="lock_version" value={sheet.lock_version} />
          <div className="flex flex-wrap gap-2">
            <Badge tone={BOOK_STATUS_TONE[sheet.book_status]}>{sheet.book_status_label}</Badge>
            <Badge tone={deadline.tone} dot={false}>
              {deadline.label}
              {sheet.days_left !== null && !sheet.response && sheet.book_status !== "closed" ? ` · ${sheet.days_left >= 0 ? `${sheet.days_left} días hábiles` : `${Math.abs(sheet.days_left)} días de atraso`}` : ""}
            </Badge>
            <Link href={`/crm/reclamaciones/${encodeURIComponent(sheet.code)}`} className="ml-auto text-[12.5px] font-semibold text-accent hover:underline">
              Ver hoja completa y auditoría
            </Link>
          </div>
          <section className="rounded-xl bg-surface-2 px-3.5 py-1">
            <Row label="Consumidor">
              {sheet.consumer.name}
              {sheet.consumer.is_minor && <span className="ml-2 align-middle"><Badge tone="warn" dot={false}>Menor de edad</Badge></span>}
              <span className="block text-[12px] text-fg-3">{[sheet.consumer.doc_type, sheet.consumer.doc_number].filter(Boolean).join(" ")} · {sheet.consumer.email ?? sheet.consumer.phone ?? "sin contacto"}</span>
            </Row>
            {sheet.consumer.guardian && (
              <Row label={sheet.consumer.guardian.relation ?? "Apoderado"}>
                {sheet.consumer.guardian.name}
                <span className="block text-[12px] text-fg-3">{[sheet.consumer.guardian.doc_type, sheet.consumer.guardian.doc_number].filter(Boolean).join(" ")}</span>
              </Row>
            )}
            {sheet.consumer.address && <Row label="Domicilio">{sheet.consumer.address}</Row>}
            {sheet.good && <Row label="Bien">{sheet.good.description}{sheet.good.amount > 0 ? ` · ${formatMoney(sheet.good.amount, sheet.good.currency)}` : ""}</Row>}
            <Row label="Recibida">{formatDateTime(sheet.received_at)}</Row>
            {sheet.due_date && <Row label="Responder hasta">{formatDate(sheet.due_date)}</Row>}
            {sheet.client && <Row label="Cliente"><Link href={`/crm/clientes/${sheet.client.code}`} className="text-accent hover:underline">{sheet.client.name}</Link></Row>}
            {sheet.reservation && <Row label="Reserva"><Link href={`/reservas/${sheet.reservation}`} className="text-accent hover:underline">{sheet.reservation}</Link></Row>}
            {sheet.owner && <Row label="Responsable">{sheet.owner}</Row>}
          </section>
          <div>
            <p className="mb-1 text-[12.5px] font-semibold text-fg-3">Detalle</p>
            <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{sheet.detail}</p>
            {sheet.request && <p className="mt-2 text-[13px] text-fg-2"><b>Pedido:</b> {sheet.request}</p>}
          </div>
          {sheet.response && (
            <div className="rounded-xl border border-ok/30 bg-[color-mix(in_srgb,var(--ok)_7%,var(--surface))] px-3.5 py-3 text-[13px]">
              <p className="font-semibold text-ok">{sheet.response.decision}</p>
              <p className="mt-1 whitespace-pre-line">{sheet.response.text}</p>
              {sheet.response.actions && <p className="mt-1 text-fg-2">Acciones: {sheet.response.actions}</p>}
              {sheet.response.sent_at && <p className="mt-1 text-[12px] text-fg-3">Enviada {formatDateTime(sheet.response.sent_at)}{sheet.response.sent_to ? ` a ${sheet.response.sent_to}` : ""}</p>}
            </div>
          )}
          {sheet.close_note && <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px]"><b>Cierre:</b> {sheet.close_note}</p>}
          <ol className="flex flex-col gap-2 border-l-2 border-line pl-3.5">
            {sheet.log.map((entry) => (
              <li key={`${entry.at}-${entry.message}`} className="text-[12.5px]">
                <span className="font-semibold">{entry.message}</span>
                <span className="block text-fg-3">{entry.by} · {formatDateTime(entry.at)}</span>
              </li>
            ))}
          </ol>
          {step === "evaluate" && (
            <div className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3.5">
              <SelectField label="Responsable" name="owner_id" options={owners} placeholder="Yo mismo" hint="Recibe un aviso con el plazo de respuesta." />
              <TextArea label="Nota para el responsable (opcional)" name="note" rows={2} maxLength={500} />
            </div>
          )}
          {step === "respond" && (
            <div className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3.5">
              <ChoiceGroup label="Decisión" name="decision" options={DECISIONS} defaultValue="Procedente" />
              <TextArea label="Respuesta al consumidor" name="text" rows={5} required minLength={40} maxLength={4000} hint={sheet.consumer.email ? `Se envía a ${sheet.consumer.email}.` : "El consumidor no dejó correo: entrega la respuesta por otro medio."} />
              <TextArea label="Acciones adoptadas" name="actions" rows={2} required minLength={10} maxLength={1000} />
            </div>
          )}
        </>
      )}
    </PanelAction>
  );
}

export function ClaimAlertsAction({ pending }: { pending: number }) {
  return (
    <PanelAction<StepResult>
      label="Alertar vencimientos"
      icon={<BellRing size={15} />}
      size="sm"
      formId="alertar-vencimientos"
      title="Alertar vencimientos"
      description={pending > 0 ? `Avisa ahora al responsable de ${pending === 1 ? "1 hoja por vencer o vencida" : `${pending} hojas por vencer o vencidas`} y a la gerencia.` : "No hay hojas por vencer ni vencidas. Igual puedes correr la revisión."}
      submitLabel="Enviar avisos"
      action={claimStep}
      initial={initial}
    >
      {() => (
        <>
          <input type="hidden" name="step" value="alerts" />
          <input type="hidden" name="code" value="alertas" />
          <p className="text-[13px] text-fg-2">Es la misma revisión que corre cada día a las 08:00. Nadie recibe dos veces el mismo aviso en el día.</p>
        </>
      )}
    </PanelAction>
  );
}

export function ClaimNoteAction({ sheet, trigger }: { sheet: ClaimSheet; trigger?: (open: () => void) => React.ReactNode }) {
  return (
    <PanelAction<StepResult>
      label="Nota interna"
      icon={<StickyNote size={15} />}
      size="sm"
      formId={`nota-${sheet.code}`}
      title={`Nota interna en ${sheet.book_number}`}
      description="Queda en el historial de la hoja. No se envía al consumidor."
      submitLabel="Agregar nota"
      action={claimStep}
      initial={initial}
      trigger={trigger}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={sheet.code} />
          <input type="hidden" name="step" value="note" />
          <TextArea label="Nota" name="note" rows={3} required minLength={3} maxLength={1000} />
        </>
      )}
    </PanelAction>
  );
}

export function ClaimLinkAction({ sheet, overview, trigger }: { sheet: ClaimSheet; overview: ClaimsOverview; trigger?: (open: () => void) => React.ReactNode }) {
  const closed = sheet.book_status === "closed";
  return (
    <PanelAction<StepResult>
      label="Vincular"
      icon={<Link2 size={15} />}
      size="sm"
      formId={`vincular-${sheet.code}`}
      title={`Vincular ${sheet.book_number}`}
      description="Relaciona la hoja con el cliente y la reserva. Deja vacío para quitar el vínculo."
      submitLabel="Guardar vínculos"
      action={claimStep}
      initial={initial}
      trigger={trigger ?? ((open) => <RowIcon tone="neutral" label="Vincular cliente y reserva" icon={<Link2 size={15} />} onClick={open} disabledHint={closed ? "La hoja está cerrada" : undefined} />)}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={sheet.code} />
          <input type="hidden" name="step" value="links" />
          <SelectField label="Cliente" name="client" options={overview.options.clients} defaultValue={sheet.client?.code ?? ""} placeholder="Sin cliente" />
          <SelectField label="Reserva" name="reservation" options={overview.options.reservations} defaultValue={sheet.reservation ?? ""} placeholder="Sin reserva" hint="Si la reserva es de otro cliente, se rechaza." />
        </>
      )}
    </PanelAction>
  );
}

export function ClaimCloseAction({ sheet, reasons = [] }: { sheet: ClaimSheet; reasons?: { value: string; label: string }[] }) {
  return (
    <PanelAction<StepResult>
      label="Cerrar"
      formId={`cerrar-${sheet.code}`}
      title={`Cerrar ${sheet.book_number}`}
      description="La hoja se conserva en el libro; solo cambia a cerrada."
      submitLabel="Cerrar hoja"
      action={claimStep}
      initial={initial}
      trigger={(open) => <RowIcon tone="delete" label="Cerrar hoja" icon={<Archive size={15} />} onClick={open} disabledHint={sheet.book_status === "answered" ? undefined : sheet.book_status === "closed" ? "Ya está cerrada" : "Primero responde la hoja"} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={sheet.code} />
          <input type="hidden" name="step" value="close" />
          <input type="hidden" name="lock_version" value={sheet.lock_version} />
          {reasons.length > 0 ? (
            <>
              <SelectField label="Motivo del cierre" name="reason" options={reasons} defaultValue={reasons[0]?.value} />
              <TextArea label="Observación (opcional)" name="note" rows={2} maxLength={1000} placeholder="Por ejemplo: extorno confirmado el 12/11." />
            </>
          ) : (
            <TextArea label="Motivo del cierre" name="note" rows={3} required minLength={5} maxLength={1000} placeholder="Por ejemplo: extorno realizado y confirmado por el consumidor." />
          )}
        </>
      )}
    </PanelAction>
  );
}
