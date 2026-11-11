"use client";

import { ArrowUpDown, Building2, CalendarClock, Globe, Hash, MapPin, Pencil, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { changeTenantPlan, previewTenantPlan, updateTenant, voidTenantScheduledPlan, type ProvisionState } from "@/app/plataforma/actions";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { PlanChangeNote, PlanChangeSummary } from "@/features/billing/PlanChangeSummary";
import type { PlanChangePreview } from "@/lib/admin";
import { formatDate, formatMoney } from "@/lib/format";
import { CYCLE_LABEL, type BillingCycle, type PlanEffective, type PlanSummary, type TenantDetail, type TenantSubscription } from "@/lib/platform";

const BUSINESS_TYPES = ["Agencia de viajes minorista", "Operador turístico", "DMC / receptivo", "Agencia corporativa", "Agencia mayorista"];

const initial: ProvisionState = { message: null, done: false };

export function TenantPlanAction({ tenant, plans }: { tenant: TenantDetail; plans: PlanSummary[] }) {
  const router = useRouter();
  const subscription = tenant.subscription;
  const active = plans.filter((plan) => plan.status === "active").sort((a, b) => a.rank - b.rank);
  const current = tenant.plan?.code ?? "";
  const initialPlan = active.find((plan) => plan.rank > (tenant.plan?.rank ?? 0))?.code ?? active.findLast((plan) => plan.code !== current)?.code ?? current;
  const description = subscription
    ? `${tenant.name} está en ${tenant.plan?.name ?? "ningún plan"} con pago ${CYCLE_LABEL[subscription.cycle].toLowerCase()}. Las subidas pueden regir hoy con prorrateo; las bajadas rigen al cierre del ciclo.`
    : `${tenant.name} está en ${tenant.plan?.name ?? "ningún plan"}. Para bajar de plan, sus usuarios, sedes y almacenamiento deben caber en el nuevo.`;

  return (
    <PanelAction<ProvisionState>
      label="Cambiar plan"
      icon={<ArrowUpDown size={16} />}
      formId="tenant-plan"
      title="Cambiar plan"
      description={description}
      submitLabel="Confirmar cambio"
      action={changeTenantPlan}
      initial={initial}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <input type="hidden" name="tenant" value={tenant.code} />
          <input type="hidden" name="lock_version" value={tenant.lock_version} />
          {subscription ? (
            <TenantPlanFields tenant={tenant.code} plans={active} current={current} subscription={subscription} initialPlan={initialPlan} />
          ) : (
            <SelectField label="Nuevo plan" name="plan" options={active.filter((plan) => plan.code !== current).map((plan) => ({ value: plan.code, label: `${plan.name} · ${formatMoney(plan.price_month)} al mes` }))} placeholder="Elegir" />
          )}
          <TextArea label="Motivo (opcional)" name="reason" rows={3} maxLength={500} placeholder="Por ejemplo: crecimiento del equipo comercial." hint="Queda registrado en el historial de la agencia." />
        </>
      )}
    </PanelAction>
  );
}

const CYCLE_OPTIONS = (Object.keys(CYCLE_LABEL) as BillingCycle[]).map((value) => ({ value, label: CYCLE_LABEL[value] }));

function TenantPlanFields({ tenant, plans, current, subscription, initialPlan }: { tenant: string; plans: PlanSummary[]; current: string; subscription: TenantSubscription; initialPlan: string }) {
  const [plan, setPlan] = useState(initialPlan);
  const [cycle, setCycle] = useState<BillingCycle>(subscription.cycle);
  const [effective, setEffective] = useState<PlanEffective>("immediate");
  const rank = (code: string) => plans.find((item) => item.code === code)?.rank ?? 0;
  const trial = subscription.status === "trialing";
  const canNow = trial || rank(plan) > rank(current) || (rank(plan) === rank(current) && cycle === "annual" && subscription.cycle === "monthly");
  const canLater = !trial;
  const chosen: PlanEffective = canNow && (effective === "immediate" || !canLater) ? "immediate" : "next_cycle";
  const options = [
    ...(canNow ? [{ value: "immediate", label: trial ? "Hoy, sin cobro" : "Hoy, con prorrateo" }] : []),
    ...(canLater ? [{ value: "next_cycle", label: `Al cierre del ciclo (${formatDate(subscription.period_end)})` }] : []),
  ];

  return (
    <>
      <ChoiceGroup label="Plan" name="plan" options={plans.map((item) => ({ value: item.code, label: item.code === current ? `${item.name} (actual)` : item.name }))} defaultValue={initialPlan} onChange={setPlan} />
      <ChoiceGroup label="Ciclo de pago" name="cycle" options={CYCLE_OPTIONS} defaultValue={subscription.cycle} onChange={(value) => setCycle(value as BillingCycle)} />
      {options.length > 1 ? (
        <ChoiceGroup key={options.map((option) => option.value).join("|")} label="Vigencia" name="effective" options={options} defaultValue={chosen} onChange={(value) => setEffective(value as PlanEffective)} hint="Una bajada de plan o el paso de anual a mensual rige siempre al cierre del ciclo, sin reembolso." />
      ) : (
        <input type="hidden" name="effective" value={chosen} />
      )}
      <TenantPlanPreview tenant={tenant} plan={plan} cycle={cycle} effective={chosen} same={plan === current && cycle === subscription.cycle} />
    </>
  );
}

