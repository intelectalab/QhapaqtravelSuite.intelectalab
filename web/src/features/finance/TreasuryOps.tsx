"use client";

import { ArrowLeftRight, Calculator, CheckCheck, CreditCard, DoorOpen, Pencil, Plus, Receipt, RotateCcw, ShieldCheck, ThumbsDown, ThumbsUp, Wallet } from "lucide-react";
import { useState } from "react";
import { recordExpense } from "@/app/(backoffice)/finanzas/actions";
import { RowIcon } from "@/components/table/RowActions";
import { Button } from "@/components/ui/Button";
import { ChoiceGroup } from "@/components/ui/ChoiceGroup";
import { FilePicker } from "@/components/ui/FilePicker";
import { SelectField } from "@/components/ui/SelectField";
import { SwitchField } from "@/components/ui/SwitchField";
import { TextArea } from "@/components/ui/TextArea";
import { TextField } from "@/components/ui/TextField";
import type { CashCount, TreasuryAccount, TreasuryOverview } from "@/lib/finance";
import { formatMoney } from "@/lib/format";
import { FinanceStep, SummaryBox } from "./FinanceStep";

const KINDS = [
  { value: "bank", label: "Banco" },
  { value: "petty_cash", label: "Caja chica" },
  { value: "gateway", label: "Pasarela" },
];

const RECEIPTS = [
  { value: "sales_receipt", label: "Boleta" },
  { value: "invoice", label: "Factura" },
  { value: "ticket", label: "Ticket" },
  { value: "fee_receipt", label: "Recibo por honorarios" },
  { value: "mobility_sheet", label: "Planilla de movilidad" },
  { value: "sworn_statement", label: "Declaración jurada" },
];

const EXPENSE_CATEGORIES = ["Movilidad", "Útiles de oficina", "Refrigerios", "Mensajería", "Mantenimiento", "Atención a pasajeros", "Otros"].map((value) => ({ value, label: value }));

const accountOptions = (accounts: TreasuryAccount[], filter?: (account: TreasuryAccount) => boolean) =>
  accounts.filter((account) => account.active && (!filter || filter(account))).map((account) => ({ value: account.code, label: `${account.name} · ${formatMoney(account.balance, account.currency)}` }));

function AccountFields({ data, account }: { data: TreasuryOverview; account?: TreasuryAccount }) {
  const [kind, setKind] = useState<string>(account?.kind ?? "bank");
  const [active, setActive] = useState(account?.active ?? true);
  const banks = accountOptions(data.accounts, (item) => item.kind === "bank");
  return (
    <>
      {!account && <ChoiceGroup label="Tipo" name="kind" options={KINDS} defaultValue="bank" onChange={setKind} />}
      <TextField label="Nombre" name="name" required minLength={3} maxLength={120} defaultValue={account?.name} placeholder={kind === "bank" ? "BCP soles operaciones" : kind === "petty_cash" ? "Caja chica Cusco" : "Pasarela de pagos USD"} />
      {!account && <ChoiceGroup label="Moneda" name="currency" options={[{ value: "PEN", label: "Soles" }, { value: "USD", label: "Dólares" }]} defaultValue="PEN" />}
      {kind === "bank" && (
        <>
          <TextField label="Banco" name="bank" maxLength={80} defaultValue={account?.bank ?? ""} />
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Número de cuenta" name="account_number" maxLength={40} defaultValue={account?.number ?? ""} />
            <TextField label="CCI (opcional)" name="cci" inputMode="numeric" pattern="\d{20}" maxLength={20} />
          </div>
        </>
      )}
      {kind === "petty_cash" && (
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Fondo fijo" name="fund_amount" type="number" step="0.01" min="1" required={!account} defaultValue={account?.fund ? String(account.fund) : ""} />
          <SelectField label="Custodia" name="custodian_id" options={data.options.custodians} placeholder="Elegir persona" />
        </div>
      )}
      {kind === "gateway" && <SelectField label="Liquida en" name="settle_to" options={banks} placeholder="Cuenta bancaria" hint="El banco donde la pasarela deposita los lotes." />}
      <SelectField label="Sede" name="sede_id" options={data.options.sedes} placeholder="La del usuario" />
      {!account && (
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Saldo de apertura" name="opening_balance" type="number" step="0.01" min="0" defaultValue="0" />
          <TextField label="Fecha de apertura" name="opening_date" type="date" max={data.today} defaultValue={data.today} />
        </div>
      )}
      {account && (
        <>
          <SwitchField label="Cuenta activa" name="active_switch" checked={active} onCheckedChange={setActive} hint="Para desactivarla, su saldo debe estar en cero." />
          <input type="hidden" name="active" value={active ? "1" : "0"} />
        </>
      )}
    </>
  );
}

