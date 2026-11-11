"use client";

import { Check, Layers, Lock, PencilRuler, Plus, Power, PowerOff, RotateCcw, SlidersHorizontal, Sparkles, Trash2 } from "lucide-react";
import Link from "next/link";
import { useOptimistic, useState, useTransition } from "react";
import { applyRuleTemplate, createRule, deleteRule, resetRule, toggleRule, updateRule, updateRuleParams } from "@/app/(backoffice)/admin/reglas/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { ADMIN_INITIAL, type AdminActionState, type AuditEntry, type BookingRule, type RuleParam, type RuleRef, type RuleTemplate, type RulesOverview } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { RISE, ToggleField } from "./AdminParts";

export const RULE_GROUPS = ["Disponibilidad", "Pasajeros", "Alojamiento", "Adicionales", "Precios", "Monedas y pagos", "Checkout", "Comunicación"];

const GROUP_TONES: Record<string, "t1" | "t4" | "sun" | "violet" | "t3" | "accent" | "info" | "brand"> = {
  Disponibilidad: "t1",
  Pasajeros: "t4",
  Alojamiento: "sun",
  Adicionales: "violet",
  Precios: "t3",
  "Monedas y pagos": "accent",
  Checkout: "info",
  Comunicación: "brand",
};

function paramText(param: RuleParam): string {
  if (param.type === "bool") return `${param.label}: ${param.value ? "sí" : "no"}`;
  if (param.type === "choice") return `${param.label}: ${param.options?.find((option) => option.value === param.value)?.label ?? param.value}`;
  return `${param.label}: ${param.value}${param.unit ? ` ${param.unit}` : ""}`;
}

function RuleSwitch({ rule, manage }: { rule: BookingRule; manage: boolean }) {
  const [enabled, setEnabled] = useOptimistic(rule.enabled);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const disabledHint = rule.locked ? `Disponible desde el plan ${rule.min_plan}` : !manage ? "Solo lectura" : undefined;
  if (disabledHint) {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-fg-3" title={disabledHint}>
        {rule.locked ? <Lock size={13} /> : null}
        {rule.enabled ? "Activa" : "Inactiva"}
      </span>
    );
  }
  return (
    <div className={cn("flex flex-col gap-1", pending && "opacity-70")}>
      <SwitchField
        label={enabled ? "Activa" : "Inactiva"}
        name={`rule-${rule.code}`}
        checked={enabled}
        onCheckedChange={(next) =>
          start(async () => {
            setEnabled(next);
            setError(null);
            const result = await toggleRule(rule.code, next, rule.lock_version);
            if (!result.done) setError(result.message);
          })
        }
      />
      {error && <span className="max-w-[220px] text-[11.5px] text-bad">{error}</span>}
    </div>
  );
}

function ParamField({ param }: { param: RuleParam }) {
  if (param.type === "bool") return <ToggleField label={param.label} name={`p_${param.key}`} defaultChecked={Boolean(param.value)} />;
  if (param.type === "choice") return <SelectField label={param.label} name={`p_${param.key}`} options={param.options ?? []} defaultValue={String(param.value)} />;
  return <TextField label={param.unit ? `${param.label} (${param.unit})` : param.label} name={`p_${param.key}`} type="number" step="any" min={param.min ?? undefined} max={param.max ?? undefined} required defaultValue={String(param.value)} hint={param.min !== null && param.max !== null ? `Entre ${param.min} y ${param.max}` : undefined} />;
}

function RuleFields({ rule }: { rule?: BookingRule }) {
  return (
    <>
      <TextField label="Nombre" name="name" required minLength={3} defaultValue={rule?.name} placeholder="Ej.: Seguro de viaje obligatorio" />
      <TextArea label="Qué hará la regla" name="description" rows={3} required minLength={10} defaultValue={rule?.description} />
      <SelectField label="Grupo" name="group" options={RULE_GROUPS.map((group) => ({ value: group, label: group }))} defaultValue={rule?.group ?? "Checkout"} />
    </>
  );
}

