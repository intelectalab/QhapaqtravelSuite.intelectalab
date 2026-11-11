"use client";

import { ArrowRight, Check, Headset, Hourglass, Infinity as InfinityIcon, ShieldCheck } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { InfoTip } from "@/components/ui/InfoTip";
import { KEY_LIMITS, limitValue } from "@/features/platform/planLimits";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { planTone } from "@/lib/platform";
import { contactHref, monthlyPrice, type BillingCycle, type PublicPlan } from "@/lib/software";
import { toneStyle } from "@/lib/tone";

const HIGHLIGHTS = 5;

export function CycleToggle({ cycle, onChange, saving }: { cycle: BillingCycle; onChange: (cycle: BillingCycle) => void; saving: number }) {
  const options: { value: BillingCycle; label: string }[] = [
    { value: "month", label: "Mensual" },
    { value: "year", label: "Anual" },
  ];
  return (
    <div className="flex flex-wrap items-center gap-3">
      <div role="radiogroup" aria-label="Ciclo de facturación" className="relative grid grid-cols-2 rounded-full border border-line bg-surface p-1 shadow-card">
        <span aria-hidden className={cn("absolute inset-y-1 left-1 w-[calc(50%-4px)] rounded-full bg-fg transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]", cycle === "year" && "translate-x-full")} />
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={cycle === option.value}
            onClick={() => onChange(option.value)}
            className={cn("relative z-10 min-w-[104px] rounded-full px-5 py-2 text-[13.5px] font-semibold transition-colors duration-300", cycle === option.value ? "text-surface" : "text-fg-2 hover:text-fg")}
          >
            {option.label}
          </button>
        ))}
      </div>
      {saving > 0 && (
        <span className={cn("transition-transform duration-500", cycle === "year" ? "scale-105" : "scale-100")}>
          <Badge tone="ok">Ahorra hasta {saving} % pagando el año</Badge>
        </span>
      )}
    </div>
  );
}

function PriceBlock({ plan, cycle, dense = false }: { plan: PublicPlan; cycle: BillingCycle; dense?: boolean }) {
  const price = monthlyPrice(plan, cycle);
  return (
    <div className="mt-6">
      <div className="flex items-end gap-1.5">
        <span key={`${plan.code}-${cycle}`} className={cn("whitespace-nowrap font-mono font-bold leading-none tracking-[-0.04em] text-fg animate-[rise-in_380ms_cubic-bezier(0.22,1,0.36,1)_backwards]", dense ? "text-[30px]" : "text-[40px]")}>
          {formatMoney(price, plan.currency)}
        </span>
        <span className="pb-1 text-[13px] font-medium text-fg-3">al mes</span>
      </div>
      <p className="mt-2 min-h-[24px] text-[13px] text-fg-2">
        {cycle === "year" ? (
          <span className="inline-flex flex-wrap items-center gap-2">
            {formatMoney(plan.price_year, plan.currency)} al año
            {plan.saving_year > 0 && <Badge tone="ok">Ahorras {formatMoney(plan.saving_year, plan.currency)}</Badge>}
          </span>
        ) : (
          <>Facturación mensual, sin permanencia</>
        )}
      </p>
    </div>
  );
}

