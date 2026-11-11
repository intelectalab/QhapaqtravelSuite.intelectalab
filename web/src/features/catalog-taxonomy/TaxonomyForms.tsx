"use client";

import { FolderPlus, Plus, Tag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createCategory, createProductType, createSubcategory, deleteCategory, deleteProductType, deleteSubcategory, updateCategory, updateProductType, updateSubcategory } from "@/app/(backoffice)/catalogo/categorias/actions";
import { RowIcon } from "@/components/table/RowActions";
import { PanelAction } from "@/components/ui/PanelAction";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { ConfirmAction, HiddenFields, STEP_INITIAL } from "@/features/catalog-shared/CatalogPanels";
import type { ProductCategory, ProductSubcategory, ProductType } from "@/lib/catalog-taxonomy";
import type { StepResult } from "@/lib/server/resource";

const inUse = (count: number, label: string) => (count === 1 ? `Lo usa un producto: cambia su ${label} antes de eliminar` : `Lo usan ${count} productos: cambia su ${label} antes de eliminar`);

function TypeFields({ type }: { type?: ProductType }) {
  const [itinerary, setItinerary] = useState(type?.requires_itinerary ?? false);
  const [components, setComponents] = useState(type?.requires_components ?? true);
  return (
    <>
      <TextField label="Nombre del tipo" name="name" required minLength={2} maxLength={60} defaultValue={type?.name} placeholder="Por ejemplo: CRUCERO FLUVIAL" icon={<Tag size={16} />} hint="Se guarda en mayúsculas, como el resto de los tipos." />
      <SwitchField label="Requiere itinerario para activarse" name="requires_itinerary" checked={itinerary} onCheckedChange={setItinerary} hint="El checklist de activación pide al menos un día de itinerario." />
      <SwitchField label="Requiere componentes" name="requires_components" checked={components} onCheckedChange={setComponents} hint="Apágalo para productos armados a medida, sin servicios fijos." />
    </>
  );
}

export function TypeCreateAction() {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Nuevo tipo"
      icon={<Plus size={16} strokeWidth={2.4} />}
      size="sm"
      variant="primary"
      formId="type-create"
      title="Nuevo tipo de producto"
      description="Los tipos ordenan el catálogo y definen qué exige el checklist para activar un producto."
      submitLabel="Crear tipo"
      action={createProductType}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => <TypeFields />}
    </PanelAction>
  );
}

export function TypeEditAction({ type }: { type: ProductType }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Editar"
      formId={`type-edit-${type.id}`}
      trigger={(open) => <RowIcon tone="edit" label="Editar tipo" onClick={open} />}
      title="Editar tipo de producto"
      description={type.products.length ? `${type.name} · lo usan ${type.products.length} productos; conservan el tipo con el nuevo nombre.` : type.name}
      submitLabel="Guardar cambios"
      action={updateProductType}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={{ id: type.id, version: type.version }} />
          <TypeFields type={type} />
        </>
      )}
    </PanelAction>
  );
}

export function TypeDeleteAction({ type }: { type: ProductType }) {
  if (type.products.length) return <RowIcon tone="delete" label="Eliminar tipo" disabledHint={inUse(type.products.length, "tipo")} />;
  return (
    <ConfirmAction
      id={`type-${type.id}`}
      label="Eliminar tipo"
      title="Eliminar tipo de producto"
      description={`${type.name} deja de aparecer al crear o editar productos. Queda en el historial.`}
      submitLabel="Eliminar tipo"
      action={deleteProductType}
      hidden={{ id: type.id }}
    />
  );
}

export function CategoryCreateAction() {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Nueva categoría"
      icon={<Plus size={16} strokeWidth={2.4} />}
      size="sm"
      variant="primary"
      formId="category-create"
      title="Nueva categoría"
      description="Agrupa los productos por tema. Puedes cargar sus subcategorías de una vez."
      submitLabel="Crear categoría"
      action={createCategory}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <TextField label="Nombre" name="name" required minLength={2} maxLength={80} placeholder="Por ejemplo: Bienestar" icon={<FolderPlus size={16} />} />
          <TextArea label="Subcategorías" name="subcategories" rows={4} placeholder={"Una por línea\nSpa andino\nYoga y meditación"} hint="Opcional. Una por línea; las repetidas se ignoran." />
        </>
      )}
    </PanelAction>
  );
}

export function CategoryEditAction({ category }: { category: ProductCategory }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Editar"
      formId={`category-edit-${category.ref}`}
      trigger={(open) => <RowIcon tone="edit" label="Editar categoría" onClick={open} />}
      title="Editar categoría"
      description={`${category.ref} · los productos conservan la categoría con el nuevo nombre.`}
      submitLabel="Guardar cambios"
      action={updateCategory}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={{ ref: category.ref, version: category.version }} />
          <TextField label="Nombre" name="name" required minLength={2} maxLength={80} defaultValue={category.name} icon={<FolderPlus size={16} />} />
        </>
      )}
    </PanelAction>
  );
}

export function CategoryDeleteAction({ category }: { category: ProductCategory }) {
  if (category.products.length) return <RowIcon tone="delete" label="Eliminar categoría" disabledHint={inUse(category.products.length, "categoría")} />;
  return (
    <ConfirmAction
      id={`category-${category.ref}`}
      label="Eliminar categoría"
      title="Eliminar categoría"
      description={category.subcategories.length ? `${category.name} y sus ${category.subcategories.length} subcategorías dejan de estar disponibles. Queda en el historial.` : `${category.name} deja de estar disponible. Queda en el historial.`}
      submitLabel="Eliminar categoría"
      action={deleteCategory}
      hidden={{ ref: category.ref }}
    />
  );
}

export function SubcategoryCreateAction({ category }: { category: ProductCategory }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Subcategoría"
      formId={`subcategory-create-${category.ref}`}
      trigger={(open) => <RowIcon tone="neutral" label="Agregar subcategoría" icon={<Plus size={15} />} onClick={open} />}
      title="Nueva subcategoría"
      description={`Dentro de ${category.name}.`}
      submitLabel="Agregar"
      action={createSubcategory}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={{ ref: category.ref }} />
          <TextField label="Nombre" name="name" required minLength={2} maxLength={80} placeholder="Por ejemplo: Spa andino" />
        </>
      )}
    </PanelAction>
  );
}

export function SubcategoryEditAction({ category, sub }: { category: ProductCategory; sub: ProductSubcategory }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Editar"
      formId={`subcategory-edit-${sub.id}`}
      trigger={(open) => <RowIcon tone="edit" label="Editar subcategoría" onClick={open} />}
      title="Editar subcategoría"
      description={`${category.name} · ${sub.name}`}
      submitLabel="Guardar cambios"
      action={updateSubcategory}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={{ ref: category.ref, id: sub.id, version: sub.version }} />
          <TextField label="Nombre" name="name" required minLength={2} maxLength={80} defaultValue={sub.name} />
        </>
      )}
    </PanelAction>
  );
}

export function SubcategoryDeleteAction({ category, sub }: { category: ProductCategory; sub: ProductSubcategory }) {
  if (sub.products.length) return <RowIcon tone="delete" label="Eliminar subcategoría" disabledHint={inUse(sub.products.length, "subcategoría")} />;
  return (
    <ConfirmAction
      id={`subcategory-${sub.id}`}
      label="Eliminar subcategoría"
      title="Eliminar subcategoría"
      description={`${sub.name} sale de ${category.name}. Queda en el historial.`}
      submitLabel="Eliminar"
      action={deleteSubcategory}
      hidden={{ ref: category.ref, id: sub.id }}
    />
  );
}
