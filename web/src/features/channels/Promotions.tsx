"use client";

import { CalendarClock, CirclePause, CirclePlay, Pencil, Plus, Tag, TicketPercent, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { promotionStep } from "@/app/(backoffice)/canales/ecommerce/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { HiddenFields } from "@/features/catalog-shared/CatalogPanels";
import type { Promotion, PromotionCatalog } from "@/lib/channels";
import { formatDate } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import type { Tone } from "@/lib/tone";

const initial: StepResult = { message: null, done: false };

const STATE: Record<Promotion["state"], { label: string; tone: Tone }> = {
  vigente: { label: "Vigente", tone: "ok" },
  programada: { label: "Programada", tone: "info" },
  pausada: { label: "Pausada", tone: "mute" },
  vencida: { label: "Vencida", tone: "warn" },
};

const KIND_HINT: Record<string, string> = {
  "Descuento %": "Porcentaje sobre el precio de la tarifa.",
  "Descuento fijo": "Monto que se resta al precio.",
  "Precio promocional": "Precio final que reemplaza a la tarifa.",
  "Descuento por cantidad": "Porcentaje que se aplica solo desde el mínimo de pasajeros.",
  "Código promocional": "Porcentaje que se aplica al ingresar el código.",
};

function PromotionForm({ catalog, promotion, product, trigger }: { catalog: PromotionCatalog; promotion?: Promotion; product?: string; trigger: (open: () => void) => React.ReactNode }) {
  const router = useRouter();
  const [kind, setKind] = useState(promotion?.kind ?? "Descuento %");
  const percent = catalog.percent_kinds.includes(kind);
  return (
    <PanelAction<StepResult>
      label={promotion ? "Editar" : "Nueva promoción"}
      formId={`promotion-${promotion?.ref ?? product ?? "new"}`}
      title={promotion ? `Editar ${promotion.name}` : "Nueva promoción"}
      description={promotion ? `${promotion.ref} · ${promotion.product.name}` : "Se aplica sobre la tarifa vigente del producto en el canal que elijas. Los porcentajes van hasta " + `${catalog.max_percent - 1} %.`}
      submitLabel={promotion ? "Guardar" : "Crear promoción"}
      action={promotionStep}
      initial={initial}
      trigger={trigger}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <HiddenFields values={{ step: promotion ? "update" : "create", ref: promotion?.ref, product: promotion?.product.code ?? product }} />
          {!promotion && !product && <SelectField label="Producto" name="product" searchable options={catalog.products.map((item) => ({ value: item.code, label: item.name, hint: item.status === "ACTIVE" ? item.code : `${item.code} · no activo` }))} />}
          <TextField label="Nombre" name="name" required minLength={3} maxLength={120} defaultValue={promotion?.name} placeholder="Ejemplo: Primavera andina" />
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Tipo" name="kind" value={kind} onChange={setKind} options={catalog.kinds.map((value) => ({ value, label: value }))} hint={KIND_HINT[kind]} />
            <TextField label={percent ? "Descuento (%)" : "Monto"} name="value" type="number" step="0.01" min="0.01" max={percent ? catalog.max_percent - 0.01 : undefined} required defaultValue={promotion?.value} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <SelectField label="Canal" name="channel" defaultValue={promotion?.channel ?? "E-commerce"} options={catalog.channels.map((value) => ({ value, label: value }))} />
            <TextField label="Código" name="promo_code" maxLength={40} defaultValue={promotion?.promo_code ?? ""} placeholder={kind === "Código promocional" ? "Obligatorio" : "Opcional"} hint="Se guarda en mayúsculas y no se repite." />
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <TextField label="Desde" name="valid_from" type="date" required defaultValue={promotion?.valid_from ?? catalog.today} />
            <TextField label="Hasta" name="valid_to" type="date" required min={catalog.today} defaultValue={promotion?.valid_to} />
            <TextField label="Mínimo de pasajeros" name="min_pax" type="number" min={1} max={99} defaultValue={promotion?.min_pax ?? ""} placeholder={kind === "Descuento por cantidad" ? "Obligatorio" : "Opcional"} />
          </div>
        </>
      )}
    </PanelAction>
  );
}

function StateAction({ promotion }: { promotion: Promotion }) {
  const router = useRouter();
  const pause = promotion.status === "activa";
  if (!pause && promotion.state === "vencida") return <RowIcon tone="neutral" label="Activar" icon={<CirclePlay size={15} />} disabledHint="Venció: extiende la vigencia para activarla" />;
  return (
    <PanelAction<StepResult>
      label={pause ? "Pausar" : "Activar"}
      formId={`promotion-state-${promotion.ref}`}
      title={pause ? "Pausar promoción" : "Activar promoción"}
      description={pause ? `${promotion.name} deja de aplicarse en el sitio y en el canal hasta que la actives.` : `${promotion.name} vuelve a aplicarse mientras esté vigente.`}
      submitLabel={pause ? "Pausar" : "Activar"}
      action={promotionStep}
      initial={initial}
      trigger={(open) => <RowIcon tone={pause ? "neutral" : "edit"} label={pause ? "Pausar" : "Activar"} icon={pause ? <CirclePause size={15} /> : <CirclePlay size={15} />} onClick={open} />}
      onDone={() => router.refresh()}
    >
      {() => <HiddenFields values={{ step: pause ? "pause" : "activate", ref: promotion.ref, product: promotion.product.code }} />}
    </PanelAction>
  );
}

