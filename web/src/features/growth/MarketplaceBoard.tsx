"use client";

import { ArrowDownLeft, ArrowUpRight, Check, Handshake, MapPin, Network, Plus, ShoppingBag, Store, X } from "lucide-react";
import { useActionState, useState } from "react";
import { decidePartnership, requestPartnership, saveListing, sellListing } from "@/app/(backoffice)/canales/marketplace/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { EmptyState } from "@/components/ui/EmptyState";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { Tabs } from "@/components/ui/Tabs";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintTile } from "@/components/ui/Tinted";
import { formatDateTime, formatMoney } from "@/lib/format";
import type { MarketListing, MarketListings, MarketOrder, MarketPartnership } from "@/lib/growth";
import type { StepResult } from "@/lib/server/resource";
import { KpiRow, PlanNotice, StatusPill } from "./GrowthUi";

const initial: StepResult = { message: null, done: false };

const DECISION_LABELS: Record<string, string> = { aceptar: "Aceptar", rechazar: "Rechazar", suspender: "Suspender", reactivar: "Reactivar", terminar: "Terminar" };

const PARTNERSHIP_LABELS: Record<string, string> = { solicitada: "Solicitud enviada", activa: "Aliados", rechazada: "Rechazada", suspendida: "Suspendida", terminada: "Terminada" };

function PublishForm({ mine, listing }: { mine: MarketListings; listing?: MarketListing }) {
  const [publish, setPublish] = useState(true);
  const [refreshPrice, setRefreshPrice] = useState(false);
  return (
    <PanelAction<StepResult>
      label="Publicar producto"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId={listing ? `pub-${listing.id}` : "pub-nueva"}
      title={listing ? `Editar ${listing.title}` : "Publicar en el marketplace"}
      description="Otras agencias de KipuControl lo verán a precio neto y lo podrán vender con su margen, una vez que aceptes la alianza."
      submitLabel={listing ? "Guardar cambios" : "Publicar"}
      action={saveListing}
      initial={initial}
      testId={listing ? undefined : "listing-create"}
      trigger={listing ? (open) => <RowIcon tone="edit" label="Editar publicación" onClick={open} /> : undefined}
    >
      {() => (
        <>
          {listing ? <input type="hidden" name="id" value={listing.id} /> : <input type="hidden" name="publish" value={publish ? "1" : "0"} />}
          {listing && <input type="hidden" name="refresh_price" value={refreshPrice ? "1" : "0"} />}
          {!listing && <SelectField label="Producto" name="product" searchable options={mine.products} placeholder="Elegir producto activo" />}
          <TextField label="Título visible" name="title" minLength={3} maxLength={200} defaultValue={listing?.title} hint={listing ? undefined : "Si lo dejas vacío, se usa el nombre del producto."} />
          <TextArea label="Resumen" name="summary" rows={3} maxLength={1000} defaultValue={listing?.summary ?? undefined} />
          <TextField label="Comisión para el revendedor (%)" name="reseller_commission_pct" type="number" step="0.01" min={0} max={40} required defaultValue={listing?.reseller_commission_pct ?? "15"} />
          {listing ? (
            <>
              <SelectField label="Estado" name="status" options={[{ value: "publicado", label: "Publicado" }, { value: "pausado", label: "Pausado" }, { value: "borrador", label: "Borrador" }, { value: "retirado", label: "Retirado (no se puede deshacer)" }]} defaultValue={listing.status} />
              <SwitchField label="Actualizar el precio desde" name="refresh_switch" checked={refreshPrice} onCheckedChange={setRefreshPrice} hint="Toma la tarifa vigente más baja del producto." />
            </>
          ) : (
            <SwitchField label="Publicar ahora" name="publish_switch" checked={publish} onCheckedChange={setPublish} hint="Si lo apagas, queda en borrador." />
          )}
        </>
      )}
    </PanelAction>
  );
}

