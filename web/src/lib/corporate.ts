import type { Tone } from "@/lib/tone";

export type CorporateRole = "administrador" | "aprobador" | "pagador" | "viajero";

export type BudgetState = "en_rango" | "alerta" | "excedido" | "sin_presupuesto";

export interface CorporateBadge {
  role: CorporateRole;
  role_label: string;
  pending_approvals: number;
}

export interface CorporatePeriodOption {
  value: string;
  label: string;
}

export interface CorporatePanel {
  client: { code: string; name: string; doc: string };
  currency: string;
  credit_days: number;
  require_approval: boolean;
  approval_threshold: string | null;
  role: CorporateRole;
  role_label: string;
  scope: string | null;
  cost_center: string | null;
  can: { statements: boolean; statements_manage: boolean; approvals: boolean; manage: boolean; travelers: boolean };
  periods: CorporatePeriodOption[];
  pending_approvals: number;
}

export interface CostCenter {
  id: string;
  code: string;
  name: string;
  budget_amount: string | null;
  budget_period: "mensual" | "trimestral" | "anual";
  budget_period_label: string;
  budget_window: { from: string; to: string };
  used: string;
  used_pct: string | null;
  budget_state: BudgetState;
  purchases: number;
  travelers: number;
  active: boolean;
  is_default: boolean;
  period_amount?: string;
  year_amount?: string;
}

export interface CorporateSummary {
  period: { key: string; label: string; from: string; to: string };
  currency: string;
  scope: string | null;
  kpis: { total: string; purchases: number; balance: string; travelers: number; average_ticket: string | null };
  months: { month: string; label: string; amount: string; count: number }[];
  cost_centers: CostCenter[];
  travelers: { name: string; trips: number; amount: string }[];
}

export interface Allocation {
  cost_center: string;
  pct: string;
  amount: string;
}

export interface CorporatePurchase {
  id: string;
  date: string;
  reservation: string;
  title: string;
  travel_from: string | null;
  cost_center: string | null;
  allocations: Allocation[];
  travelers: string[];
  amount: string;
  origin: "vivo" | "historial";
}

export interface CorporatePurchases {
  period: { key: string; label: string };
  currency: string;
  items: CorporatePurchase[];
}

export type MovementKind = "compra" | "pago" | "nota_credito";

export interface CorporateMovement {
  id: string;
  date: string;
  kind: MovementKind;
  kind_label: string;
  document: string;
  reservation: string | null;
  detail: string;
  cost_center: string | null;
  charge: string;
  credit: string;
  balance: string;
}

export interface CorporateExport {
  code: string;
  report_type: string;
  report_label: string;
  format: string;
  format_label: string;
  filters: Record<string, string>;
  status: "en_cola" | "procesando" | "listo" | "fallido" | "vencido";
  status_label: string;
  row_count: number | null;
  requested_at: string;
  completed_at: string | null;
  expires_at: string | null;
  error: string | null;
  download_path: string | null;
}

export interface CorporateMovements {
  period: { key: string; label: string; from: string; to: string };
  currency: string;
  opening_balance: string;
  totals: { charges: string; payments: string; credits: string; closing_balance: string };
  rows: CorporateMovement[];
  exports: CorporateExport[];
}

export interface CorporateStatement {
  code: string;
  account: { id: string; client_code: string; client_name: string };
  month: string;
  label: string;
  period_start: string;
  period_end: string;
  currency: string;
  opening_balance: string;
  charges: string;
  payments: string;
  credits: string;
  closing_balance: string;
  status: "generado" | "enviado" | "anulado";
  status_label: string;
  generated_at: string;
  sent_at: string | null;
  sent_to: string[];
  has_pdf: boolean;
  lines_count: number;
}

export interface StatementSettings {
  statement_auto: boolean;
  statement_day: number;
  statement_recipients: string[];
  statement_last_sent_at: string | null;
  lock_version: number;
}

export interface CorporateStatements {
  items: CorporateStatement[];
  settings: StatementSettings;
  can_manage: boolean;
}

export interface CorporateApproval {
  code: string;
  kind: "cotizacion" | "reserva";
  reference: string;
  title: string;
  amount: string;
  currency: string;
  cost_center: { code: string; name: string } | null;
  budget: { amount: string | null; used: string; used_pct: string | null; state: BudgetState; exceeded: boolean } | null;
  requested_by: string | null;
  approver: string | null;
  status: "pendiente" | "aprobada" | "rechazada" | "vencida" | "cancelada";
  status_label: string;
  reason: string | null;
  requested_at: string;
  expires_at: string;
  decided_at: string | null;
  lock_version: number;
  can_decide: boolean;
}

