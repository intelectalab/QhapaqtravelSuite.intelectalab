"use client";

import { ArrowDownRight, ArrowUpRight, Banknote, Minus, Plus } from "lucide-react";
import { registerFxRate } from "@/app/(backoffice)/admin/monedas/actions";
import { DataTable } from "@/components/table/DataTable";
import type { Column, FilterConfig, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { Sparkline } from "@/components/ui/Charts";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { PanelAction } from "@/components/ui/PanelAction";
import { SelectField } from "@/components/ui/SelectField";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { FX_SOURCES, type FxCurrency, type FxEntry } from "@/lib/finance";
import { formatDate, formatDateTime } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { toneStyle, type Tone } from "@/lib/tone";

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