function RequestForm({ listing }: { listing: MarketListing }) {
  const [terms, setTerms] = useState("prepago");
  return (
    <PanelAction<StepResult>
      label="Pedir alianza"
      formId={`alianza-${listing.id}`}
      title={`Alianza con ${listing.seller}`}
      description={`Comisión para ti: ${Number(listing.reseller_commission_pct)} %. La plataforma cobra el 1 % al vendedor.`}
      submitLabel="Enviar solicitud"
      action={requestPartnership}
      initial={initial}
      trigger={(open) => <Button size="sm" variant="secondary" icon={<Handshake size={14} />} onClick={open}>Pedir alianza</Button>}
    >
      {() => (
        <>
          <input type="hidden" name="listing" value={listing.id} />
          <ChoiceGroup label="Forma de pago" name="payment_terms" options={[{ value: "prepago", label: "Prepago" }, { value: "credito", label: "Crédito" }]} defaultValue={terms} onChange={setTerms} />
          {terms === "credito" && <TextField label="Línea de crédito solicitada" name="credit_limit" type="number" step="0.01" min={0} />}
        </>
      )}
    </PanelAction>
  );
}

function SellForm({ listing }: { listing: MarketListing }) {
  return (
    <PanelAction<StepResult>
      label="Vender"
      formId={`venta-${listing.id}`}
      title={`Vender ${listing.title}`}
      description={`${listing.seller} recibe la reserva; tú registras la venta con tu margen.${listing.net_price ? ` Precio neto ${formatMoney(listing.net_price, listing.currency)} por pasajero.` : ""}`}
      submitLabel="Registrar venta"
      action={sellListing}
      initial={initial}
      trigger={(open) => <Button size="sm" variant="primary" icon={<ShoppingBag size={14} />} onClick={open}>Vender</Button>}
    >
      {() => (
        <>
          <input type="hidden" name="listing" value={listing.id} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Pasajeros" name="pax" type="number" min={1} max={99} required defaultValue="2" />
            <TextField label="Fecha de viaje" name="travel_date" type="date" required />
          </div>
          <TextField label="Monto de la venta" name="gross_amount" type="number" step="0.01" min={0} required={!listing.from_price} hint={listing.from_price ? `Si lo dejas vacío: ${formatMoney(listing.from_price, listing.currency)} por pasajero.` : "La publicación no tiene precio desde."} />
        </>
      )}
    </PanelAction>
  );
}

function DecideButton({ partnership, decision }: { partnership: MarketPartnership; decision: string }) {
  const [state, run, pending] = useActionState(decidePartnership, initial);
  const positive = decision === "aceptar" || decision === "reactivar";
  return (
    <form action={run} className="contents">
      <input type="hidden" name="id" value={partnership.id} />
      <input type="hidden" name="decision" value={decision} />
      <Button type="submit" size="sm" variant={positive ? "primary" : "secondary"} icon={positive ? <Check size={14} /> : <X size={14} />} disabled={pending} title={state.message ?? undefined}>
        {DECISION_LABELS[decision]}
      </Button>
    </form>
  );
}

function ListingCard({ listing, index }: { listing: MarketListing; index: number }) {
  return (
    <li style={{ animationDelay: `${index * 50}ms` }} className="lift flex animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col gap-3 rounded-tile border border-line bg-surface p-4">
      <div>
        <p className="font-semibold leading-snug">{listing.title}</p>
        <p className="mt-0.5 flex items-center gap-1 text-[12.5px] text-fg-3">
          <Store size={13} /> {listing.seller}
          {listing.destination && (
            <>
              {" · "}
              <MapPin size={13} /> {listing.destination}
            </>
          )}
        </p>
        {listing.summary && <p className="mt-2 line-clamp-2 text-[12.5px] text-fg-2">{listing.summary}</p>}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-surface-2 px-3 py-2">
          <p className="text-[11px] text-fg-3">Precio público desde</p>
          <p className="text-[15px] font-bold">{listing.from_price ? formatMoney(listing.from_price, listing.currency) : "A consultar"}</p>
        </div>
        <div className="rounded-xl bg-[color-mix(in_srgb,var(--ok)_9%,var(--surface))] px-3 py-2">
          <p className="text-[11px] text-fg-3">Tu precio neto · {Number(listing.reseller_commission_pct)} %</p>
          <p className="text-[15px] font-bold text-ok">{listing.net_price ? formatMoney(listing.net_price, listing.currency) : "—"}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3">
        {listing.partnership ? <StatusPill status={listing.partnership} label={PARTNERSHIP_LABELS[listing.partnership] ?? listing.partnership} /> : <span className="text-[12px] text-fg-3">Sin alianza</span>}
        {listing.partnership === "activa" ? <SellForm listing={listing} /> : !listing.partnership || ["rechazada", "terminada"].includes(listing.partnership) ? <RequestForm listing={listing} /> : null}
      </div>
    </li>
  );
}

