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
  target: string;
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
  sla: ApprovalSla;
  mine: boolean;
  steps: ApprovalStep[];
  events: ApprovalEvent[];
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
  can: { create: boolean; manage_rules: boolean };
}

export const GENERIC_TYPES = ["credit_b2b", "refund", "other"];

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
