import type { Tone } from "@/lib/tone";

export type ApprovalSla = "ok" | "warning" | "overdue" | "paused" | "done";

export interface ApprovalStep {
  level: number;
  decision: string;
  by: string;
  at: string;
  note: string | null;
}

export interface ApprovalEvent {
  event: string;
  by: string;
  at: string;
  note: string | null;
}

export interface ApprovalItem {
  key: string;
  type: string;
  type_label: string;
  code: string;
  title: string;
  detail: string | null;
  facts: string[];
  requester: string;
  created_at: string;
  due_at: string | null;
  amount: number;
  currency: string;
  amount_pen: number;
  status: string;
  level: number;
  levels: number;
  decider: string | null;
  decided_at: string | null;
  decision_note: string | null;
  href: string | null;
  href_label?: string | null;
  target: string;
  subject?: { type: string; code: string | null } | null;
  agency?: string | null;
  reservation?: string | null;
  rule?: { code: string; min_amount: number; permission_label: string; approvers: string[] } | null;
  effect?: string | null;
  impact?: string | null;
  lock_version: number | null;
  version_no?: number;
  change_id?: string;
  cancel_id?: string;
  cancel_reason?: string;
  source?: "settlement" | "rate" | "invoice";
  approve_label?: string;
  reject_label?: string;
  is_generic?: boolean;
  can_decide: boolean;
  can_edit: boolean;
  can_withdraw?: boolean;
  can_delegate: boolean;
  can_ask: boolean;
  can_answer: boolean;
  can_resubmit: boolean;
  delegated_to: { id: string; name: string } | null;
  delegates: { id: string; name: string }[];
  resubmitted_from?: string | null;
  sla: ApprovalSla;
  mine: boolean;
  steps: ApprovalStep[];
  events: ApprovalEvent[];
  questions: ApprovalQuestion[];
}

export interface ApprovalQuestion {
  id: string;
  question: string;
  asked_by: string;
  asked_at: string;
  answer: string | null;
  answered_by: string | null;
  answered_at: string | null;
}

export interface ApprovalRule {
  code: string;
  type: string;
  type_label: string;
  level: number;
  permission: string;
  permission_label: string;
  approvers: string[];
  min_amount: number;
  sla_hours: number;
  forbid_self: boolean;
  active: boolean;
  locked: boolean;
}

export interface ApprovalsOverview {
  kpis: { for_me: number; overdue: number; sent_open: number; resolved_week: number; avg_hours: number | null };
  items: ApprovalItem[];
  rules: ApprovalRule[];
  types: { value: string; label: string }[];
  cancel_reasons: string[];
  options: { agencies: ApprovalOption[]; reservations: ApprovalOption[] };
  usd_rate: number;
  can: { create: boolean; manage_rules: boolean };
  viewer?: { role: string; scope: "all" | "role" };
}

export const APPROVAL_ROLE_NOTES: Record<string, string> = {
  sales: "Sigues aquí las solicitudes que enviaste; las decide Gerencia.",
  operations: "Apruebas las tarifas de proveedores y sigues las facturas que validaste para Finanzas.",
  finance: "Apruebas reversiones de pago, cuentas por pagar, comisiones y el nivel financiero de crédito y reembolsos.",
  accounting: "Apruebas reversiones de pago, cuentas por pagar, comisiones y el nivel financiero de crédito y reembolsos.",
  manager: "Ves todas las solicitudes y apruebas las comerciales y operativas según las reglas.",
  tenant_admin: "Ves todas las solicitudes y configuras las reglas de aprobación.",
};

export function approvalSlug(item: Pick<ApprovalItem, "key" | "code">): string {
  return item.key.startsWith("request:") ? item.code : item.key;
}

export function approvalHref(item: Pick<ApprovalItem, "key" | "code">): string {
  return `/aprobaciones/${encodeURIComponent(approvalSlug(item))}`;
}

export interface ApprovalOption {
  value: string;
  label: string;
  hint?: string;
}

export const GENERIC_TYPES = ["credit_b2b", "refund", "other"];

export function approvalRoute(rules: ApprovalRule[], type: string, amountPen: number): ApprovalRule[] {
  const applicable = rules.filter((rule) => rule.type === type && rule.active && rule.min_amount <= amountPen);
  return [1, 2]
    .map((level) => applicable.filter((rule) => rule.level === level).sort((a, b) => b.min_amount - a.min_amount)[0])
    .filter((rule): rule is ApprovalRule => rule !== undefined);
}

export const SLA_META: Record<ApprovalSla, { label: string; tone: Tone }> = {
  ok: { label: "En plazo", tone: "ok" },
  warning: { label: "Por vencer", tone: "warn" },
  overdue: { label: "Vencida", tone: "bad" },
  paused: { label: "En pausa", tone: "info" },
  done: { label: "Resuelta", tone: "mute" },
};

export const TYPE_TONES: Record<string, Tone> = {
  quote: "violet",
  change: "accent",
  cancel: "bad",
  reversal: "warn",
  payable: "t3",
  commission: "t4",
  provider_rate: "sun",
  credit_b2b: "t1",
  refund: "info",
  other: "mute",
};

export const EVENT_LABELS: Record<string, string> = {
  creada: "Solicitud creada",
  aprobada_nivel: "Aprobó un nivel",
  aprobada: "Aprobó",
  rechazada: "Rechazó",
  retirada: "Retiró la solicitud",
  info_solicitada: "Pidió información",
  info_respondida: "Respondió la consulta",
  delegada: "Delegó",
  reenviada: "Reenvió a aprobación",
};

export const PERMISSION_OPTIONS = [
  { value: "quotes.approve_internal", label: "Gerencia comercial" },
  { value: "reservations.cancel", label: "Anular reservas" },
  { value: "finance.payments.revert", label: "Revertir pagos" },
  { value: "finance.payables", label: "Cuentas por pagar" },
  { value: "finance.profitability", label: "Rentabilidad" },
  { value: "finance.commissions", label: "Comisiones" },
  { value: "catalog.providers.manage", label: "Proveedores" },
  { value: "finance.receivables", label: "Cuentas por cobrar" },
];