export function MarketplaceBoard({ network, mine, partnerships, orders }: { network: MarketListings; mine: MarketListings; partnerships: MarketPartnership[]; orders: MarketOrder[] }) {
  const { kpis } = network;
  const [query, setQuery] = useState("");
  const visible = network.listings.filter((listing) => `${listing.title} ${listing.destination ?? ""} ${listing.seller ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  return (
    <>
      <PlanNotice enabled={network.enabled} feature="El marketplace entre agencias" />
      <KpiRow>
        <TintTile icon={Store} tone="t1" label="Mis publicaciones" value={kpis.published} info={<p>Productos propios publicados que otras agencias pueden vender.</p>} />
        <TintTile icon={Handshake} tone="violet" label="Aliados" value={kpis.partners} note={kpis.pending > 0 ? `${kpis.pending} solicitudes por responder` : undefined} info={<p>Alianzas activas, como vendedor o como revendedor. Las solicitudes pendientes son las que te toca aceptar o rechazar.</p>} />
        <TintTile icon={ArrowUpRight} tone="ok" label="Vendido por aliados este mes" value={kpis.sold_month} info={<p>Ventas de tus productos hechas por agencias aliadas en el mes, sin contar rechazadas ni canceladas.</p>} />
        <TintTile icon={ArrowDownLeft} tone="info" label="Comprado a aliados este mes" value={kpis.bought_month} info={<p>Ventas que tu agencia hizo de productos de otros operadores en el mes.</p>} />
      </KpiRow>
      <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <Tabs
          tabs={[
            {
              id: "red",
              label: "Red de operadores",
              count: network.listings.length,
              content: (
                <>
                  <div className="mb-4 max-w-md">
                    <TextField label="Buscar" name="buscar" placeholder="Destino, producto u operador" value={query} onChange={(event) => setQuery(event.target.value)} />
                  </div>
                  {visible.length === 0 ? (
                    <EmptyState icon={<Network size={22} />} title="No hay productos publicados" description="Cuando otras agencias publiquen productos, aparecerán aquí con tu precio neto." />
                  ) : (
                    <ul className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
                      {visible.map((listing, index) => (
                        <ListingCard key={listing.id} listing={listing} index={index} />
                      ))}
                    </ul>
                  )}
                </>
              ),
            },
            {
              id: "mias",
              label: "Mis publicaciones",
              count: mine.listings.length,
              content: (
                <DataTable
                  screen="canales-marketplace-publicaciones"
                  rows={mine.listings}
                  getKey={(listing) => listing.id}
                  entityLabel="publicaciones"
                  searchText={(listing) => `${listing.title} ${listing.product_code ?? ""}`}
                  toolbarEnd={<PublishForm mine={mine} />}
                  emptyTitle="Aún no publicaste productos"
                  columns={[
                    { id: "title", header: "Producto", mobile: "title", cell: (listing) => <div><p className="font-semibold">{listing.title}</p><p className="font-mono text-[11.5px] text-fg-3">{listing.product_code}{listing.destination ? ` · ${listing.destination}` : ""}</p></div> },
                    { id: "price", header: "Desde", align: "right", cell: (listing) => <span className="text-[13px]">{listing.from_price ? formatMoney(listing.from_price, listing.currency) : "A consultar"}</span> },
                    { id: "commission", header: "Comisión", align: "right", cell: (listing) => <span className="text-[13px]">{Number(listing.reseller_commission_pct)} %</span> },
                    { id: "status", header: "Estado", cell: (listing) => <StatusPill status={listing.status} label={listing.status_label} /> },
                    { id: "actions", header: "", align: "right", cell: (listing) => <RowActions>{listing.status !== "retirado" && <PublishForm mine={mine} listing={listing} />}</RowActions> },
                  ]}
                />
              ),
            },
            {
              id: "alianzas",
              label: "Alianzas",
              count: partnerships.length,
              content: (
                <DataTable
                  screen="canales-marketplace-alianzas"
                  rows={partnerships}
                  getKey={(partnership) => partnership.id}
                  entityLabel="alianzas"
                  searchText={(partnership) => partnership.partner}
                  metrics={[
                    { id: "pendientes", label: "Por responder", tone: "sun", icon: <Handshake size={18} />, matches: (partnership) => partnership.actions.includes("aceptar") },
                    { id: "activas", label: "Activas", tone: "ok", icon: <Check size={18} />, matches: (partnership) => partnership.status === "activa" },
                  ]}
                  emptyTitle="Aún no hay alianzas"
                  columns={[
                    { id: "partner", header: "Agencia", mobile: "title", cell: (partnership) => <div><p className="font-semibold">{partnership.partner}</p><p className="text-[12px] text-fg-3">{partnership.role === "vendedor" ? "Vende tus productos" : "Tú vendes sus productos"}</p></div> },
                    { id: "terms", header: "Condiciones", cell: (partnership) => <span className="text-[13px] text-fg-2">{Number(partnership.commission_pct)} % de comisión · {partnership.payment_terms === "credito" ? `crédito ${partnership.credit_limit ? formatMoney(partnership.credit_limit) : ""}` : "prepago"}</span> },
                    { id: "requested", header: "Solicitada", wideOnly: true, cell: (partnership) => <span className="text-[12.5px] text-fg-3">{formatDateTime(partnership.requested_at)}</span> },
                    { id: "status", header: "Estado", cell: (partnership) => <StatusPill status={partnership.status} label={partnership.status_label} /> },
                    { id: "actions", header: "", align: "right", cell: (partnership) => <div className="flex flex-wrap justify-end gap-2">{partnership.actions.map((decision) => <DecideButton key={decision} partnership={partnership} decision={decision} />)}</div> },
                  ]}
                />
              ),
            },
            {
              id: "ventas",
              label: "Ventas y compras",
              count: orders.length,
              content: (
                <DataTable
                  screen="canales-marketplace-ventas"
                  rows={orders}
                  getKey={(order) => order.id}
                  entityLabel="ventas"
                  searchText={(order) => `${order.code} ${order.partner} ${order.listing.title}`}
                  metrics={[
                    { id: "venta", label: "Vendidas por aliados", tone: "ok", icon: <ArrowUpRight size={18} />, matches: (order) => order.role === "venta" },
                    { id: "compra", label: "Compradas a aliados", tone: "info", icon: <ArrowDownLeft size={18} />, matches: (order) => order.role === "compra" },
                  ]}
                  sorts={[{ id: "created", label: "Fecha", type: "date", value: (order) => order.created_at }]}
                  emptyTitle="Aún no hay ventas en el marketplace"
                  columns={[
                    { id: "code", header: "Venta", mobile: "title", cell: (order) => <div><p className="font-mono font-semibold">{order.code}</p><p className="text-[12px] text-fg-3">{order.listing.title}</p></div> },
                    { id: "partner", header: "Agencia", cell: (order) => <span className="text-[13px]">{order.role === "venta" ? "Vendió " : "Compraste a "}{order.partner}</span> },
                    { id: "gross", header: "Monto", align: "right", cell: (order) => <span className="text-[13px] font-semibold">{formatMoney(order.gross_amount, order.currency)}</span> },
                    { id: "commission", header: "Comisión · plataforma", align: "right", wideOnly: true, cell: (order) => <span className="text-[12.5px] text-fg-2">{formatMoney(order.commission_amount, order.currency)} · {formatMoney(order.platform_fee_amount, order.currency)}</span> },
                    { id: "status", header: "Estado", cell: (order) => <StatusPill status={order.status} label={order.status_label} /> },
                  ]}
                />
              ),
            },
          ]}
        />
      </section>
    </>
  );
}