export function AccountFormAction({ data, account }: { data: TreasuryOverview; account?: TreasuryAccount }) {
  return (
    <FinanceStep
      step={account ? "account_update" : "account_create"}
      itemKey={account?.code}
      label={account ? "Editar cuenta" : "Nueva cuenta"}
      icon={account ? <Pencil size={16} /> : <Plus size={16} strokeWidth={2.4} />}
      title={account ? `Editar ${account.name}` : "Nueva cuenta de tesorería"}
      description="Bancos, cajas chicas y pasarelas de pago de la agencia."
      submitLabel={account ? "Guardar cambios" : "Crear cuenta"}
      trigger={account ? (open) => <RowIcon tone="edit" label="Editar cuenta" onClick={open} /> : undefined}
    >
      <AccountFields data={data} account={account} />
    </FinanceStep>
  );
}

function TransferFields({ data, from }: { data: TreasuryOverview; from?: string }) {
  const [source, setSource] = useState(from ?? "");
  const [target, setTarget] = useState("");
  const a = data.accounts.find((account) => account.code === source);
  const b = data.accounts.find((account) => account.code === target);
  const mixed = a && b && a.currency !== b.currency;
  return (
    <>
      <SelectField label="Desde" name="from" options={accountOptions(data.accounts)} defaultValue={from} onChange={setSource} placeholder="Cuenta de origen" />
      <SelectField label="Hacia" name="to" options={accountOptions(data.accounts, (account) => account.code !== source)} onChange={setTarget} placeholder="Cuenta de destino" />
      <div className="grid grid-cols-2 gap-3">
        <TextField label={`Importe${a ? ` (${a.currency})` : ""}`} name="amount" type="number" step="0.01" min="0.01" required />
        <TextField label="Fecha" name="date" type="date" required max={data.today} defaultValue={data.today} />
      </div>
      {mixed && <TextField label="Tipo de cambio pactado" name="deal_rate" type="number" step="0.0001" min="0.5" max="20" defaultValue={String(data.usd_rate)} hint={`Se convierte de ${a.currency} a ${b.currency} con este tipo.`} />}
      <TextField label="Número de operación" name="reference" required maxLength={80} placeholder="OP 00887120" />
      <TextField label="Descripción" name="description" required minLength={3} maxLength={255} placeholder="Ejemplo: fondeo de la cuenta en dólares" />
    </>
  );
}

export function TransferAction({ data, from, compact = false }: { data: TreasuryOverview; from?: string; compact?: boolean }) {
  return (
    <FinanceStep step="transfer_create" label="Transferencia" icon={<ArrowLeftRight size={16} />} title="Transferencia entre cuentas" description="Sale de una cuenta y entra en la otra en la misma operación. Si las monedas difieren, se convierte con el tipo pactado." submitLabel="Registrar transferencia" trigger={compact ? (open) => <Button size="sm" variant="secondary" icon={<ArrowLeftRight size={15} />} onClick={open}>Transferir</Button> : undefined}>
      <TransferFields data={data} from={from} />
    </FinanceStep>
  );
}

