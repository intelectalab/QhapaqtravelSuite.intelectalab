"use client";

import { ArrowRight, Check, ChevronDown, Layers, Lock, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { InfoTip } from "@/components/ui/InfoTip";
import { TintCardTitle } from "@/components/ui/Tinted";
import { CycleToggle, PlanCard } from "@/features/software/PlanCards";
import { PlanMatrix } from "@/features/software/PlanMatrix";
import type { BillingCycle as SubscriptionCycle, PlanRules } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { planTone } from "@/lib/platform";
import type { BillingCycle } from "@/lib/software";
import { toneStyle } from "@/lib/tone";
import { ChangePlanAction } from "./SubscriptionActions";

function Ring({ value, total }: { value: number; total: number }) {
  const share = total > 0 ? value / total : 0;
  const radius = 52;
  const length = 2 * Math.PI * radius;
  return (
    <div className="relative grid h-[132px] w-[132px] flex-none place-items-center">
      <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90">
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--surface-2)" strokeWidth="11" />
        <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--tint)" strokeWidth="11" strokeLinecap="round" strokeDasharray={length} strokeDashoffset={length * (1 - share)} className="transition-[stroke-dashoffset] duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)]" />
      </svg>
      <div className="text-center">
        <b className="block font-mono text-[28px] font-bold leading-none">{Math.round(share * 100)}%</b>
        <span className="text-[11.5px] text-fg-3">
          {value} de {total}
        </span>
      </div>
    </div>
  );
}

