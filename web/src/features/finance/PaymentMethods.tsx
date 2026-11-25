"use client";

import { Ban, CircleCheck, Handshake, Hash, Plus, Wallet } from "lucide-react";
import { useState } from "react";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { Badge } from "@/components/ui/Badge";
import { InfoTip } from "@/components/ui/InfoTip";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextField } from "@/components/ui/TextField";
import { cn } from "@/lib/cn";
import { ROUTING_DESTINATIONS, type PaymentMethodCatalog, type PaymentMethodRow, type RoutingDestination } from "@/lib/finance";
import { FinanceStep } from "./FinanceStep";

const destinationLabel = (row: PaymentMethodRow): string => {
  if (!row.active) return "—";
  if (row.b2b || !row.destination || row.destination === "none") return ROUTING_DESTINATIONS.none;
  return row.destination === "bank" && row.bank ? `Banco ${row.bank}` : ROUTING_DESTINATIONS[row.destination];
};

function Receiving({ row }: { row: PaymentMethodRow }) {
  const accounts = [
    { currency: "En soles", name: row.accounts.PEN },
    { currency: "En dólares", name: row.accounts.USD },
  ];
  const routed = row.active && !row.b2b && row.destination !== "none";
  return (
    <span className="flex items-center gap-1.5 whitespace-nowrap text-[13px] text-fg-2">
      {destinationLabel(row)}
      {routed && (
        <InfoTip>
          <ul className="grid gap-1">
            {accounts.map((account) => (
              <li key={account.currency}>
                <b className="font-semibold">{account.currency}:</b> {account.name ?? "sin cuenta activa"}
              </li>
            ))}
          </ul>
        </InfoTip>
      )}
    </span>
  );
}

function DestinationFields({ row, banks }: { row?: PaymentMethodRow; banks: string[] }) {
  const [destination, setDestination] = useState<RoutingDestination>(row?.destination ?? (banks.length > 0 ? "bank" : "petty_cash"));
  const options = (Object.keys(ROUTING_DESTINATIONS) as RoutingDestination[]).filter((key) => key !== "bank" || banks.length > 0).map((key) => ({ value: key, label: ROUTING_DESTINATIONS[key] }));
  return (
    <>
      <SelectField label="Entra en" name="destination" value={destination} onChange={(value) => setDestination(value as RoutingDestination)} options={options} hint="Cuenta de tesorería donde se registra el ingreso de cada pago con este medio." />
      {destination === "bank" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <SelectField label="Banco" name="bank" defaultValue={row?.bank ?? banks[0]} options={banks.map((bank) => ({ value: bank, label: bank }))} hint="Solo bancos con una cuenta activa de la agencia." />
          <SelectField label="Moneda de la cuenta" name="currency" defaultValue={row?.currency ?? ""} options={[{ value: "", label: "La del cobro" }, { value: "PEN", label: "Soles" }, { value: "USD", label: "Dólares" }]} />
        </div>
      )}
    </>
  );
}

function MethodFields({ row, banks }: { row?: PaymentMethodRow; banks: string[] }) {
  const [reference, setReference] = useState(row?.requires_reference ?? true);
  const [active, setActive] = useState(row?.active ?? true);
  return (
    <>
      <TextField label="Nombre" name="label" required minLength={3} maxLength={80} defaultValue={row?.label} placeholder="Depósito en agente BCP" hint={row ? "El cambio se ve en todos los pagos ya registrados con este medio." : "Así aparece al registrar un pago y en el detalle de cada pago."} />
      <SwitchField label="Pide número de operación" name="reference_switch" checked={reference} onCheckedChange={setReference} hint="Al registrar el pago, el número de operación o voucher es obligatorio." />
      <input type="hidden" name="requires_reference" value={reference ? "1" : "0"} />
      {row && !row.b2b && (
        <>
          <SwitchField label="Medio activo" name="active_switch" checked={active} onCheckedChange={setActive} hint="Uno inactivo ya no se ofrece al registrar pagos; los pagos anteriores lo conservan." />
          <input type="hidden" name="active" value={active ? "1" : "0"} />
        </>
      )}
      {!row?.b2b && <DestinationFields row={row} banks={banks} />}
    </>
  );
}

function MethodFormAction({ row, banks }: { row?: PaymentMethodRow; banks: string[] }) {
  return (
    <FinanceStep
      step={row ? "payment_method_update" : "payment_method_create"}
      itemKey={row?.code}
      label={row ? "Editar medio" : "Nuevo medio de cobro"}
      icon={<Plus size={16} strokeWidth={2.4} />}
      title={row ? `Editar ${row.label}` : "Nuevo medio de cobro"}
      description="Los medios con los que la agencia recibe pagos de sus clientes."
      submitLabel={row ? "Guardar cambios" : "Crear medio"}
      trigger={row ? (open) => <RowIcon tone="edit" label="Editar medio" onClick={open} /> : undefined}
    >
      <MethodFields row={row} banks={banks} />
    </FinanceStep>
  );
}

