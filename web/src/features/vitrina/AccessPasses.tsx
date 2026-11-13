"use client";

import { ArrowUpRight, CalendarPlus, Clock, Coins, Plus, Ticket, TrendingUp, XCircle } from "lucide-react";
import { useState } from "react";
import { convertPass, createPass, extendPass, revokePass, saveAddonBilling } from "@/app/plataforma/(consola)/pases/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions } from "@/components/table/RowActions";
import type { Column, MetricFilter, SortOption } from "@/components/table/types";
import { ChipToggleGroup } from "@/components/ui/ChipToggleGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { SimpleTable } from "@/components/ui/SimpleTable";
import { TextField } from "@/components/ui/TextField";
import { TintTile } from "@/components/ui/Tinted";
import { TileGrid } from "@/features/channels/ChannelUi";
import { ConsoleAction } from "@/features/platform/ConsoleAction";
import { formatDate, formatMoney } from "@/lib/format";
import type { ConsoleResult } from "@/lib/server/platformConsole";
import type { AccessPass, AddonBilling, PassesOverview } from "@/lib/vitrina";
import { Meter, VitrinaBadge } from "./VitrinaUi";

const initial: ConsoleResult = { message: null, done: false };

const BILLING: Record<string, string> = { unico: "Pago único", mensual: "Mensual", ambos: "Único o mensual" };

export function PassTiles({ overview }: { overview: PassesOverview }) {
  return (
    <TileGrid>
      <TintTile icon={Ticket} tone="t1" label="Pases activos" value={overview.kpis.active} info={<p>Pases vigentes. Una agencia tiene como máximo un pase activo.</p>} />
      <TintTile icon={Clock} tone="sun" label="Vencen en 7 días" value={overview.kpis.expiring} info={<p>Pases activos cuya fecha de fin llega en los próximos 7 días. La agencia recibe avisos 7, 3 y 1 día antes.</p>} />
      <TintTile icon={TrendingUp} tone="ok" label="Convertidos a plan" value={overview.kpis.converted} info={<p>Pases que terminaron en una suscripción pagada.</p>} />
      <TintTile icon={Coins} tone="info" label="Ingresos por pases" value={formatMoney(overview.kpis.revenue, "PEN")} info={<p>Suma del precio de los pases no revocados, sin IGV. Los pagados se facturan al crearlos.</p>} />
    </TileGrid>
  );
}

export function NewPassAction({ overview }: { overview: PassesOverview }) {
  const available = overview.tenants.filter((tenant) => !tenant.has_active_pass);
  return (
    <PanelAction<ConsoleResult>
      label="Nuevo pase"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId="pass-new"
      title="Nuevo pase Básico"
      description={`Acceso por los días que elija (máximo ${overview.rules.max_days}) a las funciones marcadas. Al vencer, la agencia queda en solo lectura ${overview.rules.read_only_days} días.`}
      submitLabel="Crear pase"
      action={createPass}
      initial={initial}
    >
      {() => (
        <>
          <SelectField label="Agencia" name="tenant" options={available.map((tenant) => ({ value: tenant.code, label: `${tenant.name} · ${tenant.plan ?? "sin plan"}` }))} searchable placeholder="Elige la agencia" />
          <div className="grid grid-cols-3 gap-3">
            <TextField label="Días" name="days" type="number" min={1} max={overview.rules.max_days} defaultValue={overview.rules.default_days} />
            <TextField label="Precio (S/)" name="price" type="number" min={0} step="0.01" defaultValue={overview.rules.default_price} hint="0 = cortesía" />
            <SelectField label="Plan sugerido" name="convert_to" options={overview.plans.map((plan) => ({ value: plan.code, label: plan.name }))} defaultValue={overview.plans[0]?.code} />
          </div>
          <TextField label="Motivo" name="reason" required minLength={5} maxLength={200} placeholder="Agencia captada en la vitrina" />
          <ChipToggleGroup label="Funciones incluidas" name="features" options={overview.features.map((feature) => ({ value: feature.key, label: feature.label }))} defaultValue={overview.default_features} />
        </>
      )}
    </PanelAction>
  );
}

