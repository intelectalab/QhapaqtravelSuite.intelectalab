"use client";

import { Coins, RefreshCw, Settings2 } from "lucide-react";
import { useState } from "react";
import { RepeatableFields } from "@/components/ui/RepeatableFields";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { ROUTING_DESTINATIONS, type FxRevaluationPreview, type PaymentRoutingRule, type RoutingDestination, type TreasurySettingsData } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { FinanceStep, SummaryBox } from "./FinanceStep";

export function RegisterRevaluationAction({ preview }: { preview: FxRevaluationPreview }) {
  const diff = Number(preview.totals.unrealized_pen);
  return (
    <FinanceStep step="fx_revalue" label="Registrar diferencia del periodo" icon={<Coins size={16} />} variant="primary" title={`Diferencia cambiaria de ${preview.period}`} description="Se guarda una revaluación por cada cuenta en dólares con saldo. Es única por periodo y no se modifica." submitLabel="Registrar">
      <input type="hidden" name="close_rate" value={preview.close_rate} />
      <SummaryBox
        rows={[
          { label: "Tipo de cambio de cierre", value: preview.close_rate },
          { label: "Cuentas por revaluar", value: preview.pending },
          { label: diff >= 0 ? "Ganancia (cuenta 776)" : "Pérdida (cuenta 676)", value: <span className={diff >= 0 ? "text-ok" : "text-bad"}>{formatMoney(Math.abs(diff))}</span>, strong: true },
        ]}
      />
      <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[12.5px] text-fg-2">El saldo de cada cuenta se valoriza por costo promedio ponderado: las entradas al tipo de cambio de la operación y las salidas al promedio.</p>
    </FinanceStep>
  );
}

const outflowFields = [
  { key: "concept", label: "Concepto", maxLength: 120, placeholder: "Planilla de remuneraciones" },
  { key: "amount", label: "Monto en soles", maxLength: 12, placeholder: "48500" },
  { key: "day", label: "Día de pago (1 a 28)", maxLength: 2, placeholder: "28" },
];

export function TreasurySettingsAction({ settings }: { settings: TreasurySettingsData }) {
  return (
    <FinanceStep step="treasury_settings" label="Editar parámetros" icon={<Settings2 size={16} />} title="Parámetros de tesorería" description="Rigen para toda la agencia. Los cambios quedan en la auditoría." submitLabel="Guardar cambios">
      <input type="hidden" name="lock_version" value={settings.lock_version} />
      <p className="text-[13px] font-semibold text-fg">Caja chica</p>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Tolerancia del arqueo (S/)" name="petty_tolerance" type="number" step="0.01" min="0" max="1000" required defaultValue={String(settings.petty_tolerance)} hint="Diferencias mayores requieren aprobación." />
        <TextField label="Máximo por gasto (S/)" name="max_petty_expense" type="number" step="0.01" min="1" required defaultValue={String(settings.max_petty_expense)} />
        <TextField label="Tope declaración jurada (S/)" name="sworn_statement_max" type="number" step="0.01" min="0" required defaultValue={String(settings.sworn_statement_max)} />
        <TextField label="Pedir reposición bajo el (%)" name="replenish_threshold_pct" type="number" step="1" min="1" max="100" required defaultValue={String(settings.replenish_threshold_pct)} />
      </div>
      <p className="text-[13px] font-semibold text-fg">Pasarela y depósitos</p>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Comisión de la pasarela (%)" name="gateway_fee_pct" type="number" step="0.01" min="0" max="19.99" required defaultValue={String(settings.gateway_fee_pct)} />
        <TextField label="Depositar efectivo en (horas)" name="cash_deposit_hours" type="number" step="1" min="1" max="168" required defaultValue={String(settings.cash_deposit_hours)} />
      </div>
      <p className="text-[13px] font-semibold text-fg">Rentabilidad</p>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Meta de margen (%)" name="margin_target_pct" type="number" step="0.1" min="1" max="100" required defaultValue={String(settings.margin_target_pct)} />
        <TextField label="Margen mínimo (%)" name="margin_floor_pct" type="number" step="0.1" min="0" max="99" required defaultValue={String(settings.margin_floor_pct)} hint="Debajo de este valor la reserva queda en rojo." />
      </div>
      <RepeatableFields label="Egresos fijos del flujo proyectado" name="recurring_outflows" fields={outflowFields} defaultValue={settings.recurring_outflows.map((item) => ({ concept: item.concept, amount: String(item.amount), day: String(item.day) }))} addLabel="Agregar egreso fijo" itemLabel="Egreso" max={20} hint="Se repiten cada mes en el día indicado." />
      <PaymentRoutingFields rules={settings.payment_routing} banks={settings.routing_banks} />
    </FinanceStep>
  );
}