function DeleteMethodAction({ row }: { row: PaymentMethodRow }) {
  if (row.b2b) return <RowIcon tone="delete" label="Eliminar" disabledHint="El crédito B2B lo usan los convenios con agencias aliadas" />;
  if (row.uses > 0) return <RowIcon tone="delete" label="Eliminar" disabledHint={`Tiene ${row.uses} ${row.uses === 1 ? "pago" : "pagos"}: desactívalo en lugar de eliminarlo`} />;
  return (
    <FinanceStep step="payment_method_delete" itemKey={row.code} label="Eliminar" title={`Eliminar ${row.label}`} description="Se borra del catálogo de la agencia. No tiene pagos registrados, así que no afecta el historial." submitLabel="Eliminar" trigger={(open) => <RowIcon tone="delete" label="Eliminar" onClick={open} />}>
      <p className="rounded-xl bg-surface-2 px-3.5 py-3 text-[12.5px] text-fg-2">Queda registrado en la auditoría. Si más adelante lo necesitas, puedes volver a crearlo con el mismo nombre.</p>
    </FinanceStep>
  );
}

export function PaymentMethodsTable({ catalog }: { catalog: PaymentMethodCatalog }) {
  const { rows, can, banks } = catalog;
  const columns: Column<PaymentMethodRow>[] = [
    {
      id: "method",
      header: "Medio",
      mobile: "title",
      cell: (row) => (
        <span className={cn("flex min-w-0 items-center gap-2.5", !row.active && "opacity-55")}>
          <span className="grid h-8 w-8 flex-none place-items-center rounded-[9px] bg-surface-2 text-fg-2">{row.b2b ? <Handshake size={15} /> : <Wallet size={15} />}</span>
          <span className="min-w-0">
            <span className="block truncate font-semibold">{row.label}</span>
            {row.b2b && <span className="block truncate text-xs text-fg-3">Convenios con agencias aliadas</span>}
          </span>
        </span>
      ),
    },
    { id: "reference", header: "N.º de operación", cell: (row) => <span className="whitespace-nowrap text-[13px] text-fg-2">{row.requires_reference ? "Se pide" : "No se pide"}</span> },
    { id: "account", header: "Entra en", cell: (row) => <Receiving row={row} /> },
    { id: "uses", header: "Pagos", align: "right", cell: (row) => <span className="font-mono text-[13px]">{row.uses}</span> },
    { id: "state", header: "Estado", cell: (row) => (row.active ? <Badge tone="ok">Activo</Badge> : <Badge tone="mute">Inactivo</Badge>) },
    {
      id: "actions",
      header: "",
      mobile: "hidden",
      align: "right",
      cell: (row) =>
        can.manage ? (
          <RowActions>
            <MethodFormAction row={row} banks={banks} />
            <DeleteMethodAction row={row} />
          </RowActions>
        ) : null,
    },
  ];

  const metrics: MetricFilter<PaymentMethodRow>[] = [
    { id: "active", label: "Activos", tone: "ok", icon: <CircleCheck size={19} />, matches: (row) => row.active, info: <p>Medios que se ofrecen al registrar un pago, en Cuentas por cobrar, el portal del cliente y el de agencias aliadas.</p> },
    { id: "reference", label: "Piden número de operación", tone: "t1", icon: <Hash size={19} />, matches: (row) => row.active && row.requires_reference, info: <p>Medios activos en los que el número de operación o voucher es obligatorio al registrar el pago.</p> },
    { id: "inactive", label: "Inactivos", tone: "warn", icon: <Ban size={19} />, matches: (row) => !row.active, info: <p>Medios desactivados: ya no se ofrecen, pero los pagos anteriores los conservan con su nombre.</p> },
  ];

  const filters: FilterConfig<PaymentMethodRow>[] = [
    { id: "state", label: "Estado", options: [{ value: "Activo", label: "Activo" }, { value: "Inactivo", label: "Inactivo" }], value: (row) => (row.active ? "Activo" : "Inactivo") },
  ];

  const sorts: SortOption<PaymentMethodRow>[] = [
    { id: "label", label: "Nombre", value: (row) => row.label },
    { id: "uses", label: "Pagos", type: "number", value: (row) => row.uses },
  ];

  return (
    <DataTable
      screen="finanzas-tesoreria-medios"
      rows={rows}
      columns={columns}
      getKey={(row) => row.code}
      entityLabel="medios de cobro"
      searchText={(row) => `${row.label} ${destinationLabel(row)}`}
      searchPlaceholder="Buscar medio de cobro"
      metrics={metrics}
      filters={filters}
      sorts={sorts}
      toolbarEnd={
        can.manage ? (
          <MethodFormAction banks={banks} />
        ) : (
          <InfoTip>Solo quien administra la configuración de la agencia agrega, edita o elimina medios de cobro.</InfoTip>
        )
      }
    />
  );
}