function TenantPlanPreview({ tenant, plan, cycle, effective, same }: { tenant: string; plan: string; cycle: BillingCycle; effective: PlanEffective; same: boolean }) {
  const key = `${plan}|${cycle}|${effective}`;
  const [state, setState] = useState<{ key: string; preview: PlanChangePreview | null; message: string | null } | null>(null);

  useEffect(() => {
    if (same) return;
    let alive = true;
    previewTenantPlan(tenant, plan, cycle, effective).then((result) => {
      if (alive) setState({ key, ...result });
    });
    return () => {
      alive = false;
    };
  }, [tenant, plan, cycle, effective, key, same]);

  if (same) return <PlanChangeNote>Es el plan actual de la agencia. Elige otro plan o ciclo.</PlanChangeNote>;
  if (state?.key !== key) return <PlanChangeNote>Calculando el cambio…</PlanChangeNote>;
  if (!state.preview) return <PlanChangeNote tone="bad">{state.message}</PlanChangeNote>;
  return <PlanChangeSummary preview={state.preview} currency="PEN" audience="platform" />;
}

export function TenantScheduledChange({ tenant }: { tenant: TenantDetail }) {
  const router = useRouter();
  const scheduled = tenant.subscription?.scheduled;
  if (!scheduled) return null;

  return (
    <div role="status" className="mb-5 flex flex-wrap items-center gap-3 rounded-card border border-[color-mix(in_srgb,var(--info)_30%,transparent)] bg-[color-mix(in_srgb,var(--info)_8%,transparent)] px-4 py-3.5 text-[13.5px]">
      <CalendarClock size={18} className="flex-none text-info" />
      <p className="min-w-0 flex-1">
        <b className="font-semibold">Cambio programado para el {formatDate(scheduled.effective_at)}.</b>{" "}
        <span className="text-fg-2">
          Pasa al plan {scheduled.plan.name} con pago {CYCLE_LABEL[scheduled.cycle].toLowerCase()} en la próxima renovación.
        </span>
      </p>
      <PanelAction<ProvisionState>
        label="Anular cambio"
        icon={<Undo2 size={15} />}
        size="sm"
        variant="ghost"
        formId="tenant-scheduled-void"
        title="Anular el cambio programado"
        description={`La agencia seguirá en ${tenant.plan?.name ?? "su plan"} después del ${formatDate(scheduled.effective_at)}.`}
        submitLabel="Anular cambio"
        action={voidTenantScheduledPlan}
        initial={initial}
        onDone={() => router.refresh()}
      >
        {() => <input type="hidden" name="tenant" value={tenant.code} />}
      </PanelAction>
    </div>
  );
}

export function TenantEditAction({ tenant, defaultOpen = false }: { tenant: TenantDetail; defaultOpen?: boolean }) {
  const router = useRouter();

  return (
    <PanelAction<ProvisionState>
      label="Editar"
      icon={<Pencil size={16} />}
      formId="tenant-edit"
      defaultOpen={defaultOpen}
      title="Editar agencia"
      description={`${tenant.name} · ${tenant.code}`}
      submitLabel="Guardar cambios"
      action={updateTenant}
      initial={initial}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <input type="hidden" name="tenant" value={tenant.code} />
          <input type="hidden" name="lock_version" value={tenant.lock_version} />
          <TextField label="Nombre comercial" name="commercial_name" required defaultValue={tenant.name} icon={<Building2 size={17} />} />
          <TextField label="Razón social" name="legal_name" required defaultValue={tenant.legal_name} />
          <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3">
            <TextField label="RUC" name="ruc" required inputMode="numeric" maxLength={11} defaultValue={tenant.ruc} icon={<Hash size={17} />} />
            <SelectField label="Tipo de negocio" name="business_type" options={BUSINESS_TYPES.map((type) => ({ value: type, label: type }))} defaultValue={tenant.business_type} />
          </div>
          <TextField label="Domicilio fiscal" name="fiscal_address" required defaultValue={tenant.fiscal_address} icon={<MapPin size={17} />} />
          <TextField label="Subdominio" name="subdomain" required minLength={3} maxLength={30} defaultValue={tenant.subdomain} hint="Si lo cambias, la dirección anterior deja de funcionar." icon={<Globe size={17} />} />
        </>
      )}
    </PanelAction>
  );
}
