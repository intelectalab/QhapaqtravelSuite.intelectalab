"use client";

import { CalendarDays, CircleAlert, CircleCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { FieldError } from "@/components/ui/FieldError";
import { Select } from "@/components/ui/Select";
import { SelectField } from "@/components/ui/SelectField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { amountAttr, formatDate, formatMoney } from "@/lib/format";
import type { DirectFormOptions, DirectPayload, DirectPlan } from "@/lib/reservations";

const MODEL_HINT: Record<string, string> = {
  POR_SALIDA: "Por salida programada",
  CUPOS: "Por cupos del proveedor",
  CAPACIDAD: "Por capacidad diaria",
  POR_HABITACION: "Por habitación",
  POR_TRANSPORTE: "Por vehículo",
  POR_FECHA: "Por fecha",
  SIN_CONTROL: "Sin control de cupo",
};

export interface DirectStepProps {
  form: DirectPayload;
  set: (patch: Partial<DirectPayload>) => void;
  options: DirectFormOptions;
  errors: Record<string, string>;
}

const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`;

function Section({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <header className="border-b border-line-2 pb-1.5">
        <h4 className="text-[13.5px] font-semibold text-fg">{title}</h4>
        {hint && <p className="mt-0.5 text-[12.5px] text-fg-3">{hint}</p>}
      </header>
      {children}
    </section>
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

export function ClientStep({ form, set, options, errors }: DirectStepProps) {
  return (
    <div className="flex flex-col gap-6">
      <Section
        title="Para quién"
        hint={
          <>
            Solo clientes de tu cartera. ¿Cliente nuevo? Regístralo primero en{" "}
            <Link href="/crm/clientes" className="font-semibold text-accent hover:underline">
              Clientes
            </Link>
            .
          </>
        }
      >
        <div className="grid gap-4 md:grid-cols-2">
          <SelectField className="md:col-span-2" label="Cliente" name="client_id" value={form.client_id} onChange={(value) => set({ client_id: value })} options={options.clients.map((item) => ({ value: item.code, label: item.name, hint: item.code }))} placeholder="Elegir cliente" searchable error={errors.client_id} />
          <SelectField label="Canal" name="channel" value={form.channel} onChange={(value) => set({ channel: value })} options={options.channels.map((value) => ({ value, label: value }))} placeholder="Según el cliente" clearable hint="Define la tarifa que se aplica." error={errors.channel} />
          {options.advisors.length > 0 && <SelectField label="Responsable" name="owner_id" value={form.owner_id} onChange={(value) => set({ owner_id: value })} options={options.advisors.map((item) => ({ value: item.id, label: item.name }))} error={errors.owner_id} />}
        </div>
      </Section>
      <Section title="Notas para Operaciones">
        <TextArea label="Notas (opcional)" rows={3} maxLength={2000} value={form.notes} onChange={(event) => set({ notes: event.target.value })} placeholder="Recojo en hotel, número de vuelo, alergias, celebraciones." error={errors.notes} />
      </Section>
    </div>
  );
}

function PriceLines({ plan, form }: { plan: DirectPlan; form: DirectPayload }) {
  return (
    <dl className="flex flex-col gap-1.5 text-[13px]">
      <div className="flex justify-between gap-3">
        <dt className="text-fg-3">Viaje</dt>
        <dd className="text-right">{plan.travel_from === plan.travel_to ? formatDate(plan.travel_from ?? "") : `${formatDate(plan.travel_from ?? "")} al ${formatDate(plan.travel_to ?? "")}`}</dd>
      </div>
      <div className="flex justify-between">
        <dt className="text-fg-3">{plural(form.adt, "adulto", "adultos")}</dt>
        <dd className="font-mono">{`${form.adt} × ${formatMoney(plan.adult_price ?? 0, plan.currency)}`}</dd>
      </div>
      {form.chd > 0 && plan.child_price && (
        <div className="flex justify-between">
          <dt className="text-fg-3">{plural(form.chd, "niño", "niños")}</dt>
          <dd className="font-mono">{`${form.chd} × ${formatMoney(plan.child_price, plan.currency)}`}</dd>
        </div>
      )}
      {form.inf > 0 && (
        <div className="flex justify-between">
          <dt className="text-fg-3">{plural(form.inf, "infante", "infantes")}</dt>
          <dd>Sin cargo</dd>
        </div>
      )}
      {plan.rate_ref && (
        <div className="flex justify-between text-[12.5px]">
          <dt className="text-fg-3">Tarifa</dt>
          <dd>{`${plan.rate_ref}${plan.season_factor && Number(plan.season_factor) !== 1 ? ` · temporada ×${Number(plan.season_factor).toFixed(2)}` : ""}`}</dd>
        </div>
      )}
      <div className="flex justify-between border-t border-line-2 pt-1.5 text-[17px] font-bold">
        <dt>Total</dt>
        <dd data-testid="direct-total" data-amount={amountAttr(plan.total ?? "0")} className="font-mono">
          {formatMoney(plan.total ?? 0, plan.currency)}
        </dd>
      </div>
      {plan.cost !== undefined && Number(plan.total) > 0 && (
        <div className="flex justify-between text-[12.5px]">
          <dt className="text-fg-3">Margen</dt>
          <dd className="font-semibold">{`${(((Number(plan.total) - Number(plan.cost)) / Number(plan.total)) * 100).toFixed(1)} %`}</dd>
        </div>
      )}
    </dl>
  );
}

function Availability({ plan }: { plan: DirectPlan }) {
  return (
    <p data-testid="direct-availability" data-state={plan.available ? "ok" : "full"} className={cn("flex items-start gap-2 rounded-xl px-3.5 py-3 text-[13px] text-fg-2", plan.available ? "bg-[color-mix(in_srgb,var(--ok)_9%,transparent)]" : "bg-[color-mix(in_srgb,var(--bad)_9%,transparent)]")}>
      <span className={cn("mt-0.5 flex-none", plan.available ? "text-ok" : "text-bad")}>{plan.available ? <CircleCheck size={17} /> : <CircleAlert size={17} />}</span>
      {plan.note}
    </p>
  );
}

function PlanState({ plan, checkError, checking, perDeparture, chosen }: { plan: DirectPlan | null; checkError: string | null; checking: boolean; perDeparture: boolean; chosen: boolean }) {
  if (!chosen) return <p className="text-[13px] text-fg-3">Elige un producto para ver la disponibilidad y el precio.</p>;
  if (checkError)
    return (
      <p className="flex items-start gap-2 rounded-xl bg-[color-mix(in_srgb,var(--bad)_9%,transparent)] px-3.5 py-3 text-[13px] text-bad">
        <CircleAlert size={17} className="mt-0.5 flex-none" />
        {checkError}
      </p>
    );
  if (!plan?.priced) return <p className="text-[13px] text-fg-3">{checking ? "Calculando…" : perDeparture ? "Elige una salida para calcular el precio." : "Elige la fecha para calcular el precio."}</p>;
  return null;
}

function paxHint(product: DirectStepProps["options"]["products"][number] | undefined): string {
  if (!product) return "Los infantes no pagan.";
  const min = product.min_pax && product.min_pax > 1 ? product.min_pax : null;
  const range = min && product.max_pax ? `De ${min} a ${plural(product.max_pax, "pasajero", "pasajeros")} por reserva.` : product.max_pax ? `Hasta ${plural(product.max_pax, "pasajero", "pasajeros")} por reserva.` : min ? `Desde ${plural(min, "pasajero", "pasajeros")} por reserva.` : "";
  const age = product.min_age && product.min_age > 0 ? ` Edad mínima: ${product.min_age} años.` : "";
  return `${range}${age} Los infantes no pagan.`.trim();
}

export function TripStep({ form, set, options, errors, plan, checkError, checking }: DirectStepProps & { plan: DirectPlan | null; checkError: string | null; checking: boolean }) {
  const product = options.products.find((item) => item.code === form.product_id);
  const perDeparture = product?.model === "POR_SALIDA";
  const priced = plan?.priced && !checkError ? plan : null;

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="flex flex-col gap-6">
        <Section title="Producto" hint="Solo productos activos y reservables.">
          <SelectField label="Producto" name="product_id" value={form.product_id} onChange={(value) => set({ product_id: value, departure_id: "", date: "", rate_id: "" })} options={options.products.map((item) => ({ value: item.code, label: item.name, hint: `${item.duration} · ${MODEL_HINT[item.model] ?? item.model}` }))} placeholder="Elegir producto del catálogo" searchable error={errors.product_id} />
          {product && perDeparture && (
            <SelectField
              label="Salida"
              name="departure_id"
              value={form.departure_id}
              onChange={(value) => set({ departure_id: value, rate_id: "" })}
              options={(plan?.departures ?? []).map((item) => ({ value: item.id, label: `${formatDate(item.date)}${item.time ? ` · ${item.time}` : ""}`, hint: item.free === 0 ? `${item.ref} · sin cupos` : `${item.ref} · ${plural(item.free, "cupo libre", "cupos libres")}` }))}
              placeholder={plan && plan.departures.length === 0 ? "No hay salidas abiertas" : "Elegir salida"}
              searchable
              hint="Se retienen los cupos al crear la reserva."
              error={errors.departure_id}
            />
          )}
          {product && !perDeparture && <TextField label="Fecha del servicio" type="date" min={options.today} value={form.date} onChange={(event) => set({ date: event.target.value, rate_id: "" })} icon={<CalendarDays size={17} />} hint={product.advance_min_days > 0 ? `Se reserva con al menos ${plural(product.advance_min_days, "día", "días")} de anticipación.` : undefined} error={errors.date} data-testid="field:date" />}
          {product && plan?.rates?.length ? (
            <div>
              <span className="mb-1.5 block text-[13px] font-semibold text-fg">Tarifa</span>
              <Select
                value={form.rate_id}
                onChange={(value) => set({ rate_id: value })}
                options={[
                  { value: "", label: "Tarifa sugerida", hint: plan.rate_ref ?? "La del canal para la fecha" },
                  ...plan.rates.map((rate) => ({ value: rate.id, label: `${rate.ref} · ${rate.type} ${rate.segment} · ${rate.channel}`, hint: rate.valid ? formatMoney(rate.price, rate.currency) : "No vigente para la fecha (PRD-BR-005)", disabled: !rate.valid })),
                ]}
                ariaLabel="Tarifa de la reserva"
                className="h-12 w-full"
                testId="field:rate_id"
              />
              <FieldError name="rate_id" message={errors.rate_id} />
            </div>
          ) : null}
        </Section>
        <Section title="Pasajeros" hint={paxHint(product)}>
          <div className="grid grid-cols-3 gap-3 md:max-w-xl">
            <TextField label="Adultos" type="number" min={0} max={99} value={form.adt} onChange={(event) => set({ adt: Math.max(0, Number(event.target.value)) })} data-testid="field:adt" />
            <TextField label="Niños" type="number" min={0} max={99} value={form.chd} onChange={(event) => set({ chd: Math.max(0, Number(event.target.value)) })} />
            <TextField label="Infantes" type="number" min={0} max={99} value={form.inf} onChange={(event) => set({ inf: Math.max(0, Number(event.target.value)) })} />
          </div>
          <FieldError name="adt" message={errors.adt ?? errors.chd ?? errors.inf} />
        </Section>
      </div>
      <Aside title="Precio al momento">
        <PlanState plan={plan} checkError={checkError} checking={checking} perDeparture={perDeparture} chosen={Boolean(product)} />
        {priced && (
          <div key={`${priced.date}-${priced.total}`} className="flex flex-col gap-3 motion-safe:animate-[rise-in_380ms_cubic-bezier(0.22,1,0.36,1)_backwards]">
            <Availability plan={priced} />
            <PriceLines plan={priced} form={form} />
          </div>
        )}
      </Aside>
    </div>
  );
}

export function SummaryStep({ form, options, plan, checkError, checking }: DirectStepProps & { plan: DirectPlan | null; checkError: string | null; checking: boolean }) {
  const product = options.products.find((item) => item.code === form.product_id);
  const client = options.clients.find((item) => item.code === form.client_id);
  const owner = options.advisors.find((item) => item.id === form.owner_id);
  const priced = plan?.priced && !checkError ? plan : null;
  const rows: [string, ReactNode][] = [
    ["Cliente", client?.name ?? "Sin elegir"],
    ["Canal", priced?.channel ?? (form.channel || "Según el cliente")],
    ...(owner ? ([["Responsable", owner.name]] as [string, ReactNode][]) : []),
    ["Producto", product?.name ?? "Sin elegir"],
    [priced?.departure ? "Salida" : "Fecha", priced ? `${formatDate(priced.date ?? "")}${priced.departure ? ` · ${priced.departure.ref}${priced.departure.time ? ` · ${priced.departure.time}` : ""}` : ""}` : "Sin elegir"],
    ["Pasajeros", [form.adt ? plural(form.adt, "adulto", "adultos") : null, form.chd ? plural(form.chd, "niño", "niños") : null, form.inf ? plural(form.inf, "infante", "infantes") : null].filter(Boolean).join(", ") || "Sin pasajeros"],
    ...(form.notes.trim() ? ([["Notas", form.notes.trim()]] as [string, ReactNode][]) : []),
  ];

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
      <Section title="Lo que se reserva">
        <dl className="grid gap-x-6 gap-y-2.5 text-[13px] sm:grid-cols-2">
          {rows.map(([label, value]) => (
            <div key={label} className={label === "Notas" ? "sm:col-span-2" : undefined}>
              <dt className="text-fg-3">{label}</dt>
              <dd className="whitespace-pre-line font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <p className="text-[12.5px] text-fg-3">«Crear y confirmar» retiene los cupos y deja la reserva confirmada. «Guardar borrador» también retiene si hay cupo; si no lo hay, queda pendiente de disponibilidad y no retiene la salida.</p>
      </Section>
      <Aside title="Disponibilidad y precio">
        <PlanState plan={plan} checkError={checkError} checking={checking} perDeparture={product?.model === "POR_SALIDA"} chosen={Boolean(product)} />
        {priced && (
          <div className="flex flex-col gap-3">
            <Availability plan={priced} />
            <PriceLines plan={priced} form={form} />
            <p className="text-[12px] text-fg-3">Precio sin IGV con la tarifa elegida. Se crean el anticipo y el saldo según las políticas comerciales.</p>
          </div>
        )}
      </Aside>
    </div>
  );
}