export function SettleGatewayAction({ account, feePct, today }: { account: TreasuryAccount; feePct: string | null; today: string }) {
  return (
    <FinanceStep step="gateway_settle" itemKey={account.code} label="Liquidar al banco" icon={<CreditCard size={16} />} title={`Liquidar ${account.name}`} description="Registra el lote que la pasarela deposita en el banco: descuenta la comisión y transfiere el neto." submitLabel="Liquidar" trigger={(open) => <Button size="sm" variant="secondary" icon={<CreditCard size={15} />} onClick={open}>Liquidar</Button>}>
      <SummaryBox rows={[{ label: "Por liquidar", value: formatMoney(account.balance, account.currency), strong: true }]} />
      <div className="grid grid-cols-2 gap-3">
        <TextField label={`Monto bruto (${account.currency})`} name="gross" type="number" step="0.01" min="0.01" max={account.balance} required defaultValue={account.balance > 0 ? account.balance.toFixed(2) : ""} />
        <TextField label="Comisión %" name="fee_pct" type="number" step="0.01" min="0" max="20" defaultValue={feePct ?? "0"} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Fecha del depósito" name="date" type="date" required max={today} defaultValue={today} />
        <TextField label="Número de lote" name="batch" required maxLength={80} />
      </div>
    </FinanceStep>
  );
}

export function OpenSessionAction({ account }: { account: TreasuryAccount }) {
  return (
    <FinanceStep step="session_open" itemKey={account.code} label="Abrir caja" icon={<DoorOpen size={16} />} title={`Abrir ${account.name}`} description="Cuenta el efectivo con el que empieza el día." submitLabel="Abrir caja" trigger={(open) => <Button size="sm" variant="secondary" icon={<DoorOpen size={15} />} onClick={open}>Abrir</Button>}>
      <SummaryBox rows={[{ label: "Saldo según sistema", value: formatMoney(account.balance, account.currency), strong: true }]} />
      <TextField label="Efectivo contado" name="counted" type="number" step="0.01" min="0" required defaultValue={account.balance.toFixed(2)} />
      <TextArea label="Observación (opcional)" name="note" rows={2} maxLength={300} />
    </FinanceStep>
  );
}

function ExpenseFields({ account, today, max }: { account: TreasuryAccount; today: string; max: string | null }) {
  const [receipt, setReceipt] = useState("sales_receipt");
  const needsNumber = !["mobility_sheet", "sworn_statement"].includes(receipt);
  const needsRuc = ["invoice", "fee_receipt"].includes(receipt);
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <TextField label="Importe (S/)" name="amount" type="number" step="0.01" min="0.01" max={max ?? undefined} required hint={max ? `Máximo por gasto: S/ ${max}` : undefined} />
        <TextField label="Fecha" name="date" type="date" max={today} defaultValue={today} />
      </div>
      <SelectField label="Categoría" name="category" options={EXPENSE_CATEGORIES} defaultValue="Movilidad" />
      <TextField label="Descripción" name="description" required minLength={3} maxLength={255} placeholder="Ejemplo: taxi al aeropuerto para recoger documentos" />
      <SelectField label="Comprobante" name="receipt_type" options={RECEIPTS} defaultValue="sales_receipt" onChange={setReceipt} />
      {needsNumber && <TextField label="Serie y número" name="series_number" required maxLength={30} placeholder="B001-000123" />}
      {needsRuc && <TextField label="RUC del emisor" name="issuer_ruc" required inputMode="numeric" pattern="\d{11}" maxLength={11} />}
      <TextField label="Pagado a" name="supplier" required maxLength={160} />
      <TextField label="Reserva (opcional)" name="reservation" maxLength={30} placeholder="RES-2026-000350" hint="Para cargar el gasto al costo de un viaje." />
      {needsNumber && <FilePicker key={receipt} label="Archivo del comprobante" accept="application/pdf,image/jpeg,image/png,image/webp" formats="PDF, JPG, PNG o WEBP" maxKb={10240} />}
      <input type="hidden" name="account" value={account.code} />
    </>
  );
}

