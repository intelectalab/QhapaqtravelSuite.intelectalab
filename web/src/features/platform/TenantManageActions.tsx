"use client";

import { ArrowUpDown, Building2, Globe, Hash, MapPin, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { changeTenantPlan, updateTenant, type ProvisionState } from "@/app/plataforma/actions";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { formatMoney } from "@/lib/format";
import type { PlanSummary, TenantDetail } from "@/lib/platform";

const BUSINESS_TYPES = ["Agencia de viajes minorista", "Operador turístico", "DMC / receptivo", "Agencia corporativa", "Mayorista"];

const initial: ProvisionState = { message: null, done: false };

export function TenantPlanAction({ tenant, plans }: { tenant: TenantDetail; plans: PlanSummary[] }) {
  const router = useRouter();
  const options = plans
    .filter((plan) => plan.status === "active" && plan.code !== tenant.plan?.code)
    .sort((a, b) => a.rank - b.rank)
    .map((plan) => ({ value: plan.code, label: `${plan.name} · ${formatMoney(plan.price_month)} al mes${tenant.plan && plan.rank < tenant.plan.rank ? " · baja" : " · sube"}` }));

  return (
    <PanelAction<ProvisionState>
      label="Cambiar plan"
      icon={<ArrowUpDown size={16} />}
      formId="tenant-plan"
      title="Cambiar plan"
      description={`${tenant.name} está en ${tenant.plan?.name ?? "ningún plan"}. Para bajar de plan, sus usuarios, sedes y almacenamiento deben caber en el nuevo.`}
      submitLabel="Cambiar plan"
      action={changeTenantPlan}
      initial={initial}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <input type="hidden" name="tenant" value={tenant.code} />
          <input type="hidden" name="lock_version" value={tenant.lock_version} />
          <SelectField label="Nuevo plan" name="plan" options={options} placeholder="Elegir" />
          <TextArea label="Motivo (opcional)" name="reason" rows={3} maxLength={500} placeholder="Por ejemplo: crecimiento del equipo comercial." hint="Queda registrado en el historial de la agencia." />
        </>
      )}
    </PanelAction>
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
