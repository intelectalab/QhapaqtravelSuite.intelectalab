"use client";

import { Archive, CircleCheck, CircleDashed, CirclePause, CirclePlay, CircleStop, Pencil, Plus, Send, Trash2, Undo2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { changeProductStatus, createProduct, deleteProduct, updateProduct, type ProductActionState } from "@/app/(backoffice)/catalogo/productos/actions";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { RowIcon } from "@/components/table/RowActions";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { AVAILABILITY_LABEL, LIFECYCLE, type ProductDetail, type ProductFormOptions } from "@/lib/catalog";

const initial: ProductActionState = { message: null, done: false };

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="border-b border-line-2 pb-1.5 text-[13.5px] font-semibold text-fg">{title}</h3>
      {children}
    </section>
  );
}

function ProductFields({ options, product }: { options: ProductFormOptions; product?: ProductDetail }) {
  const [category, setCategory] = useState(product?.ids.category ?? "");
  const [b2b, setB2b] = useState(product?.raw.is_b2b ?? false);
  const [ecommerce, setEcommerce] = useState(product?.raw.is_ecommerce ?? false);
  const subcategories = options.categories.find((item) => item.id === category)?.subcategories ?? [];

  return (
    <>
      <Section title="Qué es">
        <TextField label="Nombre comercial" name="name" required minLength={3} defaultValue={product?.name} placeholder="Por ejemplo: Valle Sagrado VIP" />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Código interno" name="code" required defaultValue={product?.code} placeholder="CUS-VSG-FD" hint="Letras, números y guiones." />
          <TextField label="SKU (opcional)" name="sku" defaultValue={product?.sku} placeholder="Se arma solo" />
        </div>
        <SelectField label="Tipo de producto" name="type_id" options={options.types.map((type) => ({ value: type.id, label: type.name.charAt(0) + type.name.slice(1).toLocaleLowerCase("es") }))} defaultValue={product?.ids.type} placeholder="Elegir" />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Categoría" name="category_id" options={options.categories.map((item) => ({ value: item.id, label: item.name }))} defaultValue={category} placeholder="Elegir" onChange={setCategory} />
          <SelectField key={category} label="Subcategoría" name="subcategory_id" options={subcategories.map((item) => ({ value: item.id, label: item.name }))} defaultValue={product && product.ids.category === category ? (product.ids.subcategory ?? "") : ""} placeholder={subcategories.length ? "Elegir" : "Sin subcategorías"} />
        </div>
        <TextArea label="Descripción corta" name="short_description" rows={3} maxLength={600} defaultValue={product?.short_description ?? undefined} placeholder="Lo que verá Ventas y el cliente en una o dos frases." />
      </Section>
      <Section title="Dónde y cuánto dura">
        <SelectField label="Destino principal" name="destination_id" options={options.destinations.map((item) => ({ value: item.id, label: item.path }))} defaultValue={product?.ids.destination} placeholder="Elegir" />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Duración" name="duration_value" type="number" min={1} step="0.5" required defaultValue={product?.duration.value ?? 1} />
          <SelectField label="Unidad" name="duration_unit" options={options.units.map((unit) => ({ value: unit, label: unit }))} defaultValue={product?.duration.unit ?? "días"} />
        </div>
        <ChoiceGroup label="Modalidad" name="modality" defaultValue={product?.modality ?? "Compartido"} options={options.modalities.map((modality) => ({ value: modality, label: modality }))} />
      </Section>
      <Section title="Pasajeros y reserva">
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Pasajeros mínimo" name="minimum_passengers" type="number" min={1} required defaultValue={product?.pax.min ?? 1} />
          <TextField label="Pasajeros máximo" name="maximum_passengers" type="number" min={1} required defaultValue={product?.pax.max ?? 12} />
          <TextField label="Edad mínima" name="minimum_age" type="number" min={0} required defaultValue={product?.age.min ?? 0} />
          <TextField label="Edad máxima" name="maximum_age" type="number" min={0} required defaultValue={product?.age.max ?? 85} />
          <TextField label="Reservar con (días)" name="booking_advance_min_days" type="number" min={0} required defaultValue={product?.advance_days.min ?? 2} hint="Anticipación mínima." />
          <TextField label="Hasta (días antes)" name="booking_advance_max_days" type="number" min={0} required defaultValue={product?.advance_days.max ?? 365} />
        </div>
      </Section>
      <Section title="Operación y venta">
        <SelectField label="Proveedor principal" name="provider_id" options={options.providers.map((item) => ({ value: item.id, label: `${item.name} · ${item.type}` }))} defaultValue={product?.ids.provider ?? ""} placeholder="Sin asignar" />
        <SelectField label="Disponibilidad" name="availability_model" options={options.availability.map((item) => ({ value: item, label: AVAILABILITY_LABEL[item] ?? item }))} defaultValue={product?.raw.availability_model ?? "SIN_CONTROL"} />
        {product?.raw.markup_pct !== null && <TextField label="Margen sugerido (%)" name="markup_pct" type="number" min={0} max={300} defaultValue={product?.raw.markup_pct ?? 25} />}
        <SwitchField label="Vender a agencias B2B" name="is_b2b" checked={b2b} onCheckedChange={setB2b} />
        <SwitchField label="Publicar en la tienda en línea" name="is_ecommerce" checked={ecommerce} onCheckedChange={setEcommerce} hint="Solo se publica cuando el producto está activo." />
      </Section>
    </>
  );
}

