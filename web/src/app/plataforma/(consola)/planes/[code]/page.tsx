import { Building2, Check, Headset, Hourglass, Infinity as InfinityIcon, Lock, Minus, PackagePlus, Sparkles, Ticket } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/shell/PageHeader";
import { Badge, StatusBadge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PLAN_LIMITS, limitValue } from "@/features/platform/planLimits";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { PLAN_STATUS, planTone, tenantTotal, type FeatureKind, type PlanDetail } from "@/lib/platform";
import { getPlan } from "@/lib/server/platform";
import { toneStyle } from "@/lib/tone";

const KIND_LABEL: Partial<Record<FeatureKind, string>> = { limit: "Con límite", addon: "Se contrata aparte", beta: "En prueba cerrada" };

const softTint = "bg-[color-mix(in_srgb,var(--tint)_9%,var(--surface))]";

export async function generateMetadata({ params }: PageProps<"/plataforma/planes/[code]">): Promise<Metadata> {
  const { code } = await params;
  return { title: `Plan ${(await getPlan(code)).name}` };
}

export default async function PlanPage({ params }: PageProps<"/plataforma/planes/[code]">) {
  const { code } = await params;
  const plan = await getPlan(code);
  const tone = planTone(plan.rank);
  const status = PLAN_STATUS[plan.status];

  return (
    <div style={toneStyle(tone)}>
      <PageHeader
        back={{ href: "/plataforma/planes", label: "Planes" }}
        jump={false}
        leading={
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--tint)] text-white shadow-[0_10px_24px_-12px_var(--tint)]">
            <Ticket size={26} />
          </span>
        }
        title={plan.name}
        info={
          <span className="ml-2 flex-none">
            <Badge tone={status.tone}>{status.label}</Badge>
          </span>
        }
        subtitle={`${plan.module_count} módulos · ${plan.rules_included} de ${plan.rules_total} reglas de reserva`}
      />

      <PlanHero plan={plan} />

      <section aria-label="Límites" className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {PLAN_LIMITS.map((info) => {
          const value = limitValue(plan, info);
          const Icon = info.icon;
          return (
            <div key={info.metric} title={info.hint} style={toneStyle(info.tone)} className={cn("rounded-tile border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] px-4 py-3.5", softTint)}>
              <span className="mb-2.5 grid h-8 w-8 place-items-center rounded-[9px] bg-[var(--tint)] text-white">
                <Icon size={16} />
              </span>
              <p className="text-[12.5px] font-medium text-fg-2">{info.label}</p>
              {value.unlimited ? (
                <p className="mt-0.5 flex items-center gap-1.5 text-[19px] font-bold text-[var(--tint)]">
                  <InfinityIcon size={20} />
                  <span className="text-[13px] font-semibold">Sin límite</span>
                </p>
              ) : (
                <p className={cn("mt-0.5 text-[19px] font-bold tracking-tight", value.none && "text-[14px] font-semibold text-fg-3")}>{value.text}</p>
              )}
            </div>
          );
        })}
      </section>

      <div className="mb-5 grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardTitle icon={<Check size={16} />} title="Módulos" aside={`${plan.module_count} incluidos`} />
          <FeatureGroups features={plan.features} />
        </Card>
        <div className="flex flex-col gap-5">
          <Card>
            <CardTitle icon={<PackagePlus size={16} />} title="Complementos" />
            <ul className="flex flex-col gap-2">
              {plan.addons.map((addon) => (
                <li key={addon.code} className={cn("flex items-center gap-3 rounded-[11px] px-3 py-2.5", addon.included ? softTint : "bg-surface-2")}>
                  <span className="min-w-0 flex-1 text-[13px] font-medium">{addon.label}</span>
                  {addon.included ? (
                    <span className="text-xs font-semibold text-[var(--tint)]">Incluido</span>
                  ) : (
                    <span className="whitespace-nowrap font-mono text-[12.5px] font-semibold">
                      {formatMoney(addon.price ?? 0, plan.currency)}
                      <span className="font-sans text-[11px] font-normal text-fg-3"> /{addon.unit ?? "mes"}</span>
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </Card>
          <Card>
            <CardTitle icon={<Building2 size={16} />} title="Agencias con este plan" aside={String(tenantTotal(plan))} />
            {plan.agencies.length === 0 ? (
              <p className="text-[13.5px] text-fg-3">Ninguna agencia usa este plan todavía.</p>
            ) : (
              <ul className="flex flex-col">
                {plan.agencies.map((agency) => (
                  <li key={agency.code} className="flex items-center gap-3 border-t border-line-2 py-2.5 first:border-t-0">
                    <Link href={`/plataforma/agencias/${agency.code}`} className="min-w-0 flex-1 truncate text-[13.5px] font-semibold hover:underline">
                      {agency.name}
                    </Link>
                    <StatusBadge status={agency.status} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card>
        <CardTitle icon={<Lock size={16} />} title="Reglas de reserva" aside={`${plan.rules_included} de ${plan.rules_total}`} />
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface-2">
          <span className="block h-full rounded-full bg-[var(--tint)]" style={{ width: `${(plan.rules_included / Math.max(plan.rules_total, 1)) * 100}%` }} />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {plan.rules.map((group) => (
            <div key={group.group} className={cn("rounded-[14px] p-3.5", softTint)}>
              <p className="mb-2 flex items-center justify-between text-[13px] font-bold">
                {group.group}
                <span className="font-mono text-xs font-semibold text-[var(--tint)]">
                  {group.rules.filter((rule) => rule.included).length}/{group.rules.length}
                </span>
              </p>
              <ul className="flex flex-col gap-1.5">
                {group.rules.map((rule) => (
                  <li key={rule.code} title={rule.description} className={cn("flex items-start gap-2 text-[12.5px]", !rule.included && "text-fg-3")}>
                    {rule.included ? <Check size={14} strokeWidth={2.6} className="mt-px flex-none text-[var(--tint)]" /> : <Lock size={13} className="mt-0.5 flex-none" />}
                    <span>
                      {rule.name}
                      {!rule.included && <span className="block text-[11px]">Desde {rule.from}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function PlanHero({ plan }: { plan: PlanDetail }) {
  const saving = Number(plan.price_month) * 12 - Number(plan.price_year);
  return (
    <section className="relative isolate mb-5 overflow-hidden rounded-card bg-[var(--tint)] p-6 text-white shadow-[0_18px_40px_-24px_var(--tint)] sm:p-7">
      <span aria-hidden className="weave-pattern absolute inset-0 -z-10 bg-[length:22px_22px] opacity-[0.09]" />
      <span aria-hidden className="absolute -right-24 -top-24 -z-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div>
          <p className="text-[13px] font-medium text-white/70">Precio mensual</p>
          <p className="mt-1 text-[40px] font-bold leading-none tracking-[-0.03em]">{formatMoney(plan.price_month, plan.currency)}</p>
          <p className="mt-2 text-[13.5px] text-white/75">
            Más IGV · {formatMoney(plan.price_year, plan.currency)} al año{saving > 0 ? `, ahorra ${formatMoney(saving, plan.currency)}` : ""}
          </p>
          <div className="mt-5 flex flex-wrap gap-2">
            <HeroChip icon={<Hourglass size={14} />}>{plan.trial_days > 0 ? `${plan.trial_days} días de prueba gratis` : "Sin prueba gratis"}</HeroChip>
            <HeroChip icon={<Headset size={14} />}>{plan.support_level ?? "Soporte estándar"}</HeroChip>
            <HeroChip icon={<Building2 size={14} />}>
              {plan.tenants.active} activas · {plan.tenants.trial} en prueba
            </HeroChip>
          </div>
        </div>
        <div className="rounded-[16px] bg-white/[0.1] p-4 ring-1 ring-white/15">
          <p className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold">
            <Sparkles size={15} />
            {plan.previous ? `Todo lo de ${plan.previous}, más:` : "Incluye:"}
          </p>
          <ul className="grid gap-x-4 gap-y-1.5 sm:grid-cols-2">
            {plan.highlights.map((item) => (
              <li key={item} className="flex items-start gap-2 text-[13px] text-white/90">
                <Check size={14} strokeWidth={2.6} className="mt-0.5 flex-none" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function HeroChip({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[12.5px] font-medium">
      {icon}
      {children}
    </span>
  );
}

function CardTitle({ icon, title, aside }: { icon: ReactNode; title: string; aside?: string }) {
  return (
    <div className="mb-3.5 flex items-center justify-between gap-3">
      <h3 className="flex items-center gap-2 text-[15px] font-semibold">
        <span className="grid h-7 w-7 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--tint)_14%,transparent)] text-[var(--tint)]">{icon}</span>
        {title}
      </h3>
      {aside && <span className="text-[13px] font-semibold text-fg-3">{aside}</span>}
    </div>
  );
}

function FeatureGroups({ features }: { features: PlanDetail["features"] }) {
  const groups = [...new Set(features.map((feature) => feature.group ?? "Otros"))];
  return (
    <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
      {groups.map((group) => (
        <div key={group}>
          <span className="mb-1.5 inline-block rounded-md bg-[color-mix(in_srgb,var(--tint)_12%,transparent)] px-2 py-0.5 text-[11.5px] font-bold text-[var(--tint)]">{group}</span>
          <ul className="flex flex-col">
            {features
              .filter((feature) => (feature.group ?? "Otros") === group)
              .map((feature) => {
                const on = feature.value !== null;
                const note = on && feature.value !== "incluido" ? feature.value : KIND_LABEL[feature.kind];
                return (
                  <li key={feature.key} className="flex items-center gap-2.5 py-1.5">
                    <span className={cn("grid h-5 w-5 flex-none place-items-center rounded-full", on ? "bg-[var(--tint)] text-white" : "bg-surface-2 text-fg-3")}>
                      {on ? <Check size={12} strokeWidth={3} /> : <Minus size={12} strokeWidth={3} />}
                    </span>
                    <span className={cn("min-w-0 flex-1 text-[13.5px]", on ? "font-medium" : "text-fg-3")}>{feature.label}</span>
                    {note && <span className="whitespace-nowrap text-[11.5px] text-fg-3">{note}</span>}
                  </li>
                );
              })}
          </ul>
        </div>
      ))}
    </div>
  );
}