export function RuleCreateAction() {
  return (
    <PanelAction<AdminActionState>
      label="Nueva regla"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId="rule-create"
      title="Nueva regla personalizada"
      description="Nace inactiva. Es un interruptor que el equipo técnico conecta al motor de reservas cuando implementa su efecto."
      submitLabel="Crear regla"
      action={createRule}
      initial={ADMIN_INITIAL}
    >
      {() => <RuleFields />}
    </PanelAction>
  );
}

function RuleRowActions({ rule }: { rule: BookingRule }) {
  return (
    <RowActions>
      {rule.params.length > 0 && !rule.locked && (
        <PanelAction<AdminActionState> label="Parámetros" variant="ghost" size="sm" formId={`rule-params-${rule.code}`} trigger={(open) => <RowIcon tone="edit" label="Editar parámetros" icon={<SlidersHorizontal size={15} />} onClick={open} />} title={rule.name} description={rule.description} submitLabel="Guardar parámetros" action={updateRuleParams} initial={ADMIN_INITIAL}>
          {() => (
            <>
              <input type="hidden" name="code" value={rule.code} />
              <input type="hidden" name="lock_version" value={rule.lock_version} />
              {rule.params.filter((param) => param.type === "bool").map((param) => <input key={param.key} type="hidden" name="bool_keys" value={param.key} />)}
              {rule.params.map((param) => <ParamField key={param.key} param={param} />)}
            </>
          )}
        </PanelAction>
      )}
      {rule.custom && (
        <PanelAction<AdminActionState> label="Editar" variant="ghost" size="sm" formId={`rule-edit-${rule.code}`} trigger={(open) => <RowIcon tone="edit" label="Editar regla" icon={<PencilRuler size={15} />} onClick={open} />} title="Editar regla personalizada" description={rule.code} submitLabel="Guardar cambios" action={updateRule} initial={ADMIN_INITIAL}>
          {() => (
            <>
              <input type="hidden" name="code" value={rule.code} />
              <input type="hidden" name="lock_version" value={rule.lock_version} />
              <RuleFields rule={rule} />
            </>
          )}
        </PanelAction>
      )}
      {rule.modified && !rule.custom && (
        <PanelAction<AdminActionState> label="Restablecer" variant="ghost" size="sm" formId={`rule-reset-${rule.code}`} trigger={(open) => <RowIcon tone="neutral" label="Volver a los valores de fábrica" icon={<RotateCcw size={15} />} onClick={open} />} title="Volver a los valores de fábrica" description={`${rule.name} recupera su estado y parámetros originales.`} submitLabel="Restablecer" action={resetRule} initial={ADMIN_INITIAL}>
          {() => (
            <>
              <input type="hidden" name="code" value={rule.code} />
              <TextArea label="Motivo" name="reason" rows={2} required minLength={3} />
            </>
          )}
        </PanelAction>
      )}
      {rule.custom && !rule.enabled && (
        <PanelAction<AdminActionState> label="Eliminar" variant="ghost" size="sm" formId={`rule-delete-${rule.code}`} trigger={(open) => <RowIcon tone="delete" label="Eliminar regla" icon={<Trash2 size={15} />} onClick={open} />} title="Eliminar regla personalizada" description={`${rule.name} se elimina. Las reglas estándar no se eliminan: se desactivan.`} submitLabel="Eliminar" action={deleteRule} initial={ADMIN_INITIAL}>
          {() => (
            <>
              <input type="hidden" name="code" value={rule.code} />
              <input type="hidden" name="lock_version" value={rule.lock_version} />
            </>
          )}
        </PanelAction>
      )}
    </RowActions>
  );
}

