export interface FxCurrency {
  code: string;
  name: string;
  rate: number | null;
  previous: number | null;
  date: string | null;
  source: string | null;
  trend: { date: string; rate: number }[];
}

export interface FxEntry {
  id: string;
  currency: string;
  rate: number;
  previous: number | null;
  date: string;
  source: string;
  at: string;
  user: string;
}

export interface FxOverview {
  base: string;
  currencies: FxCurrency[];
  history: FxEntry[];
  can_register: boolean;
}

export const FX_SOURCES = ["SBS referencial", "SUNAT", "Manual (Finanzas)", "Banco"];

export interface FinanceOption {
  value: string;
  label: string;
}

export interface PaymentMethodOption extends FinanceOption {
  requires_reference: boolean;
  b2b: boolean;
}

export interface ReceivableRow {
  code: string;
  kind: string;
  concept: string;
  amount: number;
  paid: number;
  balance: number;
  balance_pen: number;
  currency: string;
  fx_rate: number | null;
  due_date: string;
  days_overdue: number;
  status: string;
  cancel_reason: string | null;
  reservation: { code: string; title: string; status: string };
  client: { code: string; name: string };
  owner: string | null;
}

export interface AgingBucket {
  label: string;
  pen: number;
  count: number;
}

export interface ReceivablesOverview {
  today: string;
  rows: ReceivableRow[];
  kpis: { receivable_pen: number; receivable_count: number; overdue_pen: number; overdue_count: number; due_week_pen: number; collected_month_pen: number };
  aging: AgingBucket[];
  methods: PaymentMethodOption[];
  usd_rate: number;
  can: { register: boolean; cancel: boolean };
}

export interface ApplyOption {
  code: string;
  concept: string;
  balance: number;
  overdue: boolean;
}

export interface PaymentRow {
  code: string;
  lock_version: number;
  kind: string;
  source: string;
  method: string;
  amount: number;
  currency: string;
  fx_rate: number | null;
  pen: number;
  paid_on: string;
  reference: string | null;
  note: string | null;
  status: string;
  reason: string | null;
  retries: number;
  receivable: string | null;
  reservation: { code: string; title: string };
  client: string | null;
  registered_by: string;
  bank_line: string | null;
  apply_to: ApplyOption[];
}

export interface PaymentsOverview {
  rows: PaymentRow[];
  kpis: { pending_count: number; pending_pen: number; applied_month_pen: number; applied_month_count: number; reverted_count: number; reverted_pen: number; rejected_count: number };
  can: { validate: boolean; revert: boolean };
}

export interface PayableRow {
  code: string;
  lock_version: number;
  kind: string;
  cost_type: string | null;
  concept: string;
  amount: number;
  paid: number;
  balance: number;
  balance_pen: number;
  currency: string;
  fx_rate: number | null;
  due_date: string;
  days_overdue: number;
  status: string;
  approved: boolean;
  supplier_doc: string | null;
  evidence: string | null;
  observation: string | null;
  scheduled_date: string | null;
  provider: { ref: string; name: string; status: string };
  reservation: { code: string; title: string } | null;
  service: string | null;
}

export interface NamedAmount {
  name: string;
  pen: number;
  count: number;
}

export interface PayablesOverview {
  rows: PayableRow[];
  kpis: { payable_pen: number; payable_count: number; overdue_pen: number; overdue_count: number; to_approve: number; due_week_pen: number; paid_month_pen: number };
  by_provider: NamedAmount[];
  options: { providers: FinanceOption[]; reservations: (FinanceOption & { currency: string })[]; cost_types: FinanceOption[]; payout_methods: FinanceOption[] };
  today: string;
  usd_rate: number;
  can: { manage: boolean; operate: boolean };
}

export interface CommissionRow {
  code: string;
  lock_version: number;
  kind: string;
  kind_label: string;
  beneficiary: string;
  rule: string;
  base: number;
  pct: number;
  amount: number;
  currency: string;
  pen: number;
  status: string;
  approved_at: string | null;
  paid_at: string | null;
  payment: string | null;
  created_at: string;
  reservation: { code: string; title: string } | null;
  pay_methods: string[];
}

export interface CommissionsOverview {
  rows: CommissionRow[];
  kpis: Record<"calculada" | "aprobada" | "pagada", { count: number; pen: number }> & { pending_reservations: number };
  by_beneficiary: NamedAmount[];
  rules: { condition: string; pct: number | null; base: string }[];
  can: { approve: boolean; operate: boolean };
}

export interface ProfitRow {
  code: string;
  title: string;
  client: string;
  owner: string;
  channel: string;
  status: string;
  travel_from: string;
  currency: string;
  income_pen: number;
  cost_pen: number;
  extra_cost_pen: number;
  commissions_pen: number;
  margin_pen: number;
  net_pen: number;
  margin_pct: number;
  band: "ok" | "warn" | "bad";
}

export interface ProfitGroup {
  name: string;
  income_pen: number;
  margin_pen: number;
  margin_pct: number;
  count: number;
}

