"use client";

import { CircleCheck, CircleOff, Lock, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { InfoTip } from "@/components/ui/InfoTip";
import { RowsEditor } from "@/components/ui/RowsEditor";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { SeasonCreateAction } from "@/features/catalog-rates/RateForms";
import { cn } from "@/lib/cn";
import { AVAILABILITY_HINT, AVAILABILITY_LABEL, type ProductComponentDraft, type ProductRateDraft, type ProductReview } from "@/lib/catalog";
import { formatDate, formatMoney } from "@/lib/format";
import { emptyRate } from "./draft";
import { ErrorList, Group, ManageLink, numberValue, rowError, type StepProps } from "./fields";

export function ComponentsStep({ draft, set, options, errors, review }: StepProps & { review: ProductReview | null }) {
  const services = (selected: string | null) =>
    options.services.map((service) => ({
      value: service.id,
      label: `${service.ref} · ${service.name}`,
      hint: [service.provider, service.cost !== null ? `${formatMoney(service.cost, service.currency)} por ${service.unit}` : service.unit, service.blocked].filter(Boolean).join(" · "),
      disabled: Boolean(service.blocked) || (service.id !== selected && draft.components.some((component) => component.service_id === service.id)),
    }));

  return (
    <div className="flex flex-col gap-6">
      <Group title="Proveedor principal" hint="Solo proveedores activos y con contrato vigente (PRD-BR-007). Si lo dejas vacío, se toma el del primer componente.">
        <SelectField
          label="Proveedor principal"
          name="main_provider_id"
          value={draft.main_provider_id ?? ""}
          error={errors.main_provider_id ?? errors.provider_id}
          clearable
          placeholder="Sin asignar"
          options={options.providers.map((provider) => ({ value: provider.id, label: provider.name, hint: [provider.type, provider.blocked].filter(Boolean).join(" · "), disabled: Boolean(provider.blocked) && provider.id !== draft.main_provider_id }))}
          onChange={(value) => set({ main_provider_id: value || null })}
          className="max-w-xl"
        />
      </Group>
      <Group
        title="Componentes"
        hint={review?.summary.components_cost != null ? `Costo total de componentes: ${formatMoney(review.summary.components_cost)} (se recalcula al guardar el paso).` : "Servicios de proveedores o productos activos que forman este producto."}
      >
        <ErrorList errors={errors} prefix={["components"]} />
        <RowsEditor<ProductComponentDraft>
          testId="field:components"
          rows={draft.components}
          onChange={(components) => set({ components })}
          create={() => ({ service_id: null, component_product_id: null, quantity: 1, is_required: true, is_included: true, notes: "" })}
          itemLabel="Componente"
          addLabel="Agregar componente"
          empty={options.types.find((type) => type.id === draft.master.type_id)?.requires_components === false ? "Este tipo no exige componentes." : "Aún no hay componentes. El checklist de activación los exige."}
          render={(row, update, index) => {
            const isProduct = row.component_product_id !== null && row.service_id === null;
            return (
              <div className="grid gap-3 lg:grid-cols-[220px_minmax(0,1fr)_110px] xl:grid-cols-[220px_minmax(0,1fr)_110px_minmax(0,0.8fr)]">
                <ChoiceGroup
                  label="Origen"
                  name={`components.${index}.kind`}
                  defaultValue={isProduct ? "product" : "service"}
                  options={[
                    { value: "service", label: "Servicio" },
                    { value: "product", label: "Producto" },
                  ]}
                  onChange={(kind) => update(kind === "product" ? { service_id: null, component_product_id: "" } : { service_id: null, component_product_id: null })}
                />
                {isProduct || row.component_product_id === "" ? (
                  <SelectField label="Producto activo" name={`components.${index}.component_product_id`} value={row.component_product_id ?? ""} error={rowError(errors, "components", index, "component_product_id")} placeholder="Elegir producto" options={options.products.filter((product) => product.code !== draft.master.code).map((product) => ({ value: product.id, label: `${product.code} · ${product.name}` }))} onChange={(value) => update({ component_product_id: value })} />
                ) : (
                  <SelectField label="Servicio" name={`components.${index}.service_id`} value={row.service_id ?? ""} error={rowError(errors, "components", index, "service_id")} placeholder="Elegir servicio" options={services(row.service_id)} onChange={(value) => update({ service_id: value })} />
                )}
                <TextField label="Cantidad" name={`components.${index}.quantity`} type="number" min={1} value={row.quantity} error={rowError(errors, "components", index, "quantity")} onChange={(event) => update({ quantity: numberValue(event.target.value) })} />
                <TextField label="Nota" name={`components.${index}.notes`} value={row.notes ?? ""} placeholder="Opcional" onChange={(event) => update({ notes: event.target.value })} className="lg:col-span-2 xl:col-span-1" />
                <div className="flex flex-wrap items-center gap-5 lg:col-span-3 xl:col-span-4">
                  <SwitchField label="Requerido" name={`components.${index}.is_required`} checked={row.is_required} onCheckedChange={(checked) => update({ is_required: checked })} />
                  <SwitchField label="Incluido en el precio" name={`components.${index}.is_included`} checked={row.is_included} onCheckedChange={(checked) => update({ is_included: checked })} />
                  {row.subtotal_pen && <span className="ml-auto text-[12.5px] text-fg-3">Subtotal {formatMoney(row.subtotal_pen)}</span>}
                </div>
              </div>
            );
          }}
        />
      </Group>
    </div>
  );
}

export function ItineraryStep({ draft, set, options, errors }: StepProps) {
  const type = options.types.find((item) => item.id === draft.master.type_id);

  return (
    <Group title="Días y actividades" hint={type?.requires_itinerary ? `El tipo ${type.name.toLocaleLowerCase("es")} requiere itinerario con actividades cada día para activarse.` : "El itinerario es opcional para este tipo, pero ayuda a Ventas y al pasajero."}>
      <ErrorList errors={errors} prefix={["itinerary"]} />
      <RowsEditor
        testId="field:itinerary"
        rows={draft.itinerary}
        onChange={(itinerary) => set({ itinerary })}
        create={() => ({ title: "", items: [{ time: "08:00", activity: "", type: "Actividad", location: "" }] })}
        itemLabel="Día"
        addLabel="Agregar día"
        empty="Sin días todavía."
        render={(day, update, dayIndex) => (
          <div className="flex flex-col gap-3">
            <TextField label="Título del día" name={`itinerary.${dayIndex}.title`} value={day.title} error={rowError(errors, "itinerary", dayIndex, "title")} placeholder="Por ejemplo: Cusco — Valle Sagrado" onChange={(event) => update({ title: event.target.value })} />
            <div className="rounded-[12px] border border-line-2 bg-surface p-3">
              <RowsEditor
                rows={day.items}
                onChange={(items) => update({ items })}
                create={() => ({ time: "", activity: "", type: "Actividad", location: "" })}
                itemLabel="Actividad"
                addLabel="Agregar actividad"
                empty="Día sin actividades."
                render={(item, change, itemIndex) => {
                  const base = `itinerary.${dayIndex}.items.${itemIndex}`;
                  return (
                    <div className="grid gap-3 sm:grid-cols-[120px_minmax(0,1fr)] lg:grid-cols-[120px_minmax(0,1.4fr)_180px_minmax(0,1fr)]">
                      <TextField label="Hora" name={`${base}.time`} type="time" value={item.time ?? ""} error={errors[`${base}.time`]} onChange={(event) => change({ time: event.target.value || null })} />
                      <TextField label="Actividad" name={`${base}.activity`} value={item.activity} error={errors[`${base}.activity`]} placeholder="Qué se hace" onChange={(event) => change({ activity: event.target.value })} />
                      <SelectField label="Tipo" name={`${base}.type`} value={item.type ?? ""} options={options.item_types.map((value) => ({ value, label: value }))} onChange={(value) => change({ type: value })} />
                      <TextField label="Ubicación" name={`${base}.location`} value={item.location ?? ""} placeholder="Opcional" onChange={(event) => change({ location: event.target.value })} />
                    </div>
                  );
                }}
              />
            </div>
          </div>
        )}
      />
    </Group>
  );
}

function RateForm({ options, suggestedCost, error, onAdd }: { options: StepProps["options"]; suggestedCost: string | null; error: (field: string) => string | undefined; onAdd: (rate: ProductRateDraft) => Promise<boolean> }) {
  const [rate, setRate] = useState<ProductRateDraft>(() => emptyRate(options, suggestedCost));
  const [busy, setBusy] = useState(false);
  const [version, setVersion] = useState(0);
  const patch = (value: Partial<ProductRateDraft>) => setRate((current) => ({ ...current, ...value }));
  const select = (values: string[]) => values.map((value) => ({ value, label: value }));

  return (
    <div key={version} className="rounded-[14px] border border-dashed border-accent/40 bg-accent/[0.03] p-4">
      <p className="mb-3 text-[13px] font-semibold text-fg">Nueva tarifa</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        <SelectField label="Tipo" name="rate_type" value={rate.rate_type} error={error("rate_type")} options={select(options.rates.types)} onChange={(value) => patch({ rate_type: value })} />
        <SelectField label="Segmento" name="segment" value={rate.segment} error={error("segment")} options={select(options.rates.segments)} onChange={(value) => patch({ segment: value })} />
        <SelectField label="Canal" name="channel" value={rate.channel} error={error("channel")} options={select(options.rates.channels)} onChange={(value) => patch({ channel: value })} />
        <SelectField label="Moneda" name="currency" value={rate.currency} error={error("currency")} placeholder="Elegir" options={select(options.rates.currencies)} onChange={(value) => patch({ currency: value })} />
        <SelectField label="Se cobra" name="price_basis" value={rate.price_basis} error={error("price_basis")} options={select(options.rates.bases)} onChange={(value) => patch({ price_basis: value })} />
        {options.sees_cost && <TextField label="Costo" name="cost" type="number" min={0} step="0.01" value={rate.cost ?? ""} error={error("cost")} onChange={(event) => patch({ cost: event.target.value })} />}
        <TextField label="Precio de venta" name="price" type="number" min={0} step="0.01" value={rate.price} error={error("price")} onChange={(event) => patch({ price: event.target.value })} />
        <TextField label="Vigente desde" name="valid_from" type="date" value={rate.valid_from} error={error("valid_from")} onChange={(event) => patch({ valid_from: event.target.value })} />
        <TextField label="Vigente hasta" name="valid_to" type="date" min={rate.valid_from} value={rate.valid_to} error={error("valid_to")} onChange={(event) => patch({ valid_to: event.target.value })} />
        <SelectField label="Temporada" name="season_id" value={rate.season_id ?? ""} clearable placeholder="Sin temporada" options={options.seasons.filter((season) => season.status === "activa").map((season) => ({ value: season.id, label: season.name, hint: `${formatDate(season.date_from)} al ${formatDate(season.date_to)}` }))} onChange={(value) => patch({ season_id: value || null })} />
        <RateLimitsFields rate={rate} error={error} patch={patch} />
      </div>
      <div className="mt-3 flex justify-end">
        <Button
          type="button"
          variant="secondary"
          icon={<Plus size={15} />}
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            if (await onAdd(rate)) {
              setRate(emptyRate(options, suggestedCost));
              setVersion((value) => value + 1);
            }
            setBusy(false);
          }}
        >
          {busy ? "Agregando…" : "Agregar tarifa"}
        </Button>
      </div>
    </div>
  );
}

