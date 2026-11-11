"use client";

import { CalendarDays, CircleAlert, Plus, ShieldAlert, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { FieldError } from "@/components/ui/FieldError";
import { Select } from "@/components/ui/Select";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import { paxLabel, type QuoteFormOptions, type QuoteLineInput, type QuotePreview, type QuoteSegmentOption } from "@/lib/quotes";
import { lineKey, lineReady, type QuoteDraft, type QuotePatch } from "./draft";

const SEGMENTS = ["Adulto", "Niño", "Infante", "Grupo", "Pasajero"];

const PAX_BY_SEGMENT: Record<string, "adt" | "chd" | "inf"> = { Adulto: "adt", Niño: "chd", Infante: "inf" };

const segmentHint = (segment: QuoteSegmentOption) => (segment.price ? formatMoney(segment.price, segment.currency ?? "PEN") : segment.pct ? `${segment.pct} % del adulto` : undefined);

export interface QuoteStepProps {
  draft: QuoteDraft;
  set: (patch: QuotePatch | ((draft: QuoteDraft) => QuotePatch)) => void;
  options: QuoteFormOptions;
  errors: Record<string, string>;
}

function Label({ children }: { children: ReactNode }) {
  return <span className="mb-1.5 block text-[13px] font-semibold text-fg">{children}</span>;
}

function Section({ title, hint, children, className }: { title: string; hint?: string; children: ReactNode; className?: string }) {
  return (
    <section className={cn("flex flex-col gap-3", className)}>
      <header className="border-b border-line-2 pb-1.5">
        <h4 className="text-[13.5px] font-semibold text-fg">{title}</h4>
        {hint && <p className="mt-0.5 text-[12.5px] text-fg-3">{hint}</p>}
      </header>
      {children}
    </section>
  );
}

export function GeneralStep({ draft, set, options, errors }: QuoteStepProps) {
  const opportunities = options.opportunities.filter((item) => !draft.client || item.client_code === draft.client);
  const chooseOpportunity = (code: string) => {
    const opportunity = options.opportunities.find((item) => item.code === code);
    set((current) => ({ opportunity: code, title: current.title || opportunity?.title || "" }));
  };

  return (
    <div className="flex flex-col gap-6">
      <Section title="Cliente" hint="Solo clientes de tu cartera. La oportunidad es opcional y debe ser del mismo cliente.">
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField label="Cliente" name="client_code" value={draft.client} onChange={(value) => set({ client: value, opportunity: "" })} options={options.clients.map((item) => ({ value: item.code, label: item.name, hint: item.code }))} placeholder="Elegir cliente" searchable error={errors.client_code} />
          <SelectField label="Oportunidad (opcional)" name="opportunity_code" value={draft.opportunity} onChange={chooseOpportunity} options={opportunities.map((item) => ({ value: item.code, label: item.title, hint: item.code }))} placeholder="Sin oportunidad" clearable error={errors.opportunity_code} />
        </div>
      </Section>
      <Section title="Propuesta">
        <div className="grid gap-4 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <TextField label="Título" value={draft.title} onChange={(event) => set({ title: event.target.value })} placeholder="Por ejemplo: Luna de miel Cusco 5D/4N" maxLength={200} error={errors.title} data-testid="field:title" />
          <TextField label="Válida hasta" type="date" value={draft.validUntil} onChange={(event) => set({ validUntil: event.target.value })} icon={<CalendarDays size={17} />} tip="Pasada esta fecha la cotización vence si el cliente no la aprobó." error={errors.valid_until} />
        </div>
        <div className="max-w-sm">
          <ChoiceGroup label="Moneda" name="currency" defaultValue={draft.currency} onChange={(value) => set({ currency: value })} options={[{ value: "USD", label: "Dólares" }, { value: "PEN", label: "Soles" }]} hint="Las tarifas se convierten con el tipo de cambio vigente." />
          <FieldError name="currency" message={errors.currency} />
        </div>
      </Section>
    </div>
  );
}

export function TripStep({ draft, set, errors }: QuoteStepProps) {
  const changeTravelFrom = (value: string) =>
    set((current) => ({
      travelFrom: value,
      lines: current.lines.map((line) => (line.date === "" || line.date === current.travelFrom ? { ...line, date: value } : line)),
    }));
  const setPax = (bucket: "adt" | "chd" | "inf", value: number) => set((current) => ({ pax: { ...current.pax, [bucket]: Math.max(0, value) } }));

  return (
    <div className="flex flex-col gap-6">
      <Section title="Fechas del viaje" hint="Los ítems que aún tienen la fecha de inicio se mueven junto con ella.">
        <div className="grid gap-4 md:grid-cols-2">
          <TextField label="Viaje desde" type="date" value={draft.travelFrom} onChange={(event) => changeTravelFrom(event.target.value)} icon={<CalendarDays size={17} />} error={errors.travel_from} data-testid="field:travel_from" />
          <TextField label="Viaje hasta" type="date" value={draft.travelTo} min={draft.travelFrom || undefined} onChange={(event) => set({ travelTo: event.target.value })} icon={<CalendarDays size={17} />} error={errors.travel_to} data-testid="field:travel_to" />
        </div>
      </Section>
      <Section title="Pasajeros" hint="Al agregar ítems, los pasajeros de cada línea se completan según el tipo elegido.">
        <div className="grid grid-cols-3 gap-3 md:max-w-xl">
          <TextField label="Adultos" type="number" min={0} max={999} value={draft.pax.adt} onChange={(event) => setPax("adt", Number(event.target.value))} />
          <TextField label="Niños" type="number" min={0} max={999} value={draft.pax.chd} onChange={(event) => setPax("chd", Number(event.target.value))} />
          <TextField label="Infantes" type="number" min={0} max={999} value={draft.pax.inf} onChange={(event) => setPax("inf", Number(event.target.value))} />
        </div>
        <FieldError name="pax_adt" message={errors.pax_adt ?? errors.pax_chd ?? errors.pax_inf} />
      </Section>
    </div>
  );
}

function Totals({ preview, currency, compact = false }: { preview: QuotePreview | null; currency: string; compact?: boolean }) {
  const totals = preview?.totals;
  return (
    <dl className="flex flex-col gap-1.5 text-[13px]">
      <div className={cn("flex justify-between", compact && "text-[17px] font-bold")}>
        <dt className={compact ? undefined : "text-fg-3"}>Subtotal</dt>
        <dd data-testid={compact ? "quote-subtotal" : undefined} className="font-mono">
          {formatMoney(totals?.sale_total ?? 0, currency)}
        </dd>
      </div>
      {!compact && Number(totals?.discount_total ?? 0) > 0 && (
        <div className="flex justify-between">
          <dt className="text-fg-3">Descuento</dt>
          <dd className="font-mono text-bad">− {formatMoney(totals?.discount_total ?? 0, currency)}</dd>
        </div>
      )}
      {!compact && (
        <>
          <div className="flex justify-between">
            <dt className="text-fg-3">IGV</dt>
            <dd className="font-mono">{formatMoney(totals?.tax_total ?? 0, currency)}</dd>
          </div>
          <div className="flex justify-between border-t border-line-2 pt-1.5 text-[17px] font-bold">
            <dt>Total</dt>
            <dd data-testid="quote-total" className="font-mono transition-all duration-300">
              {formatMoney(totals?.grand_total ?? 0, currency)}
            </dd>
          </div>
        </>
      )}
      {totals?.margin_pct !== null && totals?.margin_pct !== undefined && (
        <div className="flex justify-between text-[12.5px]">
          <dt className="text-fg-3">Margen</dt>
          <dd className={cn("font-semibold", Number(totals.margin_pct) < 15 ? "text-warn" : "text-ok")}>{totals.margin_pct} %</dd>
        </div>
      )}
    </dl>
  );
}

function Aside({ title, children }: { title: string; children: ReactNode }) {
  return (
    <aside className="lift rounded-[16px] border border-line bg-surface-2/40 p-4 lg:sticky lg:top-0">
      <h4 className="mb-3 text-[13.5px] font-semibold text-fg">{title}</h4>
      {children}
    </aside>
  );
}

export function ItemsStep({ draft, set, options, errors, preview }: QuoteStepProps & { preview: QuotePreview | null }) {
  const { pax, currency, travelFrom, travelTo } = draft;
  const totalPax = pax.adt + pax.chd + pax.inf;
  const ready = draft.lines.filter(lineReady);
  const shown = ready.length > 0 ? preview : null;

  const paxFor = (segment: string, fallback: number) => {
    const bucket = PAX_BY_SEGMENT[segment];
    return bucket && pax[bucket] > 0 ? pax[bucket] : fallback;
  };
  const setLines = (update: (lines: QuoteLineInput[]) => QuoteLineInput[]) => set((current) => ({ lines: update(current.lines) }));
  const updateLine = (key: string, patch: Partial<QuoteLineInput>) => setLines((all) => all.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  const chooseProduct = (key: string, code: string) => {
    const segments = options.products.find((item) => item.code === code)?.segments ?? [];
    setLines((all) =>
      all.map((line) => {
        if (line.key !== key) return line;
        const segment = segments.length === 0 || segments.some((item) => item.value === line.segment) ? line.segment : segments[0].value;
        return { ...line, product_code: code, segment, pax: paxFor(segment, line.pax), unit_price: "" };
      }),
    );
  };
  const addLine = () => setLines((all) => [...all, { key: lineKey(), product_code: "", date: travelFrom, qty: 1, pax: pax.adt > 0 ? pax.adt : totalPax || 1, segment: "Adulto", unit_price: "" }]);

  const productOptions = options.products.map((product) => {
    const priced = product.segments.find((segment) => segment.price);
    return { value: product.code, label: product.name, hint: `${product.duration}${priced ? ` · desde ${formatMoney(priced.price ?? 0, priced.currency ?? "PEN")}` : " · sin tarifa vigente"}` };
  });

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex flex-col gap-2.5">
        {draft.lines.length === 0 && <p className="rounded-[14px] border border-dashed border-line px-4 py-3.5 text-[13px] text-fg-3">Solo productos activos y cotizables. Si dejas el precio vacío usamos la tarifa vigente para esa fecha.</p>}
        <ul className="flex flex-col gap-2.5">
          {draft.lines.map((line, position) => {
            const product = options.products.find((item) => item.code === line.product_code);
            const segments = product?.segments ?? [];
            const segmentOptions = segments.length ? segments.map((segment) => ({ value: segment.value, label: segment.value, hint: segmentHint(segment) })) : SEGMENTS.map((segment) => ({ value: segment, label: segment }));
            const readyIndex = ready.indexOf(line);
            const result = readyIndex >= 0 ? shown?.lines[readyIndex] : undefined;
            const ratePrice = result?.rate_price ?? null;
            const lineErrors = readyIndex >= 0 ? [...new Set(Object.entries(errors).filter(([field]) => field.startsWith(`items.${readyIndex}.`)).map(([, message]) => message))] : [];
            return (
              <li key={line.key} data-testid={`quote-line:${position + 1}`} className={cn("lift rounded-[14px] border bg-surface-2/40 p-3 motion-safe:animate-[rise-in_260ms_ease-out_backwards]", lineErrors.length ? "border-bad/50" : "border-line")}>
                <div className="mb-2.5 flex items-start gap-2">
                  <span className="mt-3 w-6 flex-none text-center text-[12.5px] font-semibold text-fg-3">{position + 1}</span>
                  <div className="min-w-0 flex-1">
                    <Select value={line.product_code} onChange={(value) => chooseProduct(line.key, value)} options={productOptions} placeholder="Elegir producto del catálogo" searchable ariaLabel="Producto del catálogo" className="h-11 w-full" testId={`field:items.${position}.product_code`} />
                  </div>
                  <button type="button" onClick={() => setLines((all) => all.filter((item) => item.key !== line.key))} aria-label={`Quitar ítem ${position + 1}`} className="grid h-11 w-11 flex-none place-items-center rounded-control text-fg-3 transition-colors hover:bg-bad/10 hover:text-bad">
                    <Trash2 size={17} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,0.75fr)_minmax(0,0.75fr)_minmax(0,0.85fr)_minmax(0,0.95fr)]">
                  <TextField className="min-w-0" label="Fecha" type="date" value={line.date} min={travelFrom || undefined} max={travelTo || undefined} onChange={(event) => updateLine(line.key, { date: event.target.value })} />
                  <TextField className="min-w-0" label="Pasajeros" tip="Cuántos pasajeros del tipo elegido toman este producto. Al cambiar el tipo se completa con los adultos, niños o infantes de la cotización." type="number" min={1} value={line.pax} onChange={(event) => updateLine(line.key, { pax: Number(event.target.value) })} />
                  <TextField className="min-w-0" label="Cantidad" tip="Cuántas veces se toma el producto para esos pasajeros, por ejemplo 2 traslados (llegada y salida) o la misma excursión en dos fechas seguidas. El total de la línea es precio × pasajeros × cantidad; lo normal es 1." type="number" min={1} value={line.qty} onChange={(event) => updateLine(line.key, { qty: Number(event.target.value) })} />
                  <div className="min-w-0">
                    <Label>Tipo</Label>
                    <Select value={line.segment} onChange={(value) => updateLine(line.key, { segment: value, pax: paxFor(value, line.pax), unit_price: "" })} options={segmentOptions} ariaLabel="Tipo de pasajero" className="h-12 w-full" />
                  </div>
                  <TextField className="min-w-0" label={`Precio (${currency})`} type="number" min={0} step="0.01" value={line.unit_price} onChange={(event) => updateLine(line.key, { unit_price: event.target.value })} placeholder={ratePrice ? Number(ratePrice).toFixed(2) : segments.length ? "Según tarifa" : "Escribir"} />
                </div>
                {product && !line.date && (
                  <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-fg-3">
                    <CircleAlert size={13} />
                    Elige la fecha para calcular la tarifa.
                  </p>
                )}
                {product && segments.length === 0 && (
                  <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-warn">
                    <CircleAlert size={13} />
                    Este producto no tiene tarifa de venta vigente: escribe el precio.
                  </p>
                )}
                {lineErrors.map((message) => (
                  <p key={message} role="alert" className="mt-2 flex items-center gap-1.5 text-[12.5px] font-medium text-bad">
                    <CircleAlert size={13} />
                    {message}
                  </p>
                ))}
                {result && (
                  <p className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12.5px]">
                    <span className="text-fg-3">
                      {result.price_source === "manual" ? `Precio manual${ratePrice ? ` · tarifa ${formatMoney(ratePrice, currency)}` : ""}` : `Tarifa vigente ${formatMoney(result.unit_price, currency)}`} × {line.pax} {line.pax === 1 ? "pasajero" : "pasajeros"}
                      {line.qty > 1 ? ` × ${line.qty}` : ""}
                    </span>
                    <span className="flex items-center gap-3">
                      {result.margin_pct !== null && <span className={cn("font-semibold", Number(result.margin_pct) < 15 ? "text-warn" : "text-ok")}>{result.margin_pct} % margen</span>}
                      <b className="font-mono">{formatMoney(result.total, currency)}</b>
                    </span>
                  </p>
                )}
              </li>
            );
          })}
        </ul>
        <Button type="button" variant="secondary" icon={<Plus size={16} />} onClick={addLine} className="w-fit" data-testid="quote-add-line">
          Agregar del catálogo
        </Button>
        {ready.length === 0 && draft.lines.length > 0 && (
          <p className="flex items-center gap-1.5 text-[12px] text-fg-3">
            <CircleAlert size={13} />
            Elige producto y fecha en cada ítem para calcular el precio.
          </p>
        )}
      </div>
      <Aside title="Precio al momento">
        <Totals preview={shown} currency={currency} compact />
        <p className="mt-3 text-[12px] text-fg-3">El descuento y el IGV se aplican en el siguiente paso.</p>
      </Aside>
    </div>
  );
}

