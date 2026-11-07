"use client";

import { Archive, Plus, UserRound } from "lucide-react";
import Link from "next/link";
import { claimStep, saveClaim } from "@/app/(backoffice)/crm/reclamaciones/actions";
import { RowIcon } from "@/components/table/RowActions";
import { Badge } from "@/components/ui/Badge";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
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
          <TextField label="Nombre completo" name="consumer_name" required minLength={3} defaultValue={sheet?.consumer.name} icon={<UserRound size={17} />} />
          <div className="grid grid-cols-[150px_1fr] gap-3">
            <SelectField label="Documento" name="consumer_doc_type" options={DOC_TYPES} defaultValue={sheet?.consumer.doc_type ?? "DNI"} />
            <TextField label="Número" name="consumer_doc_number" required defaultValue={sheet?.consumer.doc_number ?? undefined} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Correo" name="consumer_email" type="email" defaultValue={sheet?.consumer.email ?? undefined} hint="Ahí se envía la constancia y la respuesta." />
            <TextField label="Teléfono" name="consumer_phone" defaultValue={sheet?.consumer.phone ?? undefined} />
          </div>
          <TextField label="Dirección" name="consumer_address" defaultValue={sheet?.consumer.address ?? undefined} />
          <p className="text-[12.5px] font-semibold text-fg-3">Bien contratado</p>
          <ChoiceGroup label="Tipo de bien" name="good_kind" options={[{ value: "Servicio", label: "Servicio" }, { value: "Producto", label: "Producto" }]} defaultValue={sheet?.good?.kind ?? "Servicio"} />
          <TextField label="Descripción" name="good_description" required defaultValue={sheet?.good?.description} />
          <div className="grid grid-cols-[1fr_130px] gap-3">
            <TextField label="Monto reclamado" name="good_amount" type="number" step="0.01" min="0" defaultValue={sheet?.good ? String(sheet.good.amount) : undefined} />
            <ChoiceGroup label="Moneda" name="good_currency" options={[{ value: "PEN", label: "S/" }, { value: "USD", label: "US$" }]} defaultValue={sheet?.good?.currency ?? "PEN"} />
          </div>
          <TextArea label="Detalle" name="detail" rows={4} required minLength={10} defaultValue={sheet?.detail} />
          <TextArea label="Pedido del consumidor" name="request" rows={2} required minLength={5} defaultValue={sheet?.request ?? undefined} />
          <SelectField label="Cliente (opcional)" name="client" options={overview.options.clients} defaultValue={sheet?.client?.code ?? ""} placeholder="Vincular a un cliente" />
          <SelectField label="Reserva (opcional)" name="reservation" options={overview.options.reservations} defaultValue={sheet?.reservation ?? ""} placeholder="Vincular a una reserva" />
        </>
      )}
    </PanelAction>
  );
}

export function ClaimDetailAction({ sheet, canManage }: { sheet: ClaimSheet; canManage: boolean }) {
  const step = !canManage ? null : sheet.book_status === "received" ? "evaluate" : sheet.book_status === "in_review" ? "respond" : null;
  const deadline = DEADLINE[sheet.deadline];
  return (
    <PanelAction<StepResult>
      label="Ver hoja"
      formId={`ver-${sheet.code}`}
      title={sheet.book_number}
      description={`${sheet.type} · ${sheet.sede ?? ""} · ${sheet.channel_label}`}
      submitLabel={step === "evaluate" ? "Pasar a evaluación" : step === "respond" ? "Enviar respuesta" : "Listo"}
      action={claimStep}
      initial={initial}
      trigger={(open) => <RowIcon tone="view" label="Ver hoja" onClick={open} />}
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
          </div>
          <section className="rounded-xl bg-surface-2 px-3.5 py-1">
            <Row label="Consumidor">
              {sheet.consumer.name}
              <span className="block text-[12px] text-fg-3">{[sheet.consumer.doc_type, sheet.consumer.doc_number].filter(Boolean).join(" ")} · {sheet.consumer.email ?? sheet.consumer.phone ?? "sin contacto"}</span>
            </Row>
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
          {step === "respond" && (
            <div className="flex flex-col gap-3 rounded-xl bg-surface-2 p-3.5">
              <ChoiceGroup label="Decisión" name="decision" options={DECISIONS} defaultValue="Procedente" />
              <TextArea label="Respuesta al consumidor" name="text" rows={5} required minLength={20} maxLength={4000} hint={sheet.consumer.email ? `Se envía a ${sheet.consumer.email}.` : "El consumidor no dejó correo: entrega la respuesta por otro medio."} />
              <TextArea label="Acciones tomadas (opcional)" name="actions" rows={2} maxLength={1000} />
            </div>
          )}
        </>
      )}
    </PanelAction>
  );
}

export function ClaimCloseAction({ sheet }: { sheet: ClaimSheet }) {
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
          <TextArea label="Motivo del cierre" name="note" rows={3} required minLength={5} maxLength={1000} placeholder="Por ejemplo: extorno realizado y confirmado por el consumidor." />
        </>
      )}
    </PanelAction>
  );
}
