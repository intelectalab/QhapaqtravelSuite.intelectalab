"use client";

import { Check, Minus, Plus, ShieldCheck, ToggleRight, Trash2 } from "lucide-react";
import { deleteOverride, saveOverride, setPlanFeature } from "@/app/plataforma/(consola)/facturacion/actions";
import { PanelAction } from "@/components/ui/PanelAction";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { EmptyState } from "@/components/ui/EmptyState";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintCardTitle } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { capitalize, formatDate } from "@/lib/format";
import { planTone } from "@/lib/platform";
import type { FeatureOverride, FlagFeature, FlagsOverview } from "@/lib/platformBilling";
import type { ConsoleResult } from "@/lib/server/platformConsole";
import { toneStyle } from "@/lib/tone";
import { ConsoleAction } from "./ConsoleAction";

const KIND: Record<FlagFeature["kind"], string> = { module: "Módulo", limit: "Con límite", addon: "Complemento", beta: "Beta" };

const initial: ConsoleResult = { message: null, done: false };

const isoIn = (days: number) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Lima" }).format(new Date(Date.now() + days * 86_400_000));

function FlagCell({ feature, plan }: { feature: FlagFeature; plan: FlagsOverview["plans"][number] }) {
  const value = feature.values[plan.code];
  const on = value !== null && value !== undefined;
  const options = [
    { value: "incluido", label: "Incluido" },
    ...(feature.key === "module.b2b" ? [{ value: "básico", label: "Básico" }] : []),
    { value: "", label: "No incluido" },
  ];

  return (
    <PanelAction<ConsoleResult>
      label={feature.label}
      formId={`flag-${feature.key}-${plan.code}`}
      title={`${feature.label} en ${plan.name}`}
      description="El cambio rige de inmediato para todas las agencias del plan. Las excepciones por agencia se mantienen y los datos nunca se borran al quitar una funcionalidad."
      submitLabel="Guardar"
      action={setPlanFeature}
      initial={initial}
      trigger={(open) => (
        <button
          type="button"
          onClick={open}
          style={toneStyle(planTone(plan.rank))}
          aria-label={`${feature.label} en ${plan.name}: ${on ? value : "no incluido"}`}
          className={cn(
            "mx-auto grid h-8 min-w-8 place-items-center rounded-[9px] px-2 text-[12px] font-semibold transition-transform duration-200 hover:-translate-y-0.5 hover:scale-110",
            on ? "bg-[var(--tint)] text-white shadow-[0_6px_14px_-8px_var(--tint)]" : "bg-surface-2 text-fg-3",
          )}
        >
          {on ? value === "incluido" ? <Check size={15} strokeWidth={2.6} /> : capitalize(value) : <Minus size={14} />}
        </button>
      )}
    >
      {() => (
        <>
          <input type="hidden" name="feature" value={feature.key} />
          <input type="hidden" name="plan" value={plan.code} />
          <ChoiceGroup label="Disponibilidad" name="value" options={options} defaultValue={value ?? ""} />
        </>
      )}
    </PanelAction>
  );
}

