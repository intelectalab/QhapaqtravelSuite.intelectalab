"use client";

import { AlertTriangle, Calculator, Coins, Save, TrendingUp } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { saveReferenceMarkup } from "@/app/(backoffice)/catalogo/productos/wizard-actions";
import { simulatePrice } from "@/app/(backoffice)/catalogo/tarifas/actions";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { SelectField } from "@/components/ui/SelectField";
import { SimpleTable } from "@/components/ui/SimpleTable";
import { TextField } from "@/components/ui/TextField";
import { TintCardTitle } from "@/components/ui/Tinted";
import { ResultView } from "@/features/catalog-rates/PricingRules";
import { cn } from "@/lib/cn";
import type { PricingResult } from "@/lib/catalog-pricing";
import { RESIDENCY_LABEL } from "@/lib/catalog-pricing";
import { formatMoney } from "@/lib/format";

export const LOW_MARGIN_PCT = 15;

type Rate = { id: string; ref: string; rate_type: string; segment: string; channel: string; currency: string; cost: string; price: string; status: string; margin: string; margin_pct: number | null };

const CHANNELS = ["Directo", "E-commerce", "B2B", "Corporativo", "Mayorista"];

function addDays(iso: string, days: number): string {
  const date = new Date(`${iso}T12:00:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function Line({ label, value, tone, strong }: { label: string; value: string; tone?: "bad" | "ok"; strong?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between gap-3 border-b border-line py-1.5 text-[13px] last:border-0", strong && "pt-2.5 text-[14px] font-semibold")}>
      <span className="text-fg-2">{label}</span>
      <span className={cn("font-mono", tone === "bad" && "text-bad", tone === "ok" && "text-ok")}>{value}</span>
    </div>
  );
}

function breakdown(rate: Rate, count: number, otherPerPax: number, commissionPct: number) {
  const sale = Number(rate.price) * count;
  const cost = Number(rate.cost) * count;
  const extra = otherPerPax * count;
  const fee = sale * (commissionPct / 100);
  const profit = sale - cost - extra - fee;
  return { sale, cost, extra, fee, profit, margin: sale > 0 ? (profit / sale) * 100 : 0 };
}

function Breakdown({ rates }: { rates: Rate[] }) {
  const live = rates.filter((rate) => rate.status === "vigente");
  const [rateId, setRateId] = useState(live[0]?.id ?? "");
  const [pax, setPax] = useState("2");
  const [other, setOther] = useState("0");
  const [commission, setCommission] = useState("5");
  const rate = live.find((row) => row.id === rateId) ?? live[0];

  const calc = rate ? breakdown(rate, Math.max(1, Number(pax) || 1), Number(other) || 0, Number(commission) || 0) : null;

  if (!rate || !calc) return <p className="text-[13px] text-fg-3">No hay tarifas vigentes para analizar.</p>;
  const low = calc.margin < LOW_MARGIN_PCT;

  return (
    <div className="grid gap-3">
      <SelectField label="Tarifa analizada" name="pf_rate" value={rate.id} onChange={setRateId} options={live.map((row) => ({ value: row.id, label: `${row.ref} · ${row.rate_type} ${row.segment}`, hint: `${row.channel} · venta ${formatMoney(row.price, row.currency)}` }))} />
      <div className="grid grid-cols-3 gap-3">
        <TextField label="Pasajeros" type="number" min={1} max={500} value={pax} onChange={(event) => setPax(event.target.value)} />
        <TextField label="Otros costos por pax" type="number" min={0} step="0.01" value={other} onChange={(event) => setOther(event.target.value)} />
        <TextField label="Comisión (%)" type="number" min={0} max={100} step="0.1" value={commission} onChange={(event) => setCommission(event.target.value)} />
      </div>
      <div className="rounded-tile border border-line px-3.5 py-2">
        <Line label="Precio de venta" value={formatMoney(calc.sale, rate.currency)} />
        <Line label="Costo proveedor" value={`− ${formatMoney(calc.cost, rate.currency)}`} />
        <Line label="Otros costos" value={`− ${formatMoney(calc.extra, rate.currency)}`} />
        <Line label="Comisión" value={`− ${formatMoney(calc.fee, rate.currency)}`} />
        <Line label="Utilidad" value={formatMoney(calc.profit, rate.currency)} tone={calc.profit < 0 ? "bad" : "ok"} strong />
        <Line label="Margen sobre venta" value={`${calc.margin.toFixed(1)} %`} tone={low ? "bad" : "ok"} />
      </div>
      {low && (
        <p className="flex items-start gap-2 rounded-tile bg-[color-mix(in_srgb,var(--bad)_9%,transparent)] px-3 py-2 text-[12.5px] text-bad">
          <AlertTriangle size={15} className="mt-0.5 flex-none" /> El margen queda bajo el {LOW_MARGIN_PCT} %. Revisa el costo del proveedor, la comisión o el precio.
        </p>
      )}
    </div>
  );
}

function Simulator({ code, rates, today, markup, canSave }: { code: string; rates: Rate[]; today: string; markup: number | null; canSave: boolean }) {
  const live = rates.filter((rate) => rate.status === "vigente");
  const [values, setValues] = useState({ rate_id: live[0]?.id ?? "", date: addDays(today, 14), pax: "2", channel: "Directo", residency: "dom", extra: "0", markup_pct: markup !== null ? String(markup) : "" });
  const [result, setResult] = useState<PricingResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const [saving, startSave] = useTransition();
  const set = (field: keyof typeof values) => (value: string) => setValues((current) => ({ ...current, [field]: value }));

  useEffect(() => {
    if (!values.rate_id) return;
    const timer = setTimeout(() => {
      start(async () => {
        const response = await simulatePrice({ ...values, pax: Number(values.pax) || 1, markup_pct: values.markup_pct === "" ? null : values.markup_pct });
        setResult(response.data);
        setMessage(response.message);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [values]);

  if (live.length === 0) return <p className="text-[13px] text-fg-3">No hay tarifas vigentes para simular.</p>;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <div className="grid content-start gap-3">
        <SelectField label="Tarifa" name="sm_rate" value={values.rate_id} onChange={set("rate_id")} options={live.map((row) => ({ value: row.id, label: `${row.ref} · ${row.rate_type} ${row.segment}`, hint: `costo ${formatMoney(row.cost, row.currency)}` }))} />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Fecha" type="date" value={values.date} onChange={(event) => set("date")(event.target.value)} />
          <TextField label="Pasajeros" type="number" min={1} max={500} value={values.pax} onChange={(event) => set("pax")(event.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <SelectField label="Canal" name="sm_channel" value={values.channel} onChange={set("channel")} options={CHANNELS.map((channel) => ({ value: channel, label: channel }))} />
          <SelectField label="Cliente" name="sm_residency" value={values.residency} onChange={set("residency")} options={Object.entries(RESIDENCY_LABEL).map(([value, label]) => ({ value, label }))} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Costos adicionales" type="number" min={0} step="0.01" value={values.extra} onChange={(event) => set("extra")(event.target.value)} />
          <TextField label="Markup (%)" type="number" min={0} max={300} step="0.1" value={values.markup_pct} placeholder="Según regla" onChange={(event) => set("markup_pct")(event.target.value)} />
        </div>
        {canSave && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              icon={<Save size={15} />}
              disabled={saving || values.markup_pct === "" || Number(values.markup_pct) === markup}
              onClick={() => startSave(async () => {
                const response = await saveReferenceMarkup(code, Number(values.markup_pct));
                setSaved(response.ok ? "Markup de referencia guardado." : response.message);
              })}
            >
              Guardar markup de referencia
            </Button>
            {saved && <span className="text-[12.5px] text-fg-3">{saved}</span>}
          </div>
        )}
      </div>
      <div className="rounded-tile border border-line p-3.5">
        <b className="mb-2 block text-[13px] font-semibold text-fg-2">{pending ? "Calculando…" : "Desglose del motor de precios"}</b>
        {message ? <p className="text-[13px] text-bad">{message}</p> : result ? <ResultView result={result} /> : <p className="text-[13px] text-fg-3">Elige una tarifa vigente.</p>}
      </div>
    </div>
  );
}

export function ProductProfitability({ code, rates, today, markup, componentsCost, canSave }: { code: string; rates: Rate[]; today: string; markup: number | null; componentsCost: string | null; canSave: boolean }) {
  const lowCount = rates.filter((rate) => rate.status === "vigente" && rate.margin_pct !== null && rate.margin_pct < LOW_MARGIN_PCT).length;
  return (
    <div className="grid gap-5">
      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <section className="lift rounded-tile border border-line p-4">
          <TintCardTitle icon={Coins} title="Desglose de utilidad" tone="t2" aside={componentsCost !== null ? <span className="text-[12px] text-fg-3">Componentes {formatMoney(componentsCost)}</span> : undefined} />
          <p className="mb-3 text-[12.5px] text-fg-3">Venta − costo proveedor − otros costos − comisión = utilidad.</p>
          <Breakdown rates={rates} />
        </section>
        <section className="lift rounded-tile border border-line p-4">
          <TintCardTitle icon={Calculator} title="Simulador del motor de precios" tone="t1" />
          <p className="mb-3 text-[12.5px] text-fg-3">Usa las reglas activas de pricing. El precio válido es el que calcula el servidor.</p>
          <Simulator code={code} rates={rates} today={today} markup={markup} canSave={canSave} />
        </section>
      </div>
      <section className="lift rounded-tile border border-line p-4">
        <TintCardTitle icon={TrendingUp} title="Margen por tarifa" tone="t3" aside={lowCount > 0 ? <Badge tone="bad">{lowCount === 1 ? "1 tarifa bajo el 15 %" : `${lowCount} tarifas bajo el 15 %`}</Badge> : undefined} />
        <SimpleTable
          columns={[{ header: "Tarifa" }, { header: "Tipo · segmento · canal" }, { header: "Costo", align: "right" }, { header: "Venta", align: "right" }, { header: "Utilidad", align: "right" }, { header: "Margen", align: "right" }]}
          rows={rates.map((row) => ({
            key: row.ref,
            muted: row.status !== "vigente",
            cells: [
              <span key="ref" className="font-mono text-[12.5px]">{row.ref}</span>,
              `${row.rate_type} · ${row.segment} · ${row.channel}`,
              formatMoney(row.cost, row.currency),
              formatMoney(row.price, row.currency),
              formatMoney(row.margin, row.currency),
              row.margin_pct !== null ? <span key="pct" className={cn("font-mono", row.margin_pct < LOW_MARGIN_PCT ? "text-bad" : "text-ok")}>{row.margin_pct} %</span> : "—",
            ],
          }))}
          empty="Sin tarifas para analizar."
        />
      </section>
    </div>
  );
}
