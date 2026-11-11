import { ArrowRight, Check, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { SimpleTable } from "@/components/ui/SimpleTable";
import { AVAILABILITY_HINT, AVAILABILITY_LABEL, durationLabel, PRODUCT_STATUS, type ProductDetail, type ProductEditorState, type ProductFormOptions, type ProductOverview, type ProductStatus, type ProductTranslations } from "@/lib/catalog";
import { formatDate, formatDateTime, formatMoney } from "@/lib/format";
import { PromotionsTable } from "@/features/channels/Promotions";
import type { PromotionCatalog } from "@/lib/channels";
import { PenaltyTiersView } from "../PenaltyTiers";
import { ProductTranslationsCard } from "../ProductTranslations";
import { EditStepButton } from "../wizard/ProductWizard";
import { ChannelSwitches, ChecklistLinks } from "./ProductInteractive";

export interface ProductTabContext {
  product: ProductDetail;
  editor: ProductEditorState;
  overview: ProductOverview;
  options: ProductFormOptions;
  translations: ProductTranslations | null;
  promotions?: PromotionCatalog | null;
}

export interface ProductTab {
  id: string;
  label: string;
  count?: number;
  render: () => ReactNode;
}

const DEPARTURE_STATUS: Record<string, "ok" | "sun" | "mute" | "bad" | "info"> = { abierta: "ok", completa: "sun", cerrada: "mute", cancelada: "bad", realizada: "info" };

function Panel({ title, hint, action, children }: { title: string; hint?: ReactNode; action?: ReactNode; children: ReactNode }) {
  return (
    <Card>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-semibold tracking-tight">{title}</h3>
          {hint && <p className="mt-0.5 text-[12.5px] text-fg-3">{hint}</p>}
        </div>
        {action}
      </header>
      {children}
    </Card>
  );
}

function ModuleLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="inline-flex items-center gap-1 text-[13px] font-semibold text-accent hover:underline">
      {label}
      <ArrowRight size={14} />
    </Link>
  );
}

function editAt(ctx: ProductTabContext, step: number, label?: string): ReactNode {
  return ctx.options.can_update && ctx.product.status !== "ARCHIVED" ? <EditStepButton options={ctx.options} initial={ctx.editor} step={step} label={label} /> : undefined;
}

function statusBadge(status: ProductStatus) {
  return <Badge tone={PRODUCT_STATUS[status]?.tone ?? "mute"}>{PRODUCT_STATUS[status]?.label ?? status}</Badge>;
}

