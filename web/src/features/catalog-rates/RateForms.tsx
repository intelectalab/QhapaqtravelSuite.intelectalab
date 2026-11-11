"use client";

import { CalendarRange, CirclePlay, CircleStop, Pencil, Plus, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { createRate, createSeason, toggleRate, toggleSeason, updateRate, updateSeason } from "@/app/(backoffice)/catalogo/tarifas/actions";
import { RowIcon } from "@/components/table/RowActions";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { ConfirmAction, HiddenFields, PanelSection, STEP_INITIAL } from "@/features/catalog-shared/CatalogPanels";
import type { RateRow, RatesOverview, SeasonRow } from "@/lib/catalog-rates";
import { formatDate } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";

const list = (values: string[]) => values.map((value) => ({ value, label: value }));

function RateFields({ overview, rate }: { overview: RatesOverview; rate?: RateRow }) {
  const { options } = overview;
  const seasons = overview.seasons.filter((season) => season.status === "activa" || season.id === rate?.season?.id);
  return (
    <>
      <PanelSection title="Qué cubre">
        {rate ? (
          <div className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px]">
            <b className="block font-semibold">{rate.product.name}</b>
            <span className="text-fg-3">{rate.product.code} · {rate.ref}</span>
          </div>
        ) : (
          <SelectField label="Producto" name="product_id" options={options.products.map((product) => ({ value: product.id, label: product.name, hint: product.code }))} placeholder="Elegir producto" />
        )}
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Tipo de tarifa" name="rate_type" options={list(options.types)} defaultValue={rate?.type ?? "Venta"} />
          <SelectField label="Segmento" name="segment" options={list(options.segments)} defaultValue={rate?.segment ?? "Adulto"} />
        </div>
        <SelectField label="Canal" name="channel" options={list(options.channels)} defaultValue={rate?.channel ?? "Directo"} />
      </PanelSection>
      <PanelSection title="Precio">
        <ChoiceGroup label="Moneda" name="currency" options={list(options.currencies)} defaultValue={rate?.currency ?? "USD"} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Costo" name="cost" type="number" step="0.01" min="0" required defaultValue={rate?.cost ?? undefined} placeholder="0.00" />
          <TextField label="Precio de venta" name="price" type="number" step="0.01" min="0.01" required defaultValue={rate?.price} placeholder="0.00" />
          <TextField label="Precio mínimo" name="min_price" type="number" step="0.01" min="0" defaultValue={rate?.min_price ?? undefined} hint="Opcional." />
          <TextField label="Precio máximo" name="max_price" type="number" step="0.01" min="0" defaultValue={rate?.max_price ?? undefined} hint="Opcional." />
        </div>
        <SelectField label="Se cobra" name="price_basis" options={list(options.bases)} defaultValue={rate?.basis ?? "Por persona"} />
      </PanelSection>
      <PanelSection title="Vigencia">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Desde" name="valid_from" type="date" required defaultValue={rate?.valid_from ?? overview.today} />
          <TextField label="Hasta" name="valid_to" type="date" required min={overview.today} defaultValue={rate?.valid_to} />
        </div>
        <SelectField label="Temporada" name="season_id" options={seasons.map((season) => ({ value: season.id, label: season.name, hint: `${formatDate(season.date_from)} – ${formatDate(season.date_to)}` }))} defaultValue={rate?.season?.id ?? ""} placeholder="Tarifa base, sin temporada" />
        <TextArea label="Condiciones" name="conditions" rows={2} maxLength={300} defaultValue={rate?.conditions ?? undefined} placeholder="Por ejemplo: mínimo 4 pasajeros, reservar con 7 días." />
      </PanelSection>
    </>
  );
}

export function RateCreateAction({ overview }: { overview: RatesOverview }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Nueva tarifa"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId="rate-create"
      title="Nueva tarifa"
      description="Nace vigente. Si el precio queda por debajo del costo, se guarda igual y te avisamos."
      submitLabel="Crear tarifa"
      action={createRate}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => <RateFields overview={overview} />}
    </PanelAction>
  );
}

export function RateEditAction({ overview, rate }: { overview: RatesOverview; rate: RateRow }) {
  const router = useRouter();
  if (rate.state === "vencida" || rate.state === "inactiva") {
    return <RowIcon tone="edit" label="Editar" disabledHint={rate.state === "vencida" ? "Vencida: crea una tarifa nueva" : "Actívala para editarla"} />;
  }
  return (
    <PanelAction<StepResult>
      label="Editar"
      icon={<Pencil size={16} />}
      formId={`rate-edit-${rate.ref}`}
      trigger={(open) => <RowIcon tone="edit" label="Editar" onClick={open} />}
      title="Editar tarifa"
      description={`${rate.product.name} · ${rate.ref}`}
      submitLabel="Guardar cambios"
      action={updateRate}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={{ product: rate.product.code, ref: rate.ref, lock_version: rate.lock_version }} />
          <RateFields overview={overview} rate={rate} />
          <TextArea label="Motivo del cambio" name="reason" rows={2} maxLength={300} hint="Obligatorio si cambias el costo o el precio. Queda en el historial." />
        </>
      )}
    </PanelAction>
  );
}

