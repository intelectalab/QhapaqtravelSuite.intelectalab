"use client";

import { Ban, CalendarPlus, Check, Lock, Pencil, PlayCircle, Send, Trash2, Undo2, Unlock, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createContract, deleteContract, releaseContract, releaseDay, requestExpansion, respondExpansion, retainDay, runReleaseJob, unretainDay, updateContract } from "@/app/(backoffice)/catalogo/cupos/actions";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { ConfirmAction, HiddenFields, PanelSection, STEP_INITIAL } from "@/features/catalog-shared/CatalogPanels";
import { KIND_LABEL, type AllotmentCell, type AllotmentOptions, type AllotmentRequest, type AllotmentSummary } from "@/lib/catalog-allotments";
import { formatDate, formatMoney } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

function ContractTerms({ contract, today }: { contract?: AllotmentSummary; today: string }) {
  return (
    <>
      <PanelSection title="Vigencia y cantidad">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Vigente desde" name="valid_from" type="date" required defaultValue={contract?.valid_from ?? today} />
          <TextField label="Vigente hasta" name="valid_to" type="date" required min={today} defaultValue={contract?.valid_to ?? addDays(today, 90)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Bloqueo base por fecha" name="base_qty" type="number" min={1} max={500} required defaultValue={contract?.base_qty ?? 4} hint="Habitaciones, asientos o entradas por día." />
          <TextField label="Días de release" name="release_days" type="number" min={0} max={120} required defaultValue={contract?.release_days ?? 14} hint="Se libera solo esos días antes." />
        </div>
      </PanelSection>
      <PanelSection title="Condiciones económicas">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Tarifa neta" name="net_rate" type="number" min={0} step="0.01" required defaultValue={contract?.net_rate} />
          <ChoiceGroup label="Moneda" name="currency" defaultValue={contract?.currency ?? "USD"} options={[{ value: "USD", label: "USD" }, { value: "PEN", label: "PEN" }]} />
        </div>
        <TextField label="Penalidad por no uso (%)" name="penalty_pct" type="number" min={0} max={100} step="0.01" required defaultValue={contract?.penalty_pct ?? 100} hint="Sobre la tarifa neta de lo retenido y no usado." />
      </PanelSection>
    </>
  );
}

function ContractIdentity({ contract }: { contract?: AllotmentSummary & { notes?: string | null } }) {
  return (
    <PanelSection title="Contrato">
      <TextField label="Nombre del cupo" name="name" required minLength={3} maxLength={150} defaultValue={contract?.name} placeholder="Por ejemplo: Tambo Real, hab. doble (temporada alta)" />
      <TextField label="Referencia del contrato" name="contract_ref" maxLength={80} defaultValue={contract?.contract_ref ?? undefined} placeholder="Adenda o convenio" />
      <TextArea label="Condiciones y notas" name="notes" rows={3} maxLength={2000} defaultValue={contract?.notes ?? undefined} />
    </PanelSection>
  );
}

function ProviderService({ options }: { options: AllotmentOptions }) {
  const [provider, setProvider] = useState("");
  const [service, setService] = useState("");
  const services = options.services.filter((item) => item.provider_id === provider);
  const chosen = options.services.find((item) => item.id === service);
  return (
    <PanelSection title="Proveedor y servicio">
      <SelectField
        label="Proveedor"
        name="provider_id"
        searchable
        value={provider}
        onChange={(value) => {
          setProvider(value);
          setService(options.services.find((item) => item.provider_id === value)?.id ?? "");
        }}
        options={options.providers.map((item) => ({ value: item.id, label: item.name, hint: item.type }))}
        placeholder="Hoteles, tren o entradas activos"
      />
      <SelectField label="Servicio contratado" name="service_id" value={service} onChange={setService} options={services.map((item) => ({ value: item.id, label: item.name, hint: `${KIND_LABEL[item.kind]} · ${formatMoney(item.cost, item.currency)}` }))} placeholder={provider ? "Elegir servicio" : "Primero elige el proveedor"} />
      {chosen && <p className="text-[12.5px] text-fg-3">Costo de lista {formatMoney(chosen.cost, chosen.currency)}. La tarifa neta del cupo puede ser distinta.</p>}
    </PanelSection>
  );
}

export function ContractCreateAction({ options, today }: { options: AllotmentOptions; today: string }) {
  return (
    <PanelAction<StepResult>
      label="Nuevo contrato"
      icon={<CalendarPlus size={16} />}
      variant="primary"
      formId="allotment-create"
      title="Nuevo contrato de cupo"
      description="Cupo garantizado con un hotel, el tren o las entradas. Se crea una fecha por día de vigencia."
      submitLabel="Registrar contrato"
      action={createContract}
      initial={STEP_INITIAL}
    >
      {() => (
        <>
          <ProviderService options={options} />
          <ContractIdentity />
          <ContractTerms today={today} />
        </>
      )}
    </PanelAction>
  );
}

export function ContractEditAction({ contract, today }: { contract: AllotmentSummary & { notes?: string | null }; today: string }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Editar"
      icon={<Pencil size={16} />}
      formId={`allotment-edit-${contract.code}`}
      title="Editar contrato"
      description={`${contract.provider.name} · ${contract.service.name}. El proveedor y el servicio no cambian.`}
      submitLabel="Guardar cambios"
      action={updateContract}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={{ code: contract.code, lock_version: contract.lock_version }} />
          <ContractIdentity contract={contract} />
          <ContractTerms contract={contract} today={today} />
        </>
      )}
    </PanelAction>
  );
}