export interface CorporateApprovalsMeta {
  require_approval: boolean;
  threshold: string | null;
  currency: string;
  ttl_hours: number;
}

export interface PortalUser {
  id: string;
  full_name: string;
  email: string;
  portal_role: CorporateRole;
  portal_role_label: string;
  cost_center: string | null;
  cost_center_id: string | null;
  traveler: string | null;
  traveler_id: string | null;
  status: "invitado" | "activo" | "inactivo";
  has_login: boolean;
  invited_at: string;
  accepted_at: string | null;
}

export interface CorporateTraveler {
  id: string;
  full_name: string;
  email: string | null;
  doc_type: string | null;
  doc_number: string | null;
  employee_code: string | null;
  cost_center: string | null;
  cost_center_id: string | null;
  active: boolean;
}

export interface CorporateAccount {
  id: string;
  client: { id: string; code: string; name: string; doc_type: string; doc_number: string; email: string | null };
  status: "activa" | "suspendida" | "cerrada";
  status_label: string;
  currency: string;
  credit_days: number;
  require_approval: boolean;
  approval_threshold: string | null;
  approval_ttl_hours: number;
  default_cost_center: { id: string; code: string; name: string } | null;
  statement_auto: boolean;
  statement_day: number;
  statement_recipients: string[];
  statement_last_sent_at: string | null;
  notes: string | null;
  lock_version: number;
  created_at: string;
  balance: string;
  purchases_year: string;
  counts: { cost_centers: number; travelers: number; portal_users: number; pending_approvals: number };
  cost_centers?: CostCenter[];
  travelers?: CorporateTraveler[];
  portal_users?: PortalUser[];
  approvals?: CorporateApproval[];
}

export interface CorporateAccountsPage {
  data: CorporateAccount[];
  meta: { kpis: { total: number; active: number; suspended: number; pending_approvals: number } };
}

export interface CorporateOptions {
  clients: { id: string; code: string; name: string; doc_number: string; email: string | null }[];
  roles: { value: CorporateRole; label: string }[];
  budget_periods: { value: string; label: string }[];
  doc_types: string[];
}

export interface StatementsPage {
  data: CorporateStatement[];
  meta: { kpis: { generated: number; sent: number; void: number; auto_accounts: number }; accounts: { id: string; client_code: string; client_name: string; currency: string; statement_auto: boolean; statement_day: number }[] };
}

export const ROLE_OPTIONS: { value: CorporateRole; label: string }[] = [
  { value: "administrador", label: "Administrador" },
  { value: "aprobador", label: "Aprobador" },
  { value: "pagador", label: "Pagador" },
  { value: "viajero", label: "Viajero" },
];

export const ROLE_HINTS: Record<CorporateRole, string> = {
  administrador: "Gestiona usuarios, centros de costo y todo el panel",
  aprobador: "Aprueba las compras de su centro de costo",
  pagador: "Ve saldos, paga y recibe el estado de cuenta",
  viajero: "Ve solo sus viajes",
};

export const BUDGET_PERIOD_OPTIONS = [
  { value: "anual", label: "Anual" },
  { value: "trimestral", label: "Trimestral" },
  { value: "mensual", label: "Mensual" },
];

export const DOC_TYPE_OPTIONS = ["DNI", "CE", "PAS", "RUC", "OTRO"].map((value) => ({ value, label: value === "PAS" ? "Pasaporte" : value === "OTRO" ? "Otro" : value }));

export const EXPORT_FORMATS = [
  { value: "xlsx", label: "Excel" },
  { value: "pdf", label: "PDF" },
  { value: "csv", label: "CSV" },
];

export const EXPORT_TYPES = [
  { value: "movimientos", label: "Movimientos" },
  { value: "compras", label: "Compras" },
  { value: "centro_costo", label: "Centros de costo" },
  { value: "viajeros", label: "Viajeros" },
  { value: "estado_cuenta", label: "Estados de cuenta" },
  { value: "aprobaciones", label: "Aprobaciones" },
];

export const KIND_TONE: Record<MovementKind, Tone> = { compra: "t1", pago: "ok", nota_credito: "violet" };

export function budgetTone(state: BudgetState): Tone {
  return state === "excedido" ? "bad" : state === "alerta" ? "warn" : state === "sin_presupuesto" ? "mute" : "ok";
}

export function budgetLabel(state: BudgetState): string {
  return { en_rango: "En rango", alerta: "Sobre el 80 %", excedido: "Excedido", sin_presupuesto: "Sin presupuesto" }[state];
}

export function num(value: string | number | null | undefined): number {
  return value === null || value === undefined ? 0 : Number(value);
}
