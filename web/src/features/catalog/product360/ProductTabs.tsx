import { ArrowRight, Check, ExternalLink, X } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { SimpleTable } from "@/components/ui/SimpleTable";
import { AVAILABILITY_HINT, AVAILABILITY_LABEL, durationLabel, PRODUCT_STATUS, type ProductDetail, type ProductEditorState, type ProductFormOptions, type ProductOverview, type ProductStatus, type ProductTranslations, type RelatedProduct } from "@/lib/catalog";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { statusLabel } from "@/lib/tone";
import { DEPARTURE_STATUS, type DeparturesOverview } from "@/lib/catalog-departures";
import { DepartureCreateAction, DepartureEditAction } from "@/features/catalog-departures/DepartureForms";
import { OccupancyBar } from "@/features/catalog-shared/CatalogPanels";
import { MainProviderChangeAction, PriceConfigurator, ProductHistoryTable, SeasonAssociateAction, SeasonDissociateAction } from "./ProductSectionActions";
import { PromotionsTable } from "@/features/channels/Promotions";
import type { PromotionCatalog } from "@/lib/channels";
import type { BookingSectionId, ProductBookingConfig } from "@/lib/catalog-booking";
import { AddonsSection, LodgingSection, OperationCard, PaxSection, PaymentSection, PickupSection, RulesSection } from "../booking/BookingSections";
import { costRange } from "@/lib/catalog-cost";
import { CostPerPerson } from "../CostPerPerson";
import { PenaltyTiersView } from "../PenaltyTiers";
import { ProductTranslationsCard } from "../ProductTranslations";
import { EditStepButton } from "../wizard/ProductWizard";
import { ChannelSwitches, ChecklistLinks } from "./ProductInteractive";
import { ProductProfitability } from "./ProductProfitability";
import { CompareVersions, NewVersionAction, ResolveRate } from "./ProductVersionTools";
import { TripSection } from "../trip/TripSection";
import type { TripCatalogView } from "@/lib/trip";

export interface ProductTabContext {
  product: ProductDetail;
  editor: ProductEditorState;
  overview: ProductOverview;
  options: ProductFormOptions;
  translations: ProductTranslations | null;
  promotions?: PromotionCatalog | null;
  booking?: ProductBookingConfig | null;
  trip?: TripCatalogView | null;
  departures?: DeparturesOverview | null;
}

export interface ProductTab {
  id: string;
  label: string;
  count?: number;
  render: () => ReactNode;
}


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

function RelatedTable({ rows, empty }: { rows: RelatedProduct[]; empty: string }) {
  return (
    <SimpleTable
      columns={[{ header: "Producto" }, { header: "Relación" }, { header: "Tipo" }, { header: "Precio desde", align: "right" }, { header: "Estado" }]}
      rows={rows.map((row) => ({
        key: `${row.code}-${row.relation}`,
        muted: row.status !== "ACTIVE",
        cells: [
          <span key="link">
            <Link href={`/catalogo/productos/${encodeURIComponent(row.code)}`} className="font-semibold hover:text-accent">{row.name}</Link>
            {row.status !== "ACTIVE" && <span className="block text-[12px] text-warn">No se ofrecerá: no está activo.</span>}
          </span>,
          row.relation,
          row.type,
          row.price_from ? formatMoney(row.price_from.amount, row.price_from.currency) : "Sin tarifa",
          statusBadge(row.status),
        ],
      }))}
      empty={empty}
    />
  );
}

