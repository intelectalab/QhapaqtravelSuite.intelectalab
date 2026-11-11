"use client";

import { CircleCheck, CircleX, Clock3, Eye, EyeOff, Gauge, Globe, Send, ShoppingBag, ShoppingCart, Star, Wallet } from "lucide-react";
import { cancelOrder, sendPaymentLink, togglePublication } from "@/app/(backoffice)/canales/ecommerce/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Card } from "@/components/ui/Card";
import { FieldList } from "@/components/ui/Details";
import { PanelAction } from "@/components/ui/PanelAction";
import { Tabs } from "@/components/ui/Tabs";
import { TextArea } from "@/components/ui/TextArea";
import { TintTile } from "@/components/ui/Tinted";
import { channelStatus, type EcommerceOverview, type EcomOrder, type EcomProduct, type PromotionCatalog } from "@/lib/channels";
import { formatDateTime, formatMoney, formatNumber, formatPercent } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { toneStyle, type Tone } from "@/lib/tone";
import { ChannelBadge, DetailPanel, MoneyLines, PanelSection, Stars, TileGrid } from "./ChannelUi";
import { PromotionsTable } from "./Promotions";

const initial: StepResult = { message: null, done: false };

export function EcommerceTiles({ kpis }: { kpis: EcommerceOverview["kpis"] }) {
  return (
    <TileGrid>
      <TintTile icon={ShoppingCart} tone="t1" label="Pedidos web" value={formatNumber(kpis.orders)} note={`${kpis.pending} con pago pendiente`} />
      <TintTile icon={Wallet} tone="t4" label="Ingresos confirmados" value={<MoneyLines values={kpis.revenue} />} note={`${kpis.confirmed} pedidos pagados`} />
      <TintTile icon={Gauge} tone="violet" label="Conversión" value={formatPercent(kpis.conversion, 0)} note="Pedidos pagados sobre creados" />
      <TintTile icon={Globe} tone="sun" label="Productos publicados" value={formatNumber(kpis.published)} note={kpis.rejected > 0 ? `${kpis.rejected} pagos rechazados por revisar` : "Sin pagos rechazados"} />
    </TileGrid>
  );
}

const FUNNEL_TONES: Tone[] = ["t1", "violet", "t4", "ok"];

export function EcommerceFunnel({ steps }: { steps: EcommerceOverview["funnel"] }) {
  const max = Math.max(...steps.map((step) => step.value), 1);
  return (
    <ol className="grid gap-2.5 md:grid-cols-4">
      {steps.map((step, index) => {
        const previous = index > 0 ? steps[index - 1].value : null;
        const rate = previous ? (step.value / previous) * 100 : null;
        return (
          <li key={step.id} style={{ ...toneStyle(FUNNEL_TONES[index % FUNNEL_TONES.length]), animationDelay: `${index * 80}ms` }} className="lift group animate-[rise-in_420ms_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-tile border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] bg-[color-mix(in_srgb,var(--tint)_6%,var(--surface))] p-3.5" title={rate !== null ? `${formatPercent(rate, 0)} respecto del paso anterior` : undefined}>
            <p className="text-[12.5px] font-semibold text-[var(--tint)]">{step.label}</p>
            <p className="mt-1 text-[24px] font-bold leading-none tracking-tight">{formatNumber(step.value)}</p>
            <span className="mt-3 block h-2 overflow-hidden rounded-full bg-surface-2">
              <span className="block h-full origin-left rounded-full bg-[var(--tint)] transition-[filter] duration-300 group-hover:brightness-110 motion-safe:animate-[fill-x_800ms_cubic-bezier(0.22,1,0.36,1)_backwards]" style={{ width: `${Math.max(4, (step.value / max) * 100)}%` }} />
            </span>
            <p className="mt-1.5 text-[11.5px] text-fg-3">{rate !== null ? `${formatPercent(rate, 0)} del paso anterior` : "Punto de partida"}</p>
          </li>
        );
      })}
    </ol>
  );
}

