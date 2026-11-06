"use client";

import { CalendarRange, CheckCheck, CircleCheck, Lock, TimerOff, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { changeHold, createHold, createRange, deleteRange, expireHolds, updateRange } from "@/app/(backoffice)/catalogo/cupos/actions";
import { RowIcon } from "@/components/table/RowActions";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { ConfirmAction, HiddenFields, STEP_INITIAL } from "@/features/catalog-shared/CatalogPanels";
import { RANGE_STATUS, type AvailabilityOverview, type HoldRow, type RangeRow } from "@/lib/catalog-availability";
import { formatDate } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";

function RangeFields({ overview, range }: { overview: AvailabilityOverview; range?: RangeRow }) {
  return (
    <>
      {range ? (
        <div className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px]">
          <b className="block font-semibold">{range.product.name}</b>
          <span className="text-fg-3">{range.code}</span>
        </div>
      ) : (
        <SelectField label="Producto" name="product_id" options={overview.options.products.map((product) => ({ value: product.id, label: product.name, hint: product.code }))} placeholder="Elegir producto" />
      )}
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Desde" name="date_from" type="date" required defaultValue={range?.date_from ?? overview.today} />
        <TextField label="Hasta" name="date_to" type="date" required defaultValue={range?.date_to} />
      </div>
      <ChoiceGroup label="Estado" name="status" defaultValue={range?.status ?? "disponible"} options={Object.entries(RANGE_STATUS).map(([value, item]) => ({ value, label: item.label }))} hint="Disponible abre venta; cerrado y agotado la bloquean en esas fechas." />
      <TextField label="Cupos por día" name="capacity_per_day" type="number" min={1} max={500} defaultValue={range?.capacity_per_day || 12} hint="Solo cuenta si el rango está disponible." />
      <TextArea label="Nota" name="note" rows={2} maxLength={200} defaultValue={range?.note ?? undefined} placeholder="Por ejemplo: mantenimiento de la vía férrea." />
    </>
  );
}

export function RangeCreateAction({ overview }: { overview: AvailabilityOverview }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Nuevo rango"
      icon={<CalendarRange size={16} />}
      formId="range-create"
      title="Nuevo rango de disponibilidad"
      description="Define cuántos cupos por día vende un producto entre dos fechas, o ciérralo."
      submitLabel="Crear rango"
      action={createRange}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => <RangeFields overview={overview} />}
    </PanelAction>
  );
}

export function RangeEditAction({ overview, range }: { overview: AvailabilityOverview; range: RangeRow }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Editar"
      formId={`range-edit-${range.code}`}
      trigger={(open) => <RowIcon tone="edit" label="Editar" onClick={open} />}
      title="Editar rango"
      description={`${range.product.name} · ${formatDate(range.date_from)} – ${formatDate(range.date_to)}`}
      submitLabel="Guardar cambios"
      action={updateRange}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={{ code: range.code }} />
          <RangeFields overview={overview} range={range} />
        </>
      )}
    </PanelAction>
  );
}

export function RangeDeleteAction({ range }: { range: RangeRow }) {
  return (
    <ConfirmAction
      id={`range-${range.code}`}
      label="Eliminar"
      title="Eliminar rango"
      description={`${range.product.name} · ${formatDate(range.date_from)} – ${formatDate(range.date_to)} deja de regir. Queda en el historial.`}
      submitLabel="Eliminar rango"
      action={deleteRange}
      hidden={{ code: range.code }}
      reason="Por ejemplo: se cargó con fechas equivocadas."
    />
  );
}

export function HoldCreateAction({ overview }: { overview: AvailabilityOverview }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Bloquear cupos"
      icon={<Lock size={16} />}
      variant="primary"
      formId="hold-create"
      title="Bloquear cupos"
      description="Retiene cupos de una salida mientras el cliente o la agencia confirma. Al vencer, vuelven a quedar libres."
      submitLabel="Bloquear"
      action={createHold}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <SelectField label="Salida" name="departure_id" options={overview.options.departures.map((departure) => ({ value: departure.id, label: `${departure.label} · ${formatDate(departure.date)} ${departure.time}`, hint: `${departure.ref} · ${departure.available} libres` }))} placeholder="Elegir salida con cupo" />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Cupos" name="quantity" type="number" min={1} max={60} required defaultValue={2} />
            <TextField label="Vence en (minutos)" name="minutes" type="number" min={5} required defaultValue={30} />
          </div>
          <TextField label="Referencia" name="reference" required minLength={3} maxLength={60} placeholder="COT-2026-00188, RES-… o agencia" />
          <TextArea label="Notas" name="notes" rows={2} maxLength={500} />
        </>
      )}
    </PanelAction>
  );
}

export function ExpireHoldsAction({ count }: { count: number }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label={`Expirar vencidos (${count})`}
      icon={<TimerOff size={16} />}
      variant="ghost"
      formId="holds-expire"
      title="Expirar bloqueos vencidos"
      description={`${count} bloqueos pasaron su hora límite y siguen restando cupos. Al expirarlos, esos cupos vuelven a quedar libres.`}
      submitLabel="Expirar ahora"
      action={expireHolds}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => null}
    </PanelAction>
  );
}

export function HoldActions({ hold }: { hold: HoldRow }) {
  if (hold.status !== "hold" && hold.status !== "confirmada") return <RowIcon tone="neutral" label="Cerrado" disabledHint="Bloqueo cerrado" icon={<CheckCheck size={15} />} />;
  const label = `${hold.quantity} cupos · ${hold.reference}`;
  return (
    <>
      {hold.status === "hold" ? (
        <ConfirmAction
          id={`hold-confirm-${hold.ref}`}
          label="Confirmar"
          tone="neutral"
          icon={<CircleCheck size={16} />}
          title="Confirmar cupos"
          description={hold.expired ? `${label}. El bloqueo ya venció: no se puede confirmar, crea uno nuevo.` : `${label}. Pasan a vendidos en la salida ${hold.departure?.ref ?? ""}.`}
          submitLabel="Confirmar"
          action={changeHold}
          hidden={{ ref: hold.ref, action: "confirm" }}
        />
      ) : (
        <ConfirmAction
          id={`hold-consume-${hold.ref}`}
          label="Marcar como usado"
          tone="neutral"
          icon={<CheckCheck size={16} />}
          title="Marcar como usado"
          description={`${label}. El servicio ya se prestó; los cupos siguen contados como vendidos.`}
          submitLabel="Marcar usado"
          action={changeHold}
          hidden={{ ref: hold.ref, action: "consume" }}
        />
      )}
      <ConfirmAction
        id={`hold-release-${hold.ref}`}
        label="Liberar"
        icon={<Undo2 size={15} />}
        title="Liberar cupos"
        description={hold.status === "confirmada" ? `${label}. Se descuentan de vendidos y la salida vuelve a tener ese cupo.` : `${label}. Vuelven a quedar libres en la salida.`}
        submitLabel="Liberar"
        action={changeHold}
        hidden={{ ref: hold.ref, action: "release" }}
        reason="Por ejemplo: el cliente cambió de fecha."
      />
    </>
  );
}
