"use client";

import { CalendarDays, CircleAlert, CircleCheck, Route, Users, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { checkDirectAvailability, createDirectReservation } from "@/app/(backoffice)/reservas/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import { TintCardTitle } from "@/components/ui/Tinted";
import { FormError } from "@/features/auth/AuthForms";
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

function Label({ children }: { children: React.ReactNode }) {
  return <span className="mb-1.5 block text-[13px] font-semibold text-fg">{children}</span>;
}

export function DirectReservationForm({ options }: { options: DirectFormOptions }) {
  const router = useRouter();
  const [form, setForm] = useState<DirectPayload>({ client_id: "", product_id: "", channel: "", owner_id: options.owner_id, departure_id: "", date: "", adt: 2, chd: 0, inf: 0, notes: "" });
  const [plan, setPlan] = useState<DirectPlan | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();
  const [saving, startSave] = useTransition();
  const product = options.products.find((item) => item.code === form.product_id);
  const perDeparture = product?.model === "POR_SALIDA";
  const set = (patch: Partial<DirectPayload>) => setForm((current) => ({ ...current, ...patch }));

  useEffect(() => {
    if (!form.product_id) return;
    const timer = setTimeout(() => {
      startCheck(async () => {
        const result = await checkDirectAvailability(form);
        setPlan(result.plan);
        setCheckError(result.message);
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [form]);

  const submit = (confirm: boolean) => {
    setMessage(null);
    startSave(async () => {
      const result = await createDirectReservation(form, confirm);
      if (result.code) router.push(`/reservas/${result.code}`);
      else setMessage(result.message);
    });
  };

  const priced = plan?.priced && !checkError ? plan : null;
  const ready = Boolean(form.client_id && priced);
  const seats = form.adt + form.chd;

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.8fr)]">
      <div className="flex flex-col gap-5">
        <Card>
          <TintCardTitle icon={Users} title="Para quién" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Cliente</Label>
              <Select value={form.client_id} onChange={(value) => set({ client_id: value })} options={options.clients.map((item) => ({ value: item.code, label: item.name, hint: item.code }))} placeholder="Elegir cliente" searchable ariaLabel="Cliente" className="h-12 w-full" testId="field:client_id" />
            </div>
            <div>
              <Label>Canal</Label>
              <Select value={form.channel} onChange={(value) => set({ channel: value })} options={options.channels.map((value) => ({ value, label: value }))} placeholder="Según el cliente" clearable ariaLabel="Canal" className="h-12 w-full" testId="field:channel" />
            </div>
            {options.advisors.length > 0 && (
              <div>
                <Label>Responsable</Label>
                <Select value={form.owner_id} onChange={(value) => set({ owner_id: value })} options={options.advisors.map((item) => ({ value: item.id, label: item.name }))} ariaLabel="Responsable" className="h-12 w-full" testId="field:owner_id" />
              </div>
            )}
          </div>
        </Card>

        <Card>
          <TintCardTitle icon={Route} title="Viaje" />
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Producto</Label>
              <Select value={form.product_id} onChange={(value) => { set({ product_id: value, departure_id: "", date: "" }); setPlan(null); }} options={options.products.map((item) => ({ value: item.code, label: item.name, hint: `${item.duration} · ${MODEL_HINT[item.model] ?? item.model}` }))} placeholder="Elegir producto del catálogo" searchable ariaLabel="Producto" className="h-12 w-full" testId="field:product_id" />
            </div>
            {product && perDeparture && (
              <div className="sm:col-span-2">
                <Label>Salida</Label>
                <Select
                  value={form.departure_id}
                  onChange={(value) => set({ departure_id: value })}
                  options={(plan?.departures ?? []).map((item) => ({ value: item.id, label: `${formatDate(item.date)}${item.time ? ` · ${item.time}` : ""}`, hint: item.free === 0 ? `${item.ref} · sin cupos` : `${item.ref} · ${item.free} ${item.free === 1 ? "cupo libre" : "cupos libres"}` }))}
                  placeholder={plan?.departures.length === 0 ? "No hay salidas abiertas" : "Elegir salida"}
                  searchable
                  ariaLabel="Salida"
                  className="h-12 w-full"
                  testId="field:departure_id"
                />
              </div>
            )}
            {product && !perDeparture && (
              <TextField className="sm:col-span-2" label="Fecha del servicio" type="date" min={options.today} value={form.date} onChange={(event) => set({ date: event.target.value })} icon={<CalendarDays size={17} />} hint={product.advance_min_days > 0 ? `Se reserva con al menos ${product.advance_min_days} ${product.advance_min_days === 1 ? "día" : "días"} de anticipación.` : undefined} />
            )}
            <div className="grid grid-cols-3 gap-2 sm:col-span-2">
              <TextField label="Adultos" type="number" min={0} max={99} value={form.adt} onChange={(event) => set({ adt: Math.max(0, Number(event.target.value)) })} />
              <TextField label="Niños" type="number" min={0} max={99} value={form.chd} onChange={(event) => set({ chd: Math.max(0, Number(event.target.value)) })} />
              <TextField label="Infantes" type="number" min={0} max={99} value={form.inf} onChange={(event) => set({ inf: Math.max(0, Number(event.target.value)) })} hint="Sin cargo" />
            </div>
            <TextArea className="sm:col-span-2" label="Notas para Operaciones (opcional)" rows={2} maxLength={2000} value={form.notes} onChange={(event) => set({ notes: event.target.value })} placeholder="Recojo en hotel, alergias, celebraciones." />
          </div>
        </Card>
      </div>

      <div className="flex flex-col gap-5 xl:sticky xl:top-20">
        <Card>
          <TintCardTitle icon={Wallet} title="Disponibilidad y precio" aside={checking ? "Calculando…" : undefined} />
          {!form.product_id ? (
            <p className="text-[13.5px] text-fg-3">Elige un producto para ver la disponibilidad y el precio.</p>
          ) : checkError ? (
            <p className="flex items-start gap-2 rounded-xl bg-[color-mix(in_srgb,var(--bad)_9%,transparent)] px-3.5 py-3 text-[13px] text-bad">
              <CircleAlert size={17} className="mt-0.5 flex-none" />
              {checkError}
            </p>
          ) : !priced ? (
            <p className="text-[13.5px] text-fg-3">{perDeparture ? "Elige una salida para calcular el precio." : "Elige la fecha para calcular el precio."}</p>
          ) : (
            <div key={`${priced.date}-${priced.total}`} className="flex animate-[rise-in_380ms_cubic-bezier(0.22,1,0.36,1)_backwards] flex-col gap-3">
              <p data-testid="direct-availability" data-state={priced.available ? "ok" : "full"} className={cn("flex items-start gap-2 rounded-xl px-3.5 py-3 text-[13px]", priced.available ? "bg-[color-mix(in_srgb,var(--ok)_9%,transparent)] text-fg-2" : "bg-[color-mix(in_srgb,var(--bad)_9%,transparent)] text-fg-2")}>
                <span className={cn("mt-0.5 flex-none", priced.available ? "text-ok" : "text-bad")}>{priced.available ? <CircleCheck size={17} /> : <CircleAlert size={17} />}</span>
                {priced.note}
              </p>
              <dl className="flex flex-col gap-1.5 text-[13px]">
                <div className="flex justify-between">
                  <dt className="text-fg-3">Viaje</dt>
                  <dd>{priced.travel_from === priced.travel_to ? formatDate(priced.travel_from ?? "") : `${formatDate(priced.travel_from ?? "")} al ${formatDate(priced.travel_to ?? "")}`}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-fg-3">{`${form.adt} ${form.adt === 1 ? "adulto" : "adultos"}`}</dt>
                  <dd className="font-mono">{`${form.adt} × ${formatMoney(priced.adult_price ?? 0, priced.currency)}`}</dd>
                </div>
                {form.chd > 0 && priced.child_price && (
                  <div className="flex justify-between">
                    <dt className="text-fg-3">{`${form.chd} ${form.chd === 1 ? "niño" : "niños"}`}</dt>
                    <dd className="font-mono">{`${form.chd} × ${formatMoney(priced.child_price, priced.currency)}`}</dd>
                  </div>
                )}
                {form.inf > 0 && (
                  <div className="flex justify-between">
                    <dt className="text-fg-3">{`${form.inf} ${form.inf === 1 ? "infante" : "infantes"}`}</dt>
                    <dd>Sin cargo</dd>
                  </div>
                )}
                <div className="flex justify-between border-t border-line-2 pt-1.5 text-[17px] font-bold">
                  <dt>Total</dt>
                  <dd data-testid="direct-total" data-amount={amountAttr(priced.total ?? "0")} className="font-mono">{formatMoney(priced.total ?? 0, priced.currency)}</dd>
                </div>
                {priced.cost !== undefined && Number(priced.total) > 0 && (
                  <div className="flex justify-between text-[12.5px]">
                    <dt className="text-fg-3">Margen</dt>
                    <dd className="font-semibold">{`${(((Number(priced.total) - Number(priced.cost)) / Number(priced.total)) * 100).toFixed(1)} %`}</dd>
                  </div>
                )}
              </dl>
              <p className="text-[12px] text-fg-3">Precio sin IGV con la tarifa vigente del canal. Se crean el anticipo del 40 % y el saldo del 60 %.</p>
            </div>
          )}
        </Card>

        <FormError message={message} />
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={() => router.back()}>
            Cancelar
          </Button>
          <Button type="button" variant="secondary" disabled={!ready || saving || seats < 1} onClick={() => submit(false)} className="flex-1" data-testid="direct-save-draft">
            Guardar borrador
          </Button>
          <Button type="button" variant="primary" disabled={!ready || saving || seats < 1 || !priced?.available} onClick={() => submit(true)} className="flex-1" data-testid="direct-confirm">
            {saving ? "Creando…" : "Crear y confirmar"}
          </Button>
        </div>
        {priced && !priced.available && <p className="text-[12.5px] text-fg-3">Sin cupo suficiente: el borrador queda pendiente de disponibilidad y no retiene la salida.</p>}
      </div>
    </div>
  );
}
