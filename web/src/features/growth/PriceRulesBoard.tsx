"use client";

import { Calculator, CalendarDays, CircleCheck, CirclePause, Gauge, Pause, Play, Plus, SlidersHorizontal, Tag } from "lucide-react";
import { useActionState, useState } from "react";
import { savePriceRule, simulatePrice, togglePriceRule, type SimulationState } from "@/app/(backoffice)/catalogo/precios-dinamicos/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import { Button } from "@/components/ui/Button";
import { ChipToggleGroup } from "@/components/ui/ChipToggleGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { Tabs } from "@/components/ui/Tabs";
import { TextField } from "@/components/ui/TextField";
import { TintTile } from "@/components/ui/Tinted";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { conditionLabel, labelOptions, type PriceRule, type PriceRulesPage } from "@/lib/growth";
import type { StepResult } from "@/lib/server/resource";
import { KpiRow, Pct, PlanNotice, StatusPill } from "./GrowthUi";

const initial: StepResult = { message: null, done: false };

const WEEKDAYS = [
  { value: "1", label: "Lun" },
  { value: "2", label: "Mar" },
  { value: "3", label: "Mié" },
  { value: "4", label: "Jue" },
  { value: "5", label: "Vie" },
  { value: "6", label: "Sáb" },
  { value: "7", label: "Dom" },
];

const num = (value: unknown, scale = 1) => (value === undefined || value === null ? undefined : String(Math.round(Number(value) * scale * 100) / 100));

function Conditions({ basis, rule }: { basis: string; rule?: PriceRule }) {
  const conditions = rule?.basis === basis ? rule.conditions : {};
  if (basis === "dia_semana") return <ChipToggleGroup label="Días" name="weekdays" options={WEEKDAYS} defaultValue={Array.isArray(conditions.weekdays) ? conditions.weekdays.map(String) : ["6", "7"]} />;
  if (basis === "temporada") {
    return (
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Desde (mes-día)" name="season_from" required pattern="(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])" placeholder="12-15" defaultValue={String(conditions.from ?? "")} />
        <TextField label="Hasta (mes-día)" name="season_to" required pattern="(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])" placeholder="01-15" defaultValue={String(conditions.to ?? "")} />
      </div>
    );
  }
  const percent = basis === "ocupacion" || basis === "demanda";
  const [minKey, maxKey] = basis === "anticipacion" ? ["days_before_gte", "days_before_lte"] : basis === "ocupacion" ? ["occupancy_gte", "occupancy_lte"] : ["demand_gte", "demand_lte"];
  return (
    <div className="grid grid-cols-2 gap-3">
      <TextField label={percent ? "Desde (%)" : "Desde (días antes)"} name="min" type="number" min={0} max={percent ? 100 : 730} defaultValue={num(conditions[minKey], percent ? 100 : 1)} />
      <TextField label={percent ? "Hasta (%)" : "Hasta (días antes)"} name="max" type="number" min={0} max={percent ? 100 : 730} defaultValue={num(conditions[maxKey], percent ? 100 : 1)} />
    </div>
  );
}

function RuleForm({ page, rule }: { page: PriceRulesPage; rule?: PriceRule }) {
  const [basis, setBasis] = useState(rule?.basis ?? "anticipacion");
  const [active, setActive] = useState(rule?.active ?? false);
  const { catalogs, products } = page.meta;
  return (
    <PanelAction<StepResult>
      label="Nueva regla"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId={rule ? `regla-${rule.code}` : "regla-nueva"}
      title={rule ? `Editar ${rule.name}` : "Nueva regla de precio"}
      description="Las reglas activas se aplican por prioridad y el ajuste acumulado queda entre el piso y el techo."
      submitLabel={rule ? "Guardar cambios" : "Crear regla"}
      action={savePriceRule}
      initial={initial}
      testId={rule ? undefined : "price-rule-create"}
      trigger={rule ? (open) => <RowIcon tone="edit" label="Editar regla" onClick={open} /> : undefined}
    >
      {() => (
        <>
          {rule && <input type="hidden" name="code" value={rule.code} />}
          {rule && <input type="hidden" name="lock_version" value={rule.lock_version} />}
          <input type="hidden" name="active" value={active ? "1" : "0"} />
          <TextField label="Nombre" name="name" required minLength={3} maxLength={120} defaultValue={rule?.name} icon={<Tag size={17} />} />
          <SelectField label="Producto" name="product" searchable options={[{ value: "*", label: "Todo el catálogo" }, ...products]} defaultValue={rule?.product?.code ?? "*"} />
          <SelectField label="Se basa en" name="basis" options={labelOptions(catalogs.bases)} value={basis} onChange={setBasis} />
          <Conditions key={basis} basis={basis} rule={rule} />
          <div className="grid grid-cols-3 gap-3">
            <TextField label="Ajuste (%)" name="adjust_pct" type="number" step="0.01" min={-50} max={100} required defaultValue={rule?.adjust_pct ?? "10"} />
            <TextField label="Piso (%)" name="floor_pct" type="number" step="0.01" min={-50} max={0} defaultValue={rule?.floor_pct ?? "-30"} />
            <TextField label="Techo (%)" name="ceiling_pct" type="number" step="0.01" min={0} max={100} defaultValue={rule?.ceiling_pct ?? "50"} />
          </div>
          <TextField label="Prioridad" name="priority" type="number" min={1} max={999} defaultValue={rule?.priority ?? 100} hint="Menor número, antes se aplica." />
          <ChipToggleGroup label="Canales" name="channels" options={labelOptions(catalogs.channels)} defaultValue={rule?.channels ?? Object.keys(catalogs.channels)} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Vigente desde" name="valid_from" type="date" defaultValue={rule?.valid_from ?? undefined} />
            <TextField label="Vigente hasta" name="valid_to" type="date" defaultValue={rule?.valid_to ?? undefined} />
          </div>
          <SwitchField label="Regla activa" name="active_switch" checked={active} onCheckedChange={setActive} hint="Lo ya cotizado o vendido conserva su precio aunque cambies la regla." />
        </>
      )}
    </PanelAction>
  );
}

