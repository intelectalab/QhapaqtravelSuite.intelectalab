"use client";

import { Calculator, Link2, RefreshCw, Unlink } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { associateSeason, changeMainProvider, dissociateSeason, quoteProductPrice, type PriceQuoteResult, type ProductActionState } from "@/app/(backoffice)/catalogo/productos/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import type { ProductDetail, ProductEditorState, ProductFormOptions, ProductOverview } from "@/lib/catalog";
import { capitalize, formatDate, formatDateTime, formatMoney } from "@/lib/format";

const initial: ProductActionState = { message: null, done: false };

type ProductRef = Pick<ProductDetail, "code" | "lock_version">;

function Hidden({ product, values = {} }: { product: ProductRef; values?: Record<string, string> }) {
  return (
    <>
      <input type="hidden" name="code" value={product.code} />
      <input type="hidden" name="lock_version" value={product.lock_version} />
      {Object.entries(values).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

export function MainProviderChangeAction({ product, options, current }: { product: ProductRef; options: ProductFormOptions; current: string | null }) {
  const router = useRouter();
  return (
    <PanelAction<ProductActionState>
      label="Cambiar principal"
      icon={<RefreshCw size={15} />}
      size="sm"
      formId={`main-provider-${product.code}`}
      title="Cambiar proveedor principal"
      description="Solo proveedores activos con contrato vigente. La identidad comercial del producto no cambia."
      submitLabel="Cambiar proveedor"
      action={changeMainProvider}
      initial={initial}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <Hidden product={product} />
          <SelectField label="Nuevo proveedor principal" name="main_provider_id" searchable defaultValue={current ?? ""} options={options.providers.map((provider) => ({ value: provider.id, label: provider.name, hint: [provider.type, provider.blocked].filter(Boolean).join(" · "), disabled: Boolean(provider.blocked) }))} placeholder="Elegir proveedor" />
          <TextArea label="Motivo" name="reason" rows={3} required minLength={3} maxLength={300} placeholder="Queda en el historial del producto." />
        </>
      )}
    </PanelAction>
  );
}

export function SeasonAssociateAction({ product, options, associated }: { product: ProductRef; options: ProductFormOptions; associated: string[] }) {
  const router = useRouter();
  const candidates = options.seasons.filter((season) => !associated.includes(season.id));
  return (
    <PanelAction<ProductActionState>
      label="Asociar temporada"
      icon={<Link2 size={15} />}
      size="sm"
      formId={`season-associate-${product.code}`}
      title="Asociar temporada"
      description="La temporada ajusta el precio del producto en las fechas que cubre."
      submitLabel="Asociar"
      action={associateSeason}
      initial={initial}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <Hidden product={product} />
          <SelectField label="Temporada" name="season_id" searchable options={candidates.map((season) => ({ value: season.id, label: season.name, hint: `${season.type} · prioridad ${season.priority}${season.status === "activa" ? "" : " · inactiva"}`, disabled: season.status !== "activa" }))} placeholder="Elegir temporada" />
        </>
      )}
    </PanelAction>
  );
}

export function SeasonDissociateAction({ product, season }: { product: ProductRef; season: { id: string; name: string } }) {
  const router = useRouter();
  return (
    <PanelAction<ProductActionState>
      label="Desasociar"
      formId={`season-dissociate-${product.code}-${season.id}`}
      trigger={(open) => <RowIcon tone="delete" label="Desasociar" icon={<Unlink size={15} />} onClick={open} />}
      title="Desasociar temporada"
      description={`${season.name} deja de ajustar el precio de este producto. La temporada sigue existiendo.`}
      submitLabel="Desasociar"
      action={dissociateSeason}
      initial={initial}
      onDone={() => router.refresh()}
    >
      {() => <Hidden product={product} values={{ season: season.id }} />}
    </PanelAction>
  );
}

type HistoryRow = NonNullable<ProductOverview["history"]>[number];

const SCOPE_LABEL: Record<HistoryRow["scope"], string> = { producto: "Producto", tarifa: "Tarifa", salida: "Salida" };

