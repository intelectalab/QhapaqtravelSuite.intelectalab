"use client";

import { Lock, PencilRuler, Plus, Power, PowerOff, RotateCcw, SlidersHorizontal, Sparkles, Trash2 } from "lucide-react";
import { useOptimistic, useState, useTransition } from "react";
import { createRule, deleteRule, resetRule, toggleRule, updateRule, updateRuleParams } from "@/app/(backoffice)/admin/reglas/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { InfoTip } from "@/components/ui/InfoTip";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { ADMIN_INITIAL, type AdminActionState, type BookingRule, type RuleParam } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { ToggleField } from "./AdminParts";

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

export function GroupPulse({ groups }: { groups: { name: string; total: number; active: number }[] }) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-4 xl:grid-cols-8">
      {groups.map((group, index) => (
        <div key={group.name} style={{ animationDelay: `${index * 45}ms` }} title={`${group.active} de ${group.total} reglas activas`} className="lift group rounded-[14px] border border-line bg-surface px-3 py-2.5 shadow-card animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
          <p className="truncate text-[12px] font-semibold text-fg-2">{group.name}</p>
          <p className="text-[17px] font-bold">
            {group.active}
            <span className="text-[12px] font-medium text-fg-3"> / {group.total}</span>
          </p>
          <div className="mt-1.5 flex gap-0.5">
            {Array.from({ length: group.total }, (_, i) => (
              <span key={i} className={cn("h-1.5 flex-1 rounded-full transition-transform duration-300 group-hover:scale-y-150", i < group.active ? "bg-ok" : "bg-surface-2")} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