export function SummaryStep({ draft, set, options, errors, preview }: QuoteStepProps & { preview: QuotePreview | null }) {
  const ready = draft.lines.filter(lineReady);
  const shown = ready.length > 0 ? preview : null;
  const client = options.clients.find((item) => item.code === draft.client)?.name;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="flex flex-col gap-6">
        <Section title="Condiciones de precio">
          <div className="grid gap-4 md:grid-cols-2">
            <TextField label="Descuento (%)" type="number" min={0} max={options.defaults.max_discount} step="0.5" value={draft.discount} onChange={(event) => set({ discount: event.target.value })} hint={`Hasta ${options.defaults.max_discount} %. Más de 5 % pide aprobación de Gerencia.`} error={errors.discount_pct} data-testid="field:discount_pct" />
            <div>
              <ChoiceGroup label="IGV" name="tax" defaultValue={draft.tax} onChange={(value) => set({ tax: value })} options={[{ value: "18", label: "18 %" }, { value: "0", label: "Exonerado" }]} />
              <FieldError name="tax_pct" message={errors.tax_pct} />
            </div>
          </div>
          <TextArea label="Notas para la versión (opcional)" rows={3} maxLength={2000} value={draft.notes} onChange={(event) => set({ notes: event.target.value })} placeholder="Condiciones comerciales, lo que incluye la propuesta o recordatorios para el cliente." error={errors.notes} />
        </Section>
        <Section title="Lo que se guarda">
          <dl className="grid gap-x-6 gap-y-2.5 text-[13px] sm:grid-cols-2">
            <div>
              <dt className="text-fg-3">Cliente</dt>
              <dd className="font-medium">{client ?? "Sin elegir"}</dd>
            </div>
            <div>
              <dt className="text-fg-3">Título</dt>
              <dd className="font-medium">{draft.title || "Sin título"}</dd>
            </div>
            <div>
              <dt className="text-fg-3">Viaje</dt>
              <dd className="font-medium">{draft.travelFrom && draft.travelTo ? `${formatDate(draft.travelFrom)} al ${formatDate(draft.travelTo)}` : "Sin fechas"}</dd>
            </div>
            <div>
              <dt className="text-fg-3">Pasajeros</dt>
              <dd className="font-medium">{paxLabel(draft.pax) || "Sin pasajeros"}</dd>
            </div>
            <div>
              <dt className="text-fg-3">Ítems</dt>
              <dd className="font-medium">{ready.length}</dd>
            </div>
            <div>
              <dt className="text-fg-3">Válida hasta</dt>
              <dd className="font-medium">{draft.validUntil ? formatDate(draft.validUntil) : "Según la agencia"}</dd>
            </div>
          </dl>
        </Section>
      </div>
      <Aside title="Resumen económico">
        <Totals preview={shown} currency={draft.currency} />
        {shown?.needs_internal_approval && (
          <p className="mt-3 flex items-start gap-2 rounded-xl bg-warn/[0.1] px-3 py-2.5 text-[12.5px] text-warn">
            <ShieldAlert size={16} className="mt-0.5 flex-none" />
            Por el descuento o el margen, Gerencia tendrá que aprobarla antes de enviarla al cliente.
          </p>
        )}
        <p className="mt-3 text-[12px] text-fg-3">Se guarda como borrador. El precio final lo calcula el sistema con las tarifas vigentes.</p>
      </Aside>
    </div>
  );
}