export function RulesTable({ rules, manage }: { rules: BookingRule[]; manage: boolean }) {
  const columns: Column<BookingRule>[] = [
    {
      id: "rule",
      header: "Regla",
      mobile: "title",
      cell: (rule) => (
        <div className="min-w-0 max-w-[460px]">
          <p className="flex items-center gap-1.5 text-[13.5px] font-semibold">
            <span className="truncate">{rule.name}</span>
            <InfoTip label="Qué hace">{rule.description}</InfoTip>
          </p>
          <p className="flex flex-wrap items-center gap-1.5 text-[11.5px] text-fg-3">
            <span className="font-mono">{rule.code}</span>
            {rule.custom && <Badge tone="violet">Personalizada</Badge>}
            {rule.modified && <span className="text-accent">Ajustada</span>}
          </p>
        </div>
      ),
    },
    { id: "group", header: "Grupo", cell: (rule) => <Badge tone={GROUP_TONES[rule.group] ?? "mute"}>{rule.group}</Badge> },
    {
      id: "params",
      header: "Parámetros",
      wideOnly: true,
      cell: (rule) =>
        rule.params.length === 0 ? (
          <span className="text-[12.5px] text-fg-3">Sin parámetros</span>
        ) : (
          <span className="flex max-w-[320px] flex-wrap gap-1">
            {rule.params.map((param) => (
              <span key={param.key} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11.5px] text-fg-2 transition-colors hover:bg-accent/10 hover:text-accent" title={param.label}>
                {paramText(param)}
              </span>
            ))}
          </span>
        ),
    },
    { id: "plan", header: "Plan", wideOnly: true, cell: (rule) => <span className={cn("text-[12.5px]", rule.locked ? "font-semibold text-warn" : "text-fg-3")}>Desde {rule.min_plan}</span> },
    { id: "status", header: "Estado", cell: (rule) => <RuleSwitch rule={rule} manage={manage} /> },
    { id: "actions", header: "", align: "right", mobile: "detail", cell: (rule) => (manage ? <RuleRowActions rule={rule} /> : null) },
  ];
  const metrics: MetricFilter<BookingRule>[] = [
    { id: "on", label: "Activas", tone: "ok", icon: <Power size={19} />, matches: (rule) => rule.enabled },
    { id: "off", label: "Inactivas", tone: "mute", icon: <PowerOff size={19} />, matches: (rule) => !rule.enabled },
    { id: "modified", label: "Ajustadas", tone: "t1", icon: <SlidersHorizontal size={19} />, matches: (rule) => rule.modified },
    { id: "custom", label: "Personalizadas", tone: "violet", icon: <Sparkles size={19} />, matches: (rule) => rule.custom },
    ...(rules.some((rule) => rule.locked) ? [{ id: "locked", label: "Fuera de tu plan", tone: "warn" as const, icon: <Lock size={19} />, matches: (rule: BookingRule) => rule.locked }] : []),
  ];
  const filters: FilterConfig<BookingRule>[] = [
    { id: "group", label: "Grupo", options: RULE_GROUPS.filter((group) => rules.some((rule) => rule.group === group)).map((group) => ({ value: group, label: group })), value: (rule) => rule.group },
    { id: "scope", label: "Dónde aplica", options: [...new Set(rules.flatMap((rule) => rule.scope))].map((scope) => ({ value: scope, label: scope })), value: (rule) => rule.scope },
    { id: "plan", label: "Plan mínimo", options: ["Starter", "Professional", "Enterprise"].map((plan) => ({ value: plan, label: plan })), value: (rule) => rule.min_plan },
  ];
  const sorts: SortOption<BookingRule>[] = [
    { id: "name", label: "Nombre", value: (rule) => rule.name },
    { id: "updated", label: "Último cambio", type: "date", value: (rule) => rule.updated_at },
  ];
  return <DataTable screen="admin-reglas" rows={rules} columns={columns} getKey={(rule) => rule.code} entityLabel="reglas" searchText={(rule) => `${rule.name} ${rule.code} ${rule.description} ${rule.group}`} searchPlaceholder="Buscar regla" metrics={metrics} filters={filters} sorts={sorts} />;
}

function RuleChips({ rules, tone, sign }: { rules: RuleRef[]; tone: "ok" | "mute" | "warn"; sign?: string }) {
  return (
    <span className="flex flex-wrap gap-1">
      {rules.map((rule) => (
        <span key={rule.code} title={rule.name} className="transition-transform duration-200 hover:-translate-y-0.5">
          <Badge tone={tone} dot={false}>
            {sign ? `${sign} ${rule.code}` : rule.code}
          </Badge>
        </span>
      ))}
    </span>
  );
}

