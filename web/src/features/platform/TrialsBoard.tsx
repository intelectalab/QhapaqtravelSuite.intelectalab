"use client";

import { CalendarPlus, CreditCard, Hourglass, Sparkles, TimerReset, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { convertTrial, extendTrial } from "@/app/plataforma/(consola)/facturacion/actions";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { EmptyState } from "@/components/ui/EmptyState";
import { SelectField } from "@/components/ui/SelectField";
import { TintTile, ToneScope } from "@/components/ui/Tinted";
import { formatDate, formatMoney } from "@/lib/format";
import type { TrialItem, TrialsOverview } from "@/lib/platformBilling";
import type { Tone } from "@/lib/tone";
import { ConsoleAction } from "./ConsoleAction";

const urgency = (days: number | null): Tone => (days === null ? "mute" : days <= 3 ? "bad" : days <= 7 ? "warn" : "info");

const left = (days: number | null) => (days === null ? "Sin fecha" : days < 0 ? `Venció hace ${Math.abs(days)} ${Math.abs(days) === 1 ? "día" : "días"}` : days === 0 ? "Vence hoy" : `${days} ${days === 1 ? "día" : "días"}`);

export function TrialsBoard({ overview }: { overview: TrialsOverview }) {
  const soon = overview.items.filter((item) => item.days_left !== null && item.days_left <= 7).length;
  const withoutCard = overview.items.filter((item) => !item.payment_method).length;

  return (
    <>
      <section aria-label="Resumen de pruebas" className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3">
        <TintTile icon={Hourglass} tone="info" label="Agencias en prueba" value={overview.items.length} />
        <TintTile icon={TimerReset} tone="warn" label="Vencen en 7 días" value={soon} />
        <TintTile icon={CreditCard} tone="violet" label="Sin tarjeta registrada" value={withoutCard} note="Se suspenden al vencer" />
      </section>
      {overview.items.length === 0 ? (
        <Card>
          <EmptyState icon={<Hourglass size={22} />} title="No hay agencias en prueba" description="Las agencias nuevas aparecen aquí durante sus días de prueba gratis." />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {overview.items.map((item, index) => (
            <TrialCard key={item.id} item={item} index={index} coupons={overview.coupons} plans={overview.plans} />
          ))}
        </div>
      )}
    </>
  );
}

function TrialCard({ item, index, coupons, plans }: { item: TrialItem; index: number; coupons: TrialsOverview["coupons"]; plans: TrialsOverview["plans"] }) {
  const tone = urgency(item.days_left);
  const total = Math.max(1, Math.round((new Date(`${item.ends_at}T12:00:00`).getTime() - new Date(`${item.starts_at}T12:00:00`).getTime()) / 86_400_000));
  const elapsed = Math.min(100, Math.max(0, ((total - (item.days_left ?? 0)) / total) * 100));
  const extensions = [7, 14].filter((days) => item.extended_days + days <= 14);

  return (
    <ToneScope tone={tone}>
      <article className="lift flex h-full animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col rounded-card border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] bg-surface p-5 shadow-card" style={{ animationDelay: `${index * 80}ms` }}>
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Link href={`/plataforma/agencias/${item.tenant.code}`} className="text-[15px] font-semibold hover:underline">
              {item.tenant.name}
            </Link>
            <p className="truncate text-[13px] text-fg-3">{item.tenant.email}</p>
          </div>
          <Badge tone={tone}>{left(item.days_left)}</Badge>
        </header>

        <div className="mb-1.5 flex justify-between text-[12px] text-fg-3">
          <span>{formatDate(item.starts_at)}</span>
          <span>{formatDate(item.ends_at)}</span>
        </div>
        <div className="mb-4 h-2 overflow-hidden rounded-full bg-surface-2">
          <span className="block h-full origin-left rounded-full bg-[var(--tint)] motion-safe:animate-[fill-x_800ms_cubic-bezier(0.4,0,0.2,1)_backwards]" style={{ width: `${elapsed}%` }} />
        </div>

        <dl className="mb-4 grid grid-cols-3 gap-2 text-[13px]">
          <Fact icon={<Sparkles size={14} />} label="Plan" value={`${item.plan.name} · ${formatMoney(item.plan.price_month)}`} />
          <Fact icon={<Users size={14} />} label="Usuarios" value={String(item.users)} />
          <Fact icon={<CreditCard size={14} />} label="Tarjeta" value={item.payment_method ?? "Sin registrar"} />
        </dl>
        {item.extended_days > 0 && <p className="mb-4 text-[12.5px] text-fg-3">Ya se extendió {item.extended_days} días de los 14 permitidos.</p>}

        <div className="mt-auto flex flex-wrap gap-2">
          <ConsoleAction
            id={`convert-${item.tenant.code}`}
            label="Convertir en suscripción"
            icon={<Sparkles size={15} />}
            variant="primary"
            size="sm"
            title={`Convertir a ${item.tenant.name}`}
            description="La agencia pasa a estar activa. Se emite la primera factura por cobrar con vencimiento a 7 días y se le avisa por correo para que registre su tarjeta."
            submitLabel="Convertir"
            action={convertTrial}
            fields={{ tenant: item.tenant.code }}
          >
            <TrialConvertFields item={item} plans={plans} coupons={coupons} />
          </ConsoleAction>
          {extensions.length > 0 && (
            <ConsoleAction
              id={`extend-trial-${item.tenant.code}`}
              label="Extender prueba"
              icon={<CalendarPlus size={15} />}
              size="sm"
              title={`Extender la prueba de ${item.tenant.name}`}
              description={`Vence el ${formatDate(item.ends_at)}. Una prueba se puede extender hasta 14 días en total.`}
              submitLabel="Extender"
              action={extendTrial}
              fields={{ tenant: item.tenant.code }}
            >
              <ChoiceGroup label="Días adicionales" name="days" options={extensions.map((days) => ({ value: String(days), label: `${days} días` }))} defaultValue={String(extensions[0])} />
            </ConsoleAction>
          )}
        </div>
      </article>
    </ToneScope>
  );
}

function TrialConvertFields({ item, plans, coupons }: { item: TrialItem; plans: TrialsOverview["plans"]; coupons: TrialsOverview["coupons"] }) {
  const [plan, setPlan] = useState(item.plan.code);
  const [cycle, setCycle] = useState<"monthly" | "annual">(item.cycle);
  const chosen = plans.find((option) => option.code === plan);
  const valid = coupons.filter((coupon) => coupon.plans.length === 0 || coupon.plans.includes(plan));
  const price = chosen ? (cycle === "annual" ? chosen.price_year : chosen.price_month) : 0;
  const current = plans.find((option) => option.code === item.plan.code);

  return (
    <>
      <ChoiceGroup label="Plan" name="plan" options={plans.map((option) => ({ value: option.code, label: option.code === item.plan.code ? `${option.name} (actual)` : option.name }))} defaultValue={item.plan.code} onChange={setPlan} />
      <ChoiceGroup label="Ciclo de pago" name="cycle" options={[{ value: "monthly", label: "Mensual" }, { value: "annual", label: "Anual" }]} defaultValue={item.cycle} onChange={(value) => setCycle(value as "monthly" | "annual")} />
      <SelectField key={plan} label="Cupón (opcional)" name="coupon" options={[{ value: "", label: "Sin cupón" }, ...valid.map((coupon) => ({ value: coupon.code, label: `${coupon.code} · ${coupon.label}` }))]} defaultValue="" hint={valid.length < coupons.length ? "Solo se listan los cupones que aplican al plan elegido." : "Se descuenta desde la primera factura."} />
      <div className="rounded-[14px] border border-line p-3.5 text-[13px]">
        <p className="font-semibold">
          Primera factura: {formatMoney(price)} {cycle === "annual" ? "al año" : "al mes"} + IGV
        </p>
        <p className="mt-1 text-[12.5px] text-fg-3">
          {chosen && current && chosen.rank < current.rank ? "Es un plan menor: sus usuarios, sedes y almacenamiento deben caber en él." : cycle === "annual" ? "El periodo pagado dura 12 meses desde hoy." : "El periodo pagado dura un mes desde hoy."}
        </p>
      </div>
    </>
  );
}

function Fact({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-[11px] bg-[color-mix(in_srgb,var(--tint)_7%,var(--surface))] px-2.5 py-2">
      <dt className="flex items-center gap-1 text-[11.5px] text-fg-3">
        {icon}
        {label}
      </dt>
      <dd className="truncate font-medium" title={value}>
        {value}
      </dd>
    </div>
  );
}