export function RateToggleAction({ rate }: { rate: RateRow }) {
  if (rate.state === "vencida") return <RowIcon tone="delete" label="Inactivar" disabledHint="Vencida: ya no se aplica" />;
  const activate = rate.status === "inactiva";
  return (
    <ConfirmAction
      id={`rate-${rate.ref}`}
      label={activate ? "Activar" : "Inactivar"}
      tone={activate ? "neutral" : "delete"}
      icon={activate ? <CirclePlay size={16} /> : <CircleStop size={16} />}
      title={activate ? "Activar tarifa" : "Inactivar tarifa"}
      description={activate ? `${rate.product.name} · ${rate.type} ${rate.segment.toLowerCase()} vuelve a ofrecerse en cotizaciones y reservas.` : `${rate.product.name} · ${rate.type} ${rate.segment.toLowerCase()} deja de ofrecerse. Las cotizaciones y reservas que ya la usan no cambian.`}
      submitLabel={activate ? "Activar" : "Inactivar"}
      action={toggleRate}
      hidden={{ product: rate.product.code, ref: rate.ref, action: activate ? "activate" : "deactivate" }}
      reason={activate ? undefined : "Por ejemplo: el proveedor cambió su tarifario."}
    />
  );
}

function SeasonFields({ seasonTypes, season }: { seasonTypes: string[]; season?: SeasonRow }) {
  return (
    <>
      <TextField label="Nombre" name="name" required minLength={3} maxLength={120} defaultValue={season?.name} placeholder="Por ejemplo: Semana Santa 2027" icon={<CalendarRange size={17} />} />
      <SelectField label="Tipo" name="type" options={list(seasonTypes)} defaultValue={season?.type ?? "Alta"} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Desde" name="date_from" type="date" required defaultValue={season?.date_from} />
        <TextField label="Hasta" name="date_to" type="date" required defaultValue={season?.date_to} />
        <TextField label="Prioridad" name="priority" type="number" min={0} max={99} required defaultValue={season?.priority ?? 1} hint="0 es la que más pesa." />
        <TextField label="Factor" name="factor" type="number" step="0.01" min="0.01" max="3" required defaultValue={season?.factor ?? 1} hint="1.20 sube el costo base 20 %." />
      </div>
      {season && <ChoiceGroup label="Estado" name="status" options={[{ value: "activa", label: "Activa" }, { value: "inactiva", label: "Inactiva" }]} defaultValue={season.status} />}
    </>
  );
}

export function SeasonCreateAction({ seasonTypes, trigger }: { seasonTypes: string[]; trigger?: (open: () => void) => ReactNode }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Nueva temporada"
      icon={<Tag size={16} />}
      formId="season-create"
      trigger={trigger}
      title="Nueva temporada"
      description="Dos temporadas activas pueden cruzarse solo si tienen distinta prioridad; manda la de número menor."
      submitLabel="Crear temporada"
      action={createSeason}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => <SeasonFields seasonTypes={seasonTypes} />}
    </PanelAction>
  );
}

export function SeasonEditAction({ overview, season }: { overview: RatesOverview; season: SeasonRow }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Editar"
      formId={`season-edit-${season.ref}`}
      trigger={(open) => <RowIcon tone="edit" label="Editar" onClick={open} />}
      title="Editar temporada"
      description={`${season.name} · ${season.ref}`}
      submitLabel="Guardar cambios"
      action={updateSeason}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={{ ref: season.ref }} />
          <SeasonFields seasonTypes={overview.options.season_types} season={season} />
        </>
      )}
    </PanelAction>
  );
}

export function SeasonToggleAction({ season }: { season: SeasonRow }) {
  const activate = season.status === "inactiva";
  const usage = season.rates + season.products;
  return (
    <ConfirmAction
      id={`season-${season.ref}`}
      label={activate ? "Activar" : "Inactivar"}
      tone={activate ? "neutral" : "delete"}
      icon={activate ? <CirclePlay size={16} /> : <CircleStop size={16} />}
      title={activate ? "Activar temporada" : "Inactivar temporada"}
      description={
        activate
          ? `${season.name} vuelve a aplicarse a las fechas que cubre.`
          : usage > 0
            ? `${season.name} la usan ${season.rates} tarifas y ${season.products} productos. Al inactivarla dejan de aplicar su factor; las tarifas se conservan.`
            : `${season.name} deja de aplicarse.`
      }
      submitLabel={activate ? "Activar" : "Inactivar"}
      action={toggleSeason}
      hidden={{ ref: season.ref, action: activate ? "activate" : "deactivate" }}
    />
  );
}