function CancelOrderAction({ order }: { order: EcomOrder }) {
  return (
    <PanelAction<StepResult>
      label="Anular"
      formId={`order-cancel-${order.code}`}
      title="Anular pedido"
      description={`${order.code} · ${order.customer}. Se liberan los cupos y la reserva asociada queda cancelada.`}
      submitLabel="Anular pedido"
      action={cancelOrder}
      initial={initial}
      trigger={(open) => <RowIcon tone="delete" label="Anular pedido" icon={<CircleX size={15} />} onClick={open} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={order.code} />
          <input type="hidden" name="lock_version" value={order.lock_version} />
          <TextArea label="Motivo" name="reason" rows={3} required minLength={3} maxLength={200} placeholder="Por ejemplo: el cliente pidió cambiar de fecha." />
        </>
      )}
    </PanelAction>
  );
}

const METHOD_LABEL: Record<string, string> = { tarjeta: "Tarjeta", transferencia: "Transferencia", yape: "Yape", plin: "Plin" };

const ATTEMPT_TONE: Record<string, Tone> = { aprobado: "ok", rechazado: "bad", por_validar: "info" };

const ATTEMPT_LABEL: Record<string, string> = { aprobado: "Aprobado", rechazado: "Rechazado", por_validar: "Por validar" };

function SendLinkAction({ order }: { order: EcomOrder }) {
  return (
    <PanelAction<StepResult>
      label="Enviar enlace de pago"
      formId={`order-link-${order.code}`}
      title="Enviar enlace de pago"
      description={`${order.code} · se envía a ${order.email}. Vence en 3 días y abre el pedido para pagar con tarjeta, transferencia, Yape o Plin.`}
      submitLabel="Enviar enlace"
      action={sendPaymentLink}
      initial={initial}
      trigger={(open) => <RowIcon tone="view" label="Enviar enlace de pago" icon={<Send size={15} />} onClick={open} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={order.code} />
          <TextArea label="Nota para el cliente" name="note" rows={3} maxLength={300} hint="Opcional. Va en el correo antes del enlace." placeholder="Por ejemplo: tu tarjeta fue rechazada; puedes intentar con otra o con Yape." />
        </>
      )}
    </PanelAction>
  );
}

function AttemptList({ order }: { order: EcomOrder }) {
  if (order.attempts.length === 0) return <p className="text-[13px] text-fg-3">El cliente aún no intentó pagar.</p>;
  return (
    <ol className="grid gap-2">
      {order.attempts.map((attempt, index) => (
        <li key={`${attempt.at}-${index}`} style={toneStyle(ATTEMPT_TONE[attempt.result] ?? "mute")} className="rounded-tile border border-[color-mix(in_srgb,var(--tint)_25%,transparent)] bg-[color-mix(in_srgb,var(--tint)_6%,var(--surface))] px-3 py-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <b className="font-semibold text-[var(--tint)]">{ATTEMPT_LABEL[attempt.result] ?? attempt.result}</b>
            <span className="text-[12px] text-fg-3">{formatDateTime(attempt.at)}</span>
          </div>
          <p className="mt-0.5 text-[12.5px] text-fg-2">
            {METHOD_LABEL[attempt.method] ?? attempt.method}
            {attempt.card ? ` ${attempt.card}` : ""}
            {attempt.operation ? ` · operación ${attempt.operation}` : ""}
            {attempt.amount !== null ? ` · ${formatMoney(attempt.amount, attempt.currency ?? order.currency)}` : ""}
            {attempt.code && attempt.result === "rechazado" ? ` · código ${attempt.code}` : ""}
          </p>
          {attempt.message && attempt.result !== "aprobado" && <p className="mt-0.5 text-[12px] text-fg-3">{attempt.message}</p>}
        </li>
      ))}
    </ol>
  );
}

function OrderDetail({ order }: { order: EcomOrder }) {
  return (
    <DetailPanel label="Ver pedido" title={order.code} description={`${order.customer} · ${formatDateTime(order.ordered_at)}`}>
      <ChannelBadge status={order.status} />
      <PanelSection title="Compra">
        <FieldList
          fields={[
            { label: "Producto", value: order.product?.name ?? "—" },
            { label: "Pasajeros", value: order.pax },
            { label: "Total", value: formatMoney(order.total, order.currency) },
            { label: "Código promocional", value: order.promo_code ?? "Sin código" },
            { label: "Reserva", value: order.reservation ?? "Se crea al confirmar el pago" },
          ]}
        />
      </PanelSection>
      <PanelSection title="Comprador">
        <FieldList fields={[{ label: "Correo", value: order.email }, { label: "País", value: order.country ?? "—" }]} />
      </PanelSection>
      <PanelSection title={`Intentos de pago (${order.attempts.length})`}>
        <AttemptList order={order} />
      </PanelSection>
      {order.links.length > 0 && (
        <PanelSection title="Enlaces de pago enviados">
          <ul className="grid gap-1 text-[12.5px] text-fg-2">
            {order.links.map((link) => (
              <li key={link.at}>
                {formatDateTime(link.at)} · {link.detail}
              </li>
            ))}
          </ul>
        </PanelSection>
      )}
      {order.cancel_reason && (
        <PanelSection title="Anulación">
          <p className="text-[13px] text-fg-2">{order.cancel_reason}</p>
        </PanelSection>
      )}
    </DetailPanel>
  );
}

