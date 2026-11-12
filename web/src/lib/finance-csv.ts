import type { CsvExport } from "@/lib/csv";
import type { CommissionRow, InvoiceRow, PayableRow, PaymentRow, ProfitRow, ReceivableRow, TreasuryMovement } from "@/lib/finance";

export const RECEIVABLES_CSV: CsvExport<ReceivableRow> = {
  fileName: "cuentas-por-cobrar",
  columns: [
    { header: "Código", value: (row) => row.code },
    { header: "Reserva", value: (row) => row.reservation.code },
    { header: "Cliente", value: (row) => row.client.name },
    { header: "Concepto", value: (row) => row.concept },
    { header: "Moneda", value: (row) => row.currency },
    { header: "Monto", value: (row) => row.amount },
    { header: "Pagado", value: (row) => row.paid },
    { header: "Saldo", value: (row) => row.balance },
    { header: "Saldo en soles", value: (row) => row.balance_pen },
    { header: "Vence", value: (row) => row.due_date },
    { header: "Días de atraso", value: (row) => row.days_overdue },
    { header: "Estado", value: (row) => row.status },
    { header: "Asesor", value: (row) => row.owner ?? "" },
  ],
};

export const PAYMENTS_CSV: CsvExport<PaymentRow> = {
  fileName: "pagos",
  columns: [
    { header: "Código", value: (row) => row.code },
    { header: "Fecha", value: (row) => row.paid_on },
    { header: "Tipo", value: (row) => row.kind },
    { header: "Reserva", value: (row) => row.reservation.code },
    { header: "Cliente", value: (row) => row.client ?? "" },
    { header: "Medio", value: (row) => row.method },
    { header: "Referencia", value: (row) => row.reference ?? "" },
    { header: "Moneda", value: (row) => row.currency },
    { header: "Monto", value: (row) => row.amount },
    { header: "En soles", value: (row) => row.pen },
    { header: "Estado", value: (row) => row.status },
    { header: "Registró", value: (row) => row.registered_by },
  ],
};

export const PAYABLES_CSV: CsvExport<PayableRow> = {
  fileName: "cuentas-por-pagar",
  columns: [
    { header: "Código", value: (row) => row.code },
    { header: "Proveedor", value: (row) => row.provider.name },
    { header: "Concepto", value: (row) => row.concept },
    { header: "Reserva", value: (row) => row.reservation?.code ?? "" },
    { header: "Moneda", value: (row) => row.currency },
    { header: "Monto", value: (row) => row.amount },
    { header: "Pagado", value: (row) => row.paid },
    { header: "Saldo", value: (row) => row.balance },
    { header: "Saldo en soles", value: (row) => row.balance_pen },
    { header: "Vence", value: (row) => row.due_date },
    { header: "Programado", value: (row) => row.scheduled_date ?? "" },
    { header: "Estado", value: (row) => row.status },
  ],
};

export const COMMISSIONS_CSV: CsvExport<CommissionRow> = {
  fileName: "comisiones",
  columns: [
    { header: "Código", value: (row) => row.code },
    { header: "Tipo", value: (row) => row.kind_label },
    { header: "Beneficiario", value: (row) => row.beneficiary },
    { header: "Regla", value: (row) => row.rule },
    { header: "Base", value: (row) => row.base },
    { header: "Porcentaje", value: (row) => row.pct },
    { header: "Moneda", value: (row) => row.currency },
    { header: "Monto", value: (row) => row.amount },
    { header: "En soles", value: (row) => row.pen },
    { header: "Estado", value: (row) => row.status },
    { header: "Aprobada", value: (row) => row.approved_at ?? "" },
    { header: "Pagada", value: (row) => row.paid_at ?? "" },
  ],
};

export const INVOICES_CSV: CsvExport<InvoiceRow> = {
  fileName: "comprobantes",
  columns: [
    { header: "Número", value: (row) => row.number },
    { header: "Tipo", value: (row) => row.type },
    { header: "Emisión", value: (row) => row.issue_date },
    { header: "Cliente", value: (row) => row.customer.name },
    { header: "Documento", value: (row) => `${row.customer.doc_type} ${row.customer.doc_number}` },
    { header: "Moneda", value: (row) => row.currency },
    { header: "Gravado", value: (row) => row.taxable },
    { header: "IGV", value: (row) => row.igv },
    { header: "Total", value: (row) => row.total },
    { header: "Total en soles", value: (row) => row.pen },
    { header: "Estado", value: (row) => row.status },
  ],
};

export const PROFIT_CSV: CsvExport<ProfitRow> = {
  fileName: "rentabilidad",
  columns: [
    { header: "Reserva", value: (row) => row.code },
    { header: "Viaje", value: (row) => row.title },
    { header: "Cliente", value: (row) => row.client },
    { header: "Asesor", value: (row) => row.owner },
    { header: "Canal", value: (row) => row.channel },
    { header: "Inicio", value: (row) => row.travel_from },
    { header: "Ingreso (S/)", value: (row) => row.income_pen },
    { header: "Costo (S/)", value: (row) => row.cost_pen },
    { header: "Costos adicionales (S/)", value: (row) => row.extra_cost_pen },
    { header: "Comisiones (S/)", value: (row) => row.commissions_pen },
    { header: "Margen (S/)", value: (row) => row.margin_pen },
    { header: "Neto (S/)", value: (row) => row.net_pen },
    { header: "Estado", value: (row) => row.status },
  ],
};

export const MOVEMENTS_CSV: CsvExport<TreasuryMovement> = {
  fileName: "extracto",
  columns: [
    { header: "Código", value: (row) => row.code },
    { header: "Fecha", value: (row) => row.date },
    { header: "Movimiento", value: (row) => (row.direction === "in" ? "Ingreso" : "Egreso") },
    { header: "Tipo", value: (row) => row.type_label },
    { header: "Descripción", value: (row) => row.description },
    { header: "Contraparte", value: (row) => row.counterparty ?? "" },
    { header: "Referencia", value: (row) => row.reference ?? "" },
    { header: "Moneda", value: (row) => row.currency },
    { header: "Monto", value: (row) => row.amount },
    { header: "En soles", value: (row) => row.pen },
    { header: "Estado", value: (row) => (row.status === "voided" ? "Anulado" : "Registrado") },
  ],
};