function ToggleRule({ rule }: { rule: PriceRule }) {
  const [state, run, pending] = useActionState(togglePriceRule, initial);
  return (
    <form action={run} className="contents">
      <input type="hidden" name="code" value={rule.code} />
      <input type="hidden" name="lock_version" value={rule.lock_version} />
      <input type="hidden" name="active" value={rule.active ? "0" : "1"} />
      <button type="submit" disabled={pending} title={state.message ?? (rule.active ? "Desactivar regla" : "Activar regla")} aria-label={rule.active ? "Desactivar regla" : "Activar regla"} className="grid h-8 w-8 place-items-center rounded-[9px] bg-surface-2 text-fg-2 transition hover:-translate-y-0.5">
        {rule.active ? <Pause size={15} /> : <Play size={15} />}
      </button>
    </form>
  );
}

function Simulator({ page }: { page: PriceRulesPage }) {
  const [state, run, pending] = useActionState<SimulationState, FormData>(simulatePrice, { message: null, result: null });
  const [inactive, setInactive] = useState(false);
  const result = state.result;
  const max = result ? Math.max(Number(result.base_price), Number(result.final_price)) || 1 : 1;
  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
      <form action={run} className="flex flex-col gap-4">
        <input type="hidden" name="include_inactive" value={inactive ? "1" : "0"} />
        <SelectField label="Producto" name="product" searchable options={[{ value: "*", label: "Sin producto, con precio base" }, ...page.meta.products]} defaultValue="*" />
        <TextField label="Precio base" name="base_price" type="number" step="0.01" min={0} hint="Si eliges un producto y lo dejas vacío, se usa su tarifa vigente." />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Fecha de viaje" name="date" type="date" required />
          <SelectField label="Canal" name="channel" options={labelOptions(page.meta.catalogs.channels)} defaultValue="web" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Ocupación (%)" name="occupancy" type="number" min={0} max={100} defaultValue="0" />
          <TextField label="Demanda (%)" name="demand" type="number" min={0} max={100} defaultValue="0" />
        </div>
        <SwitchField label="Incluir reglas inactivas" name="inactive_switch" checked={inactive} onCheckedChange={setInactive} hint="Para probar una regla antes de activarla." />
        <Button type="submit" variant="primary" icon={<Calculator size={16} />} disabled={pending}>
          {pending ? "Calculando…" : "Simular precio"}
        </Button>
        {state.message && <p className="text-[12.5px] text-bad">{state.message}</p>}
      </form>
      <div className="rounded-tile border border-line bg-surface-2/40 p-5">
        {!result ? (
          <p className="text-[13px] text-fg-3">Elige una fecha y un canal para ver qué reglas se aplican y el precio final.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Precio base", value: result.base_price, tone: "bg-fg-3" },
                { label: "Precio final", value: result.final_price, tone: Number(result.final_pct) >= 0 ? "bg-ok" : "bg-bad" },
              ].map((bar) => (
                <div key={bar.label}>
                  <p className="text-[12.5px] text-fg-3">{bar.label}</p>
                  <p className="text-[22px] font-bold tracking-tight">{formatMoney(bar.value, result.currency)}</p>
                  <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface">
                    <span style={{ width: `${(Number(bar.value) / max) * 100}%` }} className={cn("block h-full origin-left motion-safe:animate-[fill-x_620ms_cubic-bezier(0.4,0,0.2,1)_backwards]", bar.tone)} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-4 text-[13px] text-fg-2">
              Ajuste acumulado <Pct value={result.cumulative_pct} />
              {result.clamped ? (
                <>
                  {" "}
                  → queda en <Pct value={result.final_pct} /> por el {Number(result.cumulative_pct) > Number(result.final_pct) ? "techo" : "piso"}
                </>
              ) : null}
              {` · ${result.days_before} días de anticipación`}
            </p>
            <ul className="mt-3 grid gap-2">
              {result.applied.length === 0 && <li className="text-[13px] text-fg-3">Ninguna regla aplica a esa fecha y canal.</li>}
              {result.applied.map((rule, index) => (
                <li key={rule.code} style={{ animationDelay: `${index * 50}ms` }} className="lift flex animate-[rise-in_380ms_cubic-bezier(0.22,1,0.36,1)_backwards] items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-[13px]">
                  <span>
                    <span className="font-mono text-[12px] text-fg-3">{rule.code}</span> {rule.name}
                  </span>
                  <Pct value={rule.adjust_pct} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

export function PriceRulesBoard({ page }: { page: PriceRulesPage }) {
  const { counts, catalogs } = page.meta;
  return (
    <>
      <PlanNotice enabled={page.meta.enabled} feature="Los precios dinámicos" />
      <KpiRow>
        <TintTile icon={CircleCheck} tone="ok" label="Reglas activas" value={counts.active} note={`de ${counts.total} reglas`} info={<p>Reglas encendidas que hoy ajustan el precio por ocupación, anticipación, día, temporada o demanda.</p>} />
        <TintTile icon={CirclePause} tone="mute" label="Inactivas" value={counts.inactive} info={<p>Reglas guardadas que no se aplican. Puedes probarlas en el simulador antes de activarlas.</p>} />
        <TintTile icon={Gauge} tone="violet" label="Mayor alza" value={page.data.filter((rule) => rule.active).reduce((best, rule) => Math.max(best, Number(rule.adjust_pct)), 0) + " %"} info={<p>El ajuste positivo más alto entre las reglas activas, antes de aplicar el techo.</p>} />
        <TintTile icon={CalendarDays} tone="info" label="Con vigencia" value={page.data.filter((rule) => rule.valid_from || rule.valid_to).length} info={<p>Reglas limitadas a un rango de fechas de viaje.</p>} />
      </KpiRow>
      <section className="overflow-hidden rounded-card border border-line bg-surface shadow-card">
        <Tabs
          tabs={[
            {
              id: "reglas",
              label: "Reglas",
              count: counts.total,
              content: (
                <DataTable
                  screen="catalogo-precios-dinamicos"
                  rows={page.data}
                  getKey={(rule) => rule.code}
                  entityLabel="reglas"
                  searchText={(rule) => `${rule.code} ${rule.name} ${rule.product?.name ?? ""}`}
                  searchPlaceholder="Buscar por nombre o producto"
                  metrics={[
                    { id: "activas", label: "Activas", tone: "ok", icon: <CircleCheck size={18} />, matches: (rule) => rule.active },
                    { id: "inactivas", label: "Inactivas", tone: "mute", icon: <CirclePause size={18} />, matches: (rule) => !rule.active },
                  ]}
                  filters={[{ id: "basis", label: "Base", options: labelOptions(catalogs.bases), value: (rule) => rule.basis }]}
                  sorts={[{ id: "priority", label: "Prioridad", type: "number", value: (rule) => rule.priority }]}
                  toolbarEnd={<RuleForm page={page} />}
                  emptyTitle="Aún no hay reglas"
                  columns={[
                    { id: "name", header: "Regla", mobile: "title", cell: (rule) => <div><p className="font-semibold">{rule.name}</p><p className="font-mono text-[11.5px] text-fg-3">{rule.code} · prioridad {rule.priority}</p></div> },
                    { id: "condition", header: "Condición", cell: (rule) => <div><p className="text-[13px]">{rule.basis_label}</p><p className="text-[12px] text-fg-3">{conditionLabel(rule.basis, rule.conditions)}</p></div> },
                    { id: "adjust", header: "Ajuste", cell: (rule) => <div className="text-[13px]"><Pct value={rule.adjust_pct} /><p className="text-[11.5px] text-fg-3">entre {rule.floor_pct} % y {rule.ceiling_pct} %</p></div> },
                    { id: "scope", header: "Alcance", wideOnly: true, cell: (rule) => <div className="text-[12.5px] text-fg-2"><p>{rule.product?.name ?? "Todo el catálogo"}</p><p className="text-fg-3">{rule.channels.map((channel) => catalogs.channels[channel] ?? channel).join(", ")}{rule.valid_from || rule.valid_to ? ` · ${rule.valid_from ? formatDate(rule.valid_from) : "…"} al ${rule.valid_to ? formatDate(rule.valid_to) : "…"}` : ""}</p></div> },
                    { id: "status", header: "Estado", cell: (rule) => <StatusPill status={rule.active ? "activa" : "pausada"} label={rule.active ? "Activa" : "Inactiva"} /> },
                    { id: "actions", header: "", align: "right", cell: (rule) => <RowActions><ToggleRule rule={rule} /><RuleForm page={page} rule={rule} /></RowActions> },
                  ]}
                />
              ),
            },
            { id: "simulador", label: "Simulador", content: <Simulator page={page} /> },
          ]}
        />
      </section>
      <p className="mt-3 flex items-center gap-1.5 text-[12px] text-fg-3">
        <SlidersHorizontal size={13} />
        El ajuste se guarda en el detalle de cada cotización y reserva al momento de venderse.
      </p>
    </>
  );
}
