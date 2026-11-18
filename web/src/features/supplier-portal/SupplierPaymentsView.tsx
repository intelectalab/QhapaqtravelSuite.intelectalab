"use client";

import { AlarmClock, BadgeCheck, Hash, ReceiptText, Upload, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { registerInvoice } from "@/app/(proveedor)/proveedor/actions";
import { DataTable } from "@/components/table/DataTable";
import { RowActions, RowIcon } from "@/components/table/RowActions";
import type { Column, FilterConfig, MetricFilter, SortOption } from "@/components/table/types";
import { FieldList } from "@/components/ui/Details";
import { FilePicker } from "@/components/ui/FilePicker";
import { PanelAction } from "@/components/ui/PanelAction";
import { DateField } from "@/components/ui/DateField";
import { TextField } from "@/components/ui/TextField";
import { STEP_INITIAL } from "@/features/catalog-shared/CatalogPanels";
import { DetailPanel, MoneyLines, PanelSection, Timeline } from "@/features/channels/ChannelUi";
import { PortalTitle } from "@/features/portal/PortalUi";
import { cn } from "@/lib/cn";
import { formatDate, formatMoney } from "@/lib/format";
import type { StepResult } from "@/lib/server/resource";
import { dayDistance, supplierStatus, type SupplierPayable, type SupplierPayables } from "@/lib/supplier-portal";
import { SupplierBadge } from "./SupplierUi";

function InvoicePanel({ row, today, maxKb }: { row: SupplierPayable; today: string; maxKb: number }) {
  const router = useRouter();
  return (
    <PanelAction<StepResult>
      label="Subir factura"
      formId={`factura-${row.code}`}
      trigger={(open) => <RowIcon tone="edit" label="Subir factura" icon={<Upload size={15} />} onClick={open} />}
      title="Subir factura"
      description={`${row.code} · ${row.concept} · saldo ${formatMoney(row.balance, row.currency)}. Si el importe difiere del saldo, Finanzas revisará la diferencia.`}
      submitLabel="Registrar factura"
      action={registerInvoice.bind(null, row.code)}
      initial={STEP_INITIAL}
      onDone={() => router.refresh()}
    >
      {() => (
        <>
          <TextField label="Serie y número" name="number" required maxLength={13} pattern="[A-Za-z0-9]{4}-[0-9]{1,8}" placeholder="F001-4521" icon={<Hash size={17} />} hint="Serie de 4 caracteres, guion y correlativo." />
          <div className="grid grid-cols-2 gap-3">
            <DateField label="Fecha de emisión" name="issue_date" max={today} defaultValue={today} required />
            <TextField label={`Importe (${row.currency})`} name="amount" type="number" step="0.01" min="0.01" defaultValue={row.balance.toFixed(2)} required />
          </div>
          <FilePicker label="Archivo de la factura" accept=".pdf,.xml,.zip" formats="PDF, XML o ZIP" maxKb={maxKb} />
        </>
      )}
    </PanelAction>
  );
}

function PayableDetail({ row }: { row: SupplierPayable }) {
  return (
    <DetailPanel label="Ver documento" title={row.concept} description={`${row.code}${row.reservation ? ` · reserva ${row.reservation}` : ""}`}>
      <FieldList
        fields={[
          { label: "Importe", value: formatMoney(row.amount, row.currency) },
          { label: "Pagado", value: formatMoney(row.paid, row.currency) },
          { label: "Saldo", value: <b>{formatMoney(row.balance, row.currency)}</b> },
          { label: "Vencimiento", value: formatDate(row.due_date) },
          ...(row.scheduled_date ? [{ label: "Pago programado", value: formatDate(row.scheduled_date) }] : []),
          { label: "Estado", value: <SupplierBadge status={row.status} scope="payable" /> },
          ...(row.service ? [{ label: "Servicio", value: row.service }] : []),
        ]}
      />
      <PanelSection title="Tu factura">
        {row.invoice ? (
          <FieldList
            fields={[
              { label: "Número", value: <span className="font-mono">{row.invoice.number}</span> },
              { label: "Emisión", value: formatDate(row.invoice.issue_date) },
              { label: "Importe", value: formatMoney(row.invoice.amount, row.currency) },
              ...(row.invoice.difference ? [{ label: "Diferencia", value: <span className="text-warn">{formatMoney(row.invoice.difference, row.currency)} · en revisión</span> }] : []),
              { label: "Archivo", value: row.invoice.file },
              { label: "Estado", value: <SupplierBadge status={row.invoice.status} scope="invoice" /> },
              ...(row.invoice.note ? [{ label: "Nota de Finanzas", value: <span className="whitespace-normal">{row.invoice.note}</span> }] : []),
            ]}
          />
        ) : (
          <p className="text-[13px] text-fg-3">Aún no registra la factura de este documento.</p>
        )}
      </PanelSection>
      <PanelSection title="Pagos recibidos" aside={row.payouts.length}>
        <Timeline items={row.payouts.map((payout) => ({ key: payout.code, title: formatMoney(payout.amount, row.currency), meta: `${formatDate(payout.paid_on)} · ${payout.method}${payout.reference ? ` · op. ${payout.reference}` : ""}` }))} />
      </PanelSection>
    </DetailPanel>
  );
}

export function SupplierPaymentsView({ data }: { data: SupplierPayables }) {
  const columns: Column<SupplierPayable>[] = [
    {
      id: "doc",
      header: "Documento",
      mobile: "title",
      cell: (row) => (
        <span className="block min-w-0">
          <b className="block max-w-[320px] truncate font-semibold">{row.concept}</b>
          <span className="text-[12px] text-fg-3">
            {row.code}
            {row.reservation ? ` · ${row.reservation}` : ""}
          </span>
        </span>
      ),
    },
    {
      id: "amount",
      header: "Importe",
      align: "right",
      cell: (row) => (
        <span className="block text-right leading-tight">
          <b className="block text-[13.5px]">{formatMoney(row.balance, row.currency)}</b>
          <span className="text-[12px] text-fg-3">de {formatMoney(row.amount, row.currency)}</span>
        </span>
      ),
    },
    {
      id: "due",
      header: "Fecha",
      cell: (row) => (
        <span className="block leading-tight">
          <span className="block text-[13px]">{row.scheduled_date ? `Programado ${formatDate(row.scheduled_date)}` : `Vence ${formatDate(row.due_date)}`}</span>
          {row.status !== "pagada" && <span className={cn("text-[12px]", row.status === "vencida" ? "font-semibold text-bad" : "text-fg-3")}>{dayDistance(row.days_to)}</span>}
        </span>
      ),
    },
    { id: "status", header: "Estado", cell: (row) => <SupplierBadge status={row.status} scope="payable" /> },
    {
      id: "invoice",
      header: "Tu factura",
      mobile: "detail",
      cell: (row) =>
        row.invoice ? (
          <span className="flex flex-col items-start gap-0.5">
            <span className="font-mono text-[12.5px]">{row.invoice.number}</span>
            <SupplierBadge status={row.invoice.status} scope="invoice" />
          </span>
        ) : (
          <span className={cn("text-[12.5px]", row.can_invoice ? "font-medium text-warn" : "text-fg-3")}>{row.can_invoice ? "Pendiente" : "No requiere"}</span>
        ),
    },
    {
      id: "actions",
      header: "",
      align: "right",
      cell: (row) => (
        <RowActions>
          <PayableDetail row={row} />
          {row.can_invoice && <InvoicePanel row={row} today={data.today} maxKb={data.max_kb} />}
        </RowActions>
      ),
    },
  ];

  const metrics: MetricFilter<SupplierPayable>[] = [
    { id: "open", label: "Saldo por cobrar", icon: <Wallet size={19} />, tone: "t3", display: <MoneyLines values={data.totals.balance} empty="Sin saldo" />, note: "Por moneda, sin conversión", info: <p>Lo que la agencia aún te debe, sumado por moneda sin convertir. Al presionarla ves los documentos con saldo pendiente.</p>, matches: (row) => row.balance > 0.004 },
    { id: "overdue", label: "Vencidos", icon: <AlarmClock size={19} />, tone: data.totals.overdue ? "bad" : "t1", note: data.totals.overdue ? "Consulte con Pagos de la agencia" : "Ninguno", info: <p>Documentos cuya fecha de vencimiento ya pasó sin pago completo. Al presionarla ves solo esos documentos.</p>, matches: (row) => row.status === "vencida" },
    { id: "invoice", label: "Sin factura", icon: <ReceiptText size={19} />, tone: data.totals.without_invoice ? "warn" : "ok", note: data.totals.without_invoice ? "Súbala para que se programe el pago" : "Todo facturado", info: <p>Documentos que esperan tu factura; la agencia programa el pago cuando la registras. Al presionarla ves solo esos documentos.</p>, matches: (row) => row.can_invoice },
    { id: "paid", label: "Cobrado", icon: <BadgeCheck size={19} />, tone: "ok", display: <MoneyLines values={data.totals.paid} empty="Aún sin pagos" />, note: "Pagos registrados por la agencia", info: <p>Pagos que la agencia registró a tu nombre, sumados por moneda. Al presionarla ves los documentos ya pagados.</p>, matches: (row) => row.status === "pagada" },
  ];
  const filters: FilterConfig<SupplierPayable>[] = [
    { id: "status", label: "Estado", options: [...new Set(data.rows.map((row) => row.status))].map((value) => ({ value, label: supplierStatus(value, "payable").label })), value: (row) => row.status },
    { id: "currency", label: "Moneda", options: [...new Set(data.rows.map((row) => row.currency))].map((value) => ({ value, label: value })), value: (row) => row.currency },
  ];
  const sorts: SortOption<SupplierPayable>[] = [
    { id: "due", label: "Vencimiento", type: "date", value: (row) => row.due_date },
    { id: "balance", label: "Saldo", type: "number", value: (row) => row.balance },
  ];

  return (
    <>
      <PortalTitle title="Pagos" subtitle={data.payment_terms ? `Condición de pago de tu contrato: ${data.payment_terms}. La agencia programa el pago cuando registra tu factura.` : "La agencia programa el pago cuando registra tu factura."} />
      <DataTable
        screen="proveedor-pagos"
        rows={data.rows}
        columns={columns}
        getKey={(row) => row.code}
        entityLabel="documentos"
        metrics={metrics}
        filters={filters}
        sorts={sorts}
        searchText={(row) => `${row.code} ${row.concept} ${row.reservation ?? ""} ${row.invoice?.number ?? ""}`}
        searchPlaceholder="Buscar documento, reserva o factura"
        emptyTitle="La agencia aún no registra cuentas por pagar a tu nombre"
      />
    </>
  );
}
