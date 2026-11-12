"use client";

import { ArrowDownRight, ArrowUpRight, Banknote, CircleCheck, CircleOff, Coins, Minus, Percent, Plus, Power, PowerOff, Wallet } from "lucide-react";
import { registerFxRate, saveFxSettings, updateCurrency } from "@/app/(backoffice)/admin/monedas/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { Sparkline } from "@/components/ui/Charts";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import type { CurrenciesOverview, CurrencyRow } from "@/lib/admin";
import { cn } from "@/lib/cn";
import { FX_SOURCES, type FxCurrency, type FxEntry } from "@/lib/finance";
import { formatDate, formatDateTime } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { toneStyle, type Tone } from "@/lib/tone";
import { SwitchField } from "@/components/ui/SwitchField";
import { useState } from "react";

const TONES: Tone[] = ["t1", "violet", "sun"];

const fx = (value: number) => value.toLocaleString("es-PE", { minimumFractionDigits: 3, maximumFractionDigits: 4 });

function Change({ rate, previous }: { rate: number | null; previous: number | null }) {
  if (rate === null || previous === null || previous === rate) {
    return (
      <span className="inline-flex items-center gap-1 text-[12.5px] text-fg-3">
        <Minus size={13} /> sin cambio
      </span>
    );
  }
  const up = rate > previous;
  const pct = ((rate - previous) / previous) * 100;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-[12.5px] font-semibold", up ? "text-bad" : "text-ok")}>
      {up ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
      {pct > 0 ? "+" : ""}
      {pct.toFixed(2)} %
    </span>
  );
}