function OrdersTable({ rows, canManage }: { rows: EcomOrder[]; canManage: boolean }) {
  const columns: Column<EcomOrder>[] = [
    {
      id: "order",
      header: "Pedido",
      mobile: "title",
      cell: (row) => (
        <span className="flex flex-col">
          <b className="text-[13.5px] font-semibold">{row.customer}</b>
          <span className="text-[12px] text-fg-3">{row.code} · {formatDateTime(row.ordered_at)}</span>
        </span>
      ),
    },
    { id: "product", header: "Producto", cell: (row) => <span className="text-[13px]">{row.product?.name ?? "—"}</span> },
    { id: "pax", header: "Pax", align: "right", wideOnly: true, cell: (row) => <span className="font-mono text-[13px]">{row.pax}</span> },
    { id: "total", header: "Total", align: "right", cell: (row) => <b className="text-[13.5px] font-semibold">{formatMoney(row.total, row.currency)}</b> },
    { id: "status", header: "Estado", mobile: "detail", cell: (row) => <ChannelBadge status={row.status} /> },
    {
      id: "actions",
      header: "",
      cell: (row) => (
        <RowActions>
          <OrderDetail order={row} />
          {canManage && (row.can_send_link ? <SendLinkAction order={row} /> : <RowIcon tone="view" label="Enviar enlace de pago" icon={<Send size={15} />} disabledHint="Solo para pedidos con pago pendiente o rechazado" />)}
          {canManage && (row.can_cancel ? <CancelOrderAction order={row} /> : <RowIcon tone="delete" label="Anular" icon={<CircleX size={15} />} disabledHint="Solo se anulan pedidos con pago pendiente o rechazado" />)}
        </RowActions>
      ),
    },
  ];
  const metrics: MetricFilter<EcomOrder>[] = [
    { id: "paid", label: "Pagados", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.status === "confirmado" },
    { id: "pending", label: "Pago pendiente", tone: "warn", icon: <Clock3 size={19} />, matches: (row) => row.status === "pago_pendiente" || row.status === "pago_por_validar" },
    { id: "rejected", label: "Pago rechazado", tone: "bad", icon: <CircleX size={19} />, matches: (row) => row.status === "pago_rechazado" },
  ];
  const filters: FilterConfig<EcomOrder>[] = [
    { id: "status", label: "Estado", options: [...new Set(rows.map((row) => row.status))].map((value) => ({ value, label: channelStatus(value).label })), value: (row) => row.status },
    { id: "currency", label: "Moneda", options: [...new Set(rows.map((row) => row.currency))].map((value) => ({ value, label: value })), value: (row) => row.currency },
  ];
  const sorts: SortOption<EcomOrder>[] = [
    { id: "date", label: "Fecha", type: "date", value: (row) => row.ordered_at },
    { id: "total", label: "Total", type: "number", value: (row) => row.total },
  ];
  return <DataTable screen="canales-ecommerce-pedidos" rows={rows} columns={columns} getKey={(row) => row.code} entityLabel="pedidos" searchText={(row) => `${row.code} ${row.customer} ${row.email} ${row.product?.name ?? ""}`} searchPlaceholder="Buscar pedido, cliente o producto" metrics={metrics} filters={filters} sorts={sorts} emptyTitle="Sin pedidos web" />;
}