export function ExpenseAction({ account, today, max }: { account: TreasuryAccount; today: string; max: string | null }) {
  return (
    <FinanceStep step="expense_create" itemKey={account.code} action={recordExpense} label="Gasto" icon={<Receipt size={16} />} title={`Gasto de ${account.name}`} description="Cada gasto se sustenta con su comprobante y se rinde en la próxima reposición." submitLabel="Registrar gasto" trigger={(open) => <Button size="sm" variant="secondary" icon={<Receipt size={15} />} onClick={open}>Gasto</Button>}>
      <ExpenseFields account={account} today={today} max={max} />
    </FinanceStep>
  );
}

function CountFields({ account, denominations, custodians, closing }: { account: TreasuryAccount; denominations: string[]; custodians: { value: string; label: string }[]; closing: boolean }) {
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const counted = denominations.reduce((sum, value) => sum + Number(value) * (Number(quantities[value]) || 0), 0);
  const difference = Math.round((counted - account.balance) * 100) / 100;
  return (
    <>
      <input type="hidden" name="kind" value={closing ? "closing" : "surprise"} />
      <div className="grid grid-cols-3 gap-2">
        {denominations.map((value) => (
          <TextField key={value} label={`S/ ${value}`} name={`denominations[${value}]`} type="number" min="0" step="1" value={quantities[value] ?? ""} onChange={(event) => setQuantities((current) => ({ ...current, [value]: event.target.value }))} />
        ))}
      </div>
      <SummaryBox
        rows={[
          { label: "Según sistema", value: formatMoney(account.balance) },
          { label: "Contado", value: formatMoney(counted), strong: true },
          { label: "Diferencia", value: <span className={difference === 0 ? "text-ok" : "text-bad"}>{formatMoney(difference)}</span> },
        ]}
      />
      <TextArea label={difference === 0 ? "Observación (opcional)" : "Qué pasó con la diferencia"} name="note" rows={3} required={difference !== 0} maxLength={500} />
      <SelectField label="Testigo (opcional)" name="witness_id" options={custodians} placeholder="Elegir persona" />
    </>
  );
}

export function CountAction({ account, denominations, custodians, closing }: { account: TreasuryAccount; denominations: string[]; custodians: { value: string; label: string }[]; closing: boolean }) {
  return (
    <FinanceStep step="count_create" itemKey={account.code} label={closing ? "Cerrar caja" : "Arqueo"} icon={<Calculator size={16} />} title={closing ? `Cerrar ${account.name}` : `Arqueo sorpresa de ${account.name}`} description="Cuenta los billetes y monedas. Si hay diferencia mayor a la tolerancia, la aprueba otra persona." submitLabel={closing ? "Firmar y cerrar" : "Firmar arqueo"} trigger={(open) => <Button size="sm" variant={closing ? "primary" : "secondary"} icon={<Calculator size={15} />} onClick={open}>{closing ? "Cerrar" : "Arqueo"}</Button>}>
      <CountFields account={account} denominations={denominations} custodians={custodians} closing={closing} />
    </FinanceStep>
  );
}

export function ReplenishmentRequestAction({ account }: { account: TreasuryAccount }) {
  const missing = Math.max(0, (account.fund ?? 0) - account.balance);
  return (
    <FinanceStep step="replenishment_request" itemKey={account.code} label="Reposición" icon={<RotateCcw size={16} />} title={`Pedir reposición de ${account.name}`} description="Repone el fondo fijo con lo gastado. La aprueba una persona distinta de quien la pide." submitLabel="Solicitar" trigger={(open) => <Button size="sm" variant="ghost" icon={<RotateCcw size={15} />} onClick={open}>Reponer</Button>}>
      <SummaryBox rows={[{ label: "Fondo fijo", value: formatMoney(account.fund ?? 0) }, { label: "Saldo actual", value: formatMoney(account.balance) }, { label: "Gastado desde la última reposición", value: formatMoney(missing), strong: true }]} />
      <p className="text-[12.5px] text-fg-3">El importe es la suma de los gastos por rendir de la caja: quedan ligados a esta reposición y vuelven a quedar pendientes si se rechaza.</p>
      <TextArea label="Nota (opcional)" name="note" rows={2} maxLength={500} />
    </FinanceStep>
  );
}