export function FxCards({ currencies }: { currencies: FxCurrency[] }) {
  return (
    <section className="mb-5 grid gap-3 md:grid-cols-3">
      {currencies.map((currency, index) => (
        <article key={currency.code} style={{ ...toneStyle(TONES[index % TONES.length]), animationDelay: `${index * 70}ms` }} className="lift animate-[rise-in_460ms_cubic-bezier(0.22,1,0.36,1)_backwards] rounded-tile border border-[color-mix(in_srgb,var(--tint)_22%,transparent)] bg-[color-mix(in_srgb,var(--tint)_7%,var(--surface))] p-4">
          <div className="flex items-start justify-between gap-3">
            <span className="flex items-center gap-2.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--tint)] text-[13px] font-bold text-white shadow-[0_8px_18px_-10px_var(--tint)]">{currency.code}</span>
              <span>
                <b className="block text-[13.5px] font-semibold">{currency.name}</b>
                <span className="text-[12px] text-fg-3">{currency.date ? `Al ${formatDate(currency.date)}` : "Sin registro"}</span>
              </span>
            </span>
            <Change rate={currency.rate} previous={currency.previous} />
          </div>
          <p className="mt-3 text-[28px] font-bold leading-none tracking-[-0.03em]">{currency.rate === null ? "—" : `S/ ${fx(currency.rate)}`}</p>
          <p className="mt-1 text-[12px] text-fg-3">{currency.source ?? "Registra el primer tipo de cambio"}</p>
          {currency.trend.length > 1 && (
            <div className="mt-2 text-[var(--tint)]">
              <Sparkline values={currency.trend.map((point) => point.rate)} labels={currency.trend.map((point) => `${formatDate(point.date)} · S/ ${fx(point.rate)}`)} />
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

export function FxRegisterAction({ currencies }: { currencies: FxCurrency[] }) {
  return (
    <PanelAction<StepResult>
      label="Registrar tipo de cambio"
      icon={<Plus size={16} strokeWidth={2.4} />}
      variant="primary"
      formId="fx-register"
      title="Registrar tipo de cambio"
      description="Se guarda como una nueva fila del historial. Las cotizaciones, reservas y comprobantes ya emitidos conservan el suyo."
      submitLabel="Registrar"
      action={registerFxRate}
      initial={{ message: null, done: false }}
    >
      {() => (
        <>
          <ChoiceGroup label="Moneda" name="currency" options={currencies.map((currency) => ({ value: currency.code, label: currency.code }))} defaultValue="USD" />
          <TextField label="Soles por unidad" name="rate" type="number" step="0.0001" min="0.5" max="20" required icon={<Banknote size={17} />} placeholder="3.7400" />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Compra (opcional)" name="buy" type="number" step="0.0001" />
            <TextField label="Venta (opcional)" name="sell" type="number" step="0.0001" />
          </div>
          <TextField label="Fecha" name="rate_date" type="date" hint="Si la dejas vacía, se registra con la fecha de hoy." />
          <SelectField label="Fuente" name="source" options={FX_SOURCES.map((value) => ({ value, label: value }))} defaultValue="SBS referencial" />
          <ConfirmVariation hint="Márcalo solo si el sistema te avisó que el cambio supera la alerta de variación y verificaste el valor." />
        </>
      )}
    </PanelAction>
  );
}

export function FxHistoryTable({ rows }: { rows: FxEntry[] }) {
  const columns: Column<FxEntry>[] = [
    {
      id: "currency",
      header: "Moneda",
      mobile: "title",
      cell: (row) => (
        <span className="flex items-center gap-2">
          <Badge tone={row.currency === "USD" ? "t1" : row.currency === "EUR" ? "violet" : "sun"}>{row.currency}</Badge>
          <span className="text-[12.5px] text-fg-3">{formatDate(row.date)}</span>
        </span>
      ),
    },
    { id: "rate", header: "Tipo de cambio", align: "right", cell: (row) => <span className="font-mono text-[13.5px] font-semibold">S/ {fx(row.rate)}</span> },
    { id: "change", header: "Variación", cell: (row) => <Change rate={row.rate} previous={row.previous} /> },
    { id: "source", header: "Fuente", cell: (row) => <span className="text-[13px]">{row.source}</span> },
    { id: "user", header: "Registrado por", mobile: "detail", cell: (row) => <span className="text-[13px] text-fg-2">{row.user} · {formatDateTime(row.at)}</span> },
  ];
  const filters: FilterConfig<FxEntry>[] = [
    { id: "currency", label: "Moneda", options: [...new Set(rows.map((row) => row.currency))].map((value) => ({ value, label: value })), value: (row) => row.currency },
    { id: "source", label: "Fuente", options: [...new Set(rows.map((row) => row.source))].map((value) => ({ value, label: value })), value: (row) => row.source },
  ];
  const sorts: SortOption<FxEntry>[] = [
    { id: "date", label: "Fecha", type: "date", value: (row) => row.date },
    { id: "rate", label: "Tipo de cambio", type: "number", value: (row) => row.rate },
  ];
  return <DataTable screen="monedas" rows={rows} columns={columns} getKey={(row) => row.id} entityLabel="registros" searchText={(row) => `${row.currency} ${row.source} ${row.user}`} searchPlaceholder="Buscar moneda o fuente" filters={filters} sorts={sorts} />;
}

function CurrencyToggle({ row, field }: { row: CurrencyRow; field: "active" | "is_charge" }) {
  const on = field === "active" ? row.active : row.is_charge;
  const label = field === "active" ? (on ? "Desactivar" : "Activar") : on ? "Quitar de cobro" : "Cobrar en esta moneda";
  const icon = field === "active" ? (on ? <PowerOff size={15} /> : <Power size={15} />) : <Wallet size={15} />;
  const blocked = row.is_base ? "La moneda base siempre está activa y es de cobro" : field === "active" && on && row.is_charge ? "Primero quítala de las monedas de cobro" : field === "is_charge" && !row.active ? "Actívala antes de cobrar en ella" : undefined;
  if (blocked) return <RowIcon tone="neutral" label={label} icon={icon} disabledHint={blocked} />;
  return (
    <PanelAction<StepResult>
      label={label}
      formId={`moneda-${field}-${row.code}`}
      title={`${label} · ${row.code}`}
      description={field === "active" ? (on ? "Deja de mostrarse en el sitio, el widget y las cotizaciones." : "Vuelve a mostrarse como moneda de referencia.") : on ? "Se sigue mostrando, pero los cobros se hacen en otra moneda de cobro." : "El sitio y el checkout podrán cobrar en esta moneda."}
      submitLabel={label}
      action={updateCurrency}
      initial={{ message: null, done: false }}
      trigger={(open) => <RowIcon tone="neutral" label={label} icon={icon} onClick={open} />}
    >
      {() => (
        <>
          <input type="hidden" name="code" value={row.code} />
          <input type="hidden" name="field" value={field} />
          <input type="hidden" name="value" value={on ? "0" : "1"} />
          <p className="text-[13px] text-fg-2">El cambio queda en la auditoría.</p>
        </>
      )}
    </PanelAction>
  );
}

export function CurrenciesTable({ data }: { data: CurrenciesOverview }) {
  const columns: Column<CurrencyRow>[] = [
    {
      id: "currency",
      header: "Moneda",
      mobile: "title",
      cell: (row) => (
        <span className="flex items-center gap-2.5">
          <span className="grid h-8 w-11 place-items-center rounded-lg bg-surface-2 font-mono text-[12px] font-bold">{row.code}</span>
          <span>
            <b className="block text-[13.5px] font-semibold">{row.name}</b>
            <span className="text-[12px] text-fg-3">{row.symbol}{row.is_base ? " · moneda base" : ""}</span>
          </span>
        </span>
      ),
    },
    { id: "rate", header: "Tipo de cambio", align: "right", cell: (row) => <span className="font-mono text-[13px]">{row.rate === null ? "Sin registro" : row.is_base ? "1" : `S/ ${fx(row.rate)}`}</span> },
    { id: "client", header: "TC al cliente", align: "right", cell: (row) => <span className="font-mono text-[13px] text-fg-2">{row.client_rate === null || row.is_base ? "—" : `S/ ${fx(row.client_rate)}`}</span> },
    {
      id: "status",
      header: "Estado",
      cell: (row) => (
        <span className="flex flex-wrap gap-1.5">
          <Badge tone={row.active ? "ok" : "mute"}>{row.active ? "Activa" : "Inactiva"}</Badge>
          {row.is_charge && <Badge tone="t1" dot={false}>De cobro</Badge>}
        </span>
      ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      mobile: "detail",
      cell: (row) =>
        data.can_manage ? (
          <RowActions>
            <CurrencyToggle row={row} field="is_charge" />
            <CurrencyToggle row={row} field="active" />
          </RowActions>
        ) : (
          <RowActions>
            <RowIcon tone="neutral" label="Editar" disabledHint="Solo el administrador cambia las monedas" />
          </RowActions>
        ),
    },
  ];
  const metrics: MetricFilter<CurrencyRow>[] = [
    { id: "charge", label: "De cobro", tone: "t1", icon: <Coins size={19} />, matches: (row) => row.is_charge },
    { id: "active", label: "Activas", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.active },
    { id: "inactive", label: "Inactivas", tone: "mute", icon: <CircleOff size={19} />, matches: (row) => !row.active },
  ];
  return <DataTable screen="admin-monedas" rows={data.currencies} columns={columns} getKey={(row) => row.code} entityLabel="monedas" searchText={(row) => `${row.code} ${row.name}`} searchPlaceholder="Buscar moneda" metrics={metrics} />;
}

export function FxSettingsAction({ settings }: { settings: CurrenciesOverview["settings"] }) {
  return (
    <PanelAction<StepResult>
      label="Margen y alerta"
      icon={<Percent size={15} />}
      formId="fx-settings"
      title="Margen de conversión y alerta"
      description="El tipo de cambio al cliente es el del día menos el margen. La alerta avisa cuando el tipo de cambio varía más que el umbral en un día."
      submitLabel="Guardar"
      action={saveFxSettings}
      initial={{ message: null, done: false }}
    >
      {() => (
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Margen (%)" name="margin_pct" type="number" step="0.1" min={0} max={15} required defaultValue={String(settings.margin_pct)} hint="De 0 a 15 %." />
          <TextField label="Alerta de variación (%)" name="alert_pct" type="number" step="0.1" min={0.1} max={20} required defaultValue={String(settings.alert_pct)} hint="De 0,1 a 20 %." />
        </div>
      )}
    </PanelAction>
  );
}

function ConfirmVariation({ hint }: { hint: string }) {
  const [checked, setChecked] = useState(false);
  return <SwitchField label="Confirmo una variación grande" name="confirm_variation" checked={checked} onCheckedChange={setChecked} hint={hint} />;
}
