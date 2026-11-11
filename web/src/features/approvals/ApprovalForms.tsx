"use client";

import { Ban, Check, Coins, FileSignature, ListRestart, MessageCircleQuestion, MessageSquareReply, Pencil, Plus, RotateCcw, Route, Settings2, Trash2, UserRoundPlus, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { answerApprovalInfo, askApprovalInfo, decideApproval, delegateApproval, deleteApprovalRule, resetApprovalRules, resubmitApproval, saveApproval, saveApprovalRule, withdrawApproval } from "@/app/(backoffice)/aprobaciones/actions";
import { RowIcon } from "@/components/table/RowActions";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { CancelApprovalFields } from "./CancelApprovalFields";
import { approvalRoute, EVENT_LABELS, GENERIC_TYPES, PERMISSION_OPTIONS, SLA_META, TYPE_TONES, type ApprovalItem, type ApprovalRule, type ApprovalsOverview } from "@/lib/approvals";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";

const initial: StepResult = { message: null, done: false };

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-t border-line-2 py-2 text-[13px] first:border-t-0">
      <span className="text-fg-3">{label}</span>
      <span className="text-right font-medium">{children}</span>
    </div>
  );
}

function LevelTrack({ item }: { item: ApprovalItem }) {
  const levels = Array.from({ length: Math.max(1, item.levels) }, (_, index) => index + 1);
  return (
    <ol className="flex items-center gap-2">
      {levels.map((level) => {
        const step = item.steps.find((entry) => entry.level === level);
        const current = item.status === "pendiente" && level === item.level;
        return (
          <li key={level} className="flex flex-1 items-center gap-2">
            <span className={`grid h-7 w-7 flex-none place-items-center rounded-full text-[11.5px] font-bold transition-transform hover:scale-110 ${step ? "bg-ok text-white" : current ? "bg-[color-mix(in_srgb,var(--warn)_18%,var(--surface))] text-warn ring-2 ring-warn/40" : "bg-surface-2 text-fg-3"}`}>
              {step ? <Check size={14} strokeWidth={3} /> : level}
            </span>
            <span className="text-[12px] text-fg-2">{step ? `Nivel ${level} · ${step.by}` : current ? `Nivel ${level} · en espera` : `Nivel ${level}`}</span>
          </li>
        );
      })}
    </ol>
  );
}