function TemplateApply({ template }: { template: RuleTemplate }) {
  const total = template.enable.length + template.disable.length;
  return (
    <PanelAction<AdminActionState>
      label="Aplicar plantilla"
      icon={<Layers size={15} />}
      variant={total > 0 ? "primary" : "secondary"}
      size="sm"
      formId={`rule-template-${template.code}`}
      title={`Aplicar «${template.name}»`}
      description={`Cambia el estado de ${total} ${total === 1 ? "regla" : "reglas"}. Afecta de inmediato al sitio web, el widget, las cotizaciones y los portales.`}
      submitLabel={`Aplicar ${total} ${total === 1 ? "cambio" : "cambios"}`}
      action={applyRuleTemplate}
      initial={ADMIN_INITIAL}
      trigger={total === 0 ? () => <Button variant="secondary" size="sm" icon={<Check size={15} />} disabled>Sin cambios</Button> : undefined}
    >
      {() => (
        <>
          <input type="hidden" name="template" value={template.code} />
          {template.enable.length > 0 && (
            <section>
              <h3 className="mb-1.5 text-[12.5px] font-semibold text-fg-2">Se encienden</h3>
              <ul className="flex flex-col gap-1 text-[13px]">
                {template.enable.map((rule) => <li key={rule.code} className="flex items-center gap-2"><Power size={14} className="text-ok" />{rule.name}<span className="font-mono text-[11.5px] text-fg-3">{rule.code}</span></li>)}
              </ul>
            </section>
          )}
          {template.disable.length > 0 && (
            <section>
              <h3 className="mb-1.5 text-[12.5px] font-semibold text-fg-2">Se apagan</h3>
              <ul className="flex flex-col gap-1 text-[13px]">
                {template.disable.map((rule) => <li key={rule.code} className="flex items-center gap-2"><PowerOff size={14} className="text-fg-3" />{rule.name}<span className="font-mono text-[11.5px] text-fg-3">{rule.code}</span></li>)}
              </ul>
            </section>
          )}
          {template.blocked.length > 0 && <p className="text-[12.5px] text-warn">{`${template.blocked.length} ${template.blocked.length === 1 ? "regla queda" : "reglas quedan"} fuera porque no están en tu plan o dependen de otra apagada.`}</p>}
        </>
      )}
    </PanelAction>
  );
}

export function RuleTemplatesGrid({ data }: { data: RulesOverview }) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {data.templates.map((template, index) => {
        const current = data.template_applied?.code === template.code;
        const pending = template.enable.length + template.disable.length;
        return (
          <div key={template.code} style={{ animationDelay: `${index * 60}ms` }} className={cn("flex", RISE)}>
            <Card className="lift flex w-full flex-col gap-3">
              <div className="flex items-start justify-between gap-3">
                <h3 className="flex items-center gap-2 text-[15px] font-semibold">
                  <Layers size={17} className="text-accent" />
                  {template.name}
                </h3>
                {current && <Badge tone="ok">Aplicada</Badge>}
              </div>
              <p className="text-[13px] text-fg-2">{template.description}</p>
              <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-fg-3">
                <li className="flex items-center gap-1.5">
                  <Power size={13} className="text-ok" />
                  {`${template.active} activas`}
                </li>
                <li className="flex items-center gap-1.5">
                  <PowerOff size={13} />
                  {`${template.inactive} apagadas`}
                </li>
              </ul>
              {pending > 0 ? (
                <div className="flex flex-col gap-1.5">
                  <p className="text-[12px] font-semibold text-fg-3">Diferencia con tu configuración</p>
                  <RuleChips rules={template.enable} tone="ok" sign="+" />
                  <RuleChips rules={template.disable} tone="mute" sign="−" />
                </div>
              ) : (
                <p className="flex items-center gap-1.5 text-[12.5px] text-ok">
                  <Check size={14} />
                  Tu configuración coincide con esta plantilla.
                </p>
              )}
              {template.blocked.length > 0 && (
                <div className="flex flex-col gap-1.5">
                  <p className="flex items-center gap-1.5 text-[12px] font-semibold text-warn" title="No están en tu plan o dependen de una regla que queda apagada">
                    <Lock size={13} />
                    Quedan fuera
                  </p>
                  <RuleChips rules={template.blocked} tone="warn" />
                </div>
              )}
              {data.can_manage && (
                <div className="mt-auto pt-1">
                  <TemplateApply template={template} />
                </div>
              )}
            </Card>
          </div>
        );
      })}
    </div>
  );
}