export function ContractReleaseAction({ contract, units }: { contract: AllotmentSummary; units: number }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Liberar contrato"
      icon={<Unlock size={16} />}
      formId={`allotment-release-${contract.code}`}
      title="Liberar todo el contrato"
      description={`Se devuelven al proveedor ${units} ${contract.unit} sin usar en las fechas futuras. Lo consumido por reservas se mantiene y el contrato deja de recibir consumo.`}
      submitLabel="Liberar contrato"
      action={releaseContract}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={{ code: contract.code, lock_version: contract.lock_version }} />
          <TextArea label="Motivo" name="reason" rows={3} required minLength={3} maxLength={300} placeholder="Por ejemplo: baja demanda de la temporada." />
        </>
      )}
    </PanelAction>
  );
}

export function ContractDeleteAction({ contract }: { contract: AllotmentSummary }) {
  return (
    <PanelAction<StepResult>
      label="Eliminar"
      icon={<Trash2 size={16} />}
      variant="ghost"
      formId={`allotment-delete-${contract.code}`}
      title="Eliminar contrato"
      description="Solo se elimina si no tiene reservas ni penalidades. Si ya tuvo uso, libéralo para cerrarlo."
      submitLabel="Eliminar contrato"
      action={deleteContract}
      initial={STEP_INITIAL}
    >
      {() => (
        <>
          <HiddenFields values={{ code: contract.code }} />
          <TextArea label="Motivo" name="reason" rows={3} required minLength={3} maxLength={300} placeholder="Por ejemplo: se registró por error." />
        </>
      )}
    </PanelAction>
  );
}

export function ExpansionRequestAction({ contract, today }: { contract: AllotmentSummary; today: string }) {
  const router = useRouter();
  const start = today > contract.valid_from ? addDays(today, 7) : contract.valid_from;
  return (
    <PanelAction<StepResult>
      label="Solicitar ampliación"
      icon={<Send size={16} />}
      formId={`allotment-expand-${contract.code}`}
      title="Solicitar ampliación de cupo"
      description={`${contract.provider.name}. El cupo crece solo cuando registres que el proveedor la aceptó.`}
      submitLabel="Registrar solicitud"
      action={requestExpansion}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={{ code: contract.code }} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Desde" name="date_from" type="date" required min={today > contract.valid_from ? today : contract.valid_from} max={contract.valid_to} defaultValue={start > contract.valid_to ? contract.valid_to : start} />
            <TextField label="Hasta" name="date_to" type="date" required max={contract.valid_to} defaultValue={addDays(start, 2) > contract.valid_to ? contract.valid_to : addDays(start, 2)} />
          </div>
          <TextField label={`Unidades adicionales por fecha (${contract.unit})`} name="extra_qty" type="number" min={1} max={500} required defaultValue={2} />
          <TextArea label="Motivo para el proveedor" name="note" rows={3} required minLength={3} maxLength={500} placeholder="Por ejemplo: grupo corporativo en negociación." />
        </>
      )}
    </PanelAction>
  );
}

