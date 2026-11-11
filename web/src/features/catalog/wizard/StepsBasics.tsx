"use client";

import { MapPinPlus } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { InfoTip } from "@/components/ui/InfoTip";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import type { ProductMaster } from "@/lib/catalog";
import { Button } from "@/components/ui/Button";
import { DestinationCreateAction } from "@/features/catalog-destinations/DestinationForms";
import { Group, ManageLink, numberValue, ToggleChips, type StepProps } from "./fields";

const titleCase = (value: string) => value.charAt(0) + value.slice(1).toLocaleLowerCase("es");

function suggestCode(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9 ]/g, " ")
    .split(/\s+/)
    .filter((word) => word.length > 2)
    .slice(0, 3)
    .map((word) => word.slice(0, 4))
    .join("-");
}

function useMaster({ set }: StepProps) {
  return (patch: Partial<ProductMaster>) => set((current) => ({ master: { ...current.master, ...patch } }));
}

export function DefineStep(props: StepProps & { creating: boolean }) {
  const { draft, options, errors, creating } = props;
  const master = useMaster(props);
  const touched = useRef(!creating);
  const m = draft.master;
  const type = options.types.find((item) => item.id === m.type_id);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Group title="Identificación">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Nombre comercial" name="name" required minLength={3} value={m.name} error={errors.name} placeholder="Por ejemplo: Valle Sagrado VIP Full Day" onChange={(event) => master({ name: event.target.value, ...(touched.current ? {} : { code: suggestCode(event.target.value) }) })} />
          <TextField label="Nombre interno" name="internal_name" value={m.internal_name} error={errors.internal_name} placeholder="Si se deja vacío, usa el comercial" onChange={(event) => master({ internal_name: event.target.value })} />
          <TextField
            label="Código interno"
            name="code"
            required
            value={m.code}
            error={errors.code}
            placeholder="CUS-VSG-VIP"
            tip="Único en tu agencia. Letras, números y guiones."
            onChange={(event) => {
              touched.current = true;
              master({ code: event.target.value.toUpperCase() });
            }}
          />
          <TextField label="SKU comercial" name="sku" value={m.sku} error={errors.sku} placeholder="Se arma solo si lo dejas vacío" onChange={(event) => master({ sku: event.target.value.toUpperCase() })} />
          <SelectField
            label="Tipo de producto"
            name="type_id"
            value={m.type_id}
            error={errors.type_id}
            placeholder="Elegir"
            options={options.types.map((item) => ({ value: item.id, label: titleCase(item.name), hint: item.requires_itinerary ? "Requiere itinerario para activarse" : undefined }))}
            hint={type ? (type.requires_itinerary ? "Este tipo necesita itinerario para activarse." : "El itinerario es opcional para este tipo.") : undefined}
            onChange={(value) => master({ type_id: value })}
          />
          <ChoiceGroup label="Modalidad" name="modality" defaultValue={m.modality} options={options.modalities.map((value) => ({ value, label: value }))} onChange={(value) => master({ modality: value })} />
        </div>
        <TextArea label="Descripción corta" name="short_description" rows={3} maxLength={600} value={m.short_description} error={errors.short_description} placeholder="Lo que verá Ventas y el cliente en una o dos frases." onChange={(event) => master({ short_description: event.target.value })} />
      </Group>
      <Group title="Duración, pasajeros y anticipación">
        <div className="grid gap-3 sm:grid-cols-2">
          <TextField label="Duración" name="duration_value" type="number" min={1} step="0.5" required value={m.duration_value} error={errors.duration_value} onChange={(event) => master({ duration_value: numberValue(event.target.value) })} />
          <SelectField label="Unidad" name="duration_unit" value={m.duration_unit} options={options.units.map((unit) => ({ value: unit, label: unit }))} onChange={(value) => master({ duration_unit: value })} />
          <TextField label="Pasajeros mínimo" name="minimum_passengers" type="number" min={1} required value={m.minimum_passengers} error={errors.minimum_passengers} onChange={(event) => master({ minimum_passengers: numberValue(event.target.value) })} />
          <TextField label="Pasajeros máximo" name="maximum_passengers" type="number" min={1} required value={m.maximum_passengers} error={errors.maximum_passengers} onChange={(event) => master({ maximum_passengers: numberValue(event.target.value) })} />
          <TextField label="Edad mínima" name="minimum_age" type="number" min={0} required value={m.minimum_age} error={errors.minimum_age} onChange={(event) => master({ minimum_age: numberValue(event.target.value) })} />
          <TextField label="Edad máxima" name="maximum_age" type="number" min={0} required value={m.maximum_age} error={errors.maximum_age} onChange={(event) => master({ maximum_age: numberValue(event.target.value) })} />
          <TextField label="Anticipación mínima (días)" name="booking_advance_min_days" type="number" min={0} required value={m.booking_advance_min_days} error={errors.booking_advance_min_days} onChange={(event) => master({ booking_advance_min_days: numberValue(event.target.value) })} />
          <TextField label="Anticipación máxima (días)" name="booking_advance_max_days" type="number" min={0} required value={m.booking_advance_max_days} error={errors.booking_advance_max_days} onChange={(event) => master({ booking_advance_max_days: numberValue(event.target.value) })} />
        </div>
      </Group>
    </div>
  );
}