function DeleteAction({ promotion }: { promotion: Promotion }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Eliminar"
      formId={`promotion-delete-${promotion.ref}`}
      title="Eliminar promoción"
      description={`${promotion.name} se retira del catálogo. Los pedidos que ya la usaron conservan su descuento.`}
      submitLabel="Eliminar"
      action={promotionStep}
      initial={initial}
      trigger={(open) => <RowIcon tone="delete" label="Eliminar" icon={<Trash2 size={15} />} onClick={open} />}
      onDone={() => router.refresh()}
    >
      {() => <HiddenFields values={{ step: "delete", ref: promotion.ref, product: promotion.product.code }} />}
    </PanelAction>
  );
}

export function NewPromotionAction({ catalog, product }: { catalog: PromotionCatalog; product?: string }) {
  return <PromotionForm catalog={catalog} product={product} trigger={(open) => <Button size="sm" variant="primary" icon={<Plus size={15} />} onClick={open}>Nueva promoción</Button>} />;
}

export function PromotionsTable({ catalog, canManage, showProduct = true, screen, product }: { catalog: PromotionCatalog; canManage: boolean; showProduct?: boolean; screen: string; product?: string }) {
  const rows = catalog.rows;
  const columns: Column<Promotion>[] = [
    {
      id: "name",
      header: "Promoción",
      mobile: "title",
      cell: (row) => (
        <span className="flex min-w-0 flex-col">
          <b className="truncate text-[13.5px] font-semibold">{row.name}</b>
          <span className="text-[12px] text-fg-3">
            {row.ref}
            {showProduct && (
              <>
                {" · "}
                <a href={`/catalogo/productos/${row.product.code}?seccion=promociones`} className="hover:text-accent">{row.product.name}</a>
              </>
            )}
          </span>
        </span>
      ),
    },
    { id: "discount", header: "Descuento", cell: (row) => <span className="text-[13px]"><b className="font-semibold">{row.percent ? `${row.value} %` : row.value.toFixed(2)}</b><span className="block text-[12px] text-fg-3">{row.kind}{row.min_pax ? ` · desde ${row.min_pax} pax` : ""}</span></span> },
    { id: "code", header: "Código", cell: (row) => (row.promo_code ? <span className="rounded-md bg-surface-2 px-2 py-0.5 font-mono text-[12.5px] font-semibold">{row.promo_code}</span> : <span className="text-[12.5px] text-fg-3">Automática</span>) },
    { id: "channel", header: "Canal", wideOnly: true, cell: (row) => <span className="text-[13px]">{row.channel}</span> },
    { id: "validity", header: "Vigencia", cell: (row) => <span className="text-[12.5px]">{formatDate(row.valid_from)} al {formatDate(row.valid_to)}</span> },
    { id: "uses", header: "Usos", align: "right", wideOnly: true, cell: (row) => <span className="font-mono text-[13px]" title="Pedidos web con este código">{row.uses ?? "—"}</span> },
    { id: "state", header: "Estado", mobile: "detail", cell: (row) => <Badge tone={STATE[row.state].tone}>{STATE[row.state].label}</Badge> },
    {
      id: "actions",
      header: "",
      cell: (row) =>
        canManage ? (
          <RowActions>
            <PromotionForm catalog={catalog} promotion={row} trigger={(open) => <RowIcon tone="edit" label="Editar" icon={<Pencil size={15} />} onClick={open} />} />
            <StateAction promotion={row} />
            <DeleteAction promotion={row} />
          </RowActions>
        ) : null,
    },
  ];
  const metrics: MetricFilter<Promotion>[] = [
    { id: "vigente", label: "Vigentes", tone: "ok", icon: <TicketPercent size={19} />, matches: (row) => row.state === "vigente" },
    { id: "programada", label: "Programadas", tone: "info", icon: <CalendarClock size={19} />, matches: (row) => row.state === "programada" },
    { id: "pausada", label: "Pausadas", tone: "mute", icon: <CirclePause size={19} />, matches: (row) => row.state === "pausada" },
    { id: "codigo", label: "Con código", tone: "violet", icon: <Tag size={19} />, matches: (row) => row.promo_code !== null },
  ];
  const filters: FilterConfig<Promotion>[] = [
    { id: "channel", label: "Canal", options: [...new Set(rows.map((row) => row.channel))].map((value) => ({ value, label: value })), value: (row) => row.channel },
    { id: "kind", label: "Tipo", options: [...new Set(rows.map((row) => row.kind))].map((value) => ({ value, label: value })), value: (row) => row.kind },
    { id: "state", label: "Estado", options: Object.entries(STATE).map(([value, item]) => ({ value, label: item.label })), value: (row) => row.state },
  ];
  const sorts: SortOption<Promotion>[] = [
    { id: "to", label: "Vence", type: "date", value: (row) => row.valid_to },
    { id: "value", label: "Descuento", type: "number", value: (row) => row.value },
    { id: "name", label: "Nombre", value: (row) => row.name },
  ];
  return (
    <DataTable
      screen={screen}
      rows={rows}
      columns={columns}
      getKey={(row) => row.ref}
      entityLabel="promociones"
      searchText={(row) => `${row.ref} ${row.name} ${row.promo_code ?? ""} ${row.product.name}`}
      searchPlaceholder="Buscar promoción, código o producto"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
      emptyTitle="Sin promociones"
      toolbarEnd={canManage ? <NewPromotionAction catalog={catalog} product={product} /> : undefined}
    />
  );
}
