"use client";

import { Lock, Ticket } from "lucide-react";
import { useRouter } from "next/navigation";
import { createHold, sellSeats } from "@/app/(backoffice)/catalogo/salidas/actions";
import { RowIcon } from "@/components/table/RowActions";
import { PanelAction } from "@/components/ui/PanelAction";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { HiddenFields, OccupancyBar, STEP_INITIAL } from "@/features/catalog-shared/CatalogPanels";
import type { DepartureRow } from "@/lib/catalog-departures";
import { formatDate } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";

export type SellableDeparture = { id: string; available: number };

const heading = (departure: DepartureRow) => `${departure.product.name} · ${formatDate(departure.date)} ${departure.time}`;

function blockedHint(departure: DepartureRow, sellable: SellableDeparture | undefined): string | undefined {
  if (departure.status === "cancelada" || departure.status === "cerrada") return "Salida cerrada o cancelada";
  if (!departure.future) return "La salida ya pasó";
  if (!sellable) return departure.product.status === "ACTIVE" ? "La salida no está abierta" : "El producto no está activo";
  if (sellable.available <= 0) return "Sin cupos libres";
  return undefined;
}

function Snapshot({ departure }: { departure: DepartureRow }) {
  return (
    <div className="rounded-xl bg-surface-2 p-4">
      <OccupancyBar capacity={departure.capacity} sold={departure.sold} held={departure.held} />
    </div>
  );
}

export function DepartureHoldAction({ departure, sellable }: { departure: DepartureRow; sellable?: SellableDeparture }) {
  const router = useRouter();
  const hint = blockedHint(departure, sellable);
  if (hint || !sellable) return <RowIcon tone="neutral" label="Hold" icon={<Lock size={15} />} disabledHint={hint} />;
  return (
    <PanelAction<StepResult>
      label="Hold"
      formId={`departure-hold-${departure.ref}`}
      trigger={(open) => <RowIcon tone="neutral" label="Retener cupos (hold)" icon={<Lock size={15} />} onClick={open} opensRow={false} />}
      title="Retener cupos"
      description={`${heading(departure)}. Los cupos quedan apartados hasta que se confirmen, se liberen o venza el plazo.`}
      submitLabel="Retener"
      action={createHold}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={{ departure_id: sellable.id }} />
          <Snapshot departure={departure} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Cupos" name="quantity" type="number" min={1} max={sellable.available} required defaultValue={Math.min(2, sellable.available)} hint={`${sellable.available} libres`} />
            <TextField label="Vence en (minutos)" name="minutes" type="number" min={5} required defaultValue={30} />
          </div>
          <TextField label="Referencia" name="reference" required minLength={3} maxLength={60} placeholder="COT-2026-00188, RES-… o agencia" />
          <TextArea label="Notas" name="notes" rows={2} maxLength={500} />
        </>
      )}
    </PanelAction>
  );
}

export function DepartureSellAction({ departure, sellable }: { departure: DepartureRow; sellable?: SellableDeparture }) {
  const router = useRouter();
  const hint = blockedHint(departure, sellable);
  if (hint || !sellable) return <RowIcon tone="neutral" label="Confirmar" icon={<Ticket size={15} />} disabledHint={hint} />;
  return (
    <PanelAction<StepResult>
      label="Confirmar"
      formId={`departure-sell-${departure.ref}`}
      trigger={(open) => <RowIcon tone="neutral" label="Confirmar cupos (venta directa)" icon={<Ticket size={15} />} onClick={open} opensRow={false} />}
      title="Confirmar cupos"
      description={`${heading(departure)}. Venta directa sin hold previo: los cupos pasan a vendidos y quedan registrados en Holds como confirmados.`}
      submitLabel="Confirmar venta"
      action={sellSeats}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={{ ref: departure.ref, lock_version: departure.lock_version }} />
          <Snapshot departure={departure} />
          <TextField label="Cupos" name="quantity" type="number" min={1} max={sellable.available} required defaultValue={1} hint={`${sellable.available} libres`} />
          <TextField label="Reserva o pedido" name="reference" required minLength={3} maxLength={60} placeholder="RES-2026-00042 o pedido web" />
        </>
      )}
    </PanelAction>
  );
}
