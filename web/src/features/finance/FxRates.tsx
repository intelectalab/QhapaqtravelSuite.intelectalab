"use client";

import { ArrowDownRight, ArrowUpRight, Banknote, CircleCheck, CircleOff, Coins, Minus, Percent, PlugZap, Plus, Power, PowerOff, RefreshCw, Wallet } from "lucide-react";
import { refreshFxRates, registerFxRate, saveFxSettings, testFxProvider, updateCurrency } from "@/app/(backoffice)/admin/monedas/actions";
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
  const csv = { fileName: "historial-tipo-de-cambio", columns: [{ header: "Moneda", value: (row: FxEntry) => row.currency }, { header: "Fecha", value: (row: FxEntry) => row.date, type: "date" as const }, { header: "Tipo de cambio (S/)", value: (row: FxEntry) => row.rate, type: "number" as const }, { header: "Anterior (S/)", value: (row: FxEntry) => row.previous, type: "number" as const }, { header: "Fuente", value: (row: FxEntry) => row.source }, { header: "Registrado por", value: (row: FxEntry) => row.user }, { header: "Registrado el", value: (row: FxEntry) => row.at, type: "datetime" as const }] };
  return <DataTable screen="monedas" rows={rows} columns={columns} getKey={(row) => row.id} entityLabel="registros" searchText={(row) => `${row.currency} ${row.source} ${row.user}`} searchPlaceholder="Buscar moneda o fuente" filters={filters} sorts={sorts} csv={csv} />;
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
    { id: "hundred", header: "S/ 100 equivale a", align: "right", wideOnly: true, cell: (row) => <span className="font-mono text-[13px] text-fg-2">{row.is_base || !row.client_rate ? "—" : `${row.symbol} ${(100 / row.client_rate).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}</span> },
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

export interface FxProvidersData {
  providers: { id: string; code: string; name: string; kind: string; status: string; status_label: string; active: boolean; schedule_cron: string | null; last_run_at: string | null; last_error: string | null; note: string | null }[];
  active: string | null;
  simulated: boolean;
  last_rate: { date: string; source: string } | null;
}

const PROVIDER_TONE: Record<string, Tone> = { activo: "ok", por_validar: "warn", inactivo: "mute", error: "bad" };

export function FxProvidersCard({ data, canTest }: { data: FxProvidersData; canTest: boolean }) {
  return (
    <div className="flex flex-col gap-3">
      {data.simulated && <p className="rounded-xl bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-3.5 py-2.5 text-[12.5px] text-fg-2">El proveedor responde con valores de prueba hasta que se conecte uno real desde la consola de la plataforma.</p>}
      <ul className="flex flex-col gap-2">
        {data.providers.map((provider) => (
          <li key={provider.id} className="lift flex items-start gap-3 rounded-[12px] bg-surface-2 px-3.5 py-3">
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-1.5">
                <b className="text-[13.5px] font-semibold">{provider.name}</b>
                <Badge tone={PROVIDER_TONE[provider.status] ?? "mute"}>{provider.status_label}</Badge>
                {provider.active && <Badge tone="t1" dot={false}>En uso</Badge>}
              </span>
              <span className="mt-0.5 block text-[12px] text-fg-3">
                {provider.kind}
                {provider.last_run_at ? ` · última actualización ${formatDateTime(provider.last_run_at)}` : " · sin ejecuciones"}
              </span>
              {provider.last_error ? <span className="mt-0.5 block text-[12px] text-bad">{provider.last_error}</span> : provider.note && <span className="mt-0.5 block text-[12px] text-fg-2">{provider.note}</span>}
            </span>
            {canTest && (
              <PanelAction<StepResult>
                label="Probar conexión"
                formId={`fx-provider-test-${provider.code}`}
                title={`Probar ${provider.name}`}
                description="Consulta el estado del proveedor sin registrar tipos de cambio. El resultado queda en la auditoría."
                submitLabel="Probar"
                action={testFxProvider}
                initial={{ message: null, done: false }}
                trigger={(open) => <RowIcon tone="neutral" label="Probar conexión" icon={<PlugZap size={15} />} onClick={open} />}
              >
                {() => <input type="hidden" name="code" value={provider.code} />}
              </PanelAction>
            )}
          </li>
        ))}
      </ul>
      {data.last_rate && <p className="text-[12px] text-fg-3">Último registro: {formatDate(data.last_rate.date)} · {data.last_rate.source}</p>}
    </div>
  );
}

export function FxRefreshAction({ provider }: { provider: string | null }) {
  return (
    <PanelAction<StepResult>
      label="Actualizar ahora"
      icon={<RefreshCw size={15} />}
      formId="fx-refresh"
      title="Actualizar desde el proveedor"
      description={provider ? `Consulta ${provider} y registra el tipo de cambio de hoy para cada moneda activa. Si el proveedor falla, se conserva el último valor.` : "No hay un proveedor activo: registra el tipo de cambio a mano."}
      submitLabel="Actualizar"
      action={refreshFxRates}
      initial={{ message: null, done: false }}
    >
      {() => <p className="text-[13px] text-fg-2">Las cotizaciones, reservas y comprobantes ya emitidos conservan su tipo de cambio.</p>}
    </PanelAction>
  );
}

const amountText = (value: number, symbol: string) => `${symbol} ${value.toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function FxConverter({ data }: { data: CurrenciesOverview }) {
  const usable = data.currencies.filter((row) => row.is_base || row.rate !== null);
  const base = usable.find((row) => row.is_base) ?? usable[0];
  const [amount, setAmount] = useState("1490");
  const [from, setFrom] = useState(usable.find((row) => row.code === "USD")?.code ?? base?.code ?? "");
  const [to, setTo] = useState(base?.code ?? "");
  if (!base || usable.length < 2) return <p className="text-[13px] text-fg-3">Registra el tipo de cambio de al menos una moneda para probar conversiones.</p>;
  const source = usable.find((row) => row.code === from) ?? base;
  const target = usable.find((row) => row.code === to) ?? base;
  const rateOf = (row: CurrencyRow) => (row.is_base ? 1 : (row.rate ?? 1));
  const clientRateOf = (row: CurrencyRow) => (row.is_base ? 1 : (row.client_rate ?? row.rate ?? 1));
  const value = Number(amount) || 0;
  const reference = (value * rateOf(source)) / rateOf(target);
  const shown = source.code === target.code ? value : target.is_base ? value * rateOf(source) : (value * rateOf(source)) / clientRateOf(target);
  const options = usable.map((row) => ({ value: row.code, label: `${row.code} · ${row.name}` }));
  return (
    <div className="flex flex-col gap-3">
      <TextField label="Monto" name="converter_amount" type="number" step="0.01" min="0" value={amount} onChange={(event) => setAmount(event.target.value)} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField label="De" name="converter_from" options={options} value={from} onChange={setFrom} />
        <SelectField label="A" name="converter_to" options={options} value={to} onChange={setTo} />
      </div>
      <dl className="grid gap-2 rounded-xl bg-surface-2 px-3.5 py-3 text-[13px]">
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-fg-3">TC referencial</dt>
          <dd className="font-mono text-[15px] font-bold">{amountText(reference, target.symbol)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <dt className="text-fg-3">Mostrado al cliente (con margen)</dt>
          <dd className="font-mono font-semibold">{amountText(shown, target.symbol)}</dd>
        </div>
        <div className="flex items-baseline justify-between gap-3 text-[12px]">
          <dt className="text-fg-3">Cálculo</dt>
          <dd className="font-mono text-fg-2">
            {value} × {fx(rateOf(source))} ÷ {fx(rateOf(target))}
          </dd>
        </div>
      </dl>
      {!target.active && <p className="rounded-xl bg-[color-mix(in_srgb,var(--warn)_12%,transparent)] px-3.5 py-2.5 text-[12.5px] text-fg-2">{target.code} está inactiva: no se ofrece a los clientes.</p>}
      <p className="text-[12px] text-fg-3">El precio al cliente usa el TC del día menos el margen de {data.settings.margin_pct} %. La reserva congela el suyo al confirmarse.</p>
    </div>
  );
}

export function FxTrendCard({ currencies, alertPct }: { currencies: FxCurrency[]; alertPct?: number }) {
  const withTrend = currencies.filter((currency) => currency.trend.length > 1);
  const [code, setCode] = useState(withTrend[0]?.code ?? "");
  const current = withTrend.find((currency) => currency.code === code) ?? withTrend[0];
  if (!current) return <p className="text-[13px] text-fg-3">Aún no hay suficientes registros para graficar los últimos 30 días.</p>;
  const values = current.trend.map((point) => point.rate);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const change = ((values[values.length - 1] - values[0]) / values[0]) * 100;
  const days = current.trend.map((point, index) => ({ ...point, variation: index === 0 ? null : ((point.rate - current.trend[index - 1].rate) / current.trend[index - 1].rate) * 100 }));
  const jumps = alertPct ? days.filter((point) => point.variation !== null && Math.abs(point.variation) > alertPct).length : 0;
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {withTrend.map((currency) => (
          <button key={currency.code} type="button" onClick={() => setCode(currency.code)} className={cn("rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition", currency.code === current.code ? "bg-[var(--accent)] text-white" : "bg-surface-2 text-fg-2 hover:bg-[color-mix(in_srgb,var(--accent)_10%,var(--surface-2))]")}>
            {currency.code}
          </button>
        ))}
        <span className="ml-auto text-[12px] text-fg-3">
          Mín. S/ {fx(min)} · Máx. S/ {fx(max)} · Var. {change > 0 ? "+" : ""}
          {change.toFixed(2)} %
        </span>
      </div>
      <div className="relative h-[46px] text-accent">
        <Sparkline values={values} labels={current.trend.map((point) => `${formatDate(point.date)} · S/ ${fx(point.rate)}`)} className="h-full" />
      </div>
      <div className="flex justify-between text-[11.5px] text-fg-3">
        <span>{formatDate(current.trend[0].date)}</span>
        <span>{formatDate(current.trend[current.trend.length - 1].date)}</span>
      </div>
      {jumps > 0 && <p className="text-[12.5px] text-warn">{jumps === 1 ? "1 día" : `${jumps} días`} con variación mayor a la alerta de {alertPct} %.</p>}
    </div>
  );
}

function ConfirmVariation({ hint }: { hint: string }) {
  const [checked, setChecked] = useState(false);
  return <SwitchField label="Confirmo una variación grande" name="confirm_variation" checked={checked} onCheckedChange={setChecked} hint={hint} />;
}
