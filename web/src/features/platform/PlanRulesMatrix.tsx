"use client";

import { Check, Minus, RotateCcw, Users } from "lucide-react";
import { useEffect, useState } from "react";
import { applyPlanRule, previewPlanRule, resetPlanRules } from "@/app/plataforma/(consola)/planes/actions";
import { Badge } from "@/components/ui/Badge";
import { PanelAction } from "@/components/ui/PanelAction";
import { PlanChangeNote } from "@/features/billing/PlanChangeSummary";
import { cn } from "@/lib/cn";
import { planTone } from "@/lib/platform";
import type { PlanRuleChange, PlanRuleMatrix as Matrix } from "@/lib/platformBilling";
import type { ConsoleResult } from "@/lib/server/platformConsole";
import { toneStyle } from "@/lib/tone";
import { ConsoleAction } from "./ConsoleAction";

type Plan = Matrix["plans"][number];
type Rule = Matrix["groups"][number]["rules"][number];

const initial: ConsoleResult = { message: null, done: false };

export function PlanRulesMatrix({ matrix }: { matrix: Matrix }) {
  return (
    <div className="-m-5 overflow-x-auto">
      <table className="w-full min-w-[720px] text-[13.5px]">
        <thead className="bg-surface">
          <tr className="border-b border-line">
            <th className="px-5 py-3 text-left text-[12.5px] font-semibold text-fg-3">Regla</th>
            {matrix.plans.map((plan) => (
              <th key={plan.code} className="w-[132px] px-3 py-3 text-center">
                <Badge tone={planTone(plan.rank)} dot={false}>
                  {plan.name}
                </Badge>
                <span className="mt-1 block text-[11.5px] font-normal text-fg-3">
                  {plan.rules} de {matrix.rules} reglas
                </span>
              </th>
            ))}
            <th className="w-[150px] px-3 py-3 text-center text-[12.5px] font-semibold text-fg-3">Agencias con acceso</th>
          </tr>
        </thead>
        <tbody>
          {matrix.groups.map((group) => (
            <RuleGroup key={group.group} group={group} plans={matrix.plans} total={matrix.tenants} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function RuleGroup({ group, plans, total }: { group: Matrix["groups"][number]; plans: Plan[]; total: number }) {
  return (
    <>
      <tr className="bg-surface-2/60">
        <td colSpan={plans.length + 2} className="px-5 py-2 text-[12px] font-semibold text-fg-2">
          {group.group}
        </td>
      </tr>
      {group.rules.map((rule) => {
        const minimum = plans.find((plan) => plan.code === rule.min_plan)?.rank ?? 1;
        return (
          <tr key={rule.code} className="border-b border-line-2 transition-colors duration-200 last:border-b-0 hover:bg-surface-2/50">
            <td className="px-5 py-2.5" title={rule.description ?? undefined}>
              <span className="block font-medium">{rule.name}</span>
              <span className="font-mono text-[11.5px] text-fg-3">{rule.code}</span>
              {rule.default_plan !== rule.min_plan && (
                <Badge tone="sun" dot={false} className="ml-2">
                  Modificada
                </Badge>
              )}
            </td>
            {plans.map((plan) => (
              <td key={plan.code} className="px-3 py-2 text-center">
                <RuleCell rule={rule} plan={plan} minimum={minimum} plans={plans} />
              </td>
            ))}
            <td className="px-3 py-2">
              <span className="flex items-center gap-2">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <span className="block h-full rounded-full bg-[var(--accent)] transition-[width] duration-500" style={{ width: `${(rule.tenants / Math.max(total, 1)) * 100}%` }} />
                </span>
                <span className="font-mono text-[12px] text-fg-2">
                  {rule.tenants}/{total}
                </span>
              </span>
            </td>
          </tr>
        );
      })}
    </>
  );
}

function RuleCell({ rule, plan, minimum, plans }: { rule: Rule; plan: Plan; minimum: number; plans: Plan[] }) {
  const isMinimum = plan.code === rule.min_plan;
  const included = plan.rank >= minimum;
  const current = plans.find((item) => item.code === rule.min_plan);
  const cell = (
    <span
      style={toneStyle(planTone(plan.rank))}
      className={cn(
        "mx-auto grid h-8 min-w-[96px] place-items-center rounded-[9px] px-2 text-[12px] font-semibold transition-transform duration-200",
        isMinimum ? "bg-[var(--tint)] text-white shadow-[0_6px_14px_-8px_var(--tint)]" : included ? "bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] text-[var(--tint)]" : "bg-surface-2 text-fg-3",
        !isMinimum && "group-hover:-translate-y-0.5 group-hover:scale-105",
      )}
    >
      {isMinimum ? "Desde aquí" : included ? <Check size={15} strokeWidth={2.6} /> : <Minus size={14} />}
    </span>
  );

  if (isMinimum) return <span aria-label={`${rule.name}: se incluye desde ${plan.name}`}>{cell}</span>;

  return (
    <PanelAction<ConsoleResult>
      label={`${rule.name} desde ${plan.name}`}
      formId={`rule-${rule.code}-${plan.code}`}
      title={`${rule.name}: incluir desde ${plan.name}`}
      description={`Hoy se incluye desde ${current?.name ?? "Starter"}. Los planes superiores heredan la regla. Las agencias que la pierden conservan su configuración, pero el motor deja de aplicarla.`}
      submitLabel="Aplicar cambio"
      action={applyPlanRule}
      initial={initial}
      trigger={(open) => (
        <button type="button" onClick={open} aria-label={`Incluir ${rule.name} desde ${plan.name}`} className="group block w-full">
          {cell}
        </button>
      )}
    >
      {() => (
        <>
          <input type="hidden" name="rule" value={rule.code} />
          <input type="hidden" name="min_plan" value={plan.code} />
          <RuleImpact rule={rule.code} plan={plan.code} />
        </>
      )}
    </PanelAction>
  );
}

function RuleImpact({ rule, plan }: { rule: string; plan: string }) {
  const key = `${rule}|${plan}`;
  const [state, setState] = useState<{ key: string; change: PlanRuleChange | null; message: string | null } | null>(null);

  useEffect(() => {
    let alive = true;
    previewPlanRule(rule, plan).then((result) => {
      if (alive) setState({ key, ...result });
    });
    return () => {
      alive = false;
    };
  }, [rule, plan, key]);

  if (state?.key !== key) return <PlanChangeNote>Calculando qué agencias cambian de acceso…</PlanChangeNote>;
  if (!state.change) return <PlanChangeNote tone="bad">{state.message}</PlanChangeNote>;

  const { change } = state;
  const lose = change.effect === "lose";

  return (
    <div className="flex flex-col gap-3">
      <div className={cn("rounded-[14px] p-3.5 text-[13px]", lose && change.affected_tenants.length ? "bg-[color-mix(in_srgb,var(--warn)_10%,transparent)]" : "bg-surface-2")}>
        <p className="flex items-center gap-2 font-semibold">
          <Users size={15} />
          {change.affected_tenants.length === 0 ? "Ninguna agencia cambia de acceso" : `${change.affected_tenants.length} ${change.affected_tenants.length === 1 ? "agencia" : "agencias"} ${lose ? "pierden" : "ganan"} la regla`}
        </p>
        <p className="mt-1 text-[12.5px] text-fg-2">{lose ? "Les avisamos por correo. Si la tenían activada, el motor deja de aplicarla y su configuración se conserva por si suben de plan." : "Les avisamos por correo: podrán activarla desde su centro de reglas."}</p>
      </div>
      {change.affected_tenants.length > 0 && (
        <ul className="flex flex-col">
          {change.affected_tenants.map((tenant) => (
            <li key={tenant.code} className="flex items-center gap-3 border-t border-line-2 py-2 text-[13px] first:border-t-0">
              <span className="min-w-0 flex-1 truncate font-medium">{tenant.name}</span>
              <span className="text-[12px] text-fg-3">{tenant.plan}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ResetPlanRulesAction({ differs }: { differs: number }) {
  return (
    <ConsoleAction
      id="plan-rules-reset"
      label="Restablecer matriz"
      icon={<RotateCcw size={16} />}
      title="Restablecer la matriz de demostración"
      description={differs > 0 ? `${differs} ${differs === 1 ? "regla vuelve" : "reglas vuelven"} al plan mínimo de demostración. Las agencias no reciben aviso por este cambio.` : "La matriz ya está en sus valores de demostración."}
      submitLabel="Restablecer"
      action={resetPlanRules}
    />
  );
}