function PublicationAction({ product }: { product: EcomProduct }) {
  const publish = !product.published;
  return (
    <PanelAction<StepResult>
      label={publish ? "Publicar" : "Despublicar"}
      formId={`publish-${product.code}`}
      title={publish ? "Publicar en la tienda" : "Retirar de la tienda"}
      description={publish ? `${product.name} aparecerá en el sitio web y en el widget de reservas.` : `${product.name} dejará de venderse en línea. Los pedidos existentes no cambian.`}
      submitLabel={publish ? "Publicar" : "Retirar"}
      action={togglePublication}
      initial={initial}
      trigger={(open) => (product.status !== "ACTIVE" && publish ? <RowIcon tone="neutral" label="Publicar" icon={<Eye size={15} />} disabledHint="Solo se publican productos activos" /> : <RowIcon tone={publish ? "view" : "delete"} label={publish ? "Publicar" : "Despublicar"} icon={publish ? <Eye size={15} /> : <EyeOff size={15} />} onClick={open} />)}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={product.code} />
          <input type="hidden" name="published" value={publish ? "1" : "0"} />
        </>
      )}
    </PanelAction>
  );
}

function ProductsTable({ rows, canManage }: { rows: EcomProduct[]; canManage: boolean }) {
  const columns: Column<EcomProduct>[] = [
    {
      id: "product",
      header: "Producto",
      mobile: "title",
      cell: (row) => (
        <span className="flex flex-col">
          <a href={`/catalogo/productos/${row.code}`} className="text-[13.5px] font-semibold hover:text-accent">{row.name}</a>
          <span className="text-[12px] text-fg-3">{row.code}{row.featured ? " · Destacado" : ""}</span>
        </span>
      ),
    },
    { id: "rating", header: "Calificación", wideOnly: true, cell: (row) => (row.rating ? <span className="flex items-center gap-1.5"><Stars value={row.rating} size={12} /><span className="text-[12px] text-fg-3">({row.rating_count})</span></span> : <span className="text-[12.5px] text-fg-3">Sin reseñas</span>) },
    { id: "orders", header: "Pedidos", align: "right", cell: (row) => <span className="font-mono text-[13px]">{row.orders}</span> },
    { id: "sales", header: "Vendido", align: "right", cell: (row) => <span className="text-[13px] font-semibold"><MoneyLines values={row.sales} /></span> },
    { id: "published", header: "Tienda", mobile: "detail", cell: (row) => <ChannelBadge status={row.published ? "publicado" : "despublicado"} label={row.published ? "Publicado" : "No publicado"} /> },
    { id: "actions", header: "", cell: (row) => <RowActions>{canManage && <PublicationAction product={row} />}</RowActions> },
  ];
  const metrics: MetricFilter<EcomProduct>[] = [
    { id: "on", label: "Publicados", tone: "ok", icon: <Globe size={19} />, matches: (row) => row.published },
    { id: "off", label: "Sin publicar", tone: "mute", icon: <EyeOff size={19} />, matches: (row) => !row.published },
    { id: "selling", label: "Con ventas", tone: "t4", icon: <ShoppingBag size={19} />, matches: (row) => row.orders > 0 },
    { id: "rated", label: "Con reseñas", tone: "sun", icon: <Star size={19} />, matches: (row) => row.rating_count > 0 },
  ];
  const sorts: SortOption<EcomProduct>[] = [
    { id: "name", label: "Producto", value: (row) => row.name },
    { id: "orders", label: "Pedidos", type: "number", value: (row) => row.orders },
  ];
  return <DataTable screen="canales-ecommerce-productos" rows={rows} columns={columns} getKey={(row) => row.code} entityLabel="productos" searchText={(row) => `${row.code} ${row.name}`} searchPlaceholder="Buscar producto" metrics={metrics} sorts={sorts} />;
}

export function EcommerceWorkspace({ overview, promotions }: { overview: EcommerceOverview; promotions: PromotionCatalog | null }) {
  return (
    <Card padded={false}>
      <Tabs
        tabs={[
          { id: "orders", label: "Pedidos web", count: overview.orders.length, content: <OrdersTable rows={overview.orders} canManage={overview.can_manage} /> },
          { id: "products", label: "Productos en la tienda", count: overview.products.length, content: <ProductsTable rows={overview.products} canManage={overview.can_manage} /> },
          ...(promotions ? [{ id: "promotions", label: "Promociones y códigos", count: promotions.rows.filter((row) => row.state === "vigente").length, content: <PromotionsTable catalog={promotions} canManage={overview.can_manage} screen="canales-ecommerce-promociones" /> }] : []),
        ]}
      />
    </Card>
  );
}