const FLAGS: { key: keyof Pick<ProductMaster, "is_bookable" | "is_quoteable" | "is_b2b" | "is_ecommerce" | "is_featured">; label: string; hint: string }[] = [
  { key: "is_bookable", label: "Permite reserva", hint: "Se puede reservar directamente." },
  { key: "is_quoteable", label: "Permite cotización", hint: "Aparece en el cotizador de Ventas." },
  { key: "is_b2b", label: "Disponible B2B", hint: "Lo ven las agencias asociadas." },
  { key: "is_ecommerce", label: "Publicable en e-commerce", hint: "Se vende en la tienda en línea." },
  { key: "is_featured", label: "Destacado", hint: "Sale primero en el sitio y en el catálogo." },
];

export function CategorizeStep(props: StepProps) {
  const { draft, options, errors } = props;
  const master = useMaster(props);
  const category = options.categories.find((item) => item.id === draft.master.category_id);

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <Group title="Clasificación">
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Categoría" name="category_id" value={draft.master.category_id} error={errors.category_id} placeholder="Elegir" options={options.categories.map((item) => ({ value: item.id, label: item.name }))} onChange={(value) => master({ category_id: value, subcategory_id: "" })} />
          <SelectField
            key={draft.master.category_id}
            label="Subcategoría"
            name="subcategory_id"
            value={draft.master.subcategory_id}
            error={errors.subcategory_id}
            clearable
            placeholder={category ? (category.subcategories.length ? "Elegir" : "Sin subcategorías") : "Elige primero la categoría"}
            options={(category?.subcategories ?? []).map((item) => ({ value: item.id, label: item.name }))}
            onChange={(value) => master({ subcategory_id: value })}
          />
        </div>
        <p className="text-[12.5px] text-fg-3">
          Las categorías se administran en{" "}
          <Link href="/catalogo/categorias" className="font-semibold text-accent hover:underline">
            Tipos y categorías
          </Link>
          .
        </p>
      </Group>
      <Group
        title="Indicadores comerciales"
        hint={
          <span className="inline-flex items-center gap-1">
            Se aplican cuando el producto esté activo.
            <InfoTip label="Cuándo se aplican">Un producto en borrador no es comercializable. Estos indicadores toman efecto al activarlo (PRD-BR-002).</InfoTip>
          </span>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          {FLAGS.map((flag) => (
            <SwitchField key={flag.key} label={flag.label} hint={flag.hint} name={flag.key} checked={draft.master[flag.key]} onCheckedChange={(checked) => master({ [flag.key]: checked })} />
          ))}
        </div>
        {options.sees_cost && draft.master.markup_pct !== null && (
          <TextField label="Margen sugerido (%)" name="markup_pct" type="number" min={0} max={300} step="0.1" value={draft.master.markup_pct} error={errors.markup_pct} tip="Margen de referencia para proponer el precio de venta sobre el costo." onChange={(event) => master({ markup_pct: numberValue(event.target.value) })} className="max-w-xs" />
        )}
      </Group>
    </div>
  );
}

export function DestinationStep(props: StepProps) {
  const { draft, set, options, errors } = props;
  const secondary = options.destinations.filter((item) => item.id !== draft.master.destination_id);

  return (
    <div className="flex flex-col gap-6">
      <Group
        title="Destino principal"
        hint="Jerarquía país, región, departamento, ciudad o zona, lugar y atracción."
        action={
          <>
            {options.can_manage_destinations && (
              <DestinationCreateAction
                destinations={options.destinations}
                types={options.destination_types}
                trigger={(open) => (
                  <Button type="button" size="sm" icon={<MapPinPlus size={14} />} onClick={open} data-testid="btn-new-destination">
                    Nuevo destino
                  </Button>
                )}
              />
            )}
            <ManageLink href="/catalogo/destinos" label="Administrar destinos" />
          </>
        }
      >
        <SelectField
          label="Destino principal"
          name="destination_id"
          value={draft.master.destination_id}
          error={errors.destination_id}
          placeholder="Elegir"
          options={options.destinations.map((item) => ({ value: item.id, label: item.path }))}
          onChange={(value) => set({ master: { ...draft.master, destination_id: value }, secondary_destination_ids: draft.secondary_destination_ids.filter((id) => id !== value) })}
        />
      </Group>
      <Group title="Destinos secundarios" hint="Lugares que también recorre el producto. Ayudan a encontrarlo en búsquedas y en el sitio.">
        <ToggleChips label="Elige los que apliquen" testId="field:secondary_destination_ids" options={secondary.map((item) => ({ value: item.id, label: item.name, hint: item.path }))} selected={draft.secondary_destination_ids} onChange={(next) => set({ secondary_destination_ids: next })} />
      </Group>
    </div>
  );
}
