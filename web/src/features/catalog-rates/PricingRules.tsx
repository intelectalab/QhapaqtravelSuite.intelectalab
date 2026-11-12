"use client";

import { Calculator, CircleCheck, CirclePause, Plus, Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { createPriceRule, deletePriceRule, simulatePrice, togglePriceRule, updatePriceRule } from "@/app/(backoffice)/catalogo/tarifas/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { FieldList } from "@/components/ui/Details";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SidePanel } from "@/components/ui/SidePanel";
import { TextField } from "@/components/ui/TextField";
import { ConfirmAction, HiddenFields, PanelSection, STEP_INITIAL } from "@/features/catalog-shared/CatalogPanels";
import { RESIDENCY_LABEL, ruleValue, type PriceRule, type PricingOverview, type PricingResult } from "@/lib/catalog-pricing";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";

const addDays = (iso: string, days: number) => {
  const date = new Date(`${iso}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

function conditions(rule: PriceRule): string[] {
  return [rule.channel ? `Canal ${rule.channel}` : null, rule.min_pax ? `${rule.min_pax}+ pax` : null, rule.residency ? RESIDENCY_LABEL[rule.residency] : null, rule.product ? rule.product.name : null, rule.currency].filter((item): item is string => Boolean(item));
}

function RuleFields({ overview, rule }: { overview: PricingOverview; rule?: PriceRule }) {
  const { options } = overview;
  return (
    <>
      <PanelSection title="Regla">
        <TextField label="Nombre" name="name" required minLength={3} maxLength={120} defaultValue={rule?.name} />
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Tipo" name="kind" defaultValue={rule?.kind ?? "Markup %"} options={options.kinds.map((kind) => ({ value: kind, label: kind }))} />
          <TextField label="Valor" name="value" type="number" step="0.0001" min={0} required defaultValue={rule?.value} />
        </div>
        <TextField label="Cuándo aplica" name="scope" required minLength={3} maxLength={200} defaultValue={rule?.scope} placeholder="Por ejemplo: canal corporativo con 30 días de anticipación" />
        <TextField label="Prioridad" name="priority" type="number" min={1} max={999} defaultValue={rule?.priority ?? 100} hint="Si dos reglas del mismo tipo aplican, gana la de número menor." />
      </PanelSection>
      <PanelSection title="Condiciones">
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Canal" name="channel" clearable defaultValue={rule?.channel ?? ""} options={options.channels.map((channel) => ({ value: channel, label: channel }))} placeholder="Todos" />
          <TextField label="Desde cuántos pasajeros" name="min_pax" type="number" min={1} max={500} defaultValue={rule?.min_pax ?? undefined} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Cliente" name="residency" clearable defaultValue={rule?.residency ?? ""} options={Object.entries(RESIDENCY_LABEL).map(([value, label]) => ({ value, label }))} placeholder="Cualquiera" />
          <SelectField label="Moneda" name="currency" clearable defaultValue={rule?.currency ?? ""} options={options.currencies.map((currency) => ({ value: currency, label: currency }))} placeholder="Cualquiera" />
        </div>
        <SelectField label="Producto" name="product_id" clearable searchable defaultValue={rule?.product?.id ?? ""} options={options.products.map((product) => ({ value: product.id, label: product.name, hint: product.code }))} placeholder="Todos los productos" />
      </PanelSection>
    </>
  );
}

function RuleCreateAction({ overview }: { overview: PricingOverview }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult> label="Nueva regla" icon={<Plus size={16} />} formId="price-rule-create" title="Nueva regla de pricing" description="Se aplica en el cálculo del precio cuando se cumplen sus condiciones." submitLabel="Crear regla" action={createPriceRule} initial={STEP_INITIAL} onDone={() => router.refresh()}>
      {() => <RuleFields overview={overview} />}
    </PanelAction>
  );
}

function RuleEditAction({ overview, rule }: { overview: PricingOverview; rule: PriceRule }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult> label="Editar" formId={`price-rule-${rule.ref}`} trigger={(open) => <RowIcon tone="edit" label="Editar" onClick={open} />} title="Editar regla" description={`${rule.ref} · ${rule.name}`} submitLabel="Guardar cambios" action={updatePriceRule} initial={STEP_INITIAL} onDone={() => router.refresh()}>
      {() => (
        <>
          <HiddenFields values={{ ref: rule.ref }} />
          <RuleFields overview={overview} rule={rule} />
        </>
      )}
    </PanelAction>
  );
}

export function ResultView({ result }: { result: PricingResult }) {
  const money = (value: number) => formatMoney(value, result.currency);
  return (
    <div className="flex flex-col gap-4">
      {!result.rate.in_range && <p className="rounded-xl bg-[color-mix(in_srgb,var(--bad)_10%,var(--surface))] px-3.5 py-2.5 text-[13px] text-bad">La fecha está fuera de la vigencia de {result.rate.ref} ({formatDate(result.rate.valid_from)} al {formatDate(result.rate.valid_to)}): la tarifa no se aplicaría.</p>}
      {!result.product.active && <p className="rounded-xl bg-[color-mix(in_srgb,var(--warn)_10%,var(--surface))] px-3.5 py-2.5 text-[13px] text-warn">El producto no está activo: el cálculo es referencial.</p>}
      <ol className="flex flex-col">
        {result.steps.map((step) => (
          <li key={step.id} className={cn("flex items-center justify-between gap-3 border-b border-line-2 py-2 text-[13.5px] last:border-b-0", step.total && "font-semibold", step.id === "total" && "text-[15px]")}>
            <span>
              {step.label}
              {(step.note || step.rule) && <small className="ml-2 text-xs font-normal text-fg-3">{[step.note, step.rule].filter(Boolean).join(" · ")}</small>}
            </span>
            <span className="font-mono">{money(step.amount)}</span>
          </li>
        ))}
      </ol>
      {result.limit && <p className="rounded-xl bg-surface-2 px-3.5 py-2.5 text-[13px]">Se aplicó el precio {result.limit.kind === "minimo" ? "mínimo" : "máximo"} por pasajero de {money(result.limit.value)} ({result.limit.rule}).</p>}
      <FieldList
        fields={[
          { label: "Por pasajero", value: <b>{money(result.unit_price)}</b> },
          { label: "Comisión", value: `${money(result.commission.amount)} · ${result.commission.pct} %${result.commission.rule ? ` · ${result.commission.rule}` : ""}` },
          { label: "Utilidad", value: money(result.profit) },
          { label: "Margen sobre neto", value: `${result.margin_pct} %` },
          { label: "Temporada", value: result.season ? `${result.season.name} ×${result.season.factor.toFixed(2)}` : "Tarifa base" },
        ]}
      />
    </div>
  );
}

function Simulator({ overview }: { overview: PricingOverview }) {
  const [open, setOpen] = useState(false);
  const rates = overview.options.rates;
  const [values, setValues] = useState({ rate_id: rates[0]?.id ?? "", date: addDays(overview.today, 14), pax: "2", channel: "Directo", residency: "dom", extra: "0", discount_fixed: "0", markup_pct: "", discount_pct: "" });
  const [result, setResult] = useState<PricingResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const set = (field: keyof typeof values) => (value: string) => setValues((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    if (!open || !values.rate_id) return;
    const timer = setTimeout(() => {
      start(async () => {
        const response = await simulatePrice({ ...values, pax: Number(values.pax) || 1, markup_pct: values.markup_pct === "" ? null : values.markup_pct, discount_pct: values.discount_pct === "" ? null : values.discount_pct });
        setResult(response.data);
        setMessage(response.message);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [open, values]);

  return (
    <>
      <Button icon={<Calculator size={16} />} onClick={() => setOpen(true)}>Simular precio</Button>
      <SidePanel open={open} onOpenChange={setOpen} size="wide" title="Simulador de precio" description="Costo, temporada, markup, descuentos, impuestos y redondeo con las reglas activas. El cálculo lo hace el servidor.">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <PanelSection title="Datos de la venta">
            <SelectField label="Tarifa" name="rate_id" searchable value={values.rate_id} onChange={set("rate_id")} options={rates.map((rate) => ({ value: rate.id, label: `${overview.options.products.find((product) => product.id === rate.product_id)?.name ?? rate.ref}`, hint: `${rate.ref} · ${rate.rate_type} ${rate.segment} · ${rate.channel} · costo ${formatMoney(rate.cost, rate.currency)}` }))} />
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Fecha del servicio" type="date" value={values.date} onChange={(event) => set("date")(event.target.value)} />
              <TextField label="Pasajeros" type="number" min={1} max={500} value={values.pax} onChange={(event) => set("pax")(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SelectField label="Canal" name="channel" value={values.channel} onChange={set("channel")} options={overview.options.channels.map((channel) => ({ value: channel, label: channel }))} />
              <SelectField label="Cliente" name="residency" value={values.residency} onChange={set("residency")} options={Object.entries(RESIDENCY_LABEL).map(([value, label]) => ({ value, label }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Costos adicionales" type="number" min={0} step="0.01" value={values.extra} onChange={(event) => set("extra")(event.target.value)} />
              <TextField label="Descuento fijo" type="number" min={0} step="0.01" value={values.discount_fixed} onChange={(event) => set("discount_fixed")(event.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <TextField label="Markup manual (%)" type="number" min={0} step="0.1" value={values.markup_pct} placeholder="Según regla" onChange={(event) => set("markup_pct")(event.target.value)} />
              <TextField label="Descuento manual (%)" type="number" min={0} max={100} step="0.1" value={values.discount_pct} placeholder="Según regla" onChange={(event) => set("discount_pct")(event.target.value)} />
            </div>
          </PanelSection>
          <PanelSection title={pending ? "Calculando…" : "Desglose"}>
            {message ? <p className="text-[13px] text-bad">{message}</p> : result ? <ResultView result={result} /> : <p className="text-[13px] text-fg-3">{rates.length ? "Elige una tarifa vigente." : "No hay tarifas vigentes para simular."}</p>}
          </PanelSection>
        </div>
      </SidePanel>
    </>
  );
}

export function PricingRulesBoard({ overview }: { overview: PricingOverview }) {
  const manage = overview.can.manage;
  const columns: Column<PriceRule>[] = [
    { id: "name", header: "Regla", mobile: "title", cell: (rule) => <span className="min-w-0"><b className="block truncate font-semibold">{rule.name}</b><small className="block truncate text-xs text-fg-3">{rule.ref} · {rule.scope}</small></span> },
    { id: "kind", header: "Tipo", cell: (rule) => <span className="text-[13px]">{rule.kind}</span> },
    { id: "value", header: "Valor", align: "right", cell: (rule) => <b className="font-mono text-[13.5px]">{ruleValue(rule)}</b> },
    { id: "conditions", header: "Condiciones", wideOnly: true, cell: (rule) => (conditions(rule).length ? <span className="flex flex-wrap gap-1">{conditions(rule).map((item) => <span key={item} className="rounded-full bg-surface-2 px-2 py-0.5 text-[11.5px] text-fg-2">{item}</span>)}</span> : <span className="text-[12.5px] text-fg-3">Siempre</span>) },
    { id: "priority", header: "Prioridad", align: "right", wideOnly: true, cell: (rule) => <span className="font-mono text-[13px]">{rule.priority}</span> },
    { id: "status", header: "Estado", cell: (rule) => <Badge tone={rule.status === "activa" ? "ok" : "mute"}>{rule.status === "activa" ? "Activa" : "Inactiva"}</Badge> },
    ...(manage
      ? [
          {
            id: "actions",
            header: "",
            mobile: "hidden" as const,
            align: "right" as const,
            cell: (rule: PriceRule) => (
              <RowActions>
                <RuleEditAction overview={overview} rule={rule} />
                <ConfirmAction id={`rule-toggle-${rule.ref}`} label={rule.status === "activa" ? "Desactivar" : "Activar"} tone="neutral" icon={<Power size={15} />} title={rule.status === "activa" ? "Desactivar regla" : "Activar regla"} description={`${rule.name}. ${rule.status === "activa" ? "Deja de aplicarse en los precios nuevos." : "Vuelve a aplicarse en los precios nuevos."}`} submitLabel={rule.status === "activa" ? "Desactivar" : "Activar"} action={togglePriceRule} hidden={{ ref: rule.ref, action: rule.status === "activa" ? "deactivate" : "activate" }} />
                <ConfirmAction id={`rule-delete-${rule.ref}`} label="Eliminar" title="Eliminar regla" description={`${rule.name} deja de existir. El cambio queda en la auditoría.`} submitLabel="Eliminar regla" action={deletePriceRule} hidden={{ ref: rule.ref }} reason="Por ejemplo: se reemplazó por otra regla." />
              </RowActions>
            ),
          },
        ]
      : []),
  ];
  const metrics: MetricFilter<PriceRule>[] = [
    { id: "active", label: "Activas", tone: "ok", icon: <CircleCheck size={19} />, matches: (rule) => rule.status === "activa" },
    { id: "inactive", label: "Inactivas", tone: "mute", icon: <CirclePause size={19} />, matches: (rule) => rule.status === "inactiva" },
  ];
  const filters: FilterConfig<PriceRule>[] = [{ id: "kind", label: "Tipo", options: overview.options.kinds.map((kind) => ({ value: kind, label: kind })), value: (rule) => rule.kind }];
  return (
    <DataTable
      screen="tarifas-reglas"
      rows={overview.rules}
      columns={columns}
      getKey={(rule) => rule.ref}
      entityLabel="reglas"
      searchText={(rule) => `${rule.ref} ${rule.name} ${rule.scope} ${rule.kind}`}
      searchPlaceholder="Buscar regla"
      metrics={metrics}
      filters={filters}
      toolbarEnd={
        <span className="flex gap-2">
          <Simulator overview={overview} />
          {manage && <RuleCreateAction overview={overview} />}
        </span>
      }
      emptyTitle="Sin reglas de pricing"
    />
  );
}
