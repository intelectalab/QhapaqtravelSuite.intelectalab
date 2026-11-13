"use client";

import { ArrowLeft, ArrowRight, BadgeCheck, Building2, Check, LoaderCircle, Lock, Mail, Phone, Search, Tag, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useState, useTransition } from "react";
import { checkCoupon, createSignup, lookupRuc } from "@/app/(software)/software/suscribirse/actions";
import { Button } from "@/components/ui/Button";
import { Captcha } from "@/components/ui/Captcha";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import { CYCLE_LABEL, type LandingCatalog, type LandingPlan, type SignupCycle, type SignupTotals, type Taxpayer } from "@/lib/landing";
import { planTone } from "@/lib/platform";
import { toneStyle } from "@/lib/tone";

const STEPS = ["Plan y ciclo", "Tu agencia", "Pago"];

export function SignupStepper({ current }: { current: number }) {
  return (
    <ol className="mb-8 grid grid-cols-3 gap-2" aria-label="Pasos del alta">
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className="flex flex-col gap-2">
            <span className={cn("h-1.5 rounded-full transition-colors duration-500", done || active ? "bg-accent" : "bg-surface-2")} />
            <span className={cn("flex items-center gap-1.5 text-[12.5px] font-semibold", active ? "text-fg" : "text-fg-3")}>
              <span className={cn("grid h-5 w-5 place-items-center rounded-full text-[11px]", done ? "bg-ok text-white" : active ? "bg-accent text-white" : "bg-surface-2")}>{done ? <Check size={11} strokeWidth={3} /> : index + 1}</span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function ConsentSwitch({ name, label, hint }: { name: string; label: string; hint?: string }) {
  const [checked, setChecked] = useState(false);
  return <SwitchField name={name} label={label} hint={hint} checked={checked} onCheckedChange={setChecked} />;
}

function localTotals(plan: LandingPlan, cycle: SignupCycle, igvPct: number): SignupTotals {
  const price = cycle === "prueba" ? 0 : cycle === "anual" ? plan.price_year : plan.price_month;
  const igv = Math.round(price * igvPct) / 100;
  return { plan: plan.code, plan_name: plan.name, cycle, months: cycle === "anual" ? 12 : cycle === "prueba" ? 0 : 1, months_paid: cycle === "anual" ? plan.annual_months_paid : cycle === "prueba" ? 0 : 1, plan_price: price.toFixed(2), addons: [], subtotal: price.toFixed(2), coupon: null, discount: "0.00", net: price.toFixed(2), igv_pct: String(igvPct), igv: igv.toFixed(2), total: (price + igv).toFixed(2), currency: "PEN", trial_days: cycle === "prueba" ? plan.trial_days : 0 };
}

export function OrderSummary({ totals, compact = false }: { totals: SignupTotals; compact?: boolean }) {
  const rows: [string, string, boolean?][] = [
    [totals.cycle === "anual" ? `Plan ${totals.plan_name} · 12 meses (pagas ${totals.months_paid})` : `Plan ${totals.plan_name} · ${totals.cycle === "prueba" ? `${totals.trial_days} días gratis` : "1 mes"}`, formatMoney(totals.plan_price)],
    ...(Number(totals.discount) > 0 ? [[`Cupón ${totals.coupon ?? ""}`, `− ${formatMoney(totals.discount)}`, true] as [string, string, boolean]] : []),
    [`IGV ${Number(totals.igv_pct)} %`, formatMoney(totals.igv)],
  ];
  return (
    <div className={cn("rounded-[18px] border border-line bg-surface p-5", !compact && "lg:sticky lg:top-28")}>
      <p className="text-[12px] font-semibold uppercase tracking-[0.08em] text-fg-3">Resumen</p>
      <dl className="mt-3 grid gap-2 text-[13.5px]">
        {rows.map(([label, value, good]) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <dt className="text-fg-2">{label}</dt>
            <dd className={cn("whitespace-nowrap font-mono tabular-nums", good ? "text-ok" : "text-fg")}>{value}</dd>
          </div>
        ))}
      </dl>
      <div className="mt-4 flex items-baseline justify-between border-t border-line pt-4">
        <span className="text-[14px] font-semibold">Total</span>
        <span className="whitespace-nowrap font-mono text-[24px] font-bold tracking-tight">{formatMoney(totals.total)}</span>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[12px] text-fg-3">
        <Lock size={12} /> {totals.cycle === "prueba" ? "No pedimos tarjeta para la prueba." : "Los datos de la tarjeta los captura la pasarela; nunca pasan por KipuControl."}
      </p>
    </div>
  );
}

export function SignupWizard({ catalog, businessTypes, initialPlan, initialCycle, attribution }: { catalog: LandingCatalog; businessTypes: string[]; initialPlan?: string; initialCycle: SignupCycle; attribution: Record<string, string> }) {
  const router = useRouter();
  const plans = catalog.plans.filter((plan) => plan.self_service);
  const [step, setStep] = useState(0);
  const [planCode, setPlanCode] = useState(plans.some((plan) => plan.code === initialPlan) ? (initialPlan as string) : (plans[1] ?? plans[0])?.code);
  const [cycle, setCycle] = useState<SignupCycle>(initialCycle);
  const [coupon, setCoupon] = useState("");
  const [couponTotals, setCouponTotals] = useState<SignupTotals | null>(null);
  const [couponMessage, setCouponMessage] = useState<string | null>(null);
  const [taxpayer, setTaxpayer] = useState<Taxpayer | null>(null);
  const [rucMessage, setRucMessage] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const plan = plans.find((item) => item.code === planCode) ?? plans[0];

  if (!plan) return null;

  const totals = couponTotals && couponTotals.plan === plan.code && couponTotals.cycle === cycle ? couponTotals : localTotals(plan, cycle, catalog.igv_pct);

  const applyCoupon = () =>
    start(async () => {
      setCouponMessage(null);
      const result = await checkCoupon(coupon.trim(), plan.code, cycle);
      if (result.ok && result.data) setCouponTotals(result.data);
      else {
        setCouponTotals(null);
        setCouponMessage(result.message ?? "El cupón no es válido.");
      }
    });

  const findRuc = (value: string) =>
    start(async () => {
      setRucMessage(null);
      const result = await lookupRuc(value);
      setTaxpayer(result.ok && result.data ? result.data : null);
      if (!result.ok) setRucMessage(result.message ?? "El RUC no es válido.");
    });

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    start(async () => {
      setErrors({});
      setMessage(null);
      const result = await createSignup(form);
      if (result.ok && result.data) {
        router.push(`/software/bienvenido/${encodeURIComponent(result.data.token)}`);
        return;
      }
      setErrors(result.errors ?? {});
      setMessage(result.message ?? "Revisa los datos.");
    });
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,0.8fr)]">
      <div className="min-w-0">
        <SignupStepper current={step} />
        {step === 0 ? (
          <div className="flex flex-col gap-6">
            <div className="grid gap-3 sm:grid-cols-2">
              {plans.map((item) => (
                <button key={item.code} type="button" onClick={() => setPlanCode(item.code)} style={toneStyle(planTone(item.rank))} className={cn("lift relative overflow-hidden rounded-[18px] border bg-surface p-5 text-left transition", item.code === plan.code ? "border-[var(--tint)] shadow-[0_20px_40px_-30px_var(--tint)]" : "border-line hover:border-[color-mix(in_srgb,var(--tint)_45%,transparent)]")}>
                  <span aria-hidden className="absolute inset-x-0 top-0 h-1 bg-[var(--tint)]" />
                  <span className="flex items-center justify-between">
                    <b className="text-[17px]">{item.name}</b>
                    {item.code === plan.code && <BadgeCheck size={18} className="text-[var(--tint)]" />}
                  </span>
                  <span className="mt-2 block whitespace-nowrap font-mono text-[22px] font-bold">{formatMoney(item.price_month)}</span>
                  <span className="text-[12.5px] text-fg-3">al mes, sin IGV · {item.modules} módulos</span>
                </button>
              ))}
            </div>
            <ChoiceGroup label="Ciclo" name="cycle_choice" defaultValue={cycle} onChange={(value) => setCycle(value as SignupCycle)} options={(["prueba", "mensual", "anual"] as SignupCycle[]).map((value) => ({ value, label: CYCLE_LABEL[value] }))} hint={cycle === "anual" ? `Pagas ${plan.annual_months_paid} meses por 12: ahorras ${formatMoney(plan.saving_year)}.` : cycle === "prueba" ? `${plan.trial_days} días con todo el plan ${plan.name}, sin tarjeta.` : "Facturación mensual, sin permanencia."} />
            {cycle !== "prueba" && (
              <div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <TextField label="Cupón (opcional)" name="coupon_input" value={coupon} onChange={(event) => setCoupon(event.target.value.toUpperCase())} icon={<Tag size={16} />} placeholder="Escribe tu código" error={couponMessage} />
                  </div>
                  <Button type="button" variant="secondary" onClick={applyCoupon} disabled={pending || coupon.trim() === ""} className="mb-[2px] h-12">
                    Aplicar
                  </Button>
                </div>
                {couponTotals && couponTotals.plan === plan.code && couponTotals.cycle === cycle && <p className="mt-1.5 text-[12.5px] font-semibold text-ok">Cupón aplicado: − {formatMoney(couponTotals.discount)} sobre el plan.</p>}
              </div>
            )}
            <div className="flex justify-end">
              <Button type="button" onClick={() => setStep(1)} icon={<ArrowRight size={16} />}>
                Continuar
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <input type="hidden" name="plan" value={plan.code} />
            <input type="hidden" name="cycle" value={cycle} />
            <input type="hidden" name="coupon" value={totals.coupon ?? ""} />
            <input type="hidden" name="expected_total" value={totals.total} />
            {Object.entries(attribution).map(([key, value]) => (
              <input key={key} type="hidden" name={key} value={value} />
            ))}
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <TextField label="RUC de tu agencia" name="ruc" required inputMode="numeric" maxLength={11} icon={<Building2 size={16} />} placeholder="20XXXXXXXXX" onBlur={(event) => event.target.value.length === 11 && findRuc(event.target.value)} error={rucMessage ?? errors.ruc} />
              </div>
              <Button type="button" variant="secondary" className="mb-[2px] h-12" icon={pending ? <LoaderCircle size={16} className="animate-spin" /> : <Search size={16} />} onClick={(event) => findRuc(((event.currentTarget.closest("form")?.elements.namedItem("ruc") as HTMLInputElement | null)?.value ?? ""))}>
                Consultar
              </Button>
            </div>
            {taxpayer && (
              <p className="rounded-[14px] border border-[color-mix(in_srgb,var(--ok)_35%,var(--line))] bg-[color-mix(in_srgb,var(--ok)_7%,var(--surface))] px-4 py-3 text-[13px]">
                <b className="block">{taxpayer.legal_name}</b>
                <span className="text-fg-2">{taxpayer.address} · {taxpayer.status}</span>
              </p>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Nombre comercial" name="commercial_name" required minLength={2} error={errors.commercial_name} />
              <TextField label="Ciudad" name="city" required defaultValue={taxpayer?.city} key={taxpayer?.ruc ?? "city"} error={errors.city} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <SelectField label="Tipo de agencia" name="business_type" defaultValue={businessTypes[0]} options={businessTypes.map((value) => ({ value, label: value }))} error={errors.business_type} />
              <SelectField label="Comprobante" name="doc_type" defaultValue="factura" options={[{ value: "factura", label: "Factura" }, { value: "boleta", label: "Boleta" }]} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Tu nombre" name="admin_name" required minLength={3} icon={<User size={16} />} error={errors.admin_name} />
              <TextField label="Teléfono" name="phone" icon={<Phone size={16} />} error={errors.phone} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Correo de trabajo" name="email" type="email" required icon={<Mail size={16} />} error={errors.email} />
              <TextField label="Contraseña" name="password" type="password" revealable required minLength={10} hint="10 caracteres o más." error={errors.password} />
            </div>
            <ConsentSwitch name="accept_terms" label="Acepto los términos del servicio y la política de privacidad" hint={errors.accept_terms ?? "Ley 29733 de protección de datos personales."} />
            <ConsentSwitch name="marketing_consent" label="Quiero recibir novedades y guías de KipuControl" />
            <Captcha />
            {message && <p className="rounded-[12px] bg-[color-mix(in_srgb,var(--bad)_9%,transparent)] px-4 py-2.5 text-[13px] font-medium text-bad">{message}</p>}
            <div className="flex flex-wrap justify-between gap-2">
              <Button type="button" variant="ghost" icon={<ArrowLeft size={16} />} onClick={() => setStep(0)}>
                Volver
              </Button>
              <Button type="submit" disabled={pending} icon={pending ? <LoaderCircle size={16} className="animate-spin" /> : <ArrowRight size={16} />}>
                {cycle === "prueba" ? "Crear mi cuenta y empezar la prueba" : "Crear mi cuenta y pagar"}
              </Button>
            </div>
          </form>
        )}
      </div>
      <OrderSummary totals={totals} />
    </div>
  );
}
