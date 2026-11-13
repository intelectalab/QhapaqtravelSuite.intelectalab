"use client";

import { ChevronRight, Compass, MapPin, Package } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ExportButton } from "@/components/table/Toolbar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { TintCardTitle } from "@/components/ui/Tinted";
import { DESTINATION_TONE, type DestinationNode, type DestinationsOverview } from "@/lib/catalog-destinations";
import { PRODUCT_STATUS, type ProductStatus } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { downloadCsv, type CsvExport } from "@/lib/csv";
import { formatMoney } from "@/lib/format";
import { toneStyle } from "@/lib/tone";
import { DestinationCreateAction, DestinationDeleteAction, DestinationEditAction } from "./DestinationForms";

const RELATION_LABEL: Record<DestinationNode["products"][number]["relation"], string> = { principal: "Principal", secundario: "Secundario", subdestino: "En un subdestino" };

const DESTINATIONS_CSV: CsvExport<DestinationNode> = {
  fileName: "destinos",
  columns: [
    { header: "Código", value: (node) => node.ref },
    { header: "Destino", value: (node) => node.name },
    { header: "Tipo", value: (node) => node.type },
    { header: "Nivel", value: (node) => node.level },
    { header: "Ruta", value: (node) => node.path },
    { header: "Depende de", value: (node) => node.parent?.name },
    { header: "Latitud", value: (node) => node.lat },
    { header: "Longitud", value: (node) => node.lng },
    { header: "Subdestinos", value: (node) => node.children },
    { header: "Productos directos", value: (node) => node.direct_products },
    { header: "Productos con subdestinos", value: (node) => node.products.length },
  ],
};

function TreeRow({ node, active, collapsed, onSelect, onToggle, index }: { node: DestinationNode; active: boolean; collapsed: boolean; onSelect: () => void; onToggle: () => void; index: number }) {
  return (
    <li style={{ ...toneStyle(DESTINATION_TONE[node.type] ?? "t1"), animationDelay: `${index * 35}ms` }} className="motion-safe:animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
      <div className={cn("group flex items-center gap-1.5 rounded-xl py-1.5 pr-2 transition-colors", active ? "bg-[color-mix(in_srgb,var(--tint)_12%,var(--surface))]" : "hover:bg-surface-2")} style={{ paddingLeft: `${8 + node.depth * 20}px` }}>
        <button type="button" onClick={onToggle} disabled={node.children === 0} aria-label={collapsed ? "Mostrar subdestinos" : "Ocultar subdestinos"} className={cn("grid h-6 w-6 flex-none place-items-center rounded-md text-fg-3 transition", node.children === 0 ? "opacity-0" : "hover:bg-surface hover:text-fg")}>
          <ChevronRight size={15} className={cn("transition-transform duration-200", !collapsed && "rotate-90")} />
        </button>
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
          <span className={cn("h-2.5 w-2.5 flex-none rounded-full bg-[var(--tint)] transition-transform duration-300 group-hover:scale-125", active && "ring-4 ring-[color-mix(in_srgb,var(--tint)_22%,transparent)]")} />
          <span className={cn("min-w-0 truncate text-[13.5px]", active ? "font-semibold text-fg" : "text-fg-2 group-hover:text-fg")}>{node.name}</span>
          <span className="flex-none text-[11.5px] text-fg-3">{node.type}</span>
        </button>
        {node.products.length > 0 && (
          <span className="flex flex-none items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--tint)_12%,transparent)] px-2 py-0.5 text-[11px] font-semibold text-[var(--tint)]" title={`${node.products.length} productos, incluidos los subdestinos`}>
            <Package size={11} />
            {node.products.length}
          </span>
        )}
      </div>
    </li>
  );
}

