"use client";

import { Building2, Pause, Pencil, Play, Upload } from "lucide-react";
import { useState } from "react";
import { createAccount } from "@/app/(backoffice)/crm/cuentas-corporativas/actions";
import { FilePicker } from "@/components/ui/FilePicker";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import type { CorporateAccount, CorporateOptions } from "@/lib/corporate";
import type { StepResult } from "@/lib/server/resource";
import { CorporateStep } from "./CorporateForms";

type Action = (state: StepResult, form: FormData) => Promise<StepResult>;

function ConditionsFields({ account }: { account?: CorporateAccount }) {
  const [approval, setApproval] = useState(account?.require_approval ?? false);
  const [auto, setAuto] = useState(account?.statement_auto ?? false);
  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField label="Moneda de la cuenta" name="currency" options={[{ value: "PEN", label: "Soles (PEN)" }, { value: "USD", label: "Dólares (USD)" }]} defaultValue={account?.currency ?? "PEN"} hint="Moneda de los reportes y del estado de cuenta." />
        <TextField label="Días de crédito" name="credit_days" type="number" min={0} max={120} defaultValue={account?.credit_days ?? 30} required />
      </div>
      {account && account.cost_centers && account.cost_centers.length > 0 && (
        <SelectField label="Centro de costo por defecto" name="default_cost_center_id" options={account.cost_centers.filter((center) => center.active).map((center) => ({ value: center.id, label: `${center.code} · ${center.name}` }))} defaultValue={account.default_cost_center?.id ?? ""} hint="Las reservas sin reparto se cargan a este centro." />
      )}
      <SwitchField label="Exigir aprobación de la empresa" name="require_approval" checked={approval} onCheckedChange={setApproval} hint="Las cotizaciones desde el umbral necesitan una aprobación antes de convertirse en reserva." />
      {approval && (
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Umbral de aprobación" name="approval_threshold" type="number" min={0} step="100" defaultValue={account?.approval_threshold ?? "5000"} required />
          <TextField label="Vigencia de la solicitud (horas)" name="approval_ttl_hours" type="number" min={1} max={720} defaultValue={account?.approval_ttl_hours ?? 72} required />
        </div>
      )}
      <SwitchField label="Envío automático del estado de cuenta" name="statement_auto" checked={auto} onCheckedChange={setAuto} hint="Se envía el estado del mes anterior el día elegido." />
      <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)]">
        <TextField label="Día (1 a 28)" name="statement_day" type="number" min={1} max={28} defaultValue={account?.statement_day ?? 1} required />
        <TextField label="Correos de destino" name="statement_recipients" defaultValue={account?.statement_recipients.join(", ") ?? ""} required={auto} hint="Sepáralos con comas." />
      </div>
      <TextArea label="Notas internas" name="notes" rows={3} maxLength={1000} defaultValue={account?.notes ?? ""} />
    </>
  );
}

export function CreateAccountAction({ options }: { options: CorporateOptions }) {
  return (
    <CorporateStep id="cuenta-nueva" label="Nueva cuenta" icon={<Building2 size={16} />} variant="primary" title="Nueva cuenta corporativa" description="La empresa cliente verá el Panel corporativo en su portal en cuanto tenga usuarios." submitLabel="Dar de alta" action={createAccount}>
      {options.clients.length === 0 ? (
        <p className="rounded-tile bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">Todas las empresas de tu cartera ya tienen cuenta corporativa. Registra primero el cliente empresa en el CRM.</p>
      ) : (
        <SelectField label="Cliente empresa" name="client_id" options={options.clients.map((client) => ({ value: client.code, label: `${client.name} · RUC ${client.doc_number}` }))} placeholder="Elige la empresa" searchable />
      )}
      <ConditionsFields />
    </CorporateStep>
  );
}

export function EditAccountAction({ account, action }: { account: CorporateAccount; action: Action }) {
  return (
    <CorporateStep id={`cuenta-${account.id}`} label="Editar condiciones" icon={<Pencil size={15} />} title="Condiciones de la cuenta" description={account.client.name} submitLabel="Guardar" action={action}>
      <input type="hidden" name="lock_version" value={account.lock_version} />
      <ConditionsFields account={account} />
    </CorporateStep>
  );
}

export function SuspendAccountAction({ account, action }: { account: CorporateAccount; action: Action }) {
  const suspending = account.status === "activa";
  return (
    <CorporateStep id={`estado-${account.id}`} label={suspending ? "Suspender" : "Reactivar"} icon={suspending ? <Pause size={15} /> : <Play size={15} />} title={suspending ? "Suspender la cuenta" : "Reactivar la cuenta"} description={suspending ? "La empresa deja de ver el Panel corporativo hasta que la reactives. Sus datos se conservan." : "La empresa vuelve a ver el Panel corporativo."} submitLabel={suspending ? "Suspender" : "Reactivar"} action={action}>
      <input type="hidden" name="lock_version" value={account.lock_version} />
      <input type="hidden" name="active" value={suspending ? "0" : "1"} />
      <TextArea label="Motivo" name="reason" rows={3} maxLength={300} required={suspending} placeholder={suspending ? "Por ejemplo: facturas vencidas" : "Opcional"} />
    </CorporateStep>
  );
}

export function ImportTravelersAction({ action }: { action: Action }) {
  return (
    <CorporateStep id="importar-viajeros" label="Importar" icon={<Upload size={15} />} title="Importar viajeros" description="Sube un CSV o Excel con encabezados: nombre, correo, tipo_documento, documento, codigo_empleado y centro_costo. Los documentos repetidos se actualizan." submitLabel="Importar" action={action}>
      <FilePicker label="Archivo" accept=".csv,.xlsx" formats="CSV o Excel" maxKb={2048} />
    </CorporateStep>
  );
}
