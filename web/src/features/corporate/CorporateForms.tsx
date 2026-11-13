"use client";

import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { PanelAction, type PanelActionState } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { BUDGET_PERIOD_OPTIONS, DOC_TYPE_OPTIONS, ROLE_HINTS, ROLE_OPTIONS, type CorporateRole, type CorporateTraveler, type CostCenter, type PortalUser } from "@/lib/corporate";

const initial: PanelActionState = { message: null, done: false };

type Action = (state: PanelActionState, form: FormData) => Promise<PanelActionState>;

interface CorporateStepProps {
  id: string;
  label: string;
  title: string;
  description?: ReactNode;
  submitLabel: string;
  action: Action;
  icon?: ReactNode;
  variant?: "primary" | "secondary" | "ghost";
  size?: "md" | "sm";
  trigger?: (open: () => void) => ReactNode;
  children: ReactNode;
}

export function CorporateStep({ id, label, title, description, submitLabel, action, icon, variant = "secondary", size = "md", trigger, children }: CorporateStepProps) {
  const router = useRouter();
  return (
    <PanelAction<PanelActionState> label={label} icon={icon} variant={variant} size={size} formId={`corporativo-${id}`} title={title} description={description} submitLabel={submitLabel} action={action} initial={initial} trigger={trigger} onDone={() => router.refresh()}>
      {() => <>{children}</>}
    </PanelAction>
  );
}

const centerOptions = (centers: CostCenter[], empty: string) => [{ value: "", label: empty }, ...centers.filter((center) => center.active).map((center) => ({ value: center.id, label: `${center.code} · ${center.name}` }))];

export function PortalUserFields({ user, centers, travelers }: { user?: PortalUser; centers: CostCenter[]; travelers: CorporateTraveler[] }) {
  const [role, setRole] = useState<CorporateRole>(user?.portal_role ?? "viajero");
  return (
    <>
      {user && <input type="hidden" name="id" value={user.id} />}
      <TextField label="Nombre completo" name="full_name" defaultValue={user?.full_name ?? ""} required minLength={3} maxLength={160} />
      {!user && <TextField label="Correo corporativo" name="email" type="email" required maxLength={160} hint="Le llega la invitación para crear su contraseña." />}
      <SelectField label="Rol en el panel" name="portal_role" options={ROLE_OPTIONS} value={role} onChange={(value) => setRole(value as CorporateRole)} hint={ROLE_HINTS[role]} />
      <SelectField label="Centro de costo" name="cost_center_id" options={centerOptions(centers, role === "aprobador" ? "Elige el centro que aprueba" : "Todos los centros")} defaultValue={user?.cost_center_id ?? ""} hint={role === "aprobador" ? "El aprobador solo decide las compras de este centro." : undefined} />
      {role === "viajero" && travelers.length > 0 && (
        <SelectField label="Ficha de viajero" name="traveler_id" options={[{ value: "", label: "Sin vincular" }, ...travelers.filter((row) => row.active).map((row) => ({ value: row.id, label: row.full_name }))]} defaultValue={user?.traveler_id ?? ""} searchable hint="Con la ficha vinculada ve los viajes donde figura." />
      )}
    </>
  );
}

export function CostCenterFields({ center, currency }: { center?: CostCenter; currency: string }) {
  const [active, setActive] = useState(center?.active ?? true);
  return (
    <>
      {center ? <input type="hidden" name="original_code" value={center.code} /> : <TextField label="Código" name="code" required minLength={2} maxLength={20} hint="De 2 a 20 letras, números o guiones. Por ejemplo: CC-MKT." />}
      <TextField label="Nombre" name="name" defaultValue={center?.name ?? ""} required minLength={2} maxLength={120} />
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label={`Presupuesto (${currency})`} name="budget_amount" type="number" min="0" step="100" defaultValue={center?.budget_amount ?? ""} hint="Vacío si no tiene tope." />
        <SelectField label="Período del presupuesto" name="budget_period" options={BUDGET_PERIOD_OPTIONS} defaultValue={center?.budget_period ?? "anual"} />
      </div>
      {center && <SwitchField label="Centro de costo activo" name="active" checked={active} onCheckedChange={setActive} hint={center.is_default ? "Es el centro por defecto de la cuenta." : undefined} disabled={center.is_default} />}
      {center?.is_default && <input type="hidden" name="active" value="on" />}
    </>
  );
}

export function TravelerFields({ traveler, centers }: { traveler?: CorporateTraveler; centers: CostCenter[] }) {
  const [active, setActive] = useState(traveler?.active ?? true);
  return (
    <>
      {traveler && <input type="hidden" name="traveler_id" value={traveler.id} />}
      <TextField label="Nombre completo" name="full_name" defaultValue={traveler?.full_name ?? ""} required minLength={3} maxLength={160} />
      <TextField label="Correo" name="email" type="email" defaultValue={traveler?.email ?? ""} maxLength={160} />
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Tipo de documento" name="doc_type" options={[{ value: "", label: "Sin documento" }, ...DOC_TYPE_OPTIONS]} defaultValue={traveler?.doc_type ?? ""} />
        <TextField label="Número de documento" name="doc_number" defaultValue={traveler?.doc_number ?? ""} maxLength={20} />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Código de empleado" name="employee_code" defaultValue={traveler?.employee_code ?? ""} maxLength={30} />
        <SelectField label="Centro de costo" name="cost_center_id" options={centerOptions(centers, "Sin centro")} defaultValue={traveler?.cost_center_id ?? ""} />
      </div>
      {traveler && <SwitchField label="Viajero activo" name="active" checked={active} onCheckedChange={setActive} />}
    </>
  );
}