export interface ProfitabilityOverview {
  rows: ProfitRow[];
  kpis: { income_pen: number; cost_pen: number; commissions_pen: number; margin_pen: number; net_pen: number; margin_pct: number; below_floor: number };
  by_product: ProfitGroup[];
  by_owner: ProfitGroup[];
  by_channel: ProfitGroup[];
  monthly: { month: string; label: string; income_pen: number; cost_pen: number; margin_pen: number }[];
  target: number;
  floor: number;
}

export interface InvoiceRow {
  number: string;
  doc_type: string;
  type: string;
  issue_date: string;
  customer: { name: string; doc_type: string; doc_number: string; domiciled: boolean };
  operation: string;
  currency: string;
  fx_rate: number | null;
  taxable: number;
  igv: number;
  total: number;
  pen: number;
  in_words: string;
  description: string;
  status: string;
  ose_message: string | null;
  credit_reason: string | null;
  delivered: boolean;
  reservation: { code: string; title: string };
  receivable: string | null;
  ref_number: string | null;
  issued_by: string | null;
  lock_version: number;
  creditable: number;
}

export interface InvoiceKpis {
  month_count: number;
  month_pen: number;
  accepted: number;
  observed: number;
  waiting: number;
  credit_notes_pen: number;
  uninvoiced_pen: number;
}

export interface InvoiceListMeta {
  kpis: InvoiceKpis;
  reasons: FinanceOption[];
  can: { issue: boolean };
}

export interface InvoicesOverview extends InvoiceListMeta {
  rows: InvoiceRow[];
  pending: InvoicePending[];
}

export interface InvoicePending {
  code: string;
  concept: string;
  client: string;
  reservation: string;
  currency: string;
  paid: string;
  pending: string;
}

export interface InvoiceDraft {
  receivable: { code: string; kind: string; concept: string; amount: string; paid: string; status: string };
  reservation: { code: string; title: string };
  doc_type: "01" | "03";
  customer_doc_type: string;
  customer_doc_number: string;
  customer_name: string;
  customer_address: string | null;
  domiciled: boolean;
  currency: string;
  fx_rate: string | null;
  amount: string;
  maximum: string;
  description: string;
}

export interface InvoiceCheck {
  ok: boolean;
  checks: { rule: string; ok: boolean; message: string | null }[];
  maximum: string;
  operation_type: string;
  taxable_amount: string;
  igv_amount: string;
  total_amount: string;
  amount_in_words: string;
}

export interface TreasuryAccount {
  code: string;
  kind: "bank" | "petty_cash" | "gateway";
  kind_label: string;
  bank: string | null;
  name: string;
  number: string | null;
  currency: string;
  balance: number;
  balance_pen: number;
  fund: number | null;
  sede: string | null;
  custodian: string | null;
  active: boolean;
}

export interface TreasuryMovement {
  code: string;
  date: string;
  direction: "in" | "out";
  type: string;
  type_label: string;
  amount: number;
  currency: string;
  pen: number;
  manual: boolean;
  category: string | null;
  description: string;
  reference: string | null;
  counterparty: string | null;
  status: "posted" | "voided";
  void_reason: string | null;
  account: { code: string; name: string };
  user: string;
}

export interface CashSession {
  code: string;
  date: string;
  account: string;
  opened_by: string | null;
  opened_at: string;
  closed_at: string | null;
  opening: number;
  status: "open" | "closed";
  count: { code: string; counted: number; difference: number; result: string; status: string; note: string | null } | null;
}

export interface TreasuryOverview {
  accounts: TreasuryAccount[];
  movements: TreasuryMovement[];
  sessions: CashSession[];
  replenishments: { code: string; amount: number; status: string; status_label: string; requested_at: string; note: string | null; account: string; requested_by: string | null }[];
  kpis: { bank_pen: number; cash_pen: number; gateway_pen: number; total_pen: number; in_month_pen: number; out_month_pen: number; open_sessions: number };
  categories: string[];
  usd_rate: number;
  today: string;
  can: { manage: boolean };
}

export interface BankLineRow {
  code: string;
  bank: string;
  date: string;
  description: string;
  amount: number;
  currency: string;
  status: string;
  resolution: string | null;
  note: string | null;
  match: { kind: "payment" | "payable"; code: string; label: string; amount: number; currency: string; pen: number; status: string | null } | null;
  difference: number | null;
  closure: string | null;
  resolved_by: string | null;
}

export interface ReconciliationOverview {
  rows: BankLineRow[];
  kpis: { pending: number; suggested: number; exceptions: number; reconciled: number; credits_pen: number; debits_pen: number; progress: number };
  closures: { code: string; period: string; closed_at: string; lines_count: number; credits: number; debits: number; net: number }[];
  can: { operate: boolean };
}

export interface InvoiceDetail extends InvoiceRow {
  customer_address: string | null;
  lines: { line_no: number; description: string; quantity: string; unit_code: string; unit_value: string; igv_affectation: string; line_amount: string; igv_amount: string }[];
  fiscal_events: { action: string; attempt: number; response_code: string | null; response_message: string | null; status: string; created_at: string }[];
  history: { status: string; note: string | null; created_at: string; user: string | null }[];
  credit_notes: { number: string; status: string; total_amount: string; credit_note_reason: string | null }[];
  ose_ticket: string | null;
  hash: string | null;
}