function GroupCard({ group, rank, plans, index }: { group: PlanRules["rules"][number]; rank: number; plans: PlanRules["plans"]; index: number }) {
  const [open, setOpen] = useState(false);
  const included = group.rules.filter((rule) => rule.rank <= rank).length;
  const share = group.rules.length > 0 ? (included / group.rules.length) * 100 : 0;
  return (
    <div style={{ animationDelay: `${index * 50}ms` }} className="lift rounded-tile border border-line-2 bg-surface p-4 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 text-left">
        <span className="min-w-0">
          <b className="block truncate text-[13.5px]">{group.group}</b>
          <span className="text-[12px] text-fg-3">
            {included} de {group.rules.length} incluidas
          </span>
        </span>
        <ChevronDown size={16} className={cn("flex-none text-fg-3 transition-transform duration-300", open && "rotate-180")} />
      </button>
      <span className="mt-3 block h-1.5 overflow-hidden rounded-full bg-surface-2">
        <span className="block h-full rounded-full bg-[var(--tint)] motion-safe:animate-[fill-x_800ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ width: `${share}%` }} />
      </span>
      {open && (
        <ul className="mt-3 grid gap-1.5 border-t border-line-2 pt-3 animate-[rise-in_260ms_ease-out]">
          {group.rules.map((rule) => {
            const on = rule.rank <= rank;
            return (
              <li key={rule.code} title={rule.description ?? undefined} className={cn("flex items-center gap-2 text-[12.5px]", !on && "text-fg-3")}>
                {on ? <Check size={14} className="flex-none text-ok" /> : <Lock size={13} className="flex-none" />}
                <span className="min-w-0 flex-1 truncate">{rule.name}</span>
                {!on && rule.from && <span className="flex-none text-[11px]">{plans.find((plan) => plan.code === rule.from)?.name ?? rule.from}</span>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function PlanCoverage({ rules, cycle, manage }: { rules: PlanRules; cycle: SubscriptionCycle; manage: boolean }) {
  const current = rules.plans.find((plan) => plan.code === rules.current);
  const rank = current?.rank ?? 0;
  const all = rules.rules.flatMap((group) => group.rules);
  const included = all.filter((rule) => rule.rank <= rank).length;
  const upgrades = rules.plans.filter((plan) => plan.rank > rank);
  return (
    <div className="flex flex-col gap-5" style={toneStyle(planTone(rank))}>
      <Card>
        <div className="flex flex-wrap items-center gap-6">
          <Ring value={included} total={all.length} />
          <div className="min-w-0 flex-1">
            <p className="text-[12.5px] font-medium text-fg-3">Reglas del motor de reservas</p>
            <h2 className="mt-0.5 text-[22px] font-bold tracking-tight">Tu plan {current?.name} incluye {included} de {all.length}</h2>
            <p className="mt-1 max-w-xl text-[13px] text-fg-2">Las reglas no incluidas aparecen con candado en el centro de reglas. Al mejorar de plan se habilitan y conservan su configuración.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button href="/admin/suscripcion/comparar" size="sm" variant="primary" icon={<ArrowRight size={14} />}>
                Comparar planes
              </Button>
              <Button href="/admin/reglas" size="sm" variant="ghost">
                Ir al centro de reglas
              </Button>
            </div>
          </div>
        </div>
      </Card>

      <section>
        <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
          <ShieldCheck size={17} className="text-[var(--tint)]" />
          Cobertura por grupo
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {rules.rules.map((group, index) => (
            <GroupCard key={group.group} group={group} rank={rank} plans={rules.plans} index={index} />
          ))}
        </div>
      </section>

      {upgrades.length > 0 && (
        <section>
          <h3 className="mb-3 flex items-center gap-2 text-[15px] font-semibold">
            <Sparkles size={17} className="text-[var(--tint)]" />
            Lo que suma cada mejora
          </h3>
          <div className="grid gap-3 md:grid-cols-2">
            {upgrades.map((plan) => {
              const unlocked = all.filter((rule) => rule.rank > rank && rule.rank <= plan.rank);
              return (
                <div key={plan.code} style={toneStyle(planTone(plan.rank))} className="lift flex flex-col rounded-tile border border-[color-mix(in_srgb,var(--tint)_30%,transparent)] bg-[color-mix(in_srgb,var(--tint)_5%,var(--surface))] p-4">
                  <div className="flex items-baseline justify-between gap-3">
                    <b className="text-[16px]">{plan.name}</b>
                    <span className="font-mono text-[22px] font-bold text-[var(--tint)]">+{unlocked.length}</span>
                  </div>
                  <p className="text-[12px] text-fg-3">reglas que se habilitan</p>
                  <ul className="mt-3 flex-1 space-y-1.5 text-[12.5px]">
                    {unlocked.slice(0, 4).map((rule) => (
                      <li key={rule.code} className="flex items-center gap-2">
                        <Check size={14} className="flex-none text-[var(--tint)]" />
                        <span className="truncate">{rule.name}</span>
                      </li>
                    ))}
                  </ul>
                  {unlocked.length > 4 && (
                    <p className="mt-1.5 flex items-center gap-1 pl-[22px] text-[12.5px] font-semibold text-[var(--tint)]">
                      y {unlocked.length - 4} más
                      <InfoTip label={`Reglas que suma ${plan.name}`}>
                        <ul className="grid gap-1">
                          {unlocked.slice(4).map((rule) => (
                            <li key={rule.code}>{rule.name}</li>
                          ))}
                        </ul>
                      </InfoTip>
                    </p>
                  )}
                  {manage && (
                    <div className="mt-4">
                      <ChangePlanAction plans={rules.plans} current={rules.current} cycle={cycle} currency={plan.currency} target={plan.code} trigger={(open) => <Button size="sm" variant="primary" icon={<Layers size={14} />} onClick={open} className="w-full">Mejorar a {plan.name}</Button>} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

export function PlanComparison({ rules, cycle: subscriptionCycle, manage }: { rules: PlanRules; cycle: SubscriptionCycle; manage: boolean }) {
  const [cycle, setCycle] = useState<BillingCycle>(subscriptionCycle === "annual" ? "year" : "month");
  const current = rules.plans.find((plan) => plan.code === rules.current);
  const rank = current?.rank ?? 0;
  const saving = Math.max(0, ...rules.plans.map((plan) => plan.saving_percent));
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CycleToggle cycle={cycle} onChange={setCycle} saving={saving} />
        <Link href="/admin/suscripcion/planes" className="text-[13px] font-semibold text-accent hover:underline">
          Ver la cobertura de tu plan
        </Link>
      </div>
      <div className="grid items-start gap-5 lg:grid-cols-3">
        {rules.plans.map((plan, index) => (
          <PlanCard
            key={plan.code}
            plan={plan}
            cycle={cycle}
            featured={plan.code === rules.current}
            current={plan.code === rules.current}
            index={index}
            compact
            action={
              plan.code === rules.current ? (
                <span className="grid h-10 place-items-center rounded-control bg-surface-2 text-[13px] font-semibold text-fg-2">Es tu plan actual</span>
              ) : manage ? (
                <ChangePlanAction plans={rules.plans} current={rules.current} cycle={subscriptionCycle} currency={plan.currency} target={plan.code} trigger={(open) => <Button variant={plan.rank > rank ? "primary" : "ghost"} onClick={open} className="w-full">{plan.rank > rank ? `Mejorar a ${plan.name}` : `Pasar a ${plan.name}`}</Button>} />
              ) : (
                <span className="grid h-10 place-items-center text-[12.5px] text-fg-3">Lo cambia quien gestiona la facturación</span>
              )
            }
          />
        ))}
      </div>
      <Card>
        <TintCardTitle icon={Layers} title="Comparativo detallado" />
        <PlanMatrix catalog={rules} cycle={cycle} />
      </Card>
    </div>
  );
}