export function PlanCard({ plan, cycle, featured, index, compact = false, action, current = false }: { plan: PublicPlan; cycle: BillingCycle; featured: boolean; index: number; compact?: boolean; action?: ReactNode; current?: boolean }) {
  const tone = planTone(plan.rank);
  const shown = plan.highlights.slice(0, compact ? 4 : HIGHLIGHTS);
  const rest = plan.highlights.slice(shown.length);
  const rulesShare = plan.rules_total > 0 ? (plan.rules_included / plan.rules_total) * 100 : 0;

  return (
    <article
      style={{ ...toneStyle(tone), animationDelay: `${index * 90}ms` }}
      className={cn(
        "lift group relative flex flex-col overflow-hidden rounded-card border bg-surface p-6 animate-[rise-in_520ms_cubic-bezier(0.22,1,0.36,1)_backwards] sm:p-7",
        featured ? "border-[color-mix(in_srgb,var(--tint)_55%,transparent)] shadow-[0_30px_60px_-36px_var(--tint)] lg:-my-3 lg:py-9" : "border-line shadow-card hover:border-[color-mix(in_srgb,var(--tint)_40%,transparent)]",
      )}
    >
      <span aria-hidden className={cn("absolute inset-x-0 top-0 h-1.5 bg-[var(--tint)]", featured && "weave-band")} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-[22px] font-bold tracking-tight text-fg">{plan.name}</h3>
          {plan.support_level && (
            <p className="mt-1 flex items-center gap-1.5 text-[12.5px] text-fg-3">
              <Headset size={13} />
              {plan.support_level}
            </p>
          )}
        </div>
        {current && <span className="rounded-full bg-[var(--tint)] px-2.5 py-1 text-[11.5px] font-semibold text-white">Tu plan</span>}
        {action === undefined && plan.agencies > 0 && (
          <span className={cn("rounded-full px-2.5 py-1 text-[11.5px] font-semibold", featured ? "bg-[var(--tint)] text-white" : "bg-[color-mix(in_srgb,var(--tint)_12%,transparent)] text-[var(--tint)]")}>
            {plan.agencies} {plan.agencies === 1 ? "agencia" : "agencias"}
          </span>
        )}
      </div>

      <PriceBlock plan={plan} cycle={cycle} dense={action !== undefined} />

      {action !== undefined ? (
        <div className="mt-6 grid min-h-[40px] gap-2">{action}</div>
      ) : (
      <div className="mt-6 grid gap-2">
        <Button href={contactHref("trial", plan.code, cycle)} variant={featured ? "primary" : "dark"} icon={<ArrowRight size={16} />} className="site-sheen relative w-full overflow-hidden">
          Probar {plan.trial_days} días gratis
        </Button>
        {!compact && (
          <Button href={contactHref("demo", plan.code, cycle)} variant="ghost" className="w-full">
            Solicitar una demo
          </Button>
        )}
      </div>
      )}

      <ul className="mt-6 grid grid-cols-2 gap-2">
        {KEY_LIMITS.map((info) => {
          const value = limitValue(plan, info);
          return (
            <li key={info.metric} style={toneStyle(info.tone)} className="rounded-[12px] bg-surface-2 px-3 py-2.5 transition hover:-translate-y-0.5 hover:bg-[color-mix(in_srgb,var(--tint)_10%,var(--surface))]">
              <span className="flex items-center gap-1.5 text-[11.5px] font-medium text-fg-3">
                <info.icon size={13} className="text-[var(--tint)]" />
                {info.label}
              </span>
              <span className="mt-0.5 flex items-center gap-1 text-[14.5px] font-bold text-fg">
                {value.unlimited ? (
                  <>
                    <InfinityIcon size={16} /> Ilimitado
                  </>
                ) : (
                  value.text
                )}
              </span>
            </li>
          );
        })}
      </ul>

      <div className="mt-6 flex-1">
        <p className="text-[13px] font-semibold text-fg">{plan.previous ? `Todo lo de ${plan.previous}, y además` : "Incluye"}</p>
        <ul className="mt-3 grid gap-2">
          {shown.map((item, position) => (
            <li key={item} style={{ animationDelay: `${200 + position * 50}ms` }} className="flex items-start gap-2.5 text-[13.5px] text-fg-2 animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
              <span className="mt-0.5 grid h-[18px] w-[18px] flex-none place-items-center rounded-full bg-[color-mix(in_srgb,var(--tint)_16%,transparent)] text-[var(--tint)] transition-transform duration-300 group-hover:scale-110">
                <Check size={11} strokeWidth={3} />
              </span>
              {item}
            </li>
          ))}
        </ul>
        {rest.length > 0 && (
          <p className="mt-2.5 flex items-center gap-1 pl-[28px] text-[13px] font-semibold text-[var(--tint)]">
            y {rest.length} más
            <InfoTip label={`Más funciones de ${plan.name}`}>
              <ul className="grid gap-1.5">
                {rest.map((item) => (
                  <li key={item} className="text-fg">
                    {item}
                  </li>
                ))}
              </ul>
            </InfoTip>
          </p>
        )}
      </div>

      <div className="mt-6 grid gap-3 border-t border-line pt-5 text-[12.5px]">
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-medium text-fg-2">
              <ShieldCheck size={13} className="text-[var(--tint)]" />
              Reglas de reserva
            </span>
            <span className="font-mono font-semibold text-fg">
              {plan.rules_included} de {plan.rules_total}
            </span>
          </div>
          <span className="block h-1.5 overflow-hidden rounded-full bg-surface-2">
            <span className="block h-full origin-left rounded-full bg-[var(--tint)] motion-safe:animate-[fill-x_900ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ width: `${rulesShare}%`, animationDelay: `${300 + index * 120}ms` }} />
          </span>
        </div>
        {action === undefined && (
          <span className="flex items-center gap-1.5 text-fg-3">
            <Hourglass size={13} />
            {plan.trial_days} días de prueba con todas las funciones del plan
          </span>
        )}
      </div>
    </article>
  );
}