export function FlagsMatrix({ overview }: { overview: FlagsOverview }) {
  const groups = Object.entries(
    overview.features.reduce<Record<string, FlagFeature[]>>((acc, feature) => {
      const key = feature.module ?? "Otros";
      (acc[key] ??= []).push(feature);
      return acc;
    }, {}),
  );

  return (
    <Card padded={false} className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-[13.5px]">
          <thead className="sticky top-0 z-10 bg-surface">
            <tr className="border-b border-line">
              <th className="px-5 py-3 text-left text-[12.5px] font-semibold text-fg-3">Funcionalidad</th>
              {overview.plans.map((plan) => (
                <th key={plan.code} className="w-[120px] px-3 py-3 text-center">
                  <Badge tone={planTone(plan.rank)} dot={false}>
                    {plan.name}
                  </Badge>
                </th>
              ))}
              <th className="w-[110px] px-3 py-3 text-center text-[12.5px] font-semibold text-fg-3">Excepciones</th>
            </tr>
          </thead>
          <tbody>
            {groups.map(([group, features]) => (
              <FeatureGroup key={group} group={group} features={features} plans={overview.plans} />
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function FeatureGroup({ group, features, plans }: { group: string; features: FlagFeature[]; plans: FlagsOverview["plans"] }) {
  return (
    <>
      <tr className="bg-surface-2/60">
        <td colSpan={plans.length + 2} className="px-5 py-2 text-[12px] font-semibold text-fg-2">
          {group}
        </td>
      </tr>
      {features.map((feature) => (
        <tr key={feature.key} className="border-b border-line-2 transition-colors duration-200 last:border-b-0 hover:bg-surface-2/50">
          <td className="px-5 py-2.5">
            <span className="font-medium">{feature.label}</span>
            {feature.kind !== "module" && (
              <Badge tone={feature.kind === "beta" ? "violet" : "sun"} dot={false} className="ml-2">
                {KIND[feature.kind]}
              </Badge>
            )}
          </td>
          {plans.map((plan) => (
            <td key={plan.code} className="px-3 py-2 text-center">
              <FlagCell feature={feature} plan={plan} />
            </td>
          ))}
          <td className="px-3 py-2 text-center font-mono text-[12.5px] text-fg-3">{feature.overrides > 0 ? <Badge tone="info">{feature.overrides}</Badge> : "—"}</td>
        </tr>
      ))}
    </>
  );
}

export function OverrideFormAction({ overview }: { overview: FlagsOverview }) {
  return (
    <ConsoleAction
      id="override-new"
      label="Nueva excepción"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      title="Excepción para una agencia"
      description="Habilita o bloquea una funcionalidad para una sola agencia, por encima de su plan. Dura como máximo 180 días y deja de regir sola al vencer."
      submitLabel="Guardar excepción"
      action={saveOverride}
    >
      <SelectField label="Agencia" name="tenant" options={overview.tenants.map((tenant) => ({ value: tenant.code, label: tenant.name, hint: tenant.code }))} placeholder="Elige la agencia" />
      <SelectField label="Funcionalidad" name="feature" options={overview.features.map((feature) => ({ value: feature.key, label: feature.label, hint: feature.module ?? undefined }))} placeholder="Elige la funcionalidad" />
      <ChoiceGroup
        label="Acceso"
        name="value"
        options={[
          { value: "1", label: "Habilitar" },
          { value: "0", label: "Bloquear" },
        ]}
        defaultValue="1"
      />
      <TextField label="Vigente hasta" name="valid_until" type="date" required min={isoIn(0)} max={isoIn(180)} defaultValue={isoIn(30)} hint="Como máximo 180 días desde hoy." />
      <TextArea label="Motivo" name="reason" required minLength={10} maxLength={300} placeholder="Por ejemplo: piloto comercial aprobado por producto." />
    </ConsoleAction>
  );
}

export function OverridesList({ overrides }: { overrides: FeatureOverride[] }) {
  return (
    <Card>
      <TintCardTitle icon={ToggleRight} title="Excepciones por agencia" aside={String(overrides.length)} tone="info" />
      {overrides.length === 0 ? (
        <EmptyState icon={<ShieldCheck size={22} />} title="Sin excepciones" description="Todas las agencias usan exactamente lo que incluye su plan." />
      ) : (
        <ul className="flex flex-col gap-2">
          {overrides.map((override, index) => (
            <li key={override.id} className="lift flex flex-wrap items-start gap-3 rounded-[12px] border border-line px-4 py-3 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ animationDelay: `${index * 70}ms` }}>
              <span className={cn("mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-[9px]", override.value ? "bg-ok/12 text-ok" : "bg-bad/10 text-bad")}>{override.value ? <Check size={16} /> : <Minus size={16} />}</span>
              <span className="min-w-0 flex-1">
                <b className="block text-[13.5px] font-semibold">
                  {override.feature.label} · {override.tenant.name}
                </b>
                <span className="block text-[12.5px] text-fg-2">{override.reason}</span>
                <span className="mt-0.5 block text-xs text-fg-3">
                  {override.value ? "Habilitada" : "Bloqueada"} {override.valid_until ? `hasta el ${formatDate(override.valid_until)}` : "sin vencimiento"}
                  {override.granted_by ? ` · ${override.granted_by}` : ""}
                </span>
              </span>
              <Badge tone={override.active ? "ok" : "mute"}>{override.active ? "Vigente" : "Vencida"}</Badge>
              <ConsoleAction
                id={`override-delete-${override.id}`}
                label="Quitar excepción"
                icon={<Trash2 size={15} />}
                rowTone="delete"
                title="Quitar excepción"
                description={`${override.tenant.name} vuelve a usar lo que incluye su plan para ${override.feature.label}.`}
                submitLabel="Quitar"
                action={deleteOverride}
                fields={{ id: override.id }}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
