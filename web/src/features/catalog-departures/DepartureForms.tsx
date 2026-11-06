"use client";

import { CalendarPlus, Clock, MapPin, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { closeDeparture, createDeparture, updateDeparture } from "@/app/(backoffice)/catalogo/salidas/actions";
import { RowIcon } from "@/components/table/RowActions";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { ConfirmAction, HiddenFields, PanelSection, STEP_INITIAL } from "@/features/catalog-shared/CatalogPanels";
import type { DepartureRow, DeparturesOverview } from "@/lib/catalog-departures";
import { formatDate } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";

function DepartureFields({ overview, departure }: { overview: DeparturesOverview; departure?: DepartureRow }) {
  const { options } = overview;
  return (
    <>
      <PanelSection title="Cuándo">
        {departure ? (
          <div className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px]">
            <b className="block font-semibold">{departure.product.name}</b>
            <span className="text-fg-3">{departure.ref} · {departure.sold} vendidos, {departure.held} en hold</span>
          </div>
        ) : (
          <SelectField label="Producto" name="product_id" options={options.products.map((product) => ({ value: product.id, label: product.name, hint: product.status === "ACTIVE" ? product.code : `${product.code} · aún no activo` }))} placeholder="Elegir producto" />
        )}
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Fecha" name="departure_date" type="date" required min={departure ? undefined : overview.today} defaultValue={departure?.date} />
          <TextField label="Hora" name="departure_time" type="time" required defaultValue={departure?.time ?? "08:00"} icon={<Clock size={16} />} />
        </div>
        <TextField label="Capacidad" name="capacity" type="number" min={departure ? Math.max(1, departure.sold + departure.held) : 1} max={60} required defaultValue={departure?.capacity ?? 16} hint={departure ? "No puede bajar de lo vendido más lo retenido." : "Entre 1 y 60 cupos."} />
        <ChoiceGroup
          label="Estado"
          name="status"
          defaultValue={departure ? (departure.status === "completa" ? "abierta" : departure.status) : "abierta"}
          options={[
            { value: "abierta", label: "Abierta" },
            { value: "cerrada", label: "Cerrada" },
            ...(departure ? [{ value: "cancelada", label: "Cancelada" }] : []),
          ]}
          hint="Una salida abierta pasa sola a completa cuando se vende toda."
        />
      </PanelSection>
      <PanelSection title="Operación">
        <TextField label="Punto de encuentro" name="meeting_point" required maxLength={160} defaultValue={departure?.meeting_point} placeholder="Por ejemplo: recojo en hotel" icon={<MapPin size={16} />} />
        <TextField label="Punto de retorno" name="return_point" maxLength={160} defaultValue={departure?.return_point ?? undefined} />
        <SelectField label="Proveedor" name="provider_id" options={options.providers.map((provider) => ({ value: provider.id, label: provider.name, hint: provider.type }))} defaultValue={departure?.provider.id ?? ""} placeholder="El principal del producto" />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Guía" name="guide_id" options={options.guides.map((guide) => ({ value: guide.id, label: guide.name }))} defaultValue={departure?.guide?.id ?? ""} placeholder="Sin asignar" />
          <SelectField label="Vehículo" name="vehicle_id" options={options.vehicles.map((vehicle) => ({ value: vehicle.id, label: vehicle.plate, hint: `${vehicle.vehicle_type} · ${vehicle.capacity} asientos` }))} defaultValue={departure?.vehicle?.id ?? ""} placeholder="Sin asignar" />
        </div>
        <TextArea label="Notas" name="notes" rows={2} maxLength={1000} defaultValue={departure?.notes ?? undefined} />
      </PanelSection>
    </>
  );
}

export function DepartureCreateAction({ overview }: { overview: DeparturesOverview }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Nueva salida"
      icon={<CalendarPlus size={16} />}
      variant="primary"
      formId="departure-create"
      title="Nueva salida"
      description="Programa una fecha con cupos. Las reservas y los bloqueos descuentan de aquí."
      submitLabel="Crear salida"
      action={createDeparture}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => <DepartureFields overview={overview} />}
    </PanelAction>
  );
}

export function DepartureEditAction({ overview, departure }: { overview: DeparturesOverview; departure: DepartureRow }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Editar"
      icon={<Pencil size={16} />}
      formId={`departure-edit-${departure.ref}`}
      trigger={(open) => <RowIcon tone="edit" label="Editar" onClick={open} />}
      title="Editar salida"
      description={`${departure.product.name} · ${formatDate(departure.date)} ${departure.time}`}
      submitLabel="Guardar cambios"
      action={updateDeparture}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={{ ref: departure.ref, lock_version: departure.lock_version }} />
          <DepartureFields overview={overview} departure={departure} />
        </>
      )}
    </PanelAction>
  );
}

export function DepartureCloseAction({ departure }: { departure: DepartureRow }) {
  if (departure.status === "cancelada") return <RowIcon tone="delete" label="Cancelar" disabledHint="Ya está cancelada" />;
  return (
    <ConfirmAction
      id={`departure-${departure.ref}`}
      label="Cerrar o cancelar"
      title="Cerrar o cancelar salida"
      description={departure.sold > 0 ? `${departure.product.name} del ${formatDate(departure.date)} tiene ${departure.sold} pasajeros vendidos. Si la cancelas, coordina con Operaciones para reprogramarlos.` : `${departure.product.name} del ${formatDate(departure.date)} deja de recibir ventas y bloqueos.`}
      submitLabel="Confirmar"
      action={closeDeparture}
      hidden={{ ref: departure.ref }}
      reason="Por ejemplo: clima, mínimo de pasajeros no alcanzado."
    >
      <ChoiceGroup
        label="Qué hacer"
        name="action"
        defaultValue={departure.status === "cerrada" ? "cancel" : "close"}
        options={[
          ...(departure.status === "cerrada" ? [] : [{ value: "close", label: "Cerrar ventas" }]),
          { value: "cancel", label: "Cancelar salida" },
        ]}
      />
    </ConfirmAction>
  );
}
