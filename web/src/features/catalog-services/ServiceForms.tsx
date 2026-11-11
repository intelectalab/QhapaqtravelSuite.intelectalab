"use client";

import { CirclePlay, CircleStop, Layers, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { createService, toggleService, updateService } from "@/app/(backoffice)/catalogo/servicios/actions";
import { RowIcon } from "@/components/table/RowActions";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { ConfirmAction, HiddenFields, STEP_INITIAL } from "@/features/catalog-shared/CatalogPanels";
import { SUPPLY_STATE, type ServiceRow, type ServicesOverview } from "@/lib/catalog-services";
import type { StepResult } from "@/lib/server/resource";

const list = (values: string[]) => values.map((value) => ({ value, label: value }));

type ServiceFormContext = Pick<ServicesOverview, "options" | "today">;

function ServiceFields({ overview, service }: { overview: ServiceFormContext; service?: ServiceRow }) {
  const { options } = overview;
  return (
    <>
      <TextField label="Nombre" name="name" required minLength={3} maxLength={200} defaultValue={service?.name} placeholder="Por ejemplo: Traslado aeropuerto ⇄ hotel" icon={<Layers size={16} />} />
      <SelectField label="Proveedor" name="provider_id" options={options.providers.map((provider) => ({ value: provider.id, label: provider.name, hint: provider.state === "activo" ? provider.type : `${provider.type} · ${SUPPLY_STATE[provider.state].label.toLowerCase()}` }))} defaultValue={service?.provider.id} placeholder="Elegir proveedor" hint="Con un proveedor no activo, el servicio se guarda inactivo." />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Tipo" name="type" options={list(options.types)} defaultValue={service?.type ?? "Traslado"} />
        <SelectField label="Se cobra por" name="unit" options={list(options.units)} defaultValue={service?.unit ?? "pax"} />
      </div>
      <ChoiceGroup label="Moneda" name="currency" options={list(options.currencies)} defaultValue={service?.currency ?? "PEN"} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Costo" name="cost" type="number" step="0.01" min="0" required defaultValue={service?.cost ?? undefined} placeholder="0.00" />
        <TextField label="Capacidad" name="capacity" type="number" min={1} defaultValue={service?.capacity ?? undefined} hint="Vacío si no tiene límite." />
        <TextField label="Vigente desde" name="valid_from" type="date" required defaultValue={service?.valid_from ?? overview.today} />
        <TextField label="Hasta" name="valid_to" type="date" required defaultValue={service?.valid_to} />
      </div>
    </>
  );
}

export function ServiceCreateAction({ overview }: { overview: ServicesOverview }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Nuevo servicio"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId="service-create"
      title="Nuevo servicio"
      description="Un componente que compras a un proveedor y usas para armar productos."
      submitLabel="Crear servicio"
      action={createService}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => <ServiceFields overview={overview} />}
    </PanelAction>
  );
}

export function ServiceEditAction({ overview, service, button = false }: { overview: ServiceFormContext; service: ServiceRow; button?: boolean }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Editar"
      formId={`service-edit-${service.ref}`}
      icon={<Pencil size={15} />}
      trigger={button ? undefined : (open) => <RowIcon tone="edit" label="Editar" onClick={open} />}
      title="Editar servicio"
      description={service.products.length ? `${service.ref} · lo usan ${service.products.length} productos; un cambio de costo queda en el historial.` : service.ref}
      submitLabel="Guardar cambios"
      action={updateService}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={{ ref: service.ref }} />
          <ServiceFields overview={overview} service={service} />
        </>
      )}
    </PanelAction>
  );
}

export function ServiceToggleAction({ service, button = false }: { service: ServiceRow; button?: boolean }) {
  const activate = service.status !== "activo";
  return (
    <ConfirmAction
      id={`service-${service.ref}`}
      label={activate ? "Activar" : "Desactivar"}
      tone={activate ? "neutral" : "delete"}
      icon={activate ? <CirclePlay size={16} /> : <CircleStop size={16} />}
      title={activate ? "Activar servicio" : "Desactivar servicio"}
      description={
        activate
          ? `${service.name} vuelve a poder usarse en productos. Requiere proveedor activo y vigencia al día.`
          : service.products.length
            ? `${service.name} lo usan ${service.products.map((product) => product.name).join(", ")}. Esos productos no podrán activarse mientras siga inactivo.`
            : `${service.name} deja de poder usarse en productos.`
      }
      submitLabel={activate ? "Activar" : "Desactivar"}
      action={toggleService}
      hidden={{ ref: service.ref, action: activate ? "activate" : "deactivate" }}
      reason={activate ? undefined : "Por ejemplo: el proveedor dejó de prestarlo."}
      button={button}
    />
  );
}