export function productTabs(ctx: ProductTabContext): ProductTab[] {
  const { product, editor, overview, options } = ctx;
  const service = (id: string | null) => options.services.find((item) => item.id === id);
  const seasonIds = new Set([...editor.season_ids, ...editor.rates.map((rate) => rate.season_id).filter((id): id is string => Boolean(id))]);
  const destination = (id: string) => options.destinations.find((item) => item.id === id)?.path ?? "—";

  const tabs: (ProductTab | false)[] = [
    {
      id: "general",
      label: "General",
      render: () => (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <Panel title="Ficha maestra" action={editAt(ctx, 0)}>
            {product.short_description && <p className="mb-4 text-[13.5px] leading-relaxed text-fg-2">{product.short_description}</p>}
            <FieldList
              fields={[
                { label: "Nombre interno", value: product.internal_name },
                { label: "Tipo", value: product.type },
                { label: "Categoría", value: [product.category, product.subcategory].filter(Boolean).join(" › ") },
                { label: "Destino", value: product.destination_path },
                { label: "Secundarios", value: editor.secondary_destination_ids.length ? editor.secondary_destination_ids.map(destination).join(" · ") : "—" },
                { label: "Duración", value: `${durationLabel(product.duration)} · ${product.modality.toLowerCase()}` },
                { label: "Pasajeros", value: `${product.pax.min} a ${product.pax.max}` },
                { label: "Edades", value: `${product.age.min} a ${product.age.max} años` },
                { label: "Anticipación", value: `${product.advance_days.min} a ${product.advance_days.max} días` },
                { label: "Indicadores", value: [editor.master.is_bookable && "Reservable", editor.master.is_quoteable && "Cotizable", editor.master.is_b2b && "B2B", editor.master.is_ecommerce && "E-commerce", editor.master.is_featured && "Destacado"].filter(Boolean).join(" · ") || "—" },
              ]}
            />
          </Panel>
          <div id="checklist">
            <Panel title="Preparación para activación (§42)" hint={`${overview.checklist.passed} de ${overview.checklist.total} validaciones cumplidas. Pulsa una pendiente para ir a su paso.`}>
              <ChecklistLinks items={overview.checklist.items} options={options} editor={editor} />
            </Panel>
          </div>
        </div>
      ),
    },
    {
      id: "componentes",
      label: "Componentes",
      count: editor.components.length,
      render: () => (
        <Panel
          title="Componentes"
          hint={overview.kpis.components_cost !== null ? `Costo total: ${formatMoney(overview.kpis.components_cost)}. Cada fila es costo unitario × cantidad; lo que está en dólares se pasa a soles.` : undefined}
          action={editAt(ctx, 3)}
        >
          <SimpleTable
            testId="product-components"
            columns={[
              { header: "#" },
              { header: "Componente" },
              { header: "Proveedor" },
              { header: "Req." },
              { header: "Incl." },
              ...(options.sees_cost ? [{ header: "Costo unitario", align: "right" as const }] : []),
              { header: "Cant.", align: "right" },
              ...(options.sees_cost ? [{ header: "Subtotal (S/)", align: "right" as const }] : []),
            ]}
            rows={editor.components.map((component, index) => {
              const item = service(component.service_id);
              const child = options.products.find((row) => row.id === component.component_product_id);
              const currency = component.cost_currency ?? "PEN";
              return {
                key: component.id ?? String(index),
                cells: [
                  index + 1,
                  <span key="name">
                    <b className="block font-semibold">{item ? item.name : child ? child.name : "Producto componente"}</b>
                    <span className="text-[12px] text-fg-3">{item ? `${item.ref} · ${item.type} · por ${item.unit}` : `${child?.code ?? ""} · costo de su tarifa vigente más baja`}</span>
                  </span>,
                  item?.provider ?? "—",
                  component.is_required ? "Sí" : "No",
                  component.is_included ? "Sí" : "No",
                  ...(options.sees_cost ? [component.unit_cost ? formatMoney(component.unit_cost, currency) : "—"] : []),
                  `× ${component.quantity}`,
                  ...(options.sees_cost
                    ? [
                        <span key="subtotal">
                          {component.subtotal_pen ? formatMoney(component.subtotal_pen) : "—"}
                          {currency !== "PEN" && editor.fx_usd && <span className="block text-[11.5px] font-normal text-fg-3">al cambio de S/ {Number(editor.fx_usd).toFixed(3)}</span>}
                        </span>,
                      ]
                    : []),
                ],
              };
            })}
            footer={options.sees_cost && editor.components.length > 0 ? ["", "Costo total de componentes", "", "", "", "", "", formatMoney(overview.kpis.components_cost ?? "0")] : undefined}
            empty="Sin componentes. El checklist de activación los exige."
          />
        </Panel>
      ),
    },
    {
      id: "itinerario",
      label: "Itinerario",
      count: editor.itinerary.length,
      render: () => (
        <Panel title="Itinerario" action={editAt(ctx, 4)}>
          {editor.itinerary.length === 0 ? (
            <p className="text-[13.5px] text-fg-3">Sin itinerario cargado.</p>
          ) : (
            <ol className="grid gap-4 lg:grid-cols-2">
              {editor.itinerary.map((day, index) => (
                <li key={day.id ?? index} className="lift rounded-[14px] border border-line p-4">
                  <p className="mb-2 flex items-center gap-2 text-[13.5px] font-semibold">
                    <span className="grid h-6 min-w-6 place-items-center rounded-full bg-accent px-1.5 text-[11.5px] font-bold text-white">{index + 1}</span>
                    {day.title}
                  </p>
                  {day.items.length === 0 ? (
                    <p className="text-[12.5px] text-bad">Día sin actividades.</p>
                  ) : (
                    <ul className="ml-3 flex flex-col border-l-2 border-accent/25 pl-4">
                      {day.items.map((item, position) => (
                        <li key={item.id ?? position} className="py-1.5 text-[13px]">
                          {item.time && <span className="mr-2 font-mono text-[12px] font-semibold text-fg-2">{item.time}</span>}
                          {item.activity}
                          <span className="block text-[12px] text-fg-3">{[item.type, item.location].filter(Boolean).join(" · ")}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ol>
          )}
        </Panel>
      ),
    },
    {
      id: "tarifas",
      label: "Tarifas",
      count: editor.rates.length,
      render: () => (
        <Panel title="Tarifas" hint="Toda tarifa tiene moneda y vigencia (PRD-BR-004); las vencidas no se aplican (PRD-BR-005)." action={<span className="flex gap-2">{editAt(ctx, 5, "Agregar o desactivar")}<ModuleLink href="/catalogo/tarifas" label="Tarifas y temporadas" /></span>}>
          <SimpleTable
            columns={[{ header: "Tarifa" }, { header: "Tipo · segmento · canal" }, { header: "Vigencia" }, ...(options.sees_cost ? [{ header: "Costo", align: "right" as const }] : []), { header: "Venta", align: "right" }, { header: "Estado" }]}
            rows={editor.rates.map((rate) => ({
              key: rate.ref ?? rate.valid_from,
              muted: rate.state === "vencida" || rate.state === "inactiva",
              cells: [
                <span key="ref" className="font-mono text-[12.5px]">{rate.ref}</span>,
                `${rate.rate_type} · ${rate.segment} · ${rate.channel}`,
                `${formatDate(rate.valid_from)} al ${formatDate(rate.valid_to)}`,
                ...(options.sees_cost ? [rate.cost ? formatMoney(rate.cost, rate.currency) : "—"] : []),
                formatMoney(rate.price, rate.currency),
                <Badge key="state" tone={rate.state === "vigente" ? "ok" : rate.state === "programada" ? "info" : rate.state === "vencida" ? "bad" : "mute"}>{rate.state}</Badge>,
              ],
            }))}
            empty="Sin tarifas."
          />
        </Panel>
      ),
    },
    {
      id: "temporadas",
      label: "Temporadas",
      count: seasonIds.size,
      render: () => (
        <Panel title="Temporadas asociadas" action={<span className="flex gap-2">{editAt(ctx, 6)}<ModuleLink href="/catalogo/tarifas" label="Administrar temporadas" /></span>}>
          <SimpleTable
            columns={[{ header: "Temporada" }, { header: "Tipo" }, { header: "Fechas" }, { header: "Factor", align: "right" }, { header: "Origen" }]}
            rows={options.seasons.filter((season) => seasonIds.has(season.id)).map((season) => ({
              key: season.id,
              cells: [season.name, season.type, `${formatDate(season.date_from)} al ${formatDate(season.date_to)}`, `×${Number(season.factor).toFixed(2)}`, editor.rates.some((rate) => rate.season_id === season.id) ? "Usada por una tarifa" : "Asociación directa"],
            }))}
            empty="Sin temporadas asociadas."
          />
        </Panel>
      ),
    },
    {
      id: "disponibilidad",
      label: "Disponibilidad",
      render: () => (
        <Panel title="Disponibilidad" action={<span className="flex gap-2">{editAt(ctx, 7)}<ModuleLink href="/catalogo/cupos" label="Cupos y bloqueos" /></span>}>
          <FieldList
            fields={[
              { label: "Modelo", value: AVAILABILITY_LABEL[editor.availability.model] ?? editor.availability.model },
              { label: "Qué significa", value: <span className="whitespace-normal">{AVAILABILITY_HINT[editor.availability.model]}</span> },
              { label: "Capacidad", value: editor.availability.capacity ?? "Sin capacidad de referencia" },
              { label: "Fuente", value: editor.availability.source === "externa" ? "Proveedor externo (informativa, PRD-BR-013)" : "Inventario propio" },
              { label: "Salidas futuras", value: overview.kpis.future_departures },
            ]}
          />
        </Panel>
      ),
    },
    {
      id: "salidas",
      label: "Salidas",
      count: overview.departures.filter((row) => row.future).length,
      render: () => (
        <Panel title="Salidas programadas" action={<ModuleLink href="/catalogo/salidas" label="Programar en Salidas" />}>
          <SimpleTable
            columns={[{ header: "Salida" }, { header: "Fecha" }, { header: "Punto de encuentro" }, { header: "Vendidos", align: "right" }, { header: "Estado" }]}
            rows={overview.departures.map((row) => ({
              key: row.ref,
              muted: !row.future,
              cells: [<span key="ref" className="font-mono text-[12.5px]">{row.ref}</span>, `${formatDate(row.date)}${row.time ? ` · ${row.time}` : ""}`, row.meeting_point ?? "—", `${row.sold} de ${row.capacity}`, <Badge key="status" tone={DEPARTURE_STATUS[row.status] ?? "mute"}>{row.status}</Badge>],
            }))}
            empty="Sin salidas programadas."
          />
        </Panel>
      ),
    },
    overview.providers !== null && {
      id: "proveedores",
      label: "Proveedores",
      count: overview.providers.length,
      render: () => (
        <Panel title="Proveedores involucrados" hint="Solo proveedores activos con contrato vigente pueden operar el producto (PRD-BR-007)." action={<span className="flex gap-2">{editAt(ctx, 3)}<ModuleLink href="/catalogo/proveedores" label="Proveedores" /></span>}>
          <SimpleTable
            columns={[{ header: "Proveedor" }, { header: "Tipo" }, { header: "Servicios" }, { header: "Contrato hasta" }, { header: "Estado" }]}
            rows={(overview.providers ?? []).map((provider) => ({
              key: provider.ref,
              cells: [
                <span key="name"><b className="font-semibold">{provider.name}</b>{provider.main && <span className="ml-2 text-[12px] font-semibold text-accent">Principal</span>}</span>,
                provider.type,
                provider.services.join(" · ") || "—",
                formatDate(provider.contract_end),
                <Badge key="state" tone={provider.usable ? "ok" : "bad"}>{provider.usable ? "Activo" : provider.status === "activo" ? "Contrato vencido" : provider.status}</Badge>,
              ],
            }))}
            empty="Sin proveedores asignados."
          />
        </Panel>
      ),
    },
    {
      id: "politicas",
      label: "Políticas",
      render: () => (
        <Panel title="Políticas" action={editAt(ctx, 8)}>
          {editor.policies ? (
            <FieldList
              fields={[
                { label: "Cancelación", value: <span className="whitespace-normal">{editor.policies.cancellation}</span> },
                { label: "Cambios", value: <span className="whitespace-normal">{editor.policies.modification}</span> },
                { label: "No-show", value: <span className="whitespace-normal">{editor.policies.no_show}</span> },
                { label: "Reembolsos", value: <span className="whitespace-normal">{editor.policies.refund}</span> },
                { label: "Penalidades", value: <span className="whitespace-normal">{editor.policies.penalties || "—"}</span> },
                { label: "Cambio de fecha", value: <span className="whitespace-normal">{editor.policies.date_change || "—"}</span> },
              ]}
            />
          ) : null}
          {editor.policies ? (
            <div className="mt-4 border-t border-line-2 pt-4">
              <h4 className="mb-2 text-[13.5px] font-semibold">Tramos de penalidad por cancelación</h4>
              {editor.policies.tiers_from_text && <p className="mb-2 text-[12.5px] text-fg-3">Deducidos del texto de cancelación. Edita las políticas para fijarlos.</p>}
              <PenaltyTiersView tiers={editor.policies.penalty_tiers ?? []} />
            </div>
          ) : (
            <p className="text-[13.5px] text-fg-3">Sin políticas cargadas.</p>
          )}
        </Panel>
      ),
    },
    {
      id: "inclusiones",
      label: "Inclusiones / Exclusiones",
      render: () => (
        <Panel title="Inclusiones, exclusiones y requisitos" action={editAt(ctx, 8)}>
          <div className="grid gap-5 lg:grid-cols-3">
            <div>
              <p className="mb-2 text-[13px] font-semibold">Incluye</p>
              <ul className="flex flex-col gap-1.5">{editor.content.inclusions.map((text) => <li key={text} className="flex gap-2 text-[13px]"><Check size={15} className="mt-0.5 flex-none text-ok" />{text}</li>)}</ul>
            </div>
            <div>
              <p className="mb-2 text-[13px] font-semibold">No incluye</p>
              <ul className="flex flex-col gap-1.5">{editor.content.exclusions.map((text) => <li key={text} className="flex gap-2 text-[13px] text-fg-2"><X size={15} className="mt-0.5 flex-none text-fg-3" />{text}</li>)}</ul>
            </div>
            <div>
              <p className="mb-2 text-[13px] font-semibold">Requisitos y recomendaciones</p>
              <ul className="flex flex-col gap-1.5">{editor.content.requirements.map((item) => <li key={item.text} className="text-[13px]"><span className="block text-[12px] text-fg-3">{item.category ?? "General"}</span>{item.text}</li>)}</ul>
            </div>
          </div>
        </Panel>
      ),
    },
    {
      id: "relacionados",
      label: "Relacionados",
      count: overview.related.length,
      render: () => (
        <Panel title="Productos relacionados" hint="Sugerencias de venta cruzada y alternativas.">
          <SimpleTable columns={[{ header: "Producto" }, { header: "Relación" }, { header: "Estado" }]} rows={overview.related.map((row) => ({ key: row.code, cells: [<Link key="link" href={`/catalogo/productos/${encodeURIComponent(row.code)}`} className="font-semibold hover:text-accent">{row.name}</Link>, row.relation, statusBadge(row.status)] }))} empty="Sin productos relacionados." />
        </Panel>
      ),
    },
    overview.b2b !== null && {
      id: "b2b",
      label: "B2B",
      count: overview.b2b.length,
      render: () => (
        <Panel title="Precios para agencias B2B" action={<ModuleLink href="/canales/b2b" label="Agencias B2B" />}>
          <SimpleTable
            columns={[{ header: "Agencia" }, { header: "Lista de precios" }, { header: "Precio", align: "right" }, { header: "Comisión", align: "right" }, { header: "Vigente hasta" }]}
            rows={(overview.b2b ?? []).map((row, index) => ({ key: `${row.agency_code}-${index}`, cells: [row.agency ?? "Todas", row.price_list ?? "—", formatMoney(row.price, row.currency), row.commission_pct ? `${row.commission_pct} %` : "—", row.valid_to ? formatDate(row.valid_to) : "—"] }))}
            empty="Sin precios B2B."
          />
        </Panel>
      ),
    },
    {
      id: "promociones",
      label: "Promociones",
      count: overview.promotions.length,
      render: () => (
        <Panel title="Promociones" action={<ModuleLink href="/canales/ecommerce" label="Todas las promociones" />}>
          {ctx.promotions ? (
            <PromotionsTable catalog={{ ...ctx.promotions, rows: ctx.promotions.rows.filter((row) => row.product.code === product.code) }} canManage={options.can_update && product.status !== "ARCHIVED"} showProduct={false} product={product.code} screen="catalogo-producto-promociones" />
          ) : (
          <SimpleTable
            columns={[{ header: "Promoción" }, { header: "Descuento" }, { header: "Canal" }, { header: "Vigencia" }, { header: "Estado" }]}
            rows={overview.promotions.map((row) => ({ key: row.ref, cells: [<span key="name"><b className="block font-semibold">{row.name}</b><span className="font-mono text-[12px] text-fg-3">{row.promo_code ?? row.ref}</span></span>, `${row.kind} ${row.value}`, row.channel ?? "Todos", `${formatDate(row.date_from)} al ${formatDate(row.date_to)}`, <Badge key="status" tone={row.status === "activa" ? "ok" : "mute"}>{row.status}</Badge>] }))}
            empty="Sin promociones."
          />
          )}
        </Panel>
      ),
    },
    overview.profitability !== null && {
      id: "rentabilidad",
      label: "Costos y rentabilidad",
      render: () => (
        <Panel title="Rentabilidad por tarifa" hint={`Venta menos costo de la tarifa. Costo de componentes: ${overview.kpis.components_cost !== null ? formatMoney(overview.kpis.components_cost) : "—"}.`}>
          <SimpleTable
            columns={[{ header: "Tarifa" }, { header: "Tipo · segmento · canal" }, { header: "Costo", align: "right" }, { header: "Venta", align: "right" }, { header: "Utilidad", align: "right" }, { header: "Margen", align: "right" }]}
            rows={(overview.profitability ?? []).map((row) => ({ key: row.ref, muted: row.status !== "vigente", cells: [<span key="ref" className="font-mono text-[12.5px]">{row.ref}</span>, `${row.rate_type} · ${row.segment} · ${row.channel}`, formatMoney(row.cost, row.currency), formatMoney(row.price, row.currency), formatMoney(row.margin, row.currency), row.margin_pct !== null ? `${row.margin_pct} %` : "—"] }))}
            empty="Sin tarifas para analizar."
          />
        </Panel>
      ),
    },
    {
      id: "personalizacion",
      label: "Personalización",
      count: overview.config_groups.length,
      render: () => (
        <Panel title="Opciones que elige el cliente" hint="Grupos de opciones con su ajuste de precio (por ejemplo, tipo de habitación o almuerzo).">
          {overview.config_groups.length === 0 ? (
            <p className="rounded-[14px] border border-dashed border-line px-4 py-6 text-center text-[13px] text-fg-3">Este producto no tiene opciones de personalización.</p>
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {overview.config_groups.map((group) => (
                <div key={group.name} className="lift rounded-[14px] border border-line p-4">
                  <p className="mb-2 text-[13.5px] font-semibold">{group.name}</p>
                  <ul className="flex flex-col gap-1 text-[13px]">{group.options.map((option) => <li key={option.label} className="flex justify-between"><span>{option.label}</span><span className="font-mono">{formatMoney(option.price_delta)}</span></li>)}</ul>
                </div>
              ))}
            </div>
          )}
        </Panel>
      ),
    },
    {
      id: "contenido",
      label: "Contenido",
      render: () => (
        <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
          <Panel title="Contenido comercial" action={editAt(ctx, 8)}>
            {editor.content.long_description ? <p className="mb-4 whitespace-pre-line text-[13.5px] leading-relaxed text-fg-2">{editor.content.long_description}</p> : <p className="mb-4 text-[13px] text-fg-3">Sin descripción completa.</p>}
            <FieldList
              fields={[
                { label: "Título SEO", value: editor.content.seo_title ?? "—" },
                { label: "Descripción SEO", value: <span className="whitespace-normal">{editor.content.seo_description ?? "—"}</span> },
                { label: "Slug", value: <span className="font-mono text-[12.5px]">{editor.content.slug ?? "—"}</span> },
                { label: "Video", value: editor.content.video_url ? <a href={editor.content.video_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent">Ver <ExternalLink size={13} /></a> : "—" },
                { label: "Fotos", value: editor.content.media.length ? editor.content.media.map((item) => `${item.alt_text}${item.is_main ? " (portada)" : ""}`).join(" · ") : "—" },
              ]}
            />
            {editor.content.faqs.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 text-[13px] font-semibold">Preguntas frecuentes</p>
                <dl className="flex flex-col gap-3">{editor.content.faqs.map((faq) => <div key={faq.question}><dt className="text-[13px] font-semibold">{faq.question}</dt><dd className="text-[13px] text-fg-2">{faq.answer}</dd></div>)}</dl>
              </div>
            )}
          </Panel>
          {ctx.translations && <ProductTranslationsCard data={ctx.translations} canEdit={options.can_update && product.status !== "ARCHIVED"} />}
        </div>
      ),
    },
    {
      id: "canales",
      label: "Canales",
      count: editor.channels.length,
      render: () => (
        <Panel title="Canales" hint={product.status === "ACTIVE" ? "Publica o retira el producto de cada canal." : "Los canales elegidos se hacen efectivos al activar el producto (PRD-BR-002)."} action={product.status === "ACTIVE" ? undefined : editAt(ctx, 9)}>
          <ChannelSwitches code={product.code} active={product.status === "ACTIVE"} chosen={editor.channels} canPublish={options.can_publish} />
        </Panel>
      ),
    },
    {
      id: "versiones",
      label: "Versiones",
      count: overview.versions.length,
      render: () => (
        <Panel title="Versiones" hint="Las versiones no vigentes se consultan pero no se editan (PRD-BR-017).">
          <SimpleTable columns={[{ header: "Versión" }, { header: "Estado" }, { header: "Vigente desde" }, { header: "Motivo" }, { header: "Autor" }]} rows={overview.versions.map((row) => ({ key: `${row.version}-${row.created_at}`, cells: [<b key="v" className="font-mono">{row.version}</b>, <Badge key="s" tone={row.status === "vigente" ? "ok" : row.status === "borrador" ? "info" : "mute"}>{row.status}</Badge>, row.valid_from ? formatDate(row.valid_from) : "—", row.reason ?? "—", row.author ?? "—"] }))} empty="Sin versiones." />
        </Panel>
      ),
    },
    overview.history !== null && {
      id: "historial",
      label: "Historial",
      count: overview.history.length,
      render: () => (
        <Panel title="Historial de cambios" hint="Cada cambio queda con su autor y su detalle.">
          <SimpleTable columns={[{ header: "Fecha" }, { header: "Autor" }, { header: "Acción" }, { header: "Detalle" }]} rows={(overview.history ?? []).map((row) => ({ key: row.code, cells: [formatDateTime(row.occurred_at), row.actor ?? "Sistema", row.action.replace(/_/g, " "), <span key="d" className="whitespace-normal">{row.after_value ?? "—"}{row.before_value && <span className="block text-[12px] text-fg-3">Antes: {row.before_value}</span>}</span>] }))} empty="Sin cambios registrados." />
        </Panel>
      ),
    },
    {
      id: "uso",
      label: "Uso en ventas",
      count: overview.kpis.quotes + overview.kpis.reservations,
      render: () => (
        <div className="grid items-start gap-5 xl:grid-cols-2">
          <Panel title="Cotizaciones" hint={`${overview.kpis.quotes} cotizaciones usan este producto.`}>
            <SimpleTable columns={[{ header: "Cotización" }, { header: "Cliente" }, { header: "Estado" }]} rows={overview.usage.quotes.map((row) => ({ key: row.code, cells: [<Link key="q" href={`/cotizaciones/${encodeURIComponent(row.code)}`} className="font-semibold hover:text-accent">{row.code}<span className="block text-[12px] font-normal text-fg-3">{row.title}</span></Link>, row.client, row.status] }))} empty="Ninguna cotización lo usa." />
          </Panel>
          <Panel title="Reservas" hint={`${overview.kpis.reservations} reservas incluyen este producto.`}>
            <SimpleTable columns={[{ header: "Reserva" }, { header: "Cliente" }, { header: "Estado" }]} rows={overview.usage.reservations.map((row) => ({ key: row.code, cells: [<Link key="r" href={`/reservas/${encodeURIComponent(row.code)}`} className="font-semibold hover:text-accent">{row.code}<span className="block text-[12px] font-normal text-fg-3">{row.title}</span></Link>, row.client, row.status] }))} empty="Ninguna reserva lo incluye." />
          </Panel>
        </div>
      ),
    },
  ];

  return tabs.filter((tab): tab is ProductTab => tab !== false);
}

export const PRODUCT_SECTION_GROUPS: { title: string; ids: string[] }[] = [
  { title: "Ficha", ids: ["general", "contenido", "politicas", "inclusiones", "personalizacion"] },
  { title: "Operación", ids: ["componentes", "itinerario", "proveedores", "disponibilidad", "salidas"] },
  { title: "Precios", ids: ["tarifas", "temporadas", "rentabilidad", "promociones", "b2b"] },
  { title: "Venta", ids: ["canales", "relacionados", "uso"] },
  { title: "Control", ids: ["versiones", "historial"] },
];
