"use client";

import { CheckCircle2, LoaderCircle, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, type ReactNode } from "react";
import { checkTenantStep, provisionTenantWizard } from "@/app/plataforma/actions";
import { Button } from "@/components/ui/Button";
import { useOpenFromQuery, useWizard, WizardPanel } from "@/components/ui/WizardPanel";
import { TENANT_STEPS, type ProvisionOptions, type ProvisionPayload } from "@/lib/platform";
import { AdminStep, AgencyStep, ChannelsStep, CommercialStep, CompanyStep, FinanceStep, LocaleStep, PermissionsStep, ReviewStep, RolesStep, SedeStep } from "./TenantWizardSteps";

const BODY = "tenant-wizard-body";

function initialForm(options: ProvisionOptions): ProvisionPayload {
  const d = options.defaults;
  return {
    commercial_name: "",
    subdomain: "",
    plan: options.plans[1]?.code ?? options.plans[0]?.code ?? "",
    status: "prueba",
    legal_name: "",
    ruc: "",
    fiscal_address: "",
    business_type: "Operador turístico",
    legal_rep: "",
    country: String(d.country),
    locale: String(d.locale),
    base_currency: String(d.base_currency),
    alt_currency: String(d.alt_currency),
    timezone: String(d.timezone),
    sede_name: "",
    sede_city: "",
    sede_address: "",
    sede_phone: "",
    admin_name: "",
    admin_email: "",
    admin_phone: "",
    admin_mfa: true,
    roles: (d.roles as string[]) ?? ["tenant_admin"],
    permission_template: String(d.permission_template),
    quote_validity_days: Number(d.quote_validity_days),
    hold_minutes: Number(d.hold_minutes),
    markup_pct: Number(d.markup_pct),
    max_discount_pct: Number(d.max_discount_pct),
    tax_pct: Number(d.tax_pct),
    rounding: String(d.rounding),
    advance_pct: Number(d.advance_pct),
    fx_rate: Number(d.fx_rate),
    fx_source: String(d.fx_source),
    invoice_series: String(d.invoice_series),
    receipt_series: String(d.receipt_series),
    channels: (d.channels as string[]) ?? [],
  };
}

function TenantWizard({ options, open, onOpenChange }: { options: ProvisionOptions; open: boolean; onOpenChange: (open: boolean) => void }) {
  const router = useRouter();
  const wizard = useWizard(TENANT_STEPS.length, false);
  const { step, errors, busy, setBusy, fail, pass } = wizard;
  const [form, setForm] = useState<ProvisionPayload>(() => initialForm(options));
  const set = (patch: Partial<ProvisionPayload>) => setForm((current) => ({ ...current, ...patch }));

  const next = async () => {
    setBusy(true);
    const result = await checkTenantStep(form, step + 1);
    setBusy(false);
    if (!result.ok) return fail(result.error);
    pass();
  };

  const create = async () => {
    setBusy(true);
    const result = await provisionTenantWizard(form);
    if (!result.ok) {
      setBusy(false);
      return fail(result.error);
    }
    onOpenChange(false);
    router.push(`/plataforma/agencias/${encodeURIComponent(result.data.code)}`);
  };

  const plan = options.plans.find((item) => item.code === form.plan);
  const hints = useMemo(
    () => [
      [form.commercial_name, plan?.name].filter(Boolean).join(" · ") || "Nombre, subdominio y plan.",
      form.legal_name || "Razón social y RUC.",
      `${form.country} · ${form.base_currency}`,
      form.sede_name || "Sede principal.",
      form.admin_email || "Administrador de la agencia.",
      `${form.roles.length} roles`,
      form.permission_template === "minimal" ? "Mínimo privilegio" : "Estándar",
      `Cotización ${form.quote_validity_days} días`,
      `IGV ${form.tax_pct} % · ${form.invoice_series}`,
      `${form.channels.length} canales`,
      "Datos y lista de verificación.",
    ],
    [form, plan],
  );

  const props = { form, set, options, errors };
  const bodies: ReactNode[] = [
    <AgencyStep key="1" {...props} />,
    <CompanyStep key="2" {...props} />,
    <LocaleStep key="3" {...props} />,
    <SedeStep key="4" {...props} />,
    <AdminStep key="5" {...props} />,
    <RolesStep key="6" {...props} />,
    <PermissionsStep key="7" {...props} />,
    <CommercialStep key="8" {...props} />,
    <FinanceStep key="9" {...props} />,
    <ChannelsStep key="10" {...props} />,
    <ReviewStep key="11" {...props} />,
  ];

  return (
    <WizardPanel
      wizard={wizard}
      steps={TENANT_STEPS}
      hints={hints}
      open={open}
      onOpenChange={onOpenChange}
      bodyId={BODY}
      title="Nueva agencia"
      description="De la solicitud a una agencia operativa: empresa, región, sede, administrador, roles, configuración y canales."
      onNext={next}
      finish={
        <Button type="button" variant="primary" disabled={busy} icon={busy ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={16} />} onClick={create} data-testid="tenant-create">
          Crear y activar agencia
        </Button>
      }
    >
      {bodies[step]}
    </WizardPanel>
  );
}

export function TenantWizardAction({ options }: { options: ProvisionOptions }) {
  const { open, setOpen, round, start } = useOpenFromQuery(false, ["nueva"]);
  return (
    <>
      <Button type="button" variant="primary" icon={<Plus size={16} strokeWidth={2.4} />} onClick={start} data-testid="tenant-new">
        Nueva agencia
      </Button>
      <TenantWizard key={round} options={options} open={open} onOpenChange={setOpen} />
    </>
  );
}