export function productTabs(ctx: ProductTabContext): ProductTab[] {
  const { product, editor, overview, options } = ctx;
  const service = (id: string | null) => options.services.find((item) => item.id === id);
  const seasonIds = new Set([...editor.season_ids, ...editor.rates.map((rate) => rate.season_id).filter((id): id is string => Boolean(id))]);
  const destination = (id: string) => options.destinations.find((item) => item.id === id)?.path ?? "—";
  const blockedComponents = editor.components.map((component) => service(component.service_id)).filter((item): item is NonNullable<typeof item> => Boolean(item?.blocked));
  const associated = new Set(editor.season_ids);
  const futureDepartures = overview.departures.filter((row) => row.future && row.status !== "cancelada");
  const heldNow = futureDepartures.reduce((sum, row) => sum + row.held, 0);
  const manageDepartures = ctx.departures?.can.manage ?? false;
  const canSeasons = options.can_manage_rates && product.status !== "ARCHIVED";
  const b2bRows = overview.b2b ?? [];
  const b2bDiffs = b2bRows.map((row) => row.diff_pct).filter((value): value is number => value !== null);
  const b2bEnabled = product.raw.is_b2b && editor.channels.some((channel) => channel.toUpperCase() === "B2B");

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
          hint={overview.kpis.cost_breakdown ? `Costo: ${costRange(overview.kpis.cost_breakdown)}. Cada fila es costo unitario × cantidad; lo que está en dólares se pasa a soles.` : undefined}
          action={editAt(ctx, 3)}
        >
          {blockedComponents.length > 0 && (
            <p role="status" className="mb-4 rounded-xl border border-bad/30 bg-bad/[0.07] px-3.5 py-2.5 text-[13px] text-bad">
              <b className="font-semibold">{blockedComponents.length === 1 ? "1 componente no se puede vender" : `${blockedComponents.length} componentes no se pueden vender`}</b>: {blockedComponents.map((item) => `${item.name} (${item.blocked?.toLowerCase()})`).join(", ")}. Bloquean la activación y las ventas nuevas.
            </p>
          )}
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
              { header: "Vigencia" },
              { header: "Estado" },
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
                    {component.notes && <span className="block whitespace-normal text-[12px] italic text-fg-3">{component.notes}</span>}
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
                  item?.valid_to ? `hasta ${formatDate(item.valid_to)}` : child ? "Según su producto" : "—",
                  item ? <Badge key="state" tone={item.blocked ? "bad" : "ok"}>{item.blocked ?? "Vigente"}</Badge> : child ? <Badge key="state" tone="ok">Producto activo</Badge> : <Badge key="state" tone="bad">No disponible</Badge>,
                ],
              };
            })}
            footer={options.sees_cost && editor.components.length > 0 ? ["", "Suma de las filas (por persona y por grupo)", "", "", "", "", "", formatMoney(overview.kpis.components_cost ?? "0"), "", ""] : undefined}
            empty="Sin componentes. El checklist de activación los exige."
          />
          {options.sees_cost && overview.kpis.cost_breakdown && editor.components.length > 0 && <CostPerPerson breakdown={overview.kpis.cost_breakdown} className="mt-4" adjust={options.can_update && product.status !== "ARCHIVED" ? { code: product.code, lockVersion: product.lock_version } : undefined} />}
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
                          <span className="block text-[12px] text-fg-3">{[item.type, item.location, item.service ? `Servicio: ${item.service}` : null].filter(Boolean).join(" · ")}</span>
                          {item.note && <span className="mt-0.5 block text-[12px] italic text-fg-3">{item.note}</span>}
                          {(Number(item.price ?? 0) > 0 || (overview.profitability !== null && Number(item.cost ?? 0) > 0)) && (
                            <span className="mt-1 flex flex-wrap gap-1.5 text-[11.5px]">
                              {overview.profitability !== null && Number(item.cost ?? 0) > 0 && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-fg-2">Costo {formatMoney(item.cost ?? "0")}</span>}
                              {Number(item.price ?? 0) > 0 && <span className="rounded-full bg-surface-2 px-2 py-0.5 text-fg-2">Precio {formatMoney(item.price ?? "0")}</span>}
                            </span>
                          )}
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
          <ResolveRate code={product.code} />
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
        <Panel
          title="Temporadas asociadas"
          hint="Ante fechas cruzadas manda la de prioridad con número menor."
          action={<span className="flex flex-wrap gap-2">{canSeasons && <SeasonAssociateAction product={product} options={options} associated={[...seasonIds]} />}<ModuleLink href="/catalogo/tarifas/temporadas" label="Administrar temporadas" /></span>}
        >
          <SimpleTable
            columns={[{ header: "Temporada" }, { header: "Fechas" }, { header: "Prioridad", align: "right" }, { header: "Factor", align: "right" }, { header: "Tarifas que la usan" }, { header: "Estado" }, ...(canSeasons ? [{ header: "" }] : [])]}
            rows={options.seasons.filter((season) => seasonIds.has(season.id)).sort((a, b) => a.priority - b.priority).map((season) => {
              const used = editor.rates.filter((rate) => rate.season_id === season.id);
              return {
                key: season.id,
                muted: season.status !== "activa",
                cells: [
                  <span key="name"><b className="block font-semibold">{season.name}</b><span className="text-[12px] text-fg-3">{season.type}</span></span>,
                  `${formatDate(season.date_from)} al ${formatDate(season.date_to)}`,
                  <span key="priority" className="font-mono">{season.priority}</span>,
                  `×${Number(season.factor).toFixed(2)}`,
                  used.length ? <span key="rates" className="font-mono text-[12.5px]">{used.map((rate) => rate.ref).join(", ")}</span> : <span key="rates" className="text-fg-3">Asociación directa</span>,
                  <Badge key="status" tone={season.status === "activa" ? "ok" : "mute"}>{season.status === "activa" ? "Activa" : "Inactiva"}</Badge>,
                  ...(canSeasons ? [associated.has(season.id) && used.length === 0 ? <SeasonDissociateAction key="off" product={product} season={season} /> : ""] : []),
                ],
              };
            })}
            empty="Sin temporadas asociadas."
          />
        </Panel>
      ),
    },
    {
      id: "disponibilidad",
      label: "Disponibilidad",
      render: () => (
        <div className="flex flex-col gap-5">
        <Panel title="Disponibilidad" action={<span className="flex gap-2">{editAt(ctx, 7)}<ModuleLink href="/catalogo/salidas/rangos" label="Rangos de venta" /></span>}>
          <FieldList
            fields={[
              { label: "Modelo", value: AVAILABILITY_LABEL[editor.availability.model] ?? editor.availability.model },
              { label: "Qué significa", value: <span className="whitespace-normal">{AVAILABILITY_HINT[editor.availability.model]}</span> },
              { label: "Capacidad", value: editor.availability.capacity ?? "Sin capacidad de referencia" },
              { label: "Fuente", value: editor.availability.source === "externa" ? "Proveedor externo (informativa, PRD-BR-013)" : "Inventario propio" },
              { label: "Salidas futuras", value: overview.kpis.future_departures },
            ]}
          />
          {editor.availability.source === "externa" && <p role="status" className="mt-4 rounded-xl border border-warn/35 bg-warn/[0.09] px-3.5 py-2.5 text-[13px]">Fuente externa: la disponibilidad que informa el proveedor es referencial. Confírmala con él antes de confirmar la reserva.</p>}
        </Panel>
        <Panel title="Situación actual" hint="Salidas futuras abiertas: cupos, ventas y bloqueos en hold." action={<ModuleLink href="/catalogo/salidas/holds" label="Holds" />}>
          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            {[
              { label: "Cupos disponibles", value: futureDepartures.reduce((sum, row) => sum + row.available, 0), note: `de ${futureDepartures.reduce((sum, row) => sum + row.capacity, 0)} en ${futureDepartures.length} salidas` },
              { label: "Vendidos", value: futureDepartures.reduce((sum, row) => sum + row.sold, 0), note: "en salidas futuras" },
              { label: "Holds activos", value: heldNow, note: heldNow ? "cupos retenidos sin vender" : "ningún cupo retenido" },
            ].map((tile) => (
              <div key={tile.label} className="lift rounded-tile border border-line px-4 py-3">
                <p className="text-[12px] text-fg-3">{tile.label}</p>
                <p className="font-mono text-[20px] font-semibold">{tile.value}</p>
                <p className="text-[12px] text-fg-3">{tile.note}</p>
              </div>
            ))}
          </div>
          {futureDepartures.length ? (
            <ul className="flex flex-col gap-2.5">
              {futureDepartures.slice(0, 6).map((row, index) => (
                <li key={row.ref} className="grid grid-cols-[8.5rem_minmax(0,1fr)] items-center gap-3 text-[12.5px]">
                  <span><b className="font-semibold">{formatDate(row.date)}</b>{row.time && <span className="text-fg-3"> · {row.time}</span>}</span>
                  <OccupancyBar capacity={row.capacity} sold={row.sold} held={row.held} delay={index * 60} />
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[13px] text-fg-3">Sin salidas futuras abiertas.</p>
          )}
        </Panel>
        {ctx.booking && <OperationCard config={ctx.booking} />}
        </div>
      ),
    },
    {
      id: "salidas",
      label: "Salidas",
      count: overview.departures.filter((row) => row.future).length,
      render: () => (
        <Panel title="Salidas programadas" action={<span className="flex flex-wrap gap-2">{manageDepartures && ctx.departures && product.status !== "ARCHIVED" && <DepartureCreateAction overview={ctx.departures} />}<ModuleLink href="/catalogo/salidas" label="Todas las salidas" /></span>}>
          <SimpleTable
            columns={[{ header: "Salida" }, { header: "Fecha" }, { header: "Hora" }, { header: "Ocupación" }, { header: "Hold", align: "right" }, { header: "Disponibles", align: "right" }, { header: "Guía" }, { header: "Transporte" }, { header: "Estado" }, ...(manageDepartures ? [{ header: "" }] : [])]}
            rows={overview.departures.map((row) => {
              const editable = manageDepartures && ctx.departures ? ctx.departures.departures.find((item) => item.ref === row.ref) : undefined;
              return {
                key: row.ref,
                muted: !row.future,
                cells: [
                  <span key="ref" className="font-mono text-[12.5px]">{row.ref}<span className="block font-sans text-[12px] text-fg-3">{row.meeting_point || "—"}</span></span>,
                  formatDate(row.date),
                  row.time ?? "—",
                  <OccupancyBar key="occ" capacity={row.capacity} sold={row.sold} held={row.held} compact />,
                  row.held,
                  row.available,
                  row.guide?.name ?? <span key="guide" className="text-fg-3">Sin asignar</span>,
                  row.vehicle ? `${row.vehicle.plate} · ${row.vehicle.capacity} asientos` : <span key="vehicle" className="text-fg-3">Sin asignar</span>,
                  <Badge key="status" tone={DEPARTURE_STATUS[row.status as keyof typeof DEPARTURE_STATUS]?.tone ?? "mute"}>{DEPARTURE_STATUS[row.status as keyof typeof DEPARTURE_STATUS]?.label ?? statusLabel(row.status)}</Badge>,
                  ...(manageDepartures ? [editable && row.future ? <DepartureEditAction key="edit" overview={ctx.departures as DeparturesOverview} departure={editable} /> : ""] : []),
                ],
              };
            })}
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
        <Panel title="Proveedores involucrados" hint="Solo proveedores activos con contrato vigente pueden operar el producto (PRD-BR-007)." action={<span className="flex flex-wrap gap-2">{options.can_update && product.status !== "ARCHIVED" && <MainProviderChangeAction product={product} options={options} current={product.ids.provider} />}{editAt(ctx, 3)}<ModuleLink href="/catalogo/proveedores" label="Proveedores" /></span>}>
          <SimpleTable
            columns={[{ header: "Proveedor" }, { header: "Tipo" }, { header: "Servicios" }, { header: "Contrato" }, { header: "Pago" }, { header: "Calificación", align: "right" }, { header: "Estado" }]}
            rows={(overview.providers ?? []).map((provider) => ({
              key: provider.ref,
              cells: [
                <span key="name"><Link href={`/catalogo/proveedores/${encodeURIComponent(provider.ref)}`} className="font-semibold hover:text-accent hover:underline">{provider.name}</Link>{provider.main && <span className="ml-2 text-[12px] font-semibold text-accent">Principal</span>}<span className="block font-mono text-[12px] text-fg-3">RUC {provider.ruc}</span></span>,
                provider.type,
                <span key="services" className="whitespace-normal">{provider.services.join(" · ") || "—"}</span>,
                <span key="contract">hasta {formatDate(provider.contract_end)}<span className={cn("block text-[12px]", provider.contract_days < 0 ? "text-bad" : provider.contract_days <= 60 ? "text-warn" : "text-fg-3")}>{provider.contract_days < 0 ? `Vencido hace ${-provider.contract_days} días` : `Vence en ${provider.contract_days} días`}</span></span>,
                provider.payment_terms ?? "—",
                provider.rating > 0 ? provider.rating.toFixed(1) : "—",
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
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface-2 px-3.5 py-2.5">
            <p className="text-[13px]">
              <b className="font-semibold">Anticipación para reservar:</b> de {product.advance_days.min} a {product.advance_days.max} días antes del servicio.
              {ctx.booking?.operation.cutoff_hours ? <span className="text-fg-3"> Corte de venta: {ctx.booking.operation.cutoff_hours} horas antes.</span> : null}
            </p>
            {editAt(ctx, 0, "Editar anticipación")}
          </div>
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
        <div className="flex flex-col gap-5">
          <Panel title="Productos relacionados" hint="Sugerencias de venta cruzada y alternativas.">
            <RelatedTable rows={overview.related} empty="Sin productos relacionados." />
          </Panel>
          <Panel title="Referenciado desde" hint="Productos que sugieren este como relacionado.">
            <RelatedTable rows={overview.referenced_by} empty="Ningún producto lo sugiere." />
          </Panel>
        </div>
      ),
    },
    overview.b2b !== null && {
      id: "b2b",
      label: "B2B",
      count: overview.b2b.length,
      render: () => (
        <Panel title="Precios para agencias B2B" hint="Precio diferenciado, comisión, crédito, condición comercial y restricciones por agencia." action={<ModuleLink href="/canales/b2b" label="Agencias B2B" />}>
          {!b2bEnabled && <p role="status" className="mb-4 rounded-xl border border-warn/35 bg-warn/[0.09] px-3.5 py-2.5 text-[13px]">El producto no está habilitado para B2B ({product.raw.is_b2b ? "el canal B2B no está elegido" : "el indicador B2B está apagado"}). Las agencias no verán estos precios.</p>}
          <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Precio público", value: overview.public_price ? formatMoney(overview.public_price.amount, overview.public_price.currency) : "—", note: overview.public_price ? `Canal ${overview.public_price.channel}` : "Sin tarifa pública vigente" },
              { label: "Agencias con precio", value: String(b2bRows.length), note: `${b2bRows.filter((row) => row.is_credit).length} a crédito` },
              { label: "Diferencia promedio", value: b2bDiffs.length ? `${(b2bDiffs.reduce((sum, value) => sum + value, 0) / b2bDiffs.length).toFixed(1)} %` : "—", note: "frente al precio público" },
              { label: "Comisión promedio", value: b2bRows.length ? `${(b2bRows.reduce((sum, row) => sum + Number(row.commission_pct ?? 0), 0) / b2bRows.length).toFixed(1)} %` : "—", note: "entre las agencias" },
            ].map((tile) => (
              <div key={tile.label} className="lift rounded-tile border border-line px-4 py-3">
                <p className="text-[12px] text-fg-3">{tile.label}</p>
                <p className="font-mono text-[18px] font-semibold">{tile.value}</p>
                <p className="text-[12px] text-fg-3">{tile.note}</p>
              </div>
            ))}
          </div>
          <SimpleTable
            columns={[{ header: "Agencia" }, { header: "Lista de precios" }, { header: "Precio", align: "right" }, { header: "Frente al público", align: "right" }, { header: "Comisión", align: "right" }, { header: "Pago" }, { header: "Vigente hasta" }, { header: "Condición y restricciones" }]}
            rows={b2bRows.map((row, index) => ({
              key: `${row.agency_code}-${index}`,
              muted: row.agency_status !== null && row.agency_status !== "activa",
              cells: [
                <span key="agency"><b className="font-semibold">{row.agency ?? "Todas"}</b>{row.agency_status && row.agency_status !== "activa" && <span className="block text-[12px] text-bad">Agencia {statusLabel(row.agency_status).toLowerCase()}</span>}</span>,
                row.price_list ?? "—",
                formatMoney(row.price, row.currency),
                row.diff_pct === null ? "—" : `${row.diff_pct > 0 ? "+" : ""}${row.diff_pct.toFixed(1)} %`,
                row.commission_pct ? `${row.commission_pct} %` : "—",
                row.is_credit ? "Crédito" : "Prepago",
                row.valid_to ? formatDate(row.valid_to) : "—",
                <span key="terms" className="whitespace-normal">{row.conditions ?? "—"}{row.restrictions && <span className="block text-[12px] text-fg-3">{row.restrictions}</span>}</span>,
              ],
            }))}
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
          {overview.public_price && overview.promotions.some((row) => row.result_price) && (
            <div className="mb-4">
              <p className="mb-2 text-[12.5px] text-fg-3">Precio resultante sobre la tarifa pública de {formatMoney(overview.public_price.amount, overview.public_price.currency)}</p>
              <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {overview.promotions.filter((row) => row.result_price).map((row, index) => {
                  const share = Math.max(0, Math.min(100, (Number(row.result_price?.amount ?? 0) / Math.max(Number(overview.public_price?.amount ?? 1), 0.01)) * 100));
                  return (
                    <li key={row.ref} className={cn("lift rounded-tile border border-line px-3.5 py-2.5", row.date_to < options.today && "opacity-55")}>
                      <p className="flex items-center justify-between gap-2 text-[12.5px]"><b className="truncate font-semibold">{row.name}</b><span className="flex-none font-mono font-semibold text-accent">{formatMoney(row.result_price?.amount ?? "0", row.result_price?.currency)}</span></p>
                      <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2"><span className="block h-full origin-left rounded-full bg-accent motion-safe:animate-[fill-x_640ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ width: `${share}%`, animationDelay: `${index * 60}ms` }} /></div>
                      <p className="mt-1 text-[11.5px] text-fg-3">{row.kind} · {row.date_to < options.today ? "vencida" : `hasta ${formatDate(row.date_to)}`}</p>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}
          {ctx.promotions ? (
            <PromotionsTable catalog={{ ...ctx.promotions, rows: ctx.promotions.rows.filter((row) => row.product.code === product.code) }} canManage={options.can_update && product.status !== "ARCHIVED"} showProduct={false} product={product.code} screen="catalogo-producto-promociones" />
          ) : (
          <SimpleTable
            columns={[{ header: "Promoción" }, { header: "Descuento" }, { header: "Canal" }, { header: "Vigencia" }, { header: "Precio resultante", align: "right" }, { header: "Estado" }]}
            rows={overview.promotions.map((row) => ({ key: row.ref, cells: [<span key="name"><b className="block font-semibold">{row.name}</b><span className="font-mono text-[12px] text-fg-3">{row.promo_code ?? row.ref}</span></span>, `${row.kind} ${row.value}`, row.channel ?? "Todos", `${formatDate(row.date_from)} al ${formatDate(row.date_to)}`, row.result_price ? formatMoney(row.result_price.amount, row.result_price.currency) : "—", <Badge key="status" tone={row.status === "activa" && row.date_to >= options.today ? "ok" : "mute"}>{row.date_to < options.today ? "Vencida" : row.status === "activa" ? "Activa" : "Pausada"}</Badge>] }))}
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
        <ProductProfitability code={product.code} rates={overview.profitability ?? []} today={options.today} markup={product.raw.markup_pct} componentsCost={overview.kpis.cost_breakdown ? costRange(overview.kpis.cost_breakdown) : null} canSave={options.can_update && options.can_manage_rates && product.status !== "ARCHIVED"} />
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
          {overview.config_groups.length > 0 && <PriceConfigurator code={product.code} editor={editor} groups={overview.config_groups} today={options.today} />}
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
            {(editor.content.features ?? []).length > 0 && (
              <ul className="mb-4 flex flex-wrap gap-1.5">
                {(editor.content.features ?? []).map((feature) => (
                  <li key={feature} className="flex items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface))] px-2.5 py-1 text-[12.5px] font-medium text-accent"><Check size={13} />{feature}</li>
                ))}
              </ul>
            )}
            <FieldList
              fields={[
                { label: "Título SEO", value: editor.content.seo_title ? <span>{editor.content.seo_title} <span className={cn("font-mono text-[12px]", editor.content.seo_title.length > 60 ? "text-bad" : "text-fg-3")}>{editor.content.seo_title.length}/60</span></span> : "—" },
                { label: "Descripción SEO", value: editor.content.seo_description ? <span className="whitespace-normal">{editor.content.seo_description} <span className={cn("font-mono text-[12px]", editor.content.seo_description.length > 160 ? "text-bad" : "text-fg-3")}>{editor.content.seo_description.length}/160</span></span> : "—" },
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
    (options.can_update || options.sees_margin) && {
      id: "versiones",
      label: "Versiones",
      count: overview.versions.length,
      render: () => (
        <Panel title="Versiones" hint="Las versiones no vigentes se consultan pero no se editan (PRD-BR-017)." action={options.can_update && product.status !== "ARCHIVED" ? <NewVersionAction code={product.code} /> : undefined}>
          <SimpleTable columns={[{ header: "Versión" }, { header: "Estado" }, { header: "Vigente desde" }, { header: "Motivo" }, { header: "Autor" }]} rows={overview.versions.map((row) => ({ key: `${row.version}-${row.created_at}`, cells: [<b key="v" className="font-mono">{row.version}</b>, <Badge key="s" tone={row.status === "vigente" ? "ok" : row.status === "borrador" ? "info" : "mute"}>{statusLabel(row.status)}</Badge>, row.valid_from ? formatDate(row.valid_from) : "—", row.reason ?? "—", row.author ?? "—"] }))} empty="Sin versiones." />
          <CompareVersions code={product.code} versions={overview.versions.map((row) => row.version)} />
        </Panel>
      ),
    },
    overview.history !== null && {
      id: "historial",
      label: "Historial",
      count: overview.history.length,
      render: () => (
        <Panel title="Historial de cambios" hint="Cambios del producto, de sus tarifas y de sus salidas, con su autor y su detalle.">
          <ProductHistoryTable rows={overview.history ?? []} code={product.code} />
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
    ...bookingTabs(ctx.booking ?? null),
    ctx.trip && ctx.trip.legs.length > 0 ? { id: "tramos", label: "Viaje por tramos", count: ctx.trip.summary.tours + ctx.trip.summary.transport, render: () => <TripSection data={ctx.trip as TripCatalogView} /> } : false,
  ];

  return tabs.filter((tab): tab is ProductTab => tab !== false);
}

const BOOKING_TABS: { id: string; label: string; section?: BookingSectionId; count?: (config: ProductBookingConfig) => number; render: (config: ProductBookingConfig) => ReactNode }[] = [
  { id: "pasajeros", label: "Pasajeros", section: "pasajeros", render: (config) => <PaxSection config={config} /> },
  { id: "adicionales", label: "Adicionales", section: "adicionales", count: (config) => config.addons.length, render: (config) => <AddonsSection config={config} /> },
  { id: "alojamiento", label: "Alojamiento", section: "alojamiento", count: (config) => (config.accommodation.enabled ? config.accommodation.legs.length : 0), render: (config) => <LodgingSection config={config} /> },
  { id: "pago", label: "Pago", section: "pago", render: (config) => <PaymentSection config={config} /> },
  { id: "recojo", label: "Recojo", section: "recojo", count: (config) => config.pickup.points.length, render: (config) => <PickupSection config={config} /> },
  { id: "reglas", label: "Reglas", count: (config) => config.summary.overrides, render: (config) => <RulesSection config={config} /> },
];

function bookingTabs(config: ProductBookingConfig | null): ProductTab[] {
  if (!config) return [];
  return BOOKING_TABS.map((tab) => ({
    id: tab.id,
    label: tab.section && config.sections[tab.section].status !== "on" ? `${tab.label} (desactivada)` : tab.label,
    count: tab.count?.(config),
    render: () => tab.render(config),
  }));
}

export const PRODUCT_SECTION_GROUPS: { title: string; ids: string[] }[] = [
  { title: "Ficha", ids: ["general", "contenido", "politicas", "inclusiones", "personalizacion"] },
  { title: "Operación", ids: ["componentes", "itinerario", "proveedores", "disponibilidad", "salidas"] },
  { title: "Precios", ids: ["tarifas", "temporadas", "rentabilidad", "promociones", "b2b"] },
  { title: "Reservas online", ids: ["pasajeros", "adicionales", "alojamiento", "tramos", "pago", "recojo", "reglas"] },
  { title: "Venta", ids: ["canales", "relacionados", "uso"] },
  { title: "Control", ids: ["versiones", "historial"] },
];
