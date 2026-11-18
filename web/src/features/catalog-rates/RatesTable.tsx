"use client";

import { CalendarClock, CircleCheck, CircleSlash, History, Hourglass, Percent } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { FieldList } from "@/components/ui/Details";
import { DetailPanel, NameButton } from "@/features/catalog-shared/CatalogPanels";
import { PRODUCT_STATUS } from "@/lib/catalog";
import { daysBetween, RATE_STATE, type RateRow, type RatesOverview } from "@/lib/catalog-rates";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { RateEditAction, RateToggleAction } from "./RateForms";

const unique = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "es")).map((value) => ({ value, label: value }));

const money = (value: string | null, currency: string) => (value === null ? "—" : formatMoney(Number(value), currency));

function RateDetail({ rate, overview, trigger }: { rate: RateRow; overview: RatesOverview; trigger?: (open: () => void) => ReactNode }) {
  const fields = [
    { label: "Producto", value: <Link href={`/catalogo/productos/${rate.product.code}`} className="font-semibold text-accent hover:underline">{rate.product.name}</Link> },
    { label: "Tipo", value: rate.type },
    { label: "Segmento", value: rate.segment },
    { label: "Canal", value: rate.channel },
    { label: "Se cobra", value: rate.basis.toLowerCase() },
    { label: "Precio", value: <b className="font-mono">{money(rate.price, rate.currency)}</b> },
    ...((rate.alt_prices ?? []).length > 0 ? [{ label: "En otras monedas", value: <span className="font-mono">{(rate.alt_prices ?? []).map((alt) => money(alt.price, alt.currency)).join(" · ")}</span> }] : []),
    ...(overview.can.see_cost ? [{ label: "Costo", value: <span className="font-mono">{money(rate.cost, rate.currency)}</span> }] : []),
    ...(rate.margin_pct !== null ? [{ label: "Margen", value: `${rate.margin_pct.toFixed(1)} %` }] : []),
    ...(rate.min_price || rate.max_price ? [{ label: "Rango permitido", value: `${money(rate.min_price, rate.currency)} a ${money(rate.max_price, rate.currency)}` }] : []),
    { label: "Vigencia", value: `${formatDate(rate.valid_from)} – ${formatDate(rate.valid_to)}` },
    { label: "Temporada", value: rate.season?.name ?? "Tarifa base" },
    { label: "Estado", value: <Badge tone={RATE_STATE[rate.state].tone}>{RATE_STATE[rate.state].label}</Badge> },
  ];
  return (
    <DetailPanel title={`${rate.type} · ${rate.segment}`} description={`${rate.ref} · ${rate.product.name}`} trigger={trigger}>
      <FieldList fields={fields} />
      {rate.conditions && <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[13px] text-fg-2">{rate.conditions}</p>}
    </DetailPanel>
  );
}

export function RatesTable({ overview }: { overview: RatesOverview }) {
  const { can } = overview;
  const columns: Column<RateRow>[] = [
    {
      id: "rate",
      header: "Tarifa",
      mobile: "title",
      cell: (rate) => (
        <span className="flex min-w-0 flex-col items-start gap-1">
          <RateDetail rate={rate} overview={overview} trigger={(open) => <NameButton onClick={open} hint={`${rate.ref} · ${rate.type}`}>{rate.product.name}</NameButton>} />
          {rate.product.status && <Badge tone={PRODUCT_STATUS[rate.product.status].tone}>{PRODUCT_STATUS[rate.product.status].label}</Badge>}
        </span>
      ),
    },
    { id: "audience", header: "Segmento y canal", cell: (rate) => <span className="text-[13px]">{rate.segment} <span className="text-fg-3">· {rate.channel}</span></span> },
    {
      id: "price",
      header: "Precio",
      align: "right",
      cell: (rate) => (
        <span className="block text-right">
          <b className="font-mono text-[13.5px] font-semibold">{money(rate.price, rate.currency)}</b>
          {(rate.alt_prices ?? []).map((alt) => (
            <small key={alt.currency} className="block font-mono text-[11.5px] text-fg-2">
              {money(alt.price, alt.currency)}
            </small>
          ))}
          {can.see_cost && <small className="block font-mono text-[11.5px] text-fg-3">costo {money(rate.cost, rate.currency)}</small>}
        </span>
      ),
    },
    ...(can.see_margin
      ? [
          {
            id: "margin",
            header: "Margen",
            align: "right" as const,
            cell: (rate: RateRow) =>
              rate.margin_pct === null ? "—" : <span className={cn("font-mono text-[13px] font-semibold", rate.margin_pct < 0 ? "text-bad" : rate.margin_pct < 15 ? "text-warn" : "text-ok")}>{rate.margin_pct.toFixed(1)} %</span>,
          },
        ]
      : []),
    {
      id: "validity",
      header: "Vigencia",
      wideOnly: true,
      cell: (rate) => (
        <span className="text-[13px]">
          {formatDate(rate.valid_from)} – {formatDate(rate.valid_to)}
          <small className="block text-xs text-fg-3">{rate.season?.name ?? "Tarifa base"}</small>
        </span>
      ),
    },
    { id: "state", header: "Estado", cell: (rate) => <Badge tone={RATE_STATE[rate.state].tone}>{RATE_STATE[rate.state].label}</Badge> },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (rate) => (
        <RowActions>
          <RateDetail rate={rate} overview={overview} />
          {can.manage && <RateEditAction overview={overview} rate={rate} />}
          {can.manage && <RateToggleAction rate={rate} />}
        </RowActions>
      ),
    },
  ];
  const live = overview.rates.filter((rate) => rate.state === "vigente");
  const expiringSoon = (rate: RateRow) => rate.state === "vigente" && daysBetween(overview.today, rate.valid_to) <= 30;
  const firstExpiry = live.filter(expiringSoon).map((rate) => rate.valid_to).sort()[0];
  const products = new Set(live.map((rate) => rate.product.id)).size;
  const margins = live.map((rate) => rate.margin_pct).filter((value): value is number => value !== null);
  const average = margins.length ? margins.reduce((sum, value) => sum + value, 0) / margins.length : null;
  const metrics: MetricFilter<RateRow>[] = [
    { id: "vigente", label: "Vigentes", tone: "ok", icon: <CircleCheck size={19} />, note: `${products} productos cotizables · ${Math.max(0, overview.options.products.length - products)} sin tarifa`, info: <p>Tarifas activas cuya vigencia incluye hoy: son las únicas que se pueden elegir al cotizar o reservar. La nota cuenta los productos con al menos una y los que no tienen ninguna, que no se pueden cotizar. Al presionarla, la tabla muestra solo las vigentes.</p>, matches: (rate) => rate.state === "vigente" },
    { id: "por-vencer", label: "Vencen en 30 días", tone: "sun", icon: <Hourglass size={19} />, note: firstExpiry ? `La primera, ${formatDate(firstExpiry)}` : "Nada por renovar", info: <p>Tarifas vigentes cuya vigencia termina en los próximos 30 días. Al presionarla, la tabla muestra esas tarifas para renovarlas a tiempo.</p>, matches: expiringSoon },
    { id: "programada", label: "Programadas", tone: "info", icon: <CalendarClock size={19} />, info: <p>Tarifas activas cuya vigencia empieza más adelante. Al presionarla, la tabla muestra esas tarifas.</p>, matches: (rate) => rate.state === "programada" },
    { id: "vencida", label: "Vencidas", tone: "bad", icon: <History size={19} />, note: "No se pueden elegir al cotizar", info: <p>Tarifas activas cuya vigencia ya terminó. No se pueden elegir al cotizar ni reservar; renuévalas o inactívalas. Al presionarla, la tabla muestra esas tarifas.</p>, matches: (rate) => rate.state === "vencida" },
    average !== null
      ? { id: "margen", label: "Margen promedio", tone: "violet", icon: <Percent size={19} />, display: `${average.toFixed(1)} %`, note: "Sobre tarifas vigentes", info: <p>Promedio simple de (venta − costo) / venta en las tarifas vigentes. Solo lo ve quien tiene acceso a la rentabilidad. Al presionarla, la tabla muestra las tarifas vigentes con margen.</p>, matches: (rate) => rate.state === "vigente" && rate.margin_pct !== null }
      : { id: "inactiva", label: "Inactivas", tone: "mute", icon: <CircleSlash size={19} />, info: <p>Tarifas que se desactivaron a mano y no se usan en ninguna fecha. Al presionarla, la tabla muestra esas tarifas.</p>, matches: (rate) => rate.state === "inactiva" },
  ];
  const filters: FilterConfig<RateRow>[] = [
    { id: "product", label: "Producto", options: unique(overview.rates.map((rate) => rate.product.name)), value: (rate) => rate.product.name },
    { id: "channel", label: "Canal", options: unique(overview.rates.map((rate) => rate.channel)), value: (rate) => rate.channel },
    { id: "state", label: "Estado", options: Object.entries(RATE_STATE).map(([value, item]) => ({ value, label: item.label })), value: (rate) => rate.state },
    { id: "type", label: "Tipo", options: unique(overview.rates.map((rate) => rate.type)), value: (rate) => rate.type },
    { id: "currency", label: "Moneda", options: unique(overview.rates.map((rate) => rate.currency)), value: (rate) => rate.currency },
  ];
  const sorts: SortOption<RateRow>[] = [
    { id: "product", label: "Producto", type: "text", value: (rate) => rate.product.name },
    { id: "price", label: "Precio", type: "number", value: (rate) => Number(rate.price) },
    ...(can.see_margin ? [{ id: "margin", label: "Margen", type: "number" as const, value: (rate: RateRow) => rate.margin_pct }] : []),
    { id: "valid_to", label: "Vence", type: "date", value: (rate) => rate.valid_to },
  ];

  return (
    <DataTable
      screen="tarifas"
      rows={overview.rates}
      columns={columns}
      getKey={(rate) => rate.ref}
      entityLabel="tarifas"
      searchText={(rate) => `${rate.ref} ${rate.product.name} ${rate.product.code} ${rate.type} ${rate.segment} ${rate.channel} ${rate.season?.name ?? ""}`}
      searchPlaceholder="Buscar producto, código o temporada"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
      csv={{
        fileName: "tarifas",
        columns: [
          { header: "Tarifa", value: (rate) => rate.ref },
          { header: "Producto", value: (rate) => rate.product.name },
          { header: "Código del producto", value: (rate) => rate.product.code },
          { header: "Tipo", value: (rate) => rate.type },
          { header: "Segmento", value: (rate) => rate.segment },
          { header: "Canal", value: (rate) => rate.channel },
          { header: "Moneda", value: (rate) => rate.currency },
          { header: "Se cobra", value: (rate) => rate.basis },
          ...(can.see_cost ? [{ header: "Costo", value: (rate: RateRow) => rate.cost }] : []),
          { header: "Precio", value: (rate) => rate.price },
          ...(can.see_margin ? [{ header: "Margen %", value: (rate: RateRow) => rate.margin_pct }] : []),
          { header: "Vigente desde", value: (rate) => rate.valid_from },
          { header: "Vigente hasta", value: (rate) => rate.valid_to },
          { header: "Temporada", value: (rate) => rate.season?.name },
          { header: "Estado", value: (rate) => RATE_STATE[rate.state].label },
        ],
      }}
    />
  );
}