export function ProductCreateAction({ options }: { options: ProductFormOptions }) {
  const router = useRouter();
  return (
    <PanelAction<ProductActionState>
      label="Nuevo producto"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId="product-create"
      title="Nuevo producto"
      description="Se crea en borrador. Itinerario, tarifas y componentes se completan después en su ficha, antes de activarlo."
      submitLabel="Crear borrador"
      action={createProduct}
      initial={initial}
      onDone={(state) => state.code && router.push(`/catalogo/productos/${state.code}`)}
    >
      {() => <ProductFields options={options} />}
    </PanelAction>
  );
}

export function ProductEditAction({ product, options, defaultOpen = false }: { product: ProductDetail; options: ProductFormOptions; defaultOpen?: boolean }) {
  const router = useRouter();
  return (
    <PanelAction<ProductActionState>
      label="Editar"
      icon={<Pencil size={16} />}
      formId="product-edit"
      defaultOpen={defaultOpen}
      title="Editar producto"
      description={`${product.name} · ${product.code}`}
      submitLabel="Guardar cambios"
      action={updateProduct}
      initial={initial}
      onDone={(state) => (state.code && state.code !== product.code ? router.replace(`/catalogo/productos/${state.code}`) : router.refresh())}
    >
      {() => (
        <>
          <input type="hidden" name="current_code" value={product.code} />
          <input type="hidden" name="lock_version" value={product.lock_version} />
          <ProductFields options={options} product={product} />
        </>
      )}
    </PanelAction>
  );
}

const ICONS: Record<string, ReactNode> = {
  "submit-review": <Send size={16} />,
  approve: <CircleCheck size={16} />,
  "return-to-draft": <Undo2 size={16} />,
  activate: <CirclePlay size={16} />,
  suspend: <CirclePause size={16} />,
  deactivate: <CircleStop size={16} />,
  archive: <Archive size={16} />,
};

export function ProductLifecycleActions({ product, options }: { product: ProductDetail; options: ProductFormOptions }) {
  const router = useRouter();
  const available = LIFECYCLE.filter((step) => step.from.includes(product.status) && (step.activate ? options.can_activate : options.can_update));

  return (
    <>
      {available.map((step) => (
        <PanelAction<ProductActionState>
          key={step.action}
          label={step.label}
          icon={ICONS[step.action]}
          variant={step.primary ? "primary" : step.action === "archive" ? "ghost" : "secondary"}
          formId={`product-${step.action}`}
          title={step.label}
          description={step.description}
          submitLabel={step.label}
          action={changeProductStatus}
          initial={initial}
          onDone={() => router.refresh()}
        >
          {(state) => (
            <>
              <input type="hidden" name="code" value={product.code} />
              <input type="hidden" name="action" value={step.action} />
              <input type="hidden" name="lock_version" value={product.lock_version} />
              {state.failed && state.failed.length > 0 && (
                <div className="rounded-xl border border-warn/30 bg-warn/[0.08] p-3.5 text-[13px]">
                  <p className="mb-2 font-semibold text-warn">Antes de activarlo falta</p>
                  <ul className="flex flex-col gap-1.5 text-fg-2">
                    {state.failed.map((item) => (
                      <li key={item.key} className="flex items-start gap-2">
                        <CircleDashed size={14} className="mt-0.5 flex-none text-warn" />
                        <span>
                          {item.label}
                          {item.detail && <span className="block text-[12px] text-fg-3">{item.detail}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {step.reason && <TextArea label="Motivo" name="reason" rows={3} required minLength={3} maxLength={500} placeholder="Queda registrado en el historial del producto." />}
            </>
          )}
        </PanelAction>
      ))}
    </>
  );
}

export function ProductDeleteAction({ product, iconOnly = false }: { product: Pick<ProductDetail, "code" | "name">; iconOnly?: boolean }) {
  const router = useRouter();
  return (
    <PanelAction<ProductActionState>
      label="Eliminar"
      icon={<Trash2 size={16} />}
      variant="ghost"
      formId={`product-delete-${product.code}`}
      trigger={iconOnly ? (open) => <RowIcon tone="delete" label="Eliminar" onClick={open} /> : undefined}
      title="Eliminar producto"
      description={`${product.name} desaparecerá del catálogo. Solo se puede si nunca se usó en cotizaciones, reservas ni paquetes; si ya se usó, archívalo.`}
      submitLabel="Eliminar producto"
      action={deleteProduct}
      initial={initial}
      onDone={() => (iconOnly ? router.refresh() : router.push("/catalogo/productos"))}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={product.code} />
          <TextArea label="Motivo" name="reason" rows={3} required minLength={3} maxLength={500} placeholder="Por ejemplo: se creó por error." />
        </>
      )}
    </PanelAction>
  );
}
