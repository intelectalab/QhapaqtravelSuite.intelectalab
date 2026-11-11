"use client";

import { MapPin, MapPinPlus, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { createDestination, deleteDestination, updateDestination } from "@/app/(backoffice)/catalogo/destinos/actions";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { HiddenFields, STEP_INITIAL } from "@/features/catalog-shared/CatalogPanels";
import type { DestinationNode, DestinationsOverview } from "@/lib/catalog-destinations";
import type { StepResult } from "@/lib/server/resource";

function DestinationFields({ destinations, types, node, parentId }: { destinations: Pick<DestinationNode, "id" | "name" | "path">[]; types: string[]; node?: DestinationNode; parentId?: string }) {
  const candidates = destinations.filter((item) => !node || (item.id !== node.id && !item.path.startsWith(`${node.path} / `)));
  return (
    <>
      <TextField label="Nombre" name="name" required minLength={2} maxLength={120} defaultValue={node?.name} icon={<MapPin size={16} />} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="Tipo" name="type" options={types.map((type) => ({ value: type, label: type }))} defaultValue={node?.type ?? "Ciudad"} />
        <SelectField label="Dentro de" name="parent_id" options={candidates.map((item) => ({ value: item.id, label: item.name, hint: item.path }))} defaultValue={node ? (node.parent?.id ?? "") : (parentId ?? "")} placeholder="Ninguno (país)" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Latitud" name="lat" type="number" step="0.000001" min={-90} max={90} defaultValue={node?.lat ?? undefined} placeholder="-13.5319" />
        <TextField label="Longitud" name="lng" type="number" step="0.000001" min={-180} max={180} defaultValue={node?.lng ?? undefined} placeholder="-71.9675" />
      </div>
      <TextArea label="Descripción" name="description" rows={3} maxLength={1000} defaultValue={node?.description ?? undefined} />
    </>
  );
}

export function DestinationCreateAction({ destinations, types, parent, trigger }: { destinations: Pick<DestinationNode, "id" | "name" | "path">[]; types: string[]; parent?: Pick<DestinationNode, "id" | "ref" | "name">; trigger?: (open: () => void) => ReactNode }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label={parent ? "Agregar dentro" : "Nuevo destino"}
      icon={<MapPinPlus size={16} />}
      variant={parent ? "secondary" : "primary"}
      size={parent ? "sm" : "md"}
      formId={`destination-create-${parent?.ref ?? "root"}`}
      trigger={trigger}
      title={parent ? `Nuevo destino en ${parent.name}` : "Nuevo destino"}
      description="Cada nivel va dentro de uno más amplio: país, región, departamento, ciudad, lugar y atracción."
      submitLabel="Crear destino"
      action={createDestination}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => <DestinationFields destinations={destinations} types={types} parentId={parent?.id} />}
    </PanelAction>
  );
}

export function DestinationEditAction({ overview, node }: { overview: DestinationsOverview; node: DestinationNode }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Editar"
      icon={<Pencil size={15} />}
      size="sm"
      formId={`destination-edit-${node.ref}`}
      title="Editar destino"
      description={node.path}
      submitLabel="Guardar cambios"
      action={updateDestination}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={{ ref: node.ref }} />
          <DestinationFields destinations={overview.destinations} types={overview.options.types} node={node} />
        </>
      )}
    </PanelAction>
  );
}

export function DestinationDeleteAction({ node, onDeleted }: { node: DestinationNode; onDeleted: () => void }) {
  const router = useRouter();
  const blocked = node.children > 0 ? `Tiene ${node.children} subdestinos.` : node.direct_products > 0 ? `Lo usan ${node.direct_products} productos.` : null;
  return (
    <PanelAction<StepResult>
      label="Eliminar"
      icon={<Trash2 size={15} />}
      variant="ghost"
      size="sm"
      formId={`destination-delete-${node.ref}`}
      title="Eliminar destino"
      description={blocked ? `${blocked} Muévelos o cámbialos antes de eliminar ${node.name}.` : `${node.name} desaparece del árbol. Queda en el historial.`}
      submitLabel="Eliminar destino"
      action={deleteDestination}
      initial={STEP_INITIAL}
      onDone={() => {
        onDeleted();
        router.refresh();
      }}
    >
      {() => (
        <>
          <HiddenFields values={{ ref: node.ref }} />
          <TextArea label="Motivo" name="reason" rows={3} required minLength={3} maxLength={300} placeholder="Por ejemplo: se creó duplicado." />
        </>
      )}
    </PanelAction>
  );
}
