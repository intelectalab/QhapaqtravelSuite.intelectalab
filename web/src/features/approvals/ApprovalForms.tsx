"use client";

import { Ban, Check, Coins, FileSignature, Pencil, Plus, Settings2, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { decideApproval, saveApproval, saveApprovalRule, withdrawApproval } from "@/app/(backoffice)/aprobaciones/actions";
import { RowIcon } from "@/components/table/RowActions";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { EVENT_LABELS, GENERIC_TYPES, PERMISSION_OPTIONS, SLA_META, TYPE_TONES, type ApprovalItem, type ApprovalRule } from "@/lib/approvals";
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

export function ApprovalDetailAction({ item }: { item: ApprovalItem }) {
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
          {item.change_id && <input type="hidden" name="change_id" value={item.change_id} />}
          {item.cancel_reason && <input type="hidden" name="cancel_reason" value={item.cancel_reason} />}
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
            {item.href && (
              <Fact label="Origen">
                <Link href={item.href} className="text-accent hover:underline">
                  Abrir {item.target}
                </Link>
              </Fact>
            )}
          </section>
          {item.detail && (
            <div>
              <p className="mb-1 text-[12.5px] font-semibold text-fg-3">Justificación</p>
              <p className="whitespace-pre-line text-[13.5px] leading-relaxed">{item.detail}</p>
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
          {decide && <TextArea label="Comentario" name="note" rows={3} maxLength={500} hint={item.source ? `Obligatorio si eliges «${item.reject_label ?? "Rechazar"}». Quien lo pidió verá el resultado en su portal.` : "Obligatorio si rechazas. Se guarda en la trazabilidad."} />}
        </>
      )}
    </PanelAction>
  );
}

export function ApprovalFormAction({ item, types }: { item?: ApprovalItem; types: { value: string; label: string }[] }) {
  const editing = Boolean(item);
  const options = types.filter((type) => GENERIC_TYPES.includes(type.value));
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
      {() => (
        <>
          {item && <input type="hidden" name="code" value={item.code} />}
          {!editing && <SelectField label="Tipo" name="type" options={options} defaultValue="other" />}
          <TextField label="Título" name="title" required minLength={5} maxLength={200} defaultValue={item?.title} icon={<FileSignature size={17} />} placeholder="Por ejemplo: Reembolso parcial por cambio de hotel" />
          <div className="grid grid-cols-[1fr_130px] gap-3">
            <TextField label="Monto o impacto" name="amount" type="number" step="0.01" min="0" required defaultValue={item ? String(item.amount) : undefined} icon={<Coins size={17} />} />
            <ChoiceGroup label="Moneda" name="currency" options={[{ value: "PEN", label: "S/" }, { value: "USD", label: "US$" }]} defaultValue={item?.currency ?? "PEN"} />
          </div>
          <TextField label="Referencia (opcional)" name="reference" maxLength={40} defaultValue={item?.facts.find((fact) => fact.startsWith("Origen: "))?.replace("Origen: ", "")} placeholder="RES-2026-000346, AGB-03…" />
          <TextArea label="Justificación" name="justification" rows={4} required minLength={10} maxLength={2000} defaultValue={item?.detail ?? undefined} placeholder="Qué se pide, por qué y qué pasa si no se aprueba." />
        </>
      )}
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
          <TextArea label="Motivo (opcional)" name="note" rows={2} maxLength={500} />
        </>
      )}
    </PanelAction>
  );
}

export function RuleEditAction({ rule }: { rule: ApprovalRule }) {
  const [active, setActive] = useState(rule.active);
  const [noSelf, setNoSelf] = useState(rule.forbid_self);
  return (
    <PanelAction<StepResult>
      label="Editar regla"
      formId={`regla-${rule.code}`}
      title={`${rule.type_label} · nivel ${rule.level}`}
      description={rule.locked ? "El permiso del nivel 1 lo define el módulo de origen y no se cambia." : "Define quién aprueba, desde qué monto y en cuánto tiempo."}
      submitLabel="Guardar regla"
      action={saveApprovalRule}
      initial={initial}
      trigger={(open) => <RowIcon tone="edit" label="Editar regla" icon={<Settings2 size={15} />} onClick={open} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={rule.code} />
          {rule.locked ? (
            <TextField label="Permiso que aprueba" name="permission_view" value={rule.permission_label} readOnly icon={<Pencil size={16} />} />
          ) : (
            <SelectField label="Permiso que aprueba" name="permission" options={PERMISSION_OPTIONS} defaultValue={rule.permission} />
          )}
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Desde (S/)" name="min_amount" type="number" step="0.01" min="0" required defaultValue={String(rule.min_amount)} />
            <TextField label="Plazo (horas)" name="sla_hours" type="number" min="1" max="720" required defaultValue={String(rule.sla_hours)} />
          </div>
          <SwitchField label="Regla activa" name="active" checked={active} onCheckedChange={setActive} hint="Cada tipo necesita al menos una regla activa de nivel 1." />
          <SwitchField label="Prohibir que apruebe quien la pidió" name="forbid_self" checked={noSelf} onCheckedChange={setNoSelf} />
        </>
      )}
    </PanelAction>
  );
}
