"use client";

import { Check, ChevronDown, Infinity as InfinityIcon, Minus } from "lucide-react";
import { Fragment, useState, type ReactNode } from "react";
import { InfoTip } from "@/components/ui/InfoTip";
import { PLAN_LIMITS, limitValue } from "@/features/platform/planLimits";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { planTone } from "@/lib/platform";
import { monthlyPrice, type AddonStatus, type BillingCycle, type PlansCatalog, type PublicPlan } from "@/lib/software";
import { toneStyle } from "@/lib/tone";

const UNIT_LABEL: Record<string, string> = { usuario: "por usuario", paquete: "por paquete", dominio: "por dominio", módulo: "" };

function Yes() {
  return (
    <span className="mx-auto grid h-6 w-6 place-items-center rounded-full bg-[color-mix(in_srgb,var(--tint)_16%,transparent)] text-[var(--tint)] transition-transform duration-300 group-hover/row:scale-110">
      <Check size={13} strokeWidth={3} />
    </span>
  );
}

function No({ label = "No incluye" }: { label?: string }) {
  return (
    <span title={label} className="mx-auto grid h-6 w-6 place-items-center text-fg-3/60">
      <Minus size={14} />
    </span>
  );
}

function SectionRow({ title, note, span, open, onToggle }: { title: string; note?: string; span: number; open?: boolean; onToggle?: () => void }) {
  return (
    <tr>
      <th colSpan={span} scope="colgroup" className="sticky left-0 bg-surface px-0 pb-2 pt-9 text-left">
        {onToggle ? (
          <button type="button" onClick={onToggle} aria-expanded={open} className="group flex items-center gap-2 text-[15px] font-bold tracking-tight text-fg">
            <span className="weave-line h-1.5 w-6 rounded-full transition-[width] duration-300 group-hover:w-9" />
            {title}
            {note && <span className="text-[12.5px] font-medium text-fg-3">{note}</span>}
            <ChevronDown size={16} className={cn("text-fg-3 transition-transform duration-300", open && "rotate-180")} />
          </button>
        ) : (
          <span className="flex items-center gap-2 text-[15px] font-bold tracking-tight text-fg">
            <span className="weave-line h-1.5 w-6 rounded-full" />
            {title}
            {note && <span className="text-[12.5px] font-medium text-fg-3">{note}</span>}
          </span>
        )}
      </th>
    </tr>
  );
}

interface RowProps {
  label: ReactNode;
  hint?: string;
  plans: PublicPlan[];
  hovered: number | null;
  onHover: (index: number | null) => void;
  cell: (plan: PublicPlan) => ReactNode;
  nested?: boolean;
}

function Row({ label, hint, plans, hovered, onHover, cell, nested = false }: RowProps) {
  return (
    <tr className="group/row border-t border-line-2 transition-colors hover:bg-surface-2/70">
      <th scope="row" className={cn("sticky left-0 z-10 bg-surface py-3 pr-4 text-left text-[13.5px] font-medium text-fg-2 transition-colors group-hover/row:bg-surface-2 group-hover/row:text-fg", nested && "pl-5 text-[13px]")}>
        <span className="inline-flex items-center gap-1.5">
          {label}
          {hint && <InfoTip label="Qué significa">{hint}</InfoTip>}
        </span>
      </th>
      {plans.map((plan, index) => (
        <td
          key={plan.code}
          style={toneStyle(planTone(plan.rank))}
          onMouseEnter={() => onHover(index)}
          onMouseLeave={() => onHover(null)}
          className={cn("px-3 py-3 text-center text-[13.5px] text-fg transition-colors duration-200", hovered === index && "bg-[color-mix(in_srgb,var(--tint)_7%,transparent)]")}
        >
          {cell(plan)}
        </td>
      ))}
    </tr>
  );
}

function featureCell(value: string | null, addonStatus: AddonStatus | undefined, addonPrice: number | null, currency: string): ReactNode {
  if (value === "incluido") return <Yes />;
  if (value) {
    return (
      <span className="inline-flex flex-col items-center gap-0.5">
        <span className="rounded-[7px] bg-[color-mix(in_srgb,var(--tint)_12%,transparent)] px-2 py-0.5 text-[12px] font-semibold capitalize text-[var(--tint)]">{value}</span>
        {addonStatus === "available" && addonPrice !== null && <span className="text-[11.5px] text-fg-3">Completo +{formatMoney(addonPrice, currency)}</span>}
      </span>
    );
  }
  if (addonStatus === "available" && addonPrice !== null) return <span className="text-[12.5px] font-medium text-fg-2">Adicional {formatMoney(addonPrice, currency)}</span>;
  if (addonStatus === "included") return <Yes />;
  return <No />;
}