export function ExpansionRespondActions({ contract, request }: { contract: AllotmentSummary; request: AllotmentRequest }) {
  const summary = `${request.code} · +${request.extra_qty} ${contract.unit} del ${formatDate(request.date_from)} al ${formatDate(request.date_to)}.`;
  return (
    <>
      <ConfirmAction id={`accept-${request.code}`} label="Aceptada" tone="neutral" icon={<Check size={16} />} title="Registrar aceptación" description={`${summary} El bloqueo de cada fecha sube en esa cantidad.`} submitLabel="Registrar aceptación" action={respondExpansion} hidden={{ code: contract.code, request: request.code, accepted: "1" }}>
        <TextArea label="Respuesta del proveedor" name="response" rows={3} required minLength={3} maxLength={500} placeholder="Quién confirmó y por qué medio." />
      </ConfirmAction>
      <ConfirmAction id={`reject-${request.code}`} label="Rechazada" icon={<X size={16} />} title="Registrar rechazo" description={`${summary} El bloqueo no cambia.`} submitLabel="Registrar rechazo" action={respondExpansion} hidden={{ code: contract.code, request: request.code, accepted: "0" }}>
        <TextArea label="Respuesta del proveedor" name="response" rows={3} required minLength={3} maxLength={500} placeholder="Motivo que dio el proveedor." />
      </ConfirmAction>
    </>
  );
}

export function RunReleaseJobAction({ pending }: { pending: number }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Ejecutar release"
      icon={<PlayCircle size={16} />}
      formId="allotment-job"
      title="Liberar cupos en release"
      description={pending ? `${pending} fechas ya pasaron su release sin retención. El proceso las devuelve al proveedor, registra las penalidades de fechas pasadas y vence los contratos terminados.` : "No hay fechas pendientes. El proceso igual revisa penalidades y vencimientos."}
      submitLabel="Ejecutar ahora"
      action={runReleaseJob}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => null}
    </PanelAction>
  );
}

export function DayActions({ contract, cell }: { contract: AllotmentSummary; cell: AllotmentCell }) {
  const router = useRouter();
  const available = cell.available ?? 0;
  const exposure = Math.round(available * contract.net_rate * contract.penalty_pct) / 100;
  const hidden = { code: contract.code, date: cell.date, lock_version: cell.lock_version };
  return (
    <div className="flex flex-wrap gap-2">
      <PanelAction<StepResult>
        label="Liberar"
        icon={<Undo2 size={15} />}
        size="sm"
        formId={`day-release-${contract.code}-${cell.date}`}
        title="Liberar unidades"
        description={available ? `Quedan ${available} ${contract.unit} sin usar el ${formatDate(cell.date)}. Lo consumido por reservas no se libera.` : "No quedan unidades libres en esta fecha."}
        submitLabel="Liberar"
        action={releaseDay}
        initial={STEP_INITIAL}
        onDone={() => router.refresh()}
      >
        {() => (
          <>
            <HiddenFields values={hidden} />
            <TextField label="Unidades a liberar" name="qty" type="number" min={1} max={Math.max(1, available)} required defaultValue={Math.max(1, available)} />
          </>
        )}
      </PanelAction>
      {cell.retained ? (
        <PanelAction<StepResult>
          label="Quitar retención"
          icon={<Ban size={15} />}
          size="sm"
          formId={`day-unretain-${contract.code}-${cell.date}`}
          title="Quitar retención"
          description="El proceso de release podrá liberar lo disponible de esta fecha."
          submitLabel="Quitar retención"
          action={unretainDay}
          initial={STEP_INITIAL}
          onDone={() => router.refresh()}
        >
          {() => <HiddenFields values={hidden} />}
        </PanelAction>
      ) : (
        <PanelAction<StepResult>
          label="Retener"
          icon={<Lock size={15} />}
          size="sm"
          formId={`day-retain-${contract.code}-${cell.date}`}
          title="Retener la fecha"
          description={contract.penalty_pct ? `El release no la liberará. Si no se vende, la penalidad sería de ${formatMoney(exposure, contract.currency)} (${contract.penalty_pct} %).` : "El release no la liberará. Este contrato no cobra penalidad."}
          submitLabel="Retener"
          action={retainDay}
          initial={STEP_INITIAL}
          onDone={() => router.refresh()}
        >
          {() => (
            <>
              <HiddenFields values={hidden} />
              <TextField label="Motivo" name="reason" required minLength={3} maxLength={200} placeholder="Por ejemplo: grupo en negociación." />
            </>
          )}
        </PanelAction>
      )}
    </div>
  );
}
