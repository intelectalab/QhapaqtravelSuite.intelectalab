"use client";

import { AtSign, Building2, Globe, Hash, MapPin, Plus, User } from "lucide-react";
import { useRouter } from "next/navigation";
import { provisionTenant, type ProvisionState } from "@/app/plataforma/actions";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { formatMoney } from "@/lib/format";
import type { PlanSummary } from "@/lib/platform";

const BUSINESS_TYPES = ["Agencia de viajes minorista", "Operador turístico", "DMC / receptivo", "Agencia corporativa", "Agencia mayorista"];

const initial: ProvisionState = { message: null, done: false };

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <div className="border-b border-line-2 pb-1.5">
        <h3 className="text-[13.5px] font-semibold text-fg">{title}</h3>
        {hint && <p className="text-[12px] text-fg-3">{hint}</p>}
      </div>
      {children}
    </section>
  );
}

export function TenantCreateAction({ plans }: { plans: PlanSummary[] }) {
  const router = useRouter();
  const offered = plans.filter((plan) => plan.status === "active").sort((a, b) => a.rank - b.rank);

  return (
    <PanelAction<ProvisionState>
      label="Nueva agencia"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId="tenant-create"
      title="Nueva agencia"
      description="Creamos la agencia con su sede principal, los 12 roles base y su administrador. El administrador recibe un correo para crear su contraseña."
      submitLabel="Crear agencia"
      action={provisionTenant}
      initial={initial}
      onDone={(state) => state.code && router.push(`/plataforma/agencias/${state.code}`)}
    >
      {() => (
        <>
          <Section title="Empresa">
            <TextField label="Nombre comercial" name="commercial_name" required placeholder="Por ejemplo: Inka Trails" icon={<Building2 size={17} />} />
            <TextField label="Razón social" name="legal_name" required placeholder="Inka Trails S.A.C." />
            <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-3">
              <TextField label="RUC" name="ruc" required inputMode="numeric" maxLength={11} placeholder="20612345678" icon={<Hash size={17} />} />
              <SelectField label="Tipo de negocio" name="business_type" options={BUSINESS_TYPES.map((type) => ({ value: type, label: type }))} defaultValue="Operador turístico" />
            </div>
            <TextField label="Domicilio fiscal" name="fiscal_address" required placeholder="Av. El Sol 820, Cusco" icon={<MapPin size={17} />} />
          </Section>
          <Section title="Acceso y plan">
            <TextField label="Subdominio" name="subdomain" required minLength={3} maxLength={30} placeholder="inkatrails" hint="Su dirección será inkatrails.qhapaq.cloud. Solo minúsculas, números y guiones." icon={<Globe size={17} />} />
            <SelectField label="Plan" name="plan" options={offered.map((plan) => ({ value: plan.code, label: `${plan.name} · ${formatMoney(plan.price_month)} al mes` }))} defaultValue={offered[0]?.code} />
            <ChoiceGroup
              label="Empieza"
              name="status"
              defaultValue="prueba"
              options={[
                { value: "prueba", label: "Con prueba gratis" },
                { value: "activo", label: "Activa y facturando" },
              ]}
            />
          </Section>
          <Section title="Sede principal">
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Nombre" name="sede_name" required placeholder="Cusco — El Sol" />
              <TextField label="Ciudad" name="sede_city" required placeholder="Cusco" />
            </div>
            <TextField label="Dirección" name="sede_address" required placeholder="Av. El Sol 820" icon={<MapPin size={17} />} />
          </Section>
          <Section title="Administrador" hint="Entrará con este correo y deberá activar la verificación en dos pasos.">
            <TextField label="Nombre completo" name="admin_name" required icon={<User size={17} />} />
            <TextField label="Correo" name="admin_email" type="email" required icon={<AtSign size={17} />} />
          </Section>
        </>
      )}
    </PanelAction>
  );
}