export function PlanMatrix({ catalog, cycle }: { catalog: PlansCatalog; cycle: BillingCycle }) {
  const { plans, currency } = catalog;
  const [hovered, setHovered] = useState<number | null>(null);
  const [openRules, setOpenRules] = useState<string[]>([]);
  const span = plans.length + 1;
  const addonByCode = new Map(catalog.addons.map((addon) => [addon.code, addon]));
  const rowProps = { plans, hovered, onHover: setHovered };
  const toggleRules = (group: string) => setOpenRules((current) => (current.includes(group) ? current.filter((item) => item !== group) : [...current, group]));

  return (
    <div className="scroll-thin -mx-5 overflow-x-auto px-5 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[720px] border-separate border-spacing-0">
        <colgroup>
          <col className="w-[34%]" />
          {plans.map((plan) => (
            <col key={plan.code} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <th scope="col" className="sticky left-0 z-20 bg-surface pb-4 text-left align-bottom">
              <span className="text-[12.5px] font-semibold text-fg-3">Compara lo que incluye cada plan</span>
            </th>
            {plans.map((plan, index) => (
              <th
                key={plan.code}
                scope="col"
                style={toneStyle(planTone(plan.rank))}
                onMouseEnter={() => setHovered(index)}
                onMouseLeave={() => setHovered(null)}
                className="bg-surface px-3 pb-4 align-bottom"
              >
                <span className={cn("block rounded-[14px] border px-3 py-3 transition-all duration-300", hovered === index ? "-translate-y-0.5 border-[color-mix(in_srgb,var(--tint)_45%,transparent)] bg-[color-mix(in_srgb,var(--tint)_8%,var(--surface))]" : "border-line")}>
                  <span className="mx-auto mb-2 block h-1 w-8 rounded-full bg-[var(--tint)]" />
                  <span className="block text-[15px] font-bold text-fg">{plan.name}</span>
                  <span key={cycle} className="mt-0.5 block font-mono text-[13px] font-semibold text-[var(--tint)] animate-[rise-in_320ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
                    {formatMoney(monthlyPrice(plan, cycle), plan.currency)} al mes
                  </span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <SectionRow title="Límites de uso" span={span} />
          {PLAN_LIMITS.map((info) => (
            <Row
              key={info.metric}
              {...rowProps}
              label={info.label}
              hint={info.hint}
              cell={(plan) => {
                const value = limitValue(plan, info);
                if (value.unlimited) return <span className="inline-flex items-center gap-1 font-semibold text-[var(--tint)]"><InfinityIcon size={15} /> Ilimitado</span>;
                return value.none ? <No /> : <span className="font-mono font-semibold">{value.text}</span>;
              }}
            />
          ))}

          {catalog.features.map((group) => (
            <Fragment key={group.group}>
              <SectionRow title={group.group} span={span} />
              {group.items.map((feature) => {
                const addon = feature.addon ? addonByCode.get(feature.addon) : undefined;
                return (
                  <Row
                    key={feature.key}
                    {...rowProps}
                    label={feature.label}
                    hint={feature.kind === "limit" ? "Incluido con un límite de uso según el plan." : undefined}
                    cell={(plan) => featureCell(feature.values[plan.code] ?? null, addon?.plans[plan.code]?.status, addon?.plans[plan.code]?.price ?? null, currency)}
                  />
                );
              })}
            </Fragment>
          ))}

          {catalog.rules.length > 0 && (
            <>
              <SectionRow title="Reglas de reserva" note={`${catalog.rules.reduce((total, group) => total + group.rules.length, 0)} reglas en ${catalog.rules.length} grupos`} span={span} />
              {catalog.rules.map((group) => {
                const open = openRules.includes(group.group);
                return (
                  <Fragment key={group.group}>
                    <Row
                      {...rowProps}
                      label={
                        <button type="button" onClick={() => toggleRules(group.group)} aria-expanded={open} className="inline-flex items-center gap-1.5 font-semibold text-fg">
                          <ChevronDown size={14} className={cn("text-fg-3 transition-transform duration-300", open && "rotate-180")} />
                          {group.group}
                        </button>
                      }
                      cell={(plan) => {
                        const included = group.rules.filter((rule) => rule.rank <= plan.rank).length;
                        return included === 0 ? <No /> : <span className={cn("font-mono text-[13px] font-semibold", included === group.rules.length ? "text-[var(--tint)]" : "text-fg-2")}>{included} de {group.rules.length}</span>;
                      }}
                    />
                    {open &&
                      group.rules.map((rule) => (
                        <Row key={rule.code} {...rowProps} nested label={rule.name} hint={rule.description} cell={(plan) => (rule.rank <= plan.rank ? <Yes /> : <No />)} />
                      ))}
                  </Fragment>
                );
              })}
            </>
          )}

          {catalog.addons.length > 0 && (
            <>
              <SectionRow title="Adicionales" note="Se suman a la mensualidad" span={span} />
              {catalog.addons.map((addon) => (
                <Row
                  key={addon.code}
                  {...rowProps}
                  label={addon.label}
                  cell={(plan) => {
                    const offer = addon.plans[plan.code];
                    if (!offer || offer.status === "unavailable") return <No label="No disponible" />;
                    if (offer.status === "included") return <span className="text-[12.5px] font-semibold text-[var(--tint)]">Incluido</span>;
                    return (
                      <span className="inline-flex flex-col items-center">
                        <span className="font-mono font-semibold">{offer.price !== null ? formatMoney(offer.price, currency) : "A consultar"}</span>
                        <span className="text-[11.5px] text-fg-3">al mes {UNIT_LABEL[addon.unit ?? ""] ?? ""}</span>
                      </span>
                    );
                  }}
                />
              ))}
            </>
          )}

          <SectionRow title="Acompañamiento" span={span} />
          <Row {...rowProps} label="Soporte" cell={(plan) => <span className="text-[12.5px] text-fg-2">{plan.support_level ?? "Estándar"}</span>} />
          <Row {...rowProps} label="Prueba gratuita" cell={(plan) => <span className="font-mono font-semibold">{plan.trial_days} días</span>} />
        </tbody>
      </table>
    </div>
  );
}