const CHANGE_ACTIONS: Record<string, { label: string; tone: "ok" | "mute" | "t1" | "violet" | "sun" | "bad" | "info" }> = {
  activar: { label: "Activó", tone: "ok" },
  desactivar: { label: "Desactivó", tone: "mute" },
  editar_parametros: { label: "Ajustó parámetros", tone: "t1" },
  aplicar_plantilla: { label: "Aplicó plantilla", tone: "violet" },
  restablecer: { label: "Restableció", tone: "sun" },
  crear: { label: "Creó", tone: "info" },
  editar: { label: "Editó", tone: "info" },
  eliminar: { label: "Eliminó", tone: "bad" },
};

export function RuleChangesTable({ entries }: { entries: AuditEntry[] }) {
  const columns: Column<AuditEntry>[] = [
    {
      id: "rule",
      header: "Regla",
      mobile: "title",
      cell: (entry) => (
        <div className="min-w-0">
          <p className="font-mono text-[13px] font-semibold">{entry.entity_id}</p>
          <p className="text-[11.5px] text-fg-3">{entry.entity}</p>
        </div>
      ),
    },
    { id: "action", header: "Cambio", cell: (entry) => <Badge tone={CHANGE_ACTIONS[entry.action]?.tone ?? "mute"}>{CHANGE_ACTIONS[entry.action]?.label ?? entry.action.replace(/_/g, " ")}</Badge> },
    {
      id: "detail",
      header: "Antes y después",
      wideOnly: true,
      cell: (entry) => (
        <p className="max-w-[360px] truncate text-[12.5px] text-fg-2" title={`${entry.before ?? "—"} → ${entry.after ?? "—"}`}>
          {entry.before ? <span className="text-fg-3 line-through decoration-fg-3/50">{entry.before}</span> : null}
          {entry.before && entry.after ? " → " : null}
          {entry.after}
        </p>
      ),
    },
    { id: "actor", header: "Quién", cell: (entry) => <span className="text-[13px]">{entry.actor}</span> },
    {
      id: "at",
      header: "Fecha",
      align: "right",
      mobile: "detail",
      cell: (entry) => (
        <Link href={`/admin/auditoria/${entry.code}`} className="font-mono text-[12px] text-fg-3 hover:text-accent">
          {formatDateTime(entry.at, false)}
        </Link>
      ),
    },
  ];
  const metrics: MetricFilter<AuditEntry>[] = [
    { id: "toggle", label: "Encendidas y apagadas", tone: "ok", icon: <Power size={19} />, matches: (entry) => entry.action === "activar" || entry.action === "desactivar" },
    { id: "params", label: "Parámetros", tone: "t1", icon: <SlidersHorizontal size={19} />, matches: (entry) => entry.action === "editar_parametros" },
    { id: "templates", label: "Plantillas y restablecer", tone: "violet", icon: <Layers size={19} />, matches: (entry) => entry.action === "aplicar_plantilla" || entry.action === "restablecer" },
  ];
  const filters: FilterConfig<AuditEntry>[] = [{ id: "actor", label: "Quién", options: [...new Set(entries.map((entry) => entry.actor))].map((actor) => ({ value: actor, label: actor })), value: (entry) => entry.actor }];
  const sorts: SortOption<AuditEntry>[] = [{ id: "at", label: "Fecha", type: "date", value: (entry) => entry.at }];
  return <DataTable screen="admin-reglas-historial" rows={entries} columns={columns} getKey={(entry) => String(entry.code)} entityLabel="cambios" searchText={(entry) => `${entry.entity_id} ${entry.actor} ${entry.before ?? ""} ${entry.after ?? ""}`} searchPlaceholder="Buscar regla o persona" metrics={metrics} filters={filters} sorts={sorts} emptyTitle="Aún no hay cambios en las reglas" />;
}