export function DestinationsExplorer({ overview }: { overview: DestinationsOverview }) {
  const nodes = overview.destinations;
  const [selectedRef, setSelectedRef] = useState(nodes[0]?.ref ?? "");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const selected = nodes.find((node) => node.ref === selectedRef) ?? nodes[0];
  const hiddenUnder = nodes.filter((node) => collapsed.has(node.ref)).map((node) => `${node.path} / `);
  const visible = nodes.filter((node) => !hiddenUnder.some((prefix) => node.path.startsWith(prefix)));
  const children = selected ? nodes.filter((node) => node.parent?.id === selected.id) : [];
  const crumbs = selected ? nodes.filter((node) => selected.path.startsWith(`${node.path} / `)).sort((a, b) => a.depth - b.depth) : [];
  const toggle = (ref: string) =>
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(ref)) next.delete(ref);
      else next.add(ref);
      return next;
    });

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <Card>
        <TintCardTitle
          icon={Compass}
          title="Árbol de destinos"
          aside={
            <ExportButton disabled={nodes.length === 0} onClick={() => downloadCsv(nodes, DESTINATIONS_CSV)} />
          }
        />
        <ul className="flex flex-col gap-0.5">
          {visible.map((node, index) => (
            <TreeRow key={node.ref} node={node} index={index} active={node.ref === selected?.ref} collapsed={collapsed.has(node.ref)} onSelect={() => setSelectedRef(node.ref)} onToggle={() => toggle(node.ref)} />
          ))}
        </ul>
      </Card>
      {selected && (
        <div key={selected.ref} className="flex flex-col gap-4 motion-safe:animate-[rise-in_380ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
          <Card>
            <div style={toneStyle(DESTINATION_TONE[selected.type] ?? "t1")} className="mb-4 flex flex-wrap items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-11 w-11 flex-none place-items-center rounded-[12px] bg-[var(--tint)] text-white shadow-[0_8px_18px_-10px_var(--tint)]">
                  <MapPin size={20} />
                </span>
                <div className="min-w-0">
                  <h2 className="truncate text-[18px] font-bold tracking-tight">{selected.name}</h2>
                  <nav aria-label="Ruta del destino" className="flex flex-wrap items-center gap-1 text-[12.5px] text-fg-3">
                    {crumbs.map((crumb) => (
                      <span key={crumb.ref} className="flex items-center gap-1">
                        <button type="button" onClick={() => setSelectedRef(crumb.ref)} className="transition-colors hover:text-accent hover:underline">{crumb.name}</button>
                        <ChevronRight size={12} />
                      </span>
                    ))}
                    <span className="font-medium text-fg-2">{selected.name}</span>
                  </nav>
                </div>
              </div>
              {overview.can.manage && (
                <div className="flex flex-wrap gap-1.5">
                  {!["Atracción", "Ruta"].includes(selected.type) && <DestinationCreateAction destinations={overview.destinations} types={overview.options.types} parent={selected} />}
                  <DestinationEditAction overview={overview} node={selected} />
                  <DestinationDeleteAction node={selected} onDeleted={() => setSelectedRef(selected.parent?.ref ?? nodes[0]?.ref ?? "")} />
                </div>
              )}
            </div>
            <FieldList
              fields={[
                { label: "Tipo", value: <Badge tone={DESTINATION_TONE[selected.type] ?? "t1"}>{selected.type}</Badge> },
                { label: "Código", value: <span className="font-mono">{selected.ref}</span> },
                { label: "Dentro de", value: selected.parent ? <button type="button" onClick={() => setSelectedRef(selected.parent?.ref ?? "")} className="font-semibold text-accent hover:underline">{selected.parent.name}</button> : "Es la raíz" },
                { label: "Coordenadas", value: selected.lat !== null && selected.lng !== null ? <span className="font-mono text-[12.5px]">{selected.lat.toFixed(4)}, {selected.lng.toFixed(4)}</span> : "Sin coordenadas" },
              ]}
            />
            {selected.description && <p className="mt-3 rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">{selected.description}</p>}
          </Card>
          {children.length > 0 && (
            <Card>
              <TintCardTitle icon={Compass} title="Subdestinos" aside={children.length} />
              <div className="grid gap-2 sm:grid-cols-2">
                {children.map((child, index) => (
                  <button key={child.ref} type="button" onClick={() => setSelectedRef(child.ref)} style={{ ...toneStyle(DESTINATION_TONE[child.type] ?? "t1"), animationDelay: `${index * 50}ms` }} className="lift group rounded-tile border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] bg-[color-mix(in_srgb,var(--tint)_7%,var(--surface))] px-3.5 py-2.5 text-left motion-safe:animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
                    <b className="block truncate text-[13.5px] font-semibold">{child.name}</b>
                    <span className="text-[12px] text-[var(--tint)]">{child.type} · {child.products.length} productos</span>
                  </button>
                ))}
              </div>
            </Card>
          )}
          <Card>
            <TintCardTitle icon={Package} title="Productos" aside={selected.products.length} />
            {selected.products.length ? (
              <ul className="flex flex-col gap-1">
                {selected.products.map((product) => {
                  const status = PRODUCT_STATUS[product.status as ProductStatus];
                  return (
                    <li key={product.code}>
                      <Link href={`/catalogo/productos/${product.code}`} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-0.5 rounded-lg px-2.5 py-2 text-[13px] transition hover:bg-surface-2 sm:grid-cols-[minmax(0,1fr)_7rem_6.5rem_auto]">
                        <span className="min-w-0 truncate font-medium group-hover:text-accent">{product.name}</span>
                        <span className={cn("order-3 text-[12px] sm:order-none", product.relation === "principal" ? "font-semibold text-[var(--tint,var(--accent))]" : "text-fg-3")}>{RELATION_LABEL[product.relation]}</span>
                        <span className="order-4 text-right font-mono text-[12.5px] sm:order-none">{product.price_from ? `desde ${formatMoney(product.price_from.amount, product.price_from.currency)}` : <span className="text-fg-3">Sin tarifa</span>}</span>
                        {status ? <Badge tone={status.tone}>{status.label}</Badge> : <span className="text-fg-3">{product.status}</span>}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-[13px] text-fg-3">Ningún producto usa este destino ni sus subdestinos.</p>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