export function PassesTable({ overview }: { overview: PassesOverview }) {
  const columns: Column<AccessPass>[] = [
    { id: "code", header: "Pase", mobile: "title", cell: (row) => <span><b className="font-mono text-[12.5px]">{row.code}</b><span className="block max-w-[260px] truncate text-[12px] text-fg-3">{row.reason}</span></span> },
    { id: "tenant", header: "Agencia", cell: (row) => <span className="text-[13px]">{row.tenant.name}<span className="block text-[12px] text-fg-3">{row.tenant.code}</span></span> },
    {
      id: "range",
      header: "Vigencia",
      cell: (row) => (
        <span className="flex min-w-[150px] flex-col gap-1">
          <span className="whitespace-nowrap text-[12.5px]">{formatDate(row.starts_on)} → {formatDate(row.ends_on)}</span>
          {row.days_left !== null && <><Meter value={row.days - row.days_left} max={row.days} tone={row.days_left <= 7 ? "warn" : "t1"} /><span className="text-[11.5px] text-fg-3">quedan {row.days_left} días</span></>}
        </span>
      ),
    },
    { id: "features", header: "Funciones", wideOnly: true, cell: (row) => <span className="flex max-w-[280px] flex-wrap gap-1">{row.features.slice(0, 4).map((feature) => <span key={feature.key} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11.5px] text-fg-2">{feature.label}</span>)}{row.features.length > 4 && <span className="text-[11.5px] text-fg-3" title={row.features.slice(4).map((feature) => feature.label).join(" · ")}>+{row.features.length - 4}</span>}</span> },
    { id: "price", header: "Precio", align: "right", cell: (row) => (Number(row.price) > 0 ? <span className="text-[13px]">{formatMoney(row.price, row.currency)}<span className="block text-[11.5px] text-fg-3">{row.invoice}</span></span> : <span className="text-[13px] text-fg-3">Cortesía</span>) },
    { id: "status", header: "Estado", mobile: "detail", cell: (row) => <VitrinaBadge status={row.status} label={row.status === "convertido" && row.convert_to ? `Convertido a ${row.convert_to.name}` : undefined} /> },
    {
      id: "actions",
      header: "",
      cell: (row) =>
        row.status === "activo" ? (
          <RowActions>
            <ConsoleAction id={`pass-ext-${row.code}`} label="Extender" icon={<CalendarPlus size={15} />} rowTone="neutral" title="Extender pase" description={`${row.tenant.name}. Máximo ${overview.rules.max_days} días en total.`} submitLabel="Extender" action={extendPass} fields={{ code: row.code }}>
              <SelectField label="Días" name="days" options={[{ value: "7", label: "7 días" }, { value: "14", label: "14 días" }, { value: "30", label: "30 días" }]} defaultValue="7" />
            </ConsoleAction>
            <ConsoleAction id={`pass-cv-${row.code}`} label="Convertir" icon={<ArrowUpRight size={15} />} rowTone="view" title="Convertir a plan" description={`${row.tenant.name} pasa al plan elegido y las funciones del pase quedan cubiertas por el plan.`} submitLabel="Convertir" action={convertPass} fields={{ code: row.code }}>
              <SelectField label="Plan" name="plan" options={overview.plans.map((plan) => ({ value: plan.code, label: plan.name }))} defaultValue={row.convert_to?.code ?? overview.plans[0]?.code} />
            </ConsoleAction>
            <ConsoleAction id={`pass-rv-${row.code}`} label="Revocar" icon={<XCircle size={15} />} rowTone="delete" title="Revocar pase" description={`${row.tenant.name} pierde de inmediato las funciones del pase.`} submitLabel="Revocar" action={revokePass} fields={{ code: row.code }}>
              <TextField label="Motivo" name="reason" maxLength={200} />
            </ConsoleAction>
          </RowActions>
        ) : null,
    },
  ];
  const metrics: MetricFilter<AccessPass>[] = [
    { id: "active", label: "Activos", tone: "t1", icon: <Ticket size={19} />, matches: (row) => row.status === "activo" },
    { id: "soon", label: "Vencen pronto", tone: "sun", icon: <Clock size={19} />, matches: (row) => row.days_left !== null && row.days_left <= 7 },
    { id: "converted", label: "Convertidos", tone: "ok", icon: <TrendingUp size={19} />, matches: (row) => row.status === "convertido" },
  ];
  const sorts: SortOption<AccessPass>[] = [{ id: "ends", label: "Fin", type: "date", value: (row) => row.ends_on }];
  return <DataTable screen="plataforma-pases" rows={overview.items} columns={columns} getKey={(row) => row.code} entityLabel="pases" searchText={(row) => `${row.code} ${row.tenant.name} ${row.reason}`} searchPlaceholder="Buscar pase o agencia" metrics={metrics} sorts={sorts} emptyTitle="Aún no hay pases" />;
}

function AddonBillingAction({ addon }: { addon: AddonBilling }) {
  const [mode, setMode] = useState(addon.billing_mode);
  return (
    <ConsoleAction id={`addon-${addon.code}`} label="Editar cobro" icon={<Coins size={15} />} rowTone="edit" title={addon.label} description="Pago único: se factura una vez y queda activo mientras la agencia tenga cuenta. Mensual: se suma a la factura recurrente." submitLabel="Guardar" action={saveAddonBilling} fields={{ code: addon.code }}>
      <SelectField label="Modalidad de cobro" name="billing_mode" options={Object.entries(BILLING).map(([value, label]) => ({ value, label }))} value={mode} onChange={(value) => setMode(value as AddonBilling["billing_mode"])} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Pago único (S/)" name="price_once" type="number" min={0} step="0.01" defaultValue={addon.price_once ?? undefined} disabled={mode === "mensual"} />
        <TextField label="Mensual (S/)" name="price_month" type="number" min={0} step="0.01" defaultValue={addon.price_month ?? undefined} disabled={mode === "unico"} />
      </div>
    </ConsoleAction>
  );
}

export function AddonsCatalog({ addons }: { addons: AddonBilling[] }) {
  return (
    <SimpleTable
      columns={[{ header: "Add-on" }, { header: "Modalidad" }, { header: "Pago único", align: "right" }, { header: "Mensual", align: "right" }, { header: "" }]}
      rows={addons.map((addon) => ({
        key: addon.code,
        cells: [
          <span key="l"><b className="text-[13.5px]">{addon.label}</b><span className="block font-mono text-[11.5px] text-fg-3">{addon.code}</span></span>,
          <span key="m" className="text-[13px]">{BILLING[addon.billing_mode]}</span>,
          addon.price_once ? formatMoney(addon.price_once, "PEN") : "—",
          addon.price_month ? formatMoney(addon.price_month, "PEN") : "—",
          <AddonBillingAction key="a" addon={addon} />,
        ],
      }))}
      empty="Sin add-ons en el catálogo."
    />
  );
}
