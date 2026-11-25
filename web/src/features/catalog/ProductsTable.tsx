"use client";

import { CircleCheck, CirclePause, FilePen, Hourglass, MapPin, Star, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { durationLabel, priceFromChannel, PRODUCT_STATUS, STORE_WITHOUT_RATE_HINT, type ProductRow } from "@/lib/catalog";
import { formatMoney } from "@/lib/format";
import { ProductDeleteAction } from "./ProductForms";

const href = (product: ProductRow) => `/catalogo/productos/${product.code}`;

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es")).map((value) => ({ value, label: value }));

const buildColumns = (can: { edit: boolean; remove: boolean }): Column<ProductRow>[] => [
  {
    id: "product",
    header: "Producto",
    mobile: "title",
    cell: (product) => (
      <div className="min-w-0">
        <Link href={href(product)} className="inline-flex items-center gap-1.5 font-semibold hover:underline">
          {product.name}
          {product.featured && <Star size={13} className="fill-[var(--t2)] text-[var(--t2)]" aria-label="Destacado" />}
        </Link>
        <small className="block text-xs text-fg-3">
          {product.code} · {product.type.charAt(0) + product.type.slice(1).toLowerCase()}
        </small>
      </div>
    ),
  },
  {
    id: "destination",
    header: "Destino",
    cell: (product) => (
      <span className="inline-flex items-center gap-1.5 text-[13px]">
        <MapPin size={13} className="text-fg-3" />
        {product.destination}
      </span>
    ),
  },
  { id: "duration", header: "Duración", wideOnly: true, cell: (product) => <span className="text-[13px]">{durationLabel(product.duration)} · {product.modality.toLowerCase()}</span> },
  {
    id: "price",
    header: "Desde",
    align: "right",
    cell: (product) => (
      <span className="inline-flex flex-col items-end">
        {product.price_from ? <span className="font-mono text-[13px] font-semibold">{formatMoney(product.price_from.amount, product.price_from.currency)}</span> : <span className="text-[12.5px] text-fg-3">Sin tarifa</span>}
        {priceFromChannel(product.price_from) && <small className="text-[11.5px] text-fg-3">{priceFromChannel(product.price_from)}</small>}
        {product.store_without_rate && (
          <span title={STORE_WITHOUT_RATE_HINT} className="mt-0.5 inline-flex items-center gap-1 text-[11.5px] font-semibold text-bad">
            <TriangleAlert size={12} />
            Sin precio en la tienda
          </span>
        )}
      </span>
    ),
  },
  { id: "category", header: "Categoría", wideOnly: true, cell: (product) => <span className="text-[13px] text-fg-2">{product.category}{product.subcategory ? ` · ${product.subcategory}` : ""}</span> },
  { id: "status", header: "Estado", cell: (product) => <Badge tone={PRODUCT_STATUS[product.status].tone}>{PRODUCT_STATUS[product.status].label}</Badge> },
  {
    id: "actions",
    header: "",
    mobile: "hidden",
    align: "right",
    cell: (product) => (
      <RowActions>
        <RowIcon tone="view" label="Ver ficha" href={href(product)} />
        {can.edit && <RowIcon tone="edit" label="Editar" href={`${href(product)}?editar=1`} disabledHint={product.status === "ARCHIVED" ? "Archivado: ya no se edita" : undefined} />}
        {can.remove && (["ACTIVE", "SUSPENDED"].includes(product.status) ? <RowIcon tone="delete" label="Eliminar" disabledHint="Activo o suspendido: primero inactívalo" /> : <ProductDeleteAction product={product} iconOnly />)}
      </RowActions>
    ),
  },
];

const metrics: MetricFilter<ProductRow>[] = [
  { id: "active", label: "Activos", tone: "ok", icon: <CircleCheck size={19} />, info: <p>Productos activos, que se pueden cotizar y vender en los canales donde están publicados.</p>, matches: (product) => product.status === "ACTIVE" },
  { id: "review", label: "En revisión o borrador", tone: "sun", icon: <Hourglass size={19} />, info: <p>Productos en borrador o enviados a revisión, que todavía no se pueden vender.</p>, matches: (product) => product.status === "REVIEW" || product.status === "DRAFT" },
  { id: "approved", label: "Aprobados sin activar", tone: "info", icon: <FilePen size={19} />, info: <p>Productos ya aprobados que falta activar para empezar a venderlos.</p>, matches: (product) => product.status === "APPROVED" },
  { id: "stopped", label: "Suspendidos o inactivos", tone: "bad", icon: <CirclePause size={19} />, info: <p>Productos suspendidos o inactivos: no aparecen al cotizar ni en los canales de venta.</p>, matches: (product) => product.status === "SUSPENDED" || product.status === "INACTIVE" },
];

const sorts: SortOption<ProductRow>[] = [
  { id: "name", label: "Nombre", type: "text", value: (product) => product.name },
  { id: "price", label: "Precio desde", type: "number", value: (product) => (product.price_from ? Number(product.price_from.amount) : null) },
  { id: "destination", label: "Destino", type: "text", value: (product) => product.destination },
];

export function ProductsTable({ products, can }: { products: ProductRow[]; can: { edit: boolean; remove: boolean } }) {
  const filters: FilterConfig<ProductRow>[] = [
    { id: "type", label: "Tipo", options: unique(products.map((product) => product.type)), value: (product) => product.type },
    { id: "category", label: "Categoría", options: unique(products.map((product) => product.category)), value: (product) => product.category },
    { id: "status", label: "Estado", options: [...new Set(products.map((product) => product.status))].map((status) => ({ value: status, label: PRODUCT_STATUS[status].label })), value: (product) => product.status },
    { id: "destination", label: "Destino", options: unique(products.map((product) => product.destination)), value: (product) => product.destination },
    { id: "channel", label: "Canal", options: unique(products.flatMap((product) => product.channels)), value: (product) => product.channels },
  ];

  const unpriced = products.filter((product) => product.store_without_rate);

  return (
    <>
      {unpriced.length > 0 && (
        <div role="status" data-testid="store-without-rate" className="mb-5 flex items-start gap-2.5 rounded-xl border border-bad/30 bg-bad/[0.07] px-4 py-3 text-[13.5px]">
          <TriangleAlert size={17} className="mt-0.5 flex-none text-bad" />
          <span>
            <b className="font-semibold text-bad">{unpriced.length === 1 ? "1 producto publicado en la tienda en línea no se puede reservar" : `${unpriced.length} productos publicados en la tienda en línea no se pueden reservar`}</b>: no tienen tarifa vigente E-commerce, Directo o Todos y el cliente los ve con «Tarifa por publicar».{" "}
            {unpriced.slice(0, 3).map((product, index) => (
              <span key={product.code}>
                {index > 0 && ", "}
                <Link href={`${href(product)}?seccion=tarifas`} className="font-semibold text-accent hover:underline">
                  {product.name}
                </Link>
              </span>
            ))}
            {unpriced.length > 3 && ` y ${unpriced.length - 3} más`}.
          </span>
        </div>
      )}
      <DataTable
        screen="productos"
        rows={products}
        columns={buildColumns(can)}
        getKey={(product) => product.code}
        entityLabel="productos"
        searchText={(product) => `${product.name} ${product.code} ${product.destination_path} ${product.category} ${product.type}`}
        searchPlaceholder="Buscar producto, código o destino"
        metrics={metrics}
        filters={filters}
        sorts={sorts}
      />
    </>
  );
}