export function ProductHistoryTable({ rows, code }: { rows: HistoryRow[]; code: string }) {
  const columns: Column<HistoryRow>[] = [
    { id: "when", header: "Fecha", cell: (row) => <span className="font-mono text-[12.5px] text-fg-2">{formatDateTime(row.occurred_at)}</span> },
    { id: "scope", header: "Sobre", cell: (row) => <span className="text-[13px]"><Badge tone={row.scope === "producto" ? "accent" : row.scope === "tarifa" ? "violet" : "info"}>{SCOPE_LABEL[row.scope]}</Badge>{row.scope !== "producto" && <small className="ml-1.5 font-mono text-xs text-fg-3">{row.entity_id}</small>}</span> },
    { id: "action", header: "Acción", mobile: "title", cell: (row) => <b className="text-[13px] font-semibold">{capitalize(row.action.replace(/_/g, " "))}</b> },
    { id: "detail", header: "Detalle", className: "whitespace-normal", cell: (row) => <span className="block max-w-[460px] text-[13px]">{row.after_value ?? "—"}{row.before_value && <small className="block text-[12px] text-fg-3">Antes: {row.before_value}</small>}</span> },
    { id: "actor", header: "Autor", cell: (row) => <span className="text-[13px] text-fg-2">{row.actor ?? "Sistema"}</span> },
  ];
  const filters: FilterConfig<HistoryRow>[] = [
    { id: "scope", label: "Sobre", options: (Object.keys(SCOPE_LABEL) as HistoryRow["scope"][]).map((value) => ({ value, label: SCOPE_LABEL[value] })), value: (row) => row.scope },
    { id: "actor", label: "Autor", options: [...new Set(rows.map((row) => row.actor ?? "Sistema"))].map((value) => ({ value, label: value })), value: (row) => row.actor ?? "Sistema" },
  ];
  return (
    <DataTable
      screen="producto-historial"
      rows={rows}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="cambios"
      searchText={(row) => `${row.action} ${row.after_value ?? ""} ${row.before_value ?? ""} ${row.actor ?? ""} ${row.entity_id}`}
      searchPlaceholder="Buscar en el historial"
      filters={filters}
      emptyTitle="Sin cambios registrados"
      csv={{
        fileName: `historial-${code}`,
        columns: [
          { header: "Fecha", value: (row) => row.occurred_at },
          { header: "Sobre", value: (row) => SCOPE_LABEL[row.scope] },
          { header: "Código", value: (row) => row.entity_id },
          { header: "Acción", value: (row) => row.action },
          { header: "Detalle", value: (row) => row.after_value },
          { header: "Antes", value: (row) => row.before_value },
          { header: "Autor", value: (row) => row.actor ?? "Sistema" },
        ],
      }}
    />
  );
}

export function PriceConfigurator({ code, editor, groups, today }: { code: string; editor: ProductEditorState; groups: ProductOverview["config_groups"]; today: string }) {
  const rates = editor.rates.filter((rate) => rate.state === "vigente" && rate.ref);
  const [rate, setRate] = useState(rates[0]?.ref ?? "");
  const [choices, setChoices] = useState<Record<string, string>>(() => Object.fromEntries(groups.map((group) => [group.name, group.options[0]?.label ?? ""])));
  const [pax, setPax] = useState("1");
  const [date, setDate] = useState(today);
  const [result, setResult] = useState<PriceQuoteResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (rates.length === 0) return <p className="text-[13px] text-fg-3">Sin tarifas vigentes: no se puede calcular el precio con opciones.</p>;
  const calculate = () =>
    start(async () => {
      const response = await quoteProductPrice(code, rate, Object.fromEntries(Object.entries(choices).filter(([, value]) => value !== "")), Math.max(1, Number(pax) || 1), date);
      setResult(response.data);
      setMessage(response.message);
    });
  return (
    <section className="mt-5 border-t border-line-2 pt-4">
      <p className="mb-3 flex items-center gap-2 text-[13.5px] font-semibold"><Calculator size={16} className="text-accent" />Configurador de precio</p>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <SelectField label="Tarifa base" name="quote_rate" value={rate} onChange={setRate} options={rates.map((row) => ({ value: row.ref ?? "", label: `${row.segment} · ${row.channel}`, hint: `${row.ref} · ${formatMoney(row.price, row.currency)}` }))} />
        {groups.map((group) => (
          <SelectField key={group.name} label={group.name} name={`quote_${group.name}`} value={choices[group.name] ?? ""} onChange={(value) => setChoices({ ...choices, [group.name]: value })} options={group.options.map((option) => ({ value: option.label, label: option.label, hint: Number(option.price_delta) === 0 ? "sin ajuste" : formatMoney(option.price_delta) }))} />
        ))}
        <TextField label="Pasajeros" name="quote_pax" type="number" min={1} max={500} value={pax} onChange={(event) => setPax(event.target.value)} />
        <TextField label="Fecha" name="quote_date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <Button type="button" variant="primary" size="sm" onClick={calculate} disabled={pending}>{pending ? "Calculando" : "Calcular precio"}</Button>
        {message && <p className="text-[13px] text-bad">{message}</p>}
      </div>
      {result && (
        <div className="mt-4 grid gap-3 sm:grid-cols-3 motion-safe:animate-[rise-in_320ms_ease-out]">
          <div className="lift rounded-tile border border-line px-4 py-3">
            <p className="text-[12px] text-fg-3">Tarifa base</p>
            <p className="font-mono text-[16px] font-semibold">{formatMoney(result.base_price, result.currency)}</p>
            <p className="text-[12px] text-fg-3">{result.rate.ref} · {formatDate(result.date)}</p>
          </div>
          <div className="lift rounded-tile border border-line px-4 py-3">
            <p className="text-[12px] text-fg-3">Opciones elegidas</p>
            <p className="font-mono text-[16px] font-semibold">{Number(result.options_delta) >= 0 ? "+" : ""}{formatMoney(result.options_delta, result.currency)}</p>
            <p className="truncate text-[12px] text-fg-3" title={result.selections.map((item) => `${item.group}: ${item.option}`).join(" · ")}>{result.selections.map((item) => item.option).join(" · ") || "Ninguna"}</p>
          </div>
          <div className="lift rounded-tile border border-accent/40 bg-[color-mix(in_srgb,var(--accent)_7%,var(--surface))] px-4 py-3">
            <p className="text-[12px] text-fg-3">Por pasajero · total de {result.pax}</p>
            <p className="font-mono text-[16px] font-semibold text-accent">{formatMoney(result.unit_price, result.currency)}</p>
            <p className="font-mono text-[12.5px] font-semibold">{formatMoney(result.total, result.currency)}</p>
          </div>
        </div>
      )}
    </section>
  );
}