function RateLimitsFields({ rate, error, patch }: { rate: ProductRateDraft; error: (field: string) => string | undefined; patch: (value: Partial<ProductRateDraft>) => void }) {
  return (
    <>
      <TextField label="Precio mínimo" name="min_price" type="number" min={0} step="0.01" value={rate.min_price ?? ""} error={error("min_price")} hint="Opcional: piso al negociar." onChange={(event) => patch({ min_price: event.target.value })} />
      <TextField label="Precio máximo" name="max_price" type="number" min={0} step="0.01" value={rate.max_price ?? ""} error={error("max_price")} hint="Opcional: techo al negociar." onChange={(event) => patch({ max_price: event.target.value })} />
      <div className="sm:col-span-2 lg:col-span-2 xl:col-span-3">
        <TextField label="Condiciones" name="conditions" maxLength={300} value={rate.conditions ?? ""} error={error("conditions")} placeholder="Por ejemplo: mínimo 2 pasajeros, no reembolsable" onChange={(event) => patch({ conditions: event.target.value })} />
      </div>
    </>
  );
}

function RateEditForm({ initial, options, error, onSave, onCancel }: { initial: ProductRateDraft; options: StepProps["options"]; error: (field: string) => string | undefined; onSave: (rate: ProductRateDraft, reason: string | null) => Promise<boolean>; onCancel: () => void }) {
  const [rate, setRate] = useState<ProductRateDraft>(initial);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const patch = (value: Partial<ProductRateDraft>) => setRate((current) => ({ ...current, ...value }));
  const priceChanged = Number(rate.price) !== Number(initial.price) || Number(rate.cost ?? 0) !== Number(initial.cost ?? 0);

  return (
    <div className="col-span-full mt-3 rounded-[14px] border border-accent/30 bg-accent/[0.03] p-4">
      <p className="mb-3 text-[13px] font-semibold">Editar {initial.ref}</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
        {options.sees_cost && <TextField label="Costo" name="edit_cost" type="number" min={0} step="0.01" value={rate.cost ?? ""} error={error("cost")} onChange={(event) => patch({ cost: event.target.value })} />}
        <TextField label="Precio de venta" name="edit_price" type="number" min={0} step="0.01" value={rate.price} error={error("price")} onChange={(event) => patch({ price: event.target.value })} />
        <TextField label="Vigente desde" name="edit_valid_from" type="date" value={rate.valid_from} error={error("valid_from")} onChange={(event) => patch({ valid_from: event.target.value })} />
        <TextField label="Vigente hasta" name="edit_valid_to" type="date" min={rate.valid_from} value={rate.valid_to} error={error("valid_to")} onChange={(event) => patch({ valid_to: event.target.value })} />
        <RateLimitsFields rate={rate} error={error} patch={patch} />
        {priceChanged && (
          <div className="sm:col-span-2 lg:col-span-4 xl:col-span-5">
            <TextField label="Motivo del cambio de precio" name="edit_reason" required maxLength={300} value={reason} error={error("reason")} placeholder="Por ejemplo: subió el costo del tren" hint="Obligatorio cuando cambia el precio o el costo (CAT-BR-14)." onChange={(event) => setReason(event.target.value)} />
          </div>
        )}
      </div>
      <div className="mt-3 flex justify-end gap-2">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          type="button"
          variant="secondary"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            if (await onSave(rate, reason.trim() || null)) onCancel();
            setBusy(false);
          }}
        >
          {busy ? "Guardando…" : "Guardar tarifa"}
        </Button>
      </div>
    </div>
  );
}

function RateRemoveButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false);
  if (asking) {
    return (
      <span className="flex items-center gap-1 rounded-lg bg-bad/10 px-2 py-1 text-[12px] font-semibold text-bad">
        ¿Quitar?
        <button type="button" onClick={onConfirm} className="rounded-md px-1.5 py-0.5 hover:bg-bad/15">Sí</button>
        <button type="button" onClick={() => setAsking(false)} className="rounded-md px-1.5 py-0.5 text-fg-3 hover:bg-surface-2">No</button>
      </span>
    );
  }
  return (
    <button type="button" title="Quitar" aria-label={label} onClick={() => setAsking(true)} className="grid h-8 w-8 place-items-center rounded-lg text-fg-3 transition hover:bg-bad/10 hover:text-bad">
      <Trash2 size={15} />
    </button>
  );
}

const RATE_STATE: Record<string, { label: string; tone: "ok" | "mute" | "bad" | "info" }> = {
  vigente: { label: "Vigente", tone: "ok" },
  programada: { label: "Programada", tone: "info" },
  vencida: { label: "Vencida", tone: "bad" },
  inactiva: { label: "Inactiva", tone: "mute" },
};

export function RatesStep({ draft, set, options, errors, review, saved, onAdd, onToggle, onUpdate, onRemove }: StepProps & { review: ProductReview | null; saved: ProductRateDraft[] | null; onAdd: (rate: ProductRateDraft) => Promise<boolean>; onToggle: (ref: string, active: boolean) => void; onUpdate: (rate: ProductRateDraft, reason: string | null) => Promise<boolean>; onRemove: (ref: string) => void }) {
  const rows = saved ?? draft.rates;
  const editing = saved !== null;
  const [editingRef, setEditingRef] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface-2/50 px-4 py-3 text-[13px] text-fg-2">
        {review?.summary.components_cost != null && <span>Costo de componentes: <b className="font-semibold text-fg">{formatMoney(review.summary.components_cost)}</b>.</span>}
        <span>Toda tarifa necesita moneda y vigencia, y no se aceptan tarifas ya vencidas.</span>
        <InfoTip label="Reglas de tarifas">PRD-BR-004: moneda y vigencia obligatorias. PRD-BR-005: una tarifa fuera de vigencia no se aplica ni se registra como vigente.</InfoTip>
      </div>
      <ErrorList errors={errors} prefix={["rates"]} />
      {!options.can_manage_rates && <p className="text-[13px] text-fg-3">Tu rol no carga tarifas. Las agrega quien gestiona tarifas.</p>}
      {rows.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-line px-4 py-3.5 text-[13px] text-fg-3">Sin tarifas. El producto no podrá activarse hasta tener una tarifa vigente.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((rate, index) => {
            const state = rate.state ? RATE_STATE[rate.state] : null;
            return (
              <li key={rate.ref ?? index} className={cn("lift grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 rounded-[14px] border border-line px-4 py-3", rate.state && rate.state !== "vigente" && rate.state !== "programada" && "opacity-60")}>
                <span className="min-w-0">
                  <b className="block text-[13.5px] font-semibold">
                    {rate.rate_type} · {rate.segment} · {rate.channel}
                  </b>
                  <span className="text-[12px] text-fg-3">
                    {rate.price_basis} · {formatDate(rate.valid_from)} al {rate.valid_to ? formatDate(rate.valid_to) : "sin fecha"}
                    {rate.season_id && ` · ${options.seasons.find((season) => season.id === rate.season_id)?.name ?? "temporada"}`}
                    {(rate.min_price || rate.max_price) && ` · rango ${rate.min_price ? formatMoney(rate.min_price, rate.currency || "PEN") : "—"} a ${rate.max_price ? formatMoney(rate.max_price, rate.currency || "PEN") : "—"}`}
                  </span>
                  {rate.conditions && <span className="block text-[12px] text-fg-2">{rate.conditions}</span>}
                </span>
                <span className="text-right">
                  <b className="block font-mono text-[13.5px]">{rate.currency ? formatMoney(rate.price || 0, rate.currency) : rate.price}</b>
                  {rate.cost !== null && rate.cost !== "" && <span className="text-[12px] text-fg-3">Costo {formatMoney(rate.cost, rate.currency || "PEN")}{rate.margin_pct != null ? ` · ${rate.margin_pct} %` : ""}</span>}
                </span>
                <span className="flex items-center gap-1.5">
                  {state && <Badge tone={state.tone}>{state.label}</Badge>}
                  {editing && rate.ref && options.can_manage_rates && options.sees_cost && (rate.state === "vigente" || rate.state === "programada") && (
                    <button type="button" title="Editar" aria-label={`Editar ${rate.ref}`} onClick={() => setEditingRef(editingRef === rate.ref ? null : (rate.ref as string))} className="grid h-8 w-8 place-items-center rounded-lg text-fg-3 transition hover:bg-surface-2 hover:text-fg">
                      <Pencil size={15} />
                    </button>
                  )}
                  {editing && rate.ref && options.can_manage_rates && rate.state !== "vencida" && (
                    <button type="button" title={rate.state === "inactiva" ? "Activar" : "Desactivar"} aria-label={rate.state === "inactiva" ? `Activar ${rate.ref}` : `Desactivar ${rate.ref}`} onClick={() => onToggle(rate.ref as string, rate.state === "inactiva")} className="grid h-8 w-8 place-items-center rounded-lg text-fg-3 transition hover:bg-surface-2 hover:text-fg">
                      {rate.state === "inactiva" ? <CircleCheck size={16} /> : <CircleOff size={16} />}
                    </button>
                  )}
                  {editing && rate.ref && options.can_manage_rates && <RateRemoveButton label={`Quitar ${rate.ref}`} onConfirm={() => onRemove(rate.ref as string)} />}
                  {!editing && (
                    <button type="button" title="Quitar" aria-label={`Quitar tarifa ${index + 1}`} onClick={() => set({ rates: draft.rates.filter((_, position) => position !== index) })} className="grid h-8 w-8 place-items-center rounded-lg text-fg-3 transition hover:bg-bad/10 hover:text-bad">
                      <Trash2 size={15} />
                    </button>
                  )}
                </span>
                {editing && rate.ref && editingRef === rate.ref && <RateEditForm key={`${rate.ref}-${rate.lock_version}`} initial={rate} options={options} error={(field) => errors[`rates.0.${field}`]} onSave={onUpdate} onCancel={() => setEditingRef(null)} />}
              </li>
            );
          })}
        </ul>
      )}
      {options.can_manage_rates && <RateForm key={review?.summary.components_cost ?? "sin-costo"} options={options} suggestedCost={review?.summary.components_cost ?? null} error={(field) => errors[`rates.${editing ? 0 : draft.rates.length - 1}.${field}`]} onAdd={onAdd} />}
    </div>
  );
}