export function CountDecisionActions({ count, viewerId }: { count: CashCount; viewerId: string }) {
  const own = count.signed_by_id === viewerId;
  return (
    <span className="flex flex-none gap-1.5">
      {count.status === "pending_approval" &&
        (own ? (
          <RowIcon tone="edit" label="Aprobar diferencia" icon={<ThumbsUp size={15} />} disabledHint="Quien firmó el arqueo no puede aprobar su propia diferencia." />
        ) : (
          <FinanceStep step="count_approve" itemKey={count.code} label="Aprobar" title={`Aprobar diferencia del arqueo ${count.code}`} description="Se registra un ajuste en la caja por la diferencia." submitLabel="Aprobar" trigger={(open) => <RowIcon tone="edit" label="Aprobar diferencia" icon={<ThumbsUp size={15} />} onClick={open} />}>
            <SummaryBox rows={[{ label: "Diferencia", value: formatMoney(count.difference), strong: true }, { label: "Explicación", value: count.note ?? "—" }]} />
            <TextArea label="Comentario (opcional)" name="note" rows={2} maxLength={500} />
          </FinanceStep>
        ))}
      {["signed", "approved"].includes(count.status) && (
        <FinanceStep step="count_validate" itemKey={count.code} label="Visto bueno" title={`Visto bueno contable del arqueo ${count.code}`} description="Cierra la revisión contable del arqueo." submitLabel="Dar visto bueno" trigger={(open) => <RowIcon tone="view" label="Visto bueno contable" icon={<CheckCheck size={15} />} onClick={open} />} />
      )}
    </span>
  );
}

export function ReplenishmentActions({ row, viewerId, banks, today }: { row: TreasuryOverview["replenishments"][number]; viewerId: string; banks: { value: string; label: string }[]; today: string }) {
  const own = row.requested_by_id === viewerId;
  if (row.status === "requested") {
    if (own) return <RowIcon tone="edit" label="Aprobar" icon={<ShieldCheck size={15} />} disabledHint="Quien pidió la reposición no puede aprobarla." />;
    return (
      <span className="flex gap-1.5">
        <FinanceStep step="replenishment_approve" itemKey={row.code} label="Aprobar" title={`Aprobar reposición ${row.code}`} submitLabel="Aprobar" trigger={(open) => <RowIcon tone="edit" label="Aprobar" icon={<ThumbsUp size={15} />} onClick={open} />}>
          <SummaryBox rows={[{ label: "Caja", value: row.account }, { label: "Importe", value: formatMoney(row.amount), strong: true }]} />
          <TextArea label="Comentario (opcional)" name="note" rows={2} maxLength={500} />
        </FinanceStep>
        <FinanceStep step="replenishment_reject" itemKey={row.code} label="Rechazar" title={`Rechazar reposición ${row.code}`} submitLabel="Rechazar" trigger={(open) => <RowIcon tone="delete" label="Rechazar" icon={<ThumbsDown size={15} />} onClick={open} />}>
          <TextArea label="Motivo" name="reason" rows={3} required minLength={5} maxLength={500} />
        </FinanceStep>
      </span>
    );
  }
  if (row.status === "approved") {
    return (
      <FinanceStep step="replenishment_pay" itemKey={row.code} label="Pagar" title={`Pagar reposición ${row.code}`} description="Se transfiere desde el banco a la caja." submitLabel="Pagar" trigger={(open) => <RowIcon tone="view" label="Pagar" icon={<Wallet size={15} />} onClick={open} />}>
        <SummaryBox rows={[{ label: "Caja", value: row.account }, { label: "Importe", value: formatMoney(row.amount), strong: true }]} />
        <SelectField label="Desde" name="from" options={banks} placeholder="Cuenta bancaria" />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Fecha" name="date" type="date" required max={today} defaultValue={today} />
          <TextField label="Número de operación" name="reference" required maxLength={80} />
        </div>
      </FinanceStep>
    );
  }
  return null;
}
