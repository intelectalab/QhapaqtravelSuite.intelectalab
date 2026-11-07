"use client";

import { CalendarDays, CircleAlert, Plus, ShieldAlert, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { previewQuote, saveQuote, type QuotePayload } from "@/app/(backoffice)/cotizaciones/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintCardTitle } from "@/components/ui/Tinted";
import { FormError } from "@/features/auth/AuthForms";
import { cn } from "@/lib/cn";
import { formatMoney } from "@/lib/format";
import type { QuoteDetail, QuoteFormOptions, QuoteLineInput, QuotePreview } from "@/lib/quotes";
import { ClipboardList, Users, Wallet } from "lucide-react";

const SEGMENTS = ["Adulto", "Niño", "Infante", "Grupo", "Pasajero"];

let counter = 0;
const key = () => `line-${++counter}`;

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[13px] font-semibold text-fg">{children}</span>;
}

export function QuoteBuilderForm({ options, quote, opportunityCode }: { options: QuoteFormOptions; quote?: QuoteDetail; opportunityCode?: string }) {
  const router = useRouter();
  const presetOpportunity = options.opportunities.find((item) => item.code === (quote?.opportunity?.code ?? opportunityCode));
  const current = quote?.versions[0];

  const [client, setClient] = useState(quote?.client.code ?? presetOpportunity?.client_code ?? "");
  const [opportunity, setOpportunity] = useState(presetOpportunity?.code ?? "");
  const [title, setTitle] = useState(quote?.title ?? presetOpportunity?.title ?? "");
  const [travelFrom, setTravelFrom] = useState(quote?.travel_from ?? "");
  const [travelTo, setTravelTo] = useState(quote?.travel_to ?? "");
  const [validUntil, setValidUntil] = useState(quote?.valid_until ?? options.defaults.valid_until);
  const [currency, setCurrency] = useState(quote?.currency ?? presetOpportunity?.currency ?? "USD");
  const [pax, setPax] = useState({ adt: quote?.pax.adt ?? (presetOpportunity?.pax || 2), chd: quote?.pax.chd ?? 0, inf: quote?.pax.inf ?? 0 });
  const [discount, setDiscount] = useState(String(current?.discount_pct ?? 0));
  const [tax, setTax] = useState(String(current?.tax_pct ?? options.defaults.tax_pct));
  const [notes, setNotes] = useState(current?.notes ?? "");
  const [lines, setLines] = useState<QuoteLineInput[]>(
    current?.items.map((item) => ({ key: key(), product_code: item.product.code, date: item.date, qty: item.qty, pax: item.pax, segment: item.segment, unit_price: String(item.unit_price) })) ?? [],
  );
  const [preview, setPreview] = useState<QuotePreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [saving, startSaving] = useTransition();

  const opportunities = options.opportunities.filter((item) => !client || item.client_code === client);
  const totalPax = pax.adt + pax.chd + pax.inf;

  const payload = useMemo<QuotePayload>(
    () => ({
      client_code: client,
      opportunity_code: opportunity || undefined,
      title,
      travel_from: travelFrom,
      travel_to: travelTo,
      valid_until: validUntil,
      currency,
      pax_adt: pax.adt,
      pax_chd: pax.chd,
      pax_inf: pax.inf,
      discount_pct: Number(discount) || 0,
      tax_pct: Number(tax),
      notes: notes || undefined,
      items: lines.filter((line) => line.product_code && line.date).map((line) => ({ product_code: line.product_code, date: line.date, qty: line.qty, pax: line.pax, segment: line.segment, unit_price: line.unit_price === "" ? undefined : Number(line.unit_price) })),
      lock_version: quote?.lock_version,
    }),
    [client, opportunity, title, travelFrom, travelTo, validUntil, currency, pax, discount, tax, notes, lines, quote?.lock_version],
  );

  useEffect(() => {
    if (payload.items.length === 0) return;
    const timer = setTimeout(async () => {
      const result = await previewQuote(payload);
      setPreview(result.preview);
      if (result.message) setMessage(result.message);
    }, 350);
    return () => clearTimeout(timer);
  }, [payload]);

  const updateLine = (lineKey: string, patch: Partial<QuoteLineInput>) => setLines((all) => all.map((line) => (line.key === lineKey ? { ...line, ...patch } : line)));

  const addLine = () => setLines((all) => [...all, { key: key(), product_code: "", date: travelFrom, qty: 1, pax: totalPax || 1, segment: "Adulto", unit_price: "" }]);

  const submit = () => {
    setMessage(null);
    startSaving(async () => {
      const result = await saveQuote(quote?.code ?? null, payload, quote?.version);
      if (result.message) {
        setMessage(result.message);
        return;
      }
      router.push(`/cotizaciones/${result.code}`);
    });
  };

  const productOptions = options.products.map((product) => ({ value: product.code, label: product.name, hint: `${product.duration}${product.rates[0] ? ` · desde ${formatMoney(product.rates[0].price, product.rates[0].currency)}` : " · sin tarifa vigente"}` }));
  const totals = preview?.totals;

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
      <div className="flex flex-col gap-5">
        <Card>
          <TintCardTitle icon={Users} title="Para quién y cuándo" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Cliente</Label>
              <Select value={client} onChange={(value) => { setClient(value); setOpportunity(""); }} options={options.clients.map((item) => ({ value: item.code, label: item.name, hint: item.code }))} placeholder="Elegir cliente" searchable ariaLabel="Cliente" className="h-12 w-full" />
            </div>
            <div>
              <Label>Oportunidad (opcional)</Label>
              <Select value={opportunity} onChange={setOpportunity} options={opportunities.map((item) => ({ value: item.code, label: item.title, hint: item.code }))} placeholder="Sin oportunidad" clearable ariaLabel="Oportunidad" className="h-12 w-full" />
            </div>
            <TextField className="sm:col-span-2" label="Título" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Por ejemplo: Luna de miel Cusco 5D/4N" maxLength={200} />
            <TextField label="Viaje desde" type="date" value={travelFrom} onChange={(event) => setTravelFrom(event.target.value)} icon={<CalendarDays size={17} />} />
            <TextField label="Viaje hasta" type="date" value={travelTo} min={travelFrom || undefined} onChange={(event) => setTravelTo(event.target.value)} icon={<CalendarDays size={17} />} />
            <div className="grid grid-cols-3 gap-2 sm:col-span-2">
              <TextField label="Adultos" type="number" min={0} value={pax.adt} onChange={(event) => setPax({ ...pax, adt: Number(event.target.value) })} />
              <TextField label="Niños" type="number" min={0} value={pax.chd} onChange={(event) => setPax({ ...pax, chd: Number(event.target.value) })} />
              <TextField label="Infantes" type="number" min={0} value={pax.inf} onChange={(event) => setPax({ ...pax, inf: Number(event.target.value) })} />
            </div>
          </div>
        </Card>

        <Card>
          <TintCardTitle icon={ClipboardList} title="Servicios" aside={lines.length ? `${lines.length}` : undefined} />
          <ul className="flex flex-col gap-2.5">
            {lines.map((line, index) => {
              const product = options.products.find((item) => item.code === line.product_code);
              const result = preview?.lines[index];
              return (
                <li key={line.key} className="rounded-tile border border-line-2 bg-[color-mix(in_srgb,var(--tint)_4%,var(--surface))] p-3 motion-safe:animate-[drop-in_260ms_ease-out_backwards]">
                  <div className="mb-2.5 flex items-start gap-2">
                    <div className="min-w-0 flex-1">
                      <Select value={line.product_code} onChange={(value) => updateLine(line.key, { product_code: value, unit_price: "" })} options={productOptions} placeholder="Elegir servicio del catálogo" searchable ariaLabel="Servicio" className="h-11 w-full" />
                    </div>
                    <button type="button" onClick={() => setLines((all) => all.filter((item) => item.key !== line.key))} aria-label="Quitar servicio" className="grid h-11 w-11 flex-none place-items-center rounded-control text-fg-3 transition-colors hover:bg-bad/10 hover:text-bad">
                      <Trash2 size={17} />
                    </button>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-[1.3fr_0.7fr_0.7fr_1fr_1fr]">
                    <TextField label="Fecha" type="date" value={line.date} onChange={(event) => updateLine(line.key, { date: event.target.value })} />
                    <TextField label="Pax" type="number" min={1} value={line.pax} onChange={(event) => updateLine(line.key, { pax: Number(event.target.value) })} />
                    <TextField label="Cant." type="number" min={1} value={line.qty} onChange={(event) => updateLine(line.key, { qty: Number(event.target.value) })} />
                    <div>
                      <Label>Tipo</Label>
                      <Select value={line.segment} onChange={(value) => updateLine(line.key, { segment: value })} options={SEGMENTS.map((segment) => ({ value: segment, label: segment }))} ariaLabel="Tipo de pasajero" className="h-12 w-full" />
                    </div>
                    <TextField label={`Precio (${currency})`} type="number" min={0} step="0.01" value={line.unit_price} onChange={(event) => updateLine(line.key, { unit_price: event.target.value })} placeholder={product?.rates[0] ? "Tarifa" : "Escribir"} />
                  </div>
                  {result && (
                    <p className="mt-2 flex justify-end gap-3 text-[12.5px]">
                      {result.margin_pct !== null && <span className={cn("font-semibold", Number(result.margin_pct) < 15 ? "text-warn" : "text-ok")}>{result.margin_pct} % margen</span>}
                      <b className="font-mono">{formatMoney(result.total, currency)}</b>
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
          <Button type="button" variant="secondary" icon={<Plus size={16} />} onClick={addLine} className="mt-3">
            Agregar servicio
          </Button>
          {lines.length === 0 && <p className="mt-2 text-[12.5px] text-fg-3">Si dejas el precio vacío usamos la tarifa vigente para esa fecha.</p>}
        </Card>
      </div>

      <div className="flex flex-col gap-5 xl:sticky xl:top-20">
        <Card>
          <TintCardTitle icon={Wallet} title="Precio" />
          <div className="flex flex-col gap-3">
            <ChoiceGroup label="Moneda" name="currency" defaultValue={currency} onChange={setCurrency} options={[{ value: "USD", label: "Dólares" }, { value: "PEN", label: "Soles" }]} />
            <div className="grid grid-cols-2 gap-2">
              <TextField label="Descuento (%)" type="number" min={0} max={options.defaults.max_discount} step="0.5" value={discount} onChange={(event) => setDiscount(event.target.value)} hint={`Hasta ${options.defaults.max_discount} %`} />
              <ChoiceGroup label="IGV" name="tax" defaultValue={tax} onChange={setTax} options={[{ value: "18", label: "18 %" }, { value: "0", label: "Exonerado" }]} />
            </div>
            <TextField label="Válida hasta" type="date" value={validUntil} onChange={(event) => setValidUntil(event.target.value)} icon={<CalendarDays size={17} />} />
            <TextArea label="Notas para la versión (opcional)" rows={2} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>

          <dl className="mt-4 flex flex-col gap-1.5 border-t border-line-2 pt-3 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-fg-3">Subtotal</dt>
              <dd className="font-mono">{formatMoney(totals?.sale_total ?? 0, currency)}</dd>
            </div>
            {Number(totals?.discount_total ?? 0) > 0 && (
              <div className="flex justify-between">
                <dt className="text-fg-3">Descuento</dt>
                <dd className="font-mono text-bad">− {formatMoney(totals?.discount_total ?? 0, currency)}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-fg-3">IGV</dt>
              <dd className="font-mono">{formatMoney(totals?.tax_total ?? 0, currency)}</dd>
            </div>
            <div className="flex justify-between border-t border-line-2 pt-1.5 text-[17px] font-bold">
              <dt>Total</dt>
              <dd className="font-mono transition-all duration-300">{formatMoney(totals?.grand_total ?? 0, currency)}</dd>
            </div>
            {totals?.margin_pct !== null && totals?.margin_pct !== undefined && (
              <div className="flex justify-between text-[12.5px]">
                <dt className="text-fg-3">Margen</dt>
                <dd className={cn("font-semibold", Number(totals.margin_pct) < 15 ? "text-warn" : "text-ok")}>{totals.margin_pct} %</dd>
              </div>
            )}
          </dl>
          {preview?.needs_internal_approval && (
            <p className="mt-3 flex items-start gap-2 rounded-xl bg-warn/[0.1] px-3 py-2.5 text-[12.5px] text-warn">
              <ShieldAlert size={16} className="mt-0.5 flex-none" />
              Por el descuento o el margen, Gerencia tendrá que aprobarla antes de enviarla al cliente.
            </p>
          )}
        </Card>

        <FormError message={message} />
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="button" variant="primary" disabled={saving} onClick={submit} className="flex-1">
            {saving ? "Guardando…" : quote ? "Guardar cambios" : "Crear borrador"}
          </Button>
        </div>
        {!preview && lines.length > 0 && (
          <p className="flex items-center gap-1.5 text-[12px] text-fg-3">
            <CircleAlert size={13} />
            Elige servicio y fecha para calcular el precio.
          </p>
        )}
      </div>
    </div>
  );
}