export function SeasonsStep({ draft, set, options, rates }: StepProps & { rates: ProductRateDraft[] }) {
  const byRate = new Set(rates.map((rate) => rate.season_id).filter(Boolean));
  const toggle = (id: string) => set({ season_ids: draft.season_ids.includes(id) ? draft.season_ids.filter((item) => item !== id) : [...draft.season_ids, id] });

  return (
    <Group
      title="Temporadas"
      hint="Asocia las temporadas que modifican tarifa o disponibilidad. Las que usan tus tarifas quedan asociadas solas."
      action={
        <>
          {options.can_manage_rates && (
            <SeasonCreateAction
              seasonTypes={options.season_types}
              trigger={(open) => (
                <Button type="button" size="sm" icon={<Plus size={14} />} onClick={open} data-testid="btn-new-season">
                  Nueva temporada
                </Button>
              )}
            />
          )}
          <ManageLink href="/catalogo/tarifas" label="Administrar temporadas" />
        </>
      }
    >
      {options.seasons.length === 0 ? (
        <p className="text-[13px] text-fg-3">Aún no hay temporadas. Crea la primera con «Nueva temporada».</p>
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {options.seasons.map((season) => {
            const linked = byRate.has(season.id);
            const on = linked || draft.season_ids.includes(season.id);
            const inactive = season.status !== "activa" && !draft.season_ids.includes(season.id);
            return (
              <button
                key={season.id}
                type="button"
                aria-pressed={on}
                disabled={linked || inactive}
                onClick={() => toggle(season.id)}
                className={cn("lift flex items-start gap-3 rounded-[14px] border px-3.5 py-3 text-left transition disabled:cursor-not-allowed", on ? "border-accent bg-accent/[0.06]" : "border-line hover:border-accent/40", inactive && "opacity-50")}
              >
                <span className={cn("mt-0.5 grid h-5 w-5 flex-none place-items-center rounded-md border", on ? "border-accent bg-accent text-white" : "border-line")}>{linked ? <Lock size={11} /> : on && <CircleCheck size={13} />}</span>
                <span className="min-w-0">
                  <b className="block text-[13.5px] font-semibold">{season.name}</b>
                  <span className="block text-[12px] text-fg-3">
                    {season.type} · {formatDate(season.date_from)} al {formatDate(season.date_to)} · factor ×{Number(season.factor).toFixed(2)} · prioridad {season.priority}
                  </span>
                  {linked && <span className="text-[12px] font-medium text-accent">Usada por una tarifa</span>}
                  {season.status !== "activa" && <span className="text-[12px] font-medium text-fg-3">Inactiva</span>}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </Group>
  );
}

export function AvailabilityStep({ draft, set, options, errors }: StepProps) {
  const availability = draft.availability;
  const change = (patch: Partial<typeof availability>) => set((current) => ({ availability: { ...current.availability, ...patch } }));

  return (
    <div className="flex flex-col gap-6">
      <Group title="Modelo de disponibilidad">
        <div role="radiogroup" aria-label="Modelo de disponibilidad" data-testid="field:availability_model" className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {options.availability.map((model) => (
            <button key={model} type="button" role="radio" aria-checked={availability.model === model} onClick={() => change({ model })} className={cn("lift rounded-[14px] border px-3.5 py-3 text-left transition", availability.model === model ? "border-accent bg-accent/[0.06] shadow-[0_10px_24px_-18px_var(--accent)]" : "border-line hover:border-accent/40")}>
              <b className="block text-[13.5px] font-semibold">{AVAILABILITY_LABEL[model] ?? model}</b>
              <span className="block text-[12px] text-fg-3">{AVAILABILITY_HINT[model]}</span>
            </button>
          ))}
        </div>
        <ErrorList errors={errors} prefix={["model", "availability"]} />
      </Group>
      <Group title="Capacidad y fuente">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Capacidad o cupo de referencia" name="capacity" type="number" min={1} value={availability.capacity ?? ""} error={errors.capacity ?? errors["availability.capacity"]} placeholder="Opcional" onChange={(event) => change({ capacity: event.target.value === "" ? null : Number(event.target.value) })} />
          <div>
            <ChoiceGroup
              label="Fuente de disponibilidad"
              name="source"
              defaultValue={availability.source}
              options={[
                { value: "interna", label: "Inventario propio" },
                { value: "externa", label: "Proveedor externo" },
              ]}
              onChange={(source) => change({ source })}
            />
            {availability.source === "externa" && <p className="mt-2 text-[12.5px] text-fg-3">La disponibilidad externa es informativa hasta que exista una integración confirmada con el proveedor (PRD-BR-013).</p>}
          </div>
        </div>
      </Group>
    </div>
  );
}