type RoutingRow = Pick<PaymentRoutingRule, "method" | "label" | "b2b" | "destination" | "bank" | "currency">;

const destinationOptions = (Object.keys(ROUTING_DESTINATIONS) as RoutingDestination[]).map((value) => ({ value, label: ROUTING_DESTINATIONS[value] }));

const currencyOptions = [
  { value: "", label: "La del cobro" },
  { value: "PEN", label: "Siempre en soles" },
  { value: "USD", label: "Siempre en dólares" },
];

function PaymentRoutingFields({ rules, banks }: { rules: PaymentRoutingRule[]; banks: string[] }) {
  const [rows, setRows] = useState<RoutingRow[]>(() => rules.map(({ method, label, b2b, destination, bank, currency }) => ({ method, label, b2b, destination, bank, currency })));
  const bankOptions = banks.map((bank) => ({ value: bank, label: bank }));
  const update = (method: string, patch: Partial<RoutingRow>) => setRows((current) => current.map((row) => (row.method === method ? { ...row, ...patch } : row)));
  const payload = rows.filter((row) => !row.b2b).map(({ method, destination, bank, currency }) => ({ method, destination, bank: destination === "bank" ? bank : null, currency: destination === "bank" ? currency : null }));

  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-1 text-[13px] font-semibold text-fg">Cuenta que recibe cada medio de pago</legend>
      <p className="-mt-1 text-[12.5px] text-fg-3">Cada cobro confirmado entra como ingreso en esta cuenta; su reversión sale de la misma. El crédito B2B no mueve caja.</p>
      {rows.map((row) => (
        <div key={row.method} className="rounded-xl bg-surface-2 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 truncate text-[13px] font-medium">{row.label}</span>
            {row.b2b ? (
              <span className="text-[12.5px] text-fg-3">{ROUTING_DESTINATIONS.none}</span>
            ) : (
              <Select
                value={row.destination}
                onChange={(value) => update(row.method, { destination: (value || "bank") as RoutingDestination, bank: value === "bank" ? (row.bank ?? banks[0] ?? null) : row.bank })}
                options={destinationOptions}
                clearable={false}
                ariaLabel={`Destino de ${row.label}`}
                className="h-9 w-52"
              />
            )}
          </div>
          {!row.b2b && row.destination === "bank" && (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <Select value={row.bank ?? ""} onChange={(value) => update(row.method, { bank: value || null })} options={bankOptions} placeholder="Banco" clearable={false} ariaLabel={`Banco de ${row.label}`} className="h-9 w-full" />
              <Select value={row.currency ?? ""} onChange={(value) => update(row.method, { currency: value === "PEN" || value === "USD" ? value : null })} options={currencyOptions} clearable={false} ariaLabel={`Moneda de ${row.label}`} className="h-9 w-full" />
            </div>
          )}
        </div>
      ))}
      <input type="hidden" name="payment_routing" value={JSON.stringify(payload)} />
    </fieldset>
  );
}

export function SyncTreasuryAction() {
  return (
    <FinanceStep step="treasury_sync" label="Sincronizar con Finanzas" icon={<RefreshCw size={16} />} title="Sincronizar con Finanzas" description="Normalmente ocurre sola al confirmar un cobro o pagar a un proveedor." submitLabel="Sincronizar">
      <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[12.5px] text-fg-2">Busca cobros confirmados, reversiones y pagos a proveedores que aún no tienen su movimiento y los registra en la cuenta que les corresponde. No duplica los que ya están.</p>
    </FinanceStep>
  );
}
