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
  advance_reservations: AdvanceOption[];
  can: { register: boolean; cancel: boolean; invoice: boolean };
}

export interface AdvanceOption extends FinanceOption {
  client: string;
  currency: string;
  total: number;
  committed: number;
  available: number;
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
  amount_pen: number;
  paid_pen: number;
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
  scheduled_account: string | null;
  provider: { ref: string; name: string; status: string };
  reservation: { code: string; title: string } | null;
  service: { code: string; name: string; date: string; status: string } | null;
  managed: boolean;
}

export interface NamedAmount {
  name: string;
  pen: number;
  count: number;
}

export interface PayablesOverview {
  rows: PayableRow[];
  kpis: { payable_pen: number; payable_count: number; overdue_pen: number; overdue_count: number; to_approve: number; due_week_pen: number; paid_month_pen: number; scheduled_week_pen: number; scheduled_week_count: number };
  by_provider: NamedAmount[];
  options: { providers: FinanceOption[]; reservations: (FinanceOption & { currency: string })[]; cost_types: FinanceOption[]; payout_methods: FinanceOption[]; bank_accounts: BankAccountOption[] };
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

export interface BankAccountOption extends FinanceOption {
  currency: string;
}

export interface CommissionRule {
  id: string;
  lock_version: number;
  condition: "directo_ecommerce" | "corporativo_grupos" | "b2b_convenio";
  condition_label: string;
  beneficiary: string;
  pct: number | null;
  base_type: "neto_sin_igv" | "total";
  base: string;
  valid_from: string;
  valid_to: string | null;
  active: boolean;
  in_force: boolean;
  used: number;
  updated_at: string | null;
  updated_by: string | null;
}

export interface BeneficiarySummary extends NamedAmount {
  kind: string;
  calculated: number;
  approved: number;
  paid: number;
}

export interface CommissionsOverview {
  rows: CommissionRow[];
  kpis: Record<"calculada" | "aprobada" | "pagada", { count: number; pen: number }> & { pending_reservations: number };
  by_beneficiary: BeneficiarySummary[];
  rules: CommissionRule[];
  can: { approve: boolean; operate: boolean; rules: boolean };
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
  settled_at: string | null;
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
  kpis: { income_pen: number; cost_pen: number; commissions_pen: number; margin_pen: number; net_pen: number; margin_pct: number; below_floor: number; settled: number };
  by_product: ProfitGroup[];
  by_owner: ProfitGroup[];
  by_channel: ProfitGroup[];
  monthly: { month: string; label: string; income_pen: number; cost_pen: number; margin_pen: number; margin_pct: number }[];
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

export interface InvoiceInvoiceable {
  value: string;
  label: string;
  hint: string;
  kind: string;
  paid: boolean;
}

export interface InvoiceKpis {
  month_count: number;
  month_pen: number;
  accepted: number;
  observed: number;
  rejected?: number;
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
  voidable?: boolean;
  category: string | null;
  description: string;
  reference: string | null;
  counterparty: string | null;
  status: "posted" | "voided";
  void_reason: string | null;
  voided: { at: string; by: string | null } | null;
  created_at: string;
  fx_rate: number | null;
  origin: { label: string; code: string | null; href: string | null } | null;
  reservation: string | null;
  receipt: { type: string; number: string | null; ruc: string | null; supplier: string; file: boolean } | null;
  account: { code: string; name: string };
  user: string;
}

export interface TreasurySettingsData {
  petty_tolerance: number;
  max_petty_expense: number;
  sworn_statement_max: number;
  replenish_threshold_pct: number;
  gateway_fee_pct: number;
  cash_deposit_hours: number;
  margin_target_pct: number;
  margin_floor_pct: number;
  recurring_outflows: { concept: string; amount: number; day: number }[];
  payment_routing: PaymentRoutingRule[];
  routing_banks: string[];
  lock_version: number;
  updated_at: string | null;
  updated_by: string | null;
}

export type RoutingDestination = "bank" | "gateway" | "petty_cash" | "none";

export interface PaymentRoutingRule {
  method: string;
  label: string;
  b2b: boolean;
  destination: RoutingDestination;
  bank: string | null;
  currency: "PEN" | "USD" | null;
  accounts: { PEN: string | null; USD: string | null };
}

export const ROUTING_DESTINATIONS: Record<RoutingDestination, string> = {
  bank: "Cuenta bancaria",
  gateway: "Pasarela de pagos",
  petty_cash: "Caja chica de la sede",
  none: "Sin movimiento de caja",
};

export interface FxRevaluationPreview {
  period: string;
  today: string;
  close_rate: string;
  reference_rate: number;
  rows: { code: string; name: string; kind: string; balance_usd: string; book_rate: string; book_pen: string; market_pen: string; unrealized_pen: string; realized_pen: string; registered: string | null }[];
  totals: { unrealized_pen: string; realized_pen: string };
  pending: number;
  history: { code: string; period: string; date: string; balance_usd: string; book_rate: string; close_rate: string; diff_pen: string; account: { code: string; name: string }; user: string | null }[];
  can: { register: boolean };
}

export interface PeriodCheck {
  code: string;
  label: string;
  detail: string;
  ok: boolean;
  href?: string;
  checked_at?: string | null;
  checked_by?: string | null;
}

export interface PeriodCloseState {
  period: string;
  label: string;
  status: "abierto" | "cerrado";
  closed_at: string | null;
  closed_by: string | null;
  automatic: PeriodCheck[];
  manual: PeriodCheck[];
  done: number;
  total: number;
  periods: { period: string; label: string; closed: boolean }[];
  can: { manage: boolean; close: boolean };
}

export interface CashSession {
  code: string;
  date: string;
  account: string;
  account_code: string;
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
  replenishments: { code: string; amount: number; status: string; status_label: string; requested_at: string; note: string | null; reject_reason: string | null; account: string; account_code: string; requested_by: string | null; requested_by_id: string }[];
  kpis: { bank_pen: number; cash_pen: number; gateway_pen: number; total_pen: number; in_month_pen: number; out_month_pen: number; open_sessions: number };
  categories: { in: string[]; out: string[] };
  usd_rate: number;
  today: string;
  can: { manage: boolean; settings: boolean; revalue: boolean };
  counts: CashCount[];
  alerts: { tone: "warn" | "bad" | "info"; text: string }[];
  options: { sedes: { value: string; label: string }[]; custodians: { value: string; label: string }[]; denominations: string[]; gateway_fee_pct: string | null; max_petty_expense: string | null };
  viewer_id: string;
}

export interface CashCount {
  code: string;
  kind: "closing" | "surprise";
  at: string;
  counted: string;
  expected: string;
  difference: string;
  result: string;
  status: string;
  status_label: string;
  note: string | null;
  signed_by_id: string;
  signed_by: string | null;
  witness: string | null;
  account: { code: string; name: string };
}

export interface TreasuryLedger {
  code: string;
  kind: TreasuryAccount["kind"];
  kind_label: string;
  name: string;
  bank: string | null;
  number: string | null;
  cci: string | null;
  currency: string;
  sede: string | null;
  custodian: string | null;
  fund: string | null;
  settle_to: { code: string; name: string } | null;
  opening_balance: string;
  opening_date: string;
  active: boolean;
  balance: string;
  month_in: string;
  month_out: string;
  open_session: { code: string; opened_at: string; opening_amount: string } | null;
  movements: { code: string; date: string; direction: "in" | "out"; type: string; type_label: string; amount: string; category: string | null; description: string; reference: string | null; counterparty: string | null; manual: boolean; status: string; balance: string; user: string }[];
}

export interface CashFlowProjection {
  opening_pen: number;
  horizons: { label: string; in: number; out: number; net: number; closing: number }[];
  items: { kind: "in" | "out"; source: string; code: string | null; concept: string; date: string; overdue: boolean; pen: number }[];
  risk: { label: string; closing: number } | null;
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
  closures: { code: string; period: string; closed_at: string; lines_count: number; credits: number; debits: number; net: number; matched_count: number; others_count: number; closed_by: string | null }[];
  last_import: { bank: string; filename: string; lines_count: number; imported_at: string; imported_by: string | null } | null;
  accounts: { code: string; name: string; bank: string | null; currency: string }[];
  banks: string[];
  can: { operate: boolean };
}

export interface LineCandidate {
  kind: "payment" | "payable";
  code: string;
  label: string;
  amount: number;
  currency: string;
  pen: number;
  status: string | null;
  reference_hit: boolean;
  difference: number;
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

type Audit = { id: string; action: string; before: string | null; after: string | null; occurred_at: string; actor: string | null }[];
type History = { status: string; note: string | null; created_at: string; user: string | null }[];

export interface ReceivableDetail {
  code: string;
  kind: string;
  concept: string;
  status: string;
  currency: string;
  fx_rate: string;
  amount: string;
  paid: string;
  balance: string;
  due_date: string;
  cancel_reason: string | null;
  created_at: string;
  last_reminder_at: string | null;
  reservation: { code: string; title: string; status: string };
  client: { code: string; name: string; email: string | null };
  payments: { code: string; paid_on: string; method: string; reference: string | null; status: string; amount: string; applied_at: string; reversed_at: string | null }[];
  invoices: { number: string; doc_type: string; issue_date: string; total_amount: string; currency: string; status: string }[];
  reminders: { channels: string | null; sent_at: string; balance_at_send: string | null; sent_by: string | null }[];
  notifications: { code: string; channel: string; recipient_address: string | null; subject: string | null; status: string; sent_at: string | null; created_at: string }[];
  audit: Audit;
  lock_version: number;
  balance_pen: string;
  methods: PaymentMethodOption[];
  today: string;
  usd_rate: number;
  can: { register: boolean; invoice: boolean };
}

export interface PaymentDetail {
  code: string;
  kind: string;
  source: string | null;
  method: string;
  amount: string;
  currency: string;
  fx_rate: string;
  pen: string;
  paid_on: string;
  reference: string | null;
  note: string | null;
  status: string;
  reject_reason: string | null;
  reverted_at: string | null;
  revert_reason: string | null;
  reported_by_agency: boolean;
  registered_by: string | null;
  created_at: string;
  reservation: { code: string; title: string } | null;
  client: { code: string; name: string } | null;
  applications: { code: string; concept: string; due_date: string; amount: string; applied_at: string; reversed_at: string | null }[];
  bank_line: { code: string; value_date: string; description: string; amount: string; status: string } | null;
  history: History;
  audit: Audit;
  retries: number;
  lock_version: number;
  can: { retry: boolean };
}

export interface PayableDetail {
  code: string;
  kind: string;
  cost_type: string | null;
  concept: string;
  status: string;
  currency: string;
  fx_rate: string;
  amount: string;
  paid: string;
  balance: string;
  due_date: string;
  scheduled_date: string | null;
  supplier_doc: string | null;
  evidence: string | null;
  observation: string | null;
  approved_at: string | null;
  approved_by: string | null;
  created_at: string;
  provider: { ref: string; name: string; ruc: string | null; terms: string | null } | null;
  reservation: { code: string; title: string; service: string | null } | null;
  payouts: { code: string; paid_on: string; amount: string; method: string; operation_ref: string | null; account: string | null }[];
  history: History;
  audit: Audit;
  lock_version: number;
  scheduled: { date: string; account: { code: string; name: string } | null; by: string | null } | null;
  bank_accounts: BankAccountOption[];
  today: string;
  can: { manage: boolean; operate: boolean };
}

export interface CommissionDetail {
  code: string;
  kind: string;
  status: string;
  currency: string;
  fx_rate: string;
  base: string;
  pct: string;
  amount: string;
  rule: string | null;
  beneficiary: string | null;
  beneficiary_kind: string;
  approved_at: string | null;
  approved_by: string | null;
  paid_at: string | null;
  payment_method: string | null;
  payment_ref: string | null;
  observation: string | null;
  reservation: { code: string; title: string } | null;
  current_rule: { pct: string; active: boolean; condition: string | null; expected: string; difference: string } | null;
  history: History;
  audit: Audit;
  lock_version: number;
  can: { recalculate: boolean };
}

export interface SettlementDetail {
  reservation: { code: string; title: string; status: string; client: string; currency: string };
  statement: { income: string; cost: string; commissions: string; net: string; margin_pct: string | null };
  cash: { collected: string; paid_out: string; position: string };
  receivables: { code: string; concept: string; amount: string; paid_amount: string; status: string; due_date: string }[];
  payables: { code: string; concept: string; amount: string; paid_amount: string; currency: string; status: string; provider: string | null }[];
  commissions: { code: string; kind: string; amount: string; currency: string; status: string }[];
  checks: { key: string; label: string; ok: boolean; detail: string }[];
  can_close: boolean;
  closed: { closed_at: string; closed_by: string | null; net_pen: string; gross_margin_pct: string | null } | null;
}