export function ApprovalDetailAction({ item, cancelReasons = [] }: { item: ApprovalItem; cancelReasons?: string[] }) {
  const decide = item.can_decide && (item.status === "pendiente" || item.status === "info");
  const formId = `aprobacion-${item.key.replace(/[^a-z0-9-]/gi, "-")}`;
  return (
    <PanelAction<StepResult>
      label="Ver"
      formId={formId}
      title={item.title}
      description={`${item.type_label} · ${item.code}`}
      submitLabel={decide ? (item.approve_label ?? "Aprobar") : "Listo"}
      action={decide ? decideApproval : async () => ({ message: null, done: true })}
      initial={initial}
      trigger={(open) => <RowIcon tone="view" label="Ver solicitud" onClick={open} />}
      footerExtra={(_state, pending) =>
        decide ? (
          <Button type="submit" form={formId} name="decision" value="reject" variant="secondary" icon={<X size={15} />} disabled={pending}>
            {item.reject_label ?? "Rechazar"}
          </Button>
        ) : null
      }
    >
      {() => (
        <>
          <input type="hidden" name="type" value={item.type} />
          <input type="hidden" name="target" value={item.target} />
          {item.lock_version !== null && <input type="hidden" name="lock_version" value={item.lock_version} />}
          {item.version_no !== undefined && <input type="hidden" name="version_no" value={item.version_no} />}
          {item.change_id && <input type="hidden" name="change_id" value={item.change_id} />}
          {item.cancel_id && <input type="hidden" name="cancel_id" value={item.cancel_id} />}
          {item.cancel_reason && !(decide && item.type === "cancel") && <input type="hidden" name="cancel_reason" value={item.cancel_reason} />}
          {item.source && <input type="hidden" name="source" value={item.source} />}
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={TYPE_TONES[item.type] ?? "mute"}>{item.type_label}</Badge>
            <StatusBadge status={item.status} />
            <Badge tone={SLA_META[item.sla].tone} dot={false}>
              {SLA_META[item.sla].label}
            </Badge>
          </div>
          <LevelTrack item={item} />
          <section className="rounded-xl bg-surface-2 px-3.5 py-1">
            <Fact label="Monto o impacto">{formatMoney(item.amount, item.currency)}{item.currency !== "PEN" && <span className="block text-[11.5px] font-normal text-fg-3">{formatMoney(item.amount_pen)} en soles</span>}</Fact>
            <Fact label="Solicitó">{item.requester}</Fact>
            <Fact label="Fecha">{formatDateTime(item.created_at)}</Fact>
            {item.due_at && <Fact label="Plazo">{formatDateTime(item.due_at)}</Fact>}
            {item.facts.map((fact) => {
              const [label, ...rest] = fact.split(": ");
              return rest.length > 0 ? <Fact key={fact} label={label}>{rest.join(": ")}</Fact> : <Fact key={fact} label="Detalle">{fact}</Fact>;
            })}
            {item.delegated_to && <Fact label="Delegada a">{item.delegated_to.name}</Fact>}
            {item.resubmitted_from && <Fact label="Reenvío de">{item.resubmitted_from}</Fact>}
            {item.href && (
              <Fact label="Origen">
                <Link href={item.href} className="text-accent hover:underline">
                  {item.href_label ?? `Abrir ${item.target}`}
                </Link>
              </Fact>
            )}
          </section>
          {item.rule && (
            <section className="rounded-xl border border-line px-3.5 py-2.5 text-[13px]">
              <p className="flex items-center gap-1.5 font-semibold">
                <Route size={14} className="text-accent" />
                Regla {item.rule.code} · nivel {item.level} · {item.rule.permission_label}
              </p>
              <p className="mt-0.5 text-[12.5px] text-fg-3">
                {item.rule.min_amount > 0 ? `Aplica desde ${formatMoney(item.rule.min_amount)}` : "Aplica a cualquier monto"} · aprueban {item.rule.approvers.length > 0 ? item.rule.approvers.join(", ") : "nadie con el permiso"}
              </p>
              {item.effect && <p className="mt-1.5 text-[12.5px] text-fg-2">{item.effect}</p>}
            </section>
          )}
          {item.detail && (
            <div>
              <p className="mb-1 text-[12.5px] font-semibold text-fg-3">Justificación</p>
              <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{item.detail}</p>
            </div>
          )}
          {item.questions.length > 0 && (
            <div>
              <p className="mb-1.5 text-[12.5px] font-semibold text-fg-3">Consultas</p>
              <ul className="flex flex-col gap-2">
                {item.questions.map((question) => (
                  <li key={question.id} className="rounded-xl border border-line px-3.5 py-2.5 text-[13px]">
                    <span className="flex items-center gap-1.5 font-medium">
                      <MessageCircleQuestion size={14} className="flex-none text-info" />
                      {question.question}
                    </span>
                    <span className="mt-0.5 block text-[11.5px] text-fg-3">{question.asked_by} · {formatDateTime(question.asked_at)}</span>
                    {question.answer ? (
                      <span className="mt-2 flex items-start gap-1.5 border-t border-line-2 pt-2 text-fg-2">
                        <MessageSquareReply size={14} className="mt-0.5 flex-none text-ok" />
                        <span>
                          {question.answer}
                          <span className="block text-[11.5px] text-fg-3">{question.answered_by} · {question.answered_at ? formatDateTime(question.answered_at) : ""}</span>
                        </span>
                      </span>
                    ) : (
                      <span className="mt-2 block">
                        <Badge tone="info" dot={false}>Esperando respuesta</Badge>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {item.decided_at && (
            <div className="rounded-xl border border-line px-3.5 py-3 text-[13px]">
              <p className="font-semibold">
                {item.decider ?? "Sistema"} · {formatDateTime(item.decided_at)}
              </p>
              {item.decision_note && <p className="mt-1 text-fg-2">{item.decision_note}</p>}
            </div>
          )}
          {item.events.length > 0 && (
            <ol className="flex flex-col gap-2 border-l-2 border-line pl-3.5">
              {item.events.map((event) => (
                <li key={`${event.event}-${event.at}`} className="text-[12.5px]">
                  <span className="font-semibold">{EVENT_LABELS[event.event] ?? event.event}</span> · {event.by} · <span className="text-fg-3">{formatDateTime(event.at)}</span>
                  {event.note && event.note !== EVENT_LABELS[event.event] && <span className="block text-fg-2">{event.note}</span>}
                </li>
              ))}
            </ol>
          )}
          {decide && item.type === "cancel" && <CancelApprovalFields reservation={item.target} reasons={cancelReasons} reason={item.cancel_reason} />}
          {decide && <TextArea label={item.type === "cancel" ? "Detalle del motivo" : "Comentario"} name="note" rows={3} maxLength={500} hint={item.source ? `Obligatorio si eliges «${item.reject_label ?? "Rechazar"}». Quien lo pidió verá el resultado en su portal.` : "Obligatorio si rechazas. Se guarda en la trazabilidad."} />}
        </>
      )}
    </PanelAction>
  );
}

function RoutePreview({ rules, type, amount, currency, usd }: { rules: ApprovalRule[]; type: string; amount: number; currency: string; usd: number }) {
  const route = approvalRoute(rules, type, currency === "USD" ? amount * usd : amount);
  if (route.length === 0) return null;
  return (
    <ol className="flex flex-col gap-1.5 rounded-xl bg-surface-2 px-3.5 py-2.5 text-[12.5px]">
      {route.map((rule) => (
        <li key={rule.code} className="flex items-center gap-2">
          <span className="grid h-6 w-6 flex-none place-items-center rounded-full bg-surface text-[11px] font-bold text-accent">{rule.level}</span>
          <span>
            <b>{rule.permission_label}</b> · {rule.sla_hours} h
            <span className="block text-fg-3">{rule.approvers.length > 0 ? rule.approvers.join(", ") : "Sin aprobadores activos"}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}

function ApprovalFields({ item, overview }: { item?: ApprovalItem; overview: ApprovalsOverview }) {
  const editing = Boolean(item);
  const [type, setType] = useState(item?.type ?? "other");
  const [amount, setAmount] = useState(item?.amount ?? 0);
  const [currency, setCurrency] = useState(item?.currency ?? "PEN");
  const options = overview.types.filter((option) => GENERIC_TYPES.includes(option.value));
  return (
    <>
      {item && <input type="hidden" name="code" value={item.code} />}
      {editing ? <input type="hidden" name="type" value={type} /> : <SelectField label="Tipo" name="type" options={options} value={type} onChange={setType} />}
      <TextField label="Título" name="title" required minLength={5} maxLength={200} defaultValue={item?.title} icon={<FileSignature size={17} />} placeholder="Por ejemplo: Reembolso parcial por cambio de hotel" />
      <div className="grid grid-cols-[1fr_130px] gap-3">
        <TextField label="Monto o impacto" name="amount" type="number" step="0.01" min="0" required defaultValue={item ? String(item.amount) : undefined} icon={<Coins size={17} />} onChange={(event) => setAmount(Number(event.target.value) || 0)} />
        <ChoiceGroup label="Moneda" name="currency" options={[{ value: "PEN", label: "S/" }, { value: "USD", label: "US$" }]} defaultValue={currency} onChange={setCurrency} />
      </div>
      {type === "credit_b2b" && <SelectField label="Agencia B2B" name="agency" options={overview.options.agencies} defaultValue={item?.agency ?? undefined} placeholder="Elige la agencia" hint="Obligatoria: el crédito se evalúa sobre su línea." />}
      <SelectField label={type === "credit_b2b" ? "Reserva relacionada (opcional)" : "Reserva (opcional)"} name="reservation" options={overview.options.reservations} defaultValue={item?.reservation ?? ""} placeholder="Sin reserva" />
      <TextArea label="Justificación" name="justification" rows={4} required minLength={10} maxLength={2000} defaultValue={item?.detail ?? undefined} placeholder="Qué se pide, por qué y qué pasa si no se aprueba." />
      <div>
        <p className="mb-1.5 text-[12.5px] font-semibold text-fg-3">Ruta de aprobación</p>
        <RoutePreview rules={overview.rules} type={type} amount={amount} currency={currency} usd={overview.usd_rate} />
      </div>
    </>
  );
}

export function ApprovalFormAction({ item, overview }: { item?: ApprovalItem; overview: ApprovalsOverview }) {
  const editing = Boolean(item);
  return (
    <PanelAction<StepResult>
      label="Nueva solicitud"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId={editing ? `editar-${item?.code}` : "nueva-aprobacion"}
      title={editing ? "Editar solicitud" : "Nueva solicitud"}
      description={editing ? `${item?.code} · el nivel y los aprobadores se recalculan con el monto.` : "Para excepciones que no nacen en otro módulo: crédito B2B, reembolsos u otras."}
      submitLabel={editing ? "Guardar cambios" : "Enviar a aprobación"}
      action={saveApproval}
      initial={initial}
      trigger={editing ? (open) => <RowIcon tone="edit" label="Editar" onClick={open} /> : undefined}
    >
      {() => <ApprovalFields item={item} overview={overview} />}
    </PanelAction>
  );
}

export function ApprovalWithdrawAction({ item }: { item: ApprovalItem }) {
  return (
    <PanelAction<StepResult>
      label="Retirar"
      formId={`retirar-${item.code}`}
      title="Retirar solicitud"
      description={`${item.title}. Queda anulada en el historial; no se borra.`}
      submitLabel="Retirar"
      action={withdrawApproval}
      initial={initial}
      trigger={(open) => <RowIcon tone="delete" label="Retirar" icon={<Ban size={15} />} onClick={open} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={item.code} />
          {item.lock_version !== null && <input type="hidden" name="lock_version" value={item.lock_version} />}
          <TextArea label="Motivo (opcional)" name="note" rows={2} maxLength={500} />
        </>
      )}
    </PanelAction>
  );
}

type FlowKind = "delegate" | "ask" | "answer" | "resubmit";

const FLOW: Record<FlowKind, { label: string; icon: React.ReactNode; title: string; submit: string; action: (state: StepResult, form: FormData) => Promise<StepResult> }> = {
  delegate: { label: "Delegar", icon: <UserRoundPlus size={15} />, title: "Delegar solicitud", submit: "Delegar", action: delegateApproval },
  ask: { label: "Pedir información", icon: <MessageCircleQuestion size={15} />, title: "Pedir información", submit: "Enviar consulta", action: askApprovalInfo },
  answer: { label: "Responder consulta", icon: <MessageSquareReply size={15} />, title: "Responder consulta", submit: "Responder", action: answerApprovalInfo },
  resubmit: { label: "Reenviar a aprobación", icon: <RotateCcw size={15} />, title: "Reenviar a aprobación", submit: "Reenviar", action: resubmitApproval },
};

function FlowFields({ item, kind }: { item: ApprovalItem; kind: FlowKind }) {
  const pending = item.questions.find((question) => question.answered_at === null);
  if (kind === "delegate") {
    return (
      <>
        <SelectField label="Delegar en" name="user_id" options={item.delegates.map((user) => ({ value: user.id, label: user.name }))} placeholder="Elegir persona" hint="Solo quienes tienen el permiso de este nivel." />
        <TextArea label="Nota (opcional)" name="note" rows={2} maxLength={500} />
      </>
    );
  }
  if (kind === "ask") return <TextArea label="Pregunta" name="question" rows={3} required minLength={5} maxLength={1000} hint="El plazo queda en pausa hasta que respondan." />;
  if (kind === "answer") {
    return (
      <>
        <input type="hidden" name="info_id" value={pending?.id ?? ""} />
        {pending && (
          <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px]">
            <span className="block text-[12px] text-fg-3">{pending.asked_by} · {formatDateTime(pending.asked_at)}</span>
            {pending.question}
          </p>
        )}
        <TextArea label="Respuesta" name="answer" rows={3} required minLength={2} maxLength={2000} />
      </>
    );
  }
  return <TextArea label="Qué corregiste" name="note" rows={3} required minLength={5} maxLength={500} hint={item.decision_note ? `Motivo del rechazo: ${item.decision_note}` : undefined} />;
}

export function ApprovalFlowAction({ item, kind }: { item: ApprovalItem; kind: FlowKind }) {
  const flow = FLOW[kind];
  return (
    <PanelAction<StepResult>
      label={flow.label}
      formId={`${kind}-${item.code}`}
      title={flow.title}
      description={`${item.title} · ${item.code}`}
      submitLabel={flow.submit}
      action={flow.action}
      initial={initial}
      trigger={(open) => <RowIcon tone="neutral" label={flow.label} icon={flow.icon} onClick={open} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={item.code} />
          {kind !== "answer" && kind !== "resubmit" && item.lock_version !== null && <input type="hidden" name="lock_version" value={item.lock_version} />}
          <FlowFields item={item} kind={kind} />
        </>
      )}
    </PanelAction>
  );
}

export function ApprovalFlowActions({ item }: { item: ApprovalItem }) {
  const kinds: FlowKind[] = [item.can_delegate && item.delegates.length > 0 ? "delegate" : null, item.can_ask ? "ask" : null, item.can_answer ? "answer" : null, item.can_resubmit ? "resubmit" : null].filter((kind): kind is FlowKind => kind !== null);
  return (
    <>
      {kinds.map((kind) => (
        <ApprovalFlowAction key={kind} item={item} kind={kind} />
      ))}
    </>
  );
}

function RuleFields({ rule, types }: { rule?: ApprovalRule; types: ApprovalsOverview["types"] }) {
  const [active, setActive] = useState(rule?.active ?? true);
  const [noSelf, setNoSelf] = useState(rule?.forbid_self ?? true);
  return (
    <>
      {rule && <input type="hidden" name="code" value={rule.code} />}
      {!rule && <SelectField label="Tipo de solicitud" name="type" options={types.filter((type) => type.value !== "change")} defaultValue="refund" hint="La regla nueva es de nivel 2: se suma cuando el monto supera el umbral." />}
      {rule?.locked ? (
        <TextField label="Permiso que aprueba" name="permission_view" value={rule.permission_label} readOnly icon={<Pencil size={16} />} />
      ) : (
        <SelectField label="Permiso que aprueba" name="permission" options={PERMISSION_OPTIONS} defaultValue={rule?.permission ?? "finance.profitability"} />
      )}
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Desde (S/)" name="min_amount" type="number" step="0.01" min="0" required defaultValue={String(rule?.min_amount ?? 5000)} />
        <TextField label="Plazo (horas)" name="sla_hours" type="number" min="1" max="720" required defaultValue={String(rule?.sla_hours ?? 24)} />
      </div>
      <SwitchField label="Regla activa" name="active" checked={active} onCheckedChange={setActive} hint="Cada tipo necesita al menos una regla activa de nivel 1." />
      <SwitchField label="Prohibir que apruebe quien la pidió" name="forbid_self" checked={noSelf} onCheckedChange={setNoSelf} />
    </>
  );
}

export function RuleFormAction({ rule, types }: { rule?: ApprovalRule; types: ApprovalsOverview["types"] }) {
  return (
    <PanelAction<StepResult>
      label="Nueva regla"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId={rule ? `regla-${rule.code}` : "nueva-regla"}
      title={rule ? `${rule.type_label} · nivel ${rule.level}` : "Nueva regla de nivel 2"}
      description={rule?.locked ? "El permiso del nivel 1 lo define el módulo de origen y no se cambia." : "Define quién aprueba, desde qué monto y en cuánto tiempo."}
      submitLabel={rule ? "Guardar regla" : "Crear regla"}
      action={saveApprovalRule}
      initial={initial}
      trigger={rule ? (open) => <RowIcon tone="edit" label="Editar regla" icon={<Settings2 size={15} />} onClick={open} /> : undefined}
    >
      {() => <RuleFields rule={rule} types={types} />}
    </PanelAction>
  );
}

export function RuleDeleteAction({ rule }: { rule: ApprovalRule }) {
  if (rule.level !== 2) return <RowIcon tone="delete" label="Eliminar" icon={<Trash2 size={15} />} disabledHint="El nivel 1 no se elimina: se edita o se desactiva" />;
  return (
    <PanelAction<StepResult>
      label="Eliminar"
      formId={`eliminar-regla-${rule.code}`}
      title={`Eliminar regla ${rule.code}`}
      description={`Las solicitudes de «${rule.type_label}» dejarán de requerir el nivel 2 desde ${formatMoney(rule.min_amount)}. Las pendientes recalculan su ruta.`}
      submitLabel="Eliminar regla"
      action={deleteApprovalRule}
      initial={initial}
      trigger={(open) => <RowIcon tone="delete" label="Eliminar regla" icon={<Trash2 size={15} />} onClick={open} />}
    >
      {() => <input type="hidden" name="code" value={rule.code} />}
    </PanelAction>
  );
}

export function RulesResetAction() {
  return (
    <PanelAction<StepResult>
      label="Restaurar valores por defecto"
      icon={<ListRestart size={16} />}
      formId="restaurar-reglas"
      title="Restaurar matriz por defecto"
      description="Las reglas vuelven a los valores de referencia: permisos, montos, plazos y autoaprobación prohibida. Las reglas de nivel 2 que agregaste se eliminan."
      submitLabel="Restaurar"
      action={resetApprovalRules}
      initial={initial}
    >
      {() => <p className="text-[13px] text-fg-2">El cambio queda en la auditoría y las solicitudes pendientes recalculan sus niveles.</p>}
    </PanelAction>
  );
}
