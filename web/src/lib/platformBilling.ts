import type { PlanMetric, TenantStatus } from "@/lib/platform";
import { capitalize } from "@/lib/format";
import type { Tone } from "@/lib/tone";

export type InvoiceStatus = "draft" | "open" | "paid" | "failed" | "uncollectible" | "void";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "cancel_scheduled" | "suspended" | "canceled";

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  draft: { label: "Borrador", tone: "mute" },
  open: { label: "Por cobrar", tone: "info" },
  paid: { label: "Pagada", tone: "ok" },
  failed: { label: "Cobro fallido", tone: "bad" },
  uncollectible: { label: "Incobrable", tone: "warn" },
  void: { label: "Anulada", tone: "mute" },
};

export const SUBSCRIPTION_STATUS: Record<SubscriptionStatus, { label: string; tone: Tone }> = {
  trialing: { label: "En prueba", tone: "info" },
  active: { label: "Al día", tone: "ok" },
  past_due: { label: "En cobranza", tone: "bad" },
  cancel_scheduled: { label: "Baja programada", tone: "warn" },
  suspended: { label: "Suspendida", tone: "mute" },
  canceled: { label: "Cancelada", tone: "mute" },
};

export const SUNAT_STATUS: Record<string, { label: string; tone: Tone }> = {
  pending: { label: "SUNAT pendiente", tone: "warn" },
  accepted: { label: "Aceptada por SUNAT", tone: "ok" },
  observed: { label: "Observada", tone: "warn" },
  rejected: { label: "Rechazada", tone: "bad" },
};

export const ATTEMPT_SOURCE: Record<string, string> = {
  initial: "Cobro inicial",
  dunning: "Reintento programado",
  manual_retry: "Reintento manual",
  portal: "Pago desde el portal",
  manual_payment: "Pago manual",
};

export const MANUAL_METHODS = ["Transferencia bancaria", "Depósito en cuenta", "Yape o Plin empresarial"];

export interface MetricsPoint {
  month: string;
  mrr: number;
  active: number;
  new: number;
  churned: number;
  suspended: number;
}

export interface Cancellation {
  name: string;
  plan: string;
  date: string;
  mrr: number;
  reason: string;
  comment?: string;
}

export interface LifecycleEvent {
  at: string;
  kind: string;
  tenant: string;
  code: string | null;
  detail: string;
  amount?: number;
}

export interface FailedSummary {
  count: number;
  amount: number;
  tenants: number;
  in_dunning: number;
}

export interface BillingOverview {
  currency: string;
  mrr: number;
  arr: number;
  arpa: number;
  mrr_change: number | null;
  paying_tenants: number;
  churn: { churned: number; lost_mrr: number; logo_pct: number | null; revenue_pct: number | null; cancellations: Cancellation[] };
  failed: FailedSummary;
  series: MetricsPoint[];
  by_plan: { code: string; name: string; rank: number; tenants: number; mrr: number; share: number }[];
  events: LifecycleEvent[];
}

export interface InvoiceSummary {
  id: string;
  number: string;
  tenant: { code: string; name: string; status: TenantStatus };
  plan: { name: string; rank: number };
  subscription_status: SubscriptionStatus;
  kind: "subscription" | "proration" | "addon" | "manual";
  period_from: string;
  period_to: string;
  issue_date: string;
  due_date: string;
  currency: string;
  total: number;
  status: InvoiceStatus;
  sunat_status: string;
  paid_at: string | null;
  payment_ref: string | null;
  attempts: number;
  credit_note: string | null;
  dunning_extended_days: number;
}

export interface InvoiceFull extends Omit<InvoiceSummary, "attempts" | "credit_note"> {
  bill_to: { name: string; ruc: string; address: string };
  igv_pct: number;
  subtotal: number;
  igv: number;
  sunat_hash: string | null;
  void_reason: string | null;
  lines: { description: string; quantity: number; unit_price: number; amount: number; type: string }[];
  attempts: { number: number; source: string; result: "succeeded" | "declined" | "error"; code: string | null; message: string | null; at: string }[];
  credit_note: { number: string; reason: string; amount: number; refund_ref: string | null; at: string } | null;
}

export interface DunningStep {
  label: string;
  date: string;
  state: "done" | "next" | "pending";
}

export interface DunningItem extends InvoiceSummary {
  failed_at: string;
  retries_done: number;
  retries_total: number;
  extended_days: number;
  next_retry_at: string | null;
  decline_code: string | null;
  decline_message: string | null;
  payment_method: string | null;
  payment_method_status: string | null;
  steps: DunningStep[];
}

export interface DunningPolicy {
  retry_days: number[];
  suspend_after_last: boolean;
}

export interface DunningOverview {
  policy: DunningPolicy;
  items: DunningItem[];
}

export interface TrialItem {
  id: string;
  code: string;
  cycle: "monthly" | "annual";
  tenant: { code: string; name: string; email: string };
  plan: { code: string; name: string; price_month: number };
  starts_at: string;
  ends_at: string;
  days_left: number | null;
  extended_days: number;
  can_extend: boolean;
  payment_method: string | null;
  users: number;
}

export interface TrialsOverview {
  items: TrialItem[];
  coupons: { code: string; label: string; plans: string[] }[];
  plans: { code: string; name: string; rank: number; price_month: number; price_year: number }[];
}

export interface Coupon {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  label: string;
  duration_cycles: number;
  plans: { code: string; name: string }[];
  max_redemptions: number | null;
  redeemed: number;
  valid_to: string | null;
  expired: boolean;
  exhausted: boolean;
  status: "active" | "inactive";
  note: string | null;
  created_at: string;
}

export interface FlagFeature {
  key: string;
  label: string;
  module: string | null;
  kind: "module" | "limit" | "addon" | "beta";
  addon: string | null;
  values: Record<string, string | null>;
  overrides: number;
}

export interface FeatureOverride {
  id: string;
  feature: { key: string; label: string };
  tenant: { code: string; name: string };
  value: boolean;
  reason: string;
  valid_until: string | null;
  active: boolean;
  granted_by: string | null;
  created_at: string;
}

export interface FlagsOverview {
  plans: { code: string; name: string; rank: number }[];
  features: FlagFeature[];
  overrides: FeatureOverride[];
  tenants: { code: string; name: string }[];
}

export interface UsageMetric {
  metric: PlanMetric;
  value: number;
  limit: number | null;
  pct: number | null;
}

export interface UsageItem {
  code: string;
  name: string;
  status: TenantStatus;
  plan: { code: string; name: string; rank: number };
  metrics: UsageMetric[];
  top: UsageMetric | null;
  alert: UsageMetric | null;
}

export interface UsageOverview {
  month: string;
  items: UsageItem[];
}

export interface HomeAlert {
  tone: Tone;
  kind: string;
  title: string;
  detail: string;
  href: string;
}

export interface AuditEvent {
  id: string;
  code: number;
  at: string;
  actor: string | null;
  actor_type: string;
  entity: string;
  group: "agencias" | "facturacion" | "catalogo" | "tareas" | "sesiones" | "configuracion" | "otros";
  entity_id: string;
  subject: string;
  tenant: { code: string; name: string } | null;
  action: string;
  critical: boolean;
  before: string | null;
  after: string | null;
  ip: string | null;
  correlation_id: string | null;
}

export interface AuditEventDetail extends AuditEvent {
  actor_role: string | null;
  actor_email: string | null;
  diff: Record<string, unknown> | null;
  user_agent: string | null;
  evidence: Record<string, unknown> | null;
  related: (AuditEvent & { same_request: boolean })[];
}

export interface PlanRuleMatrix {
  plans: { code: string; name: string; rank: number; rules: number; tenants: number }[];
  groups: { group: string; rules: { code: string; name: string; description: string | null; min_plan: string | null; default_plan: string | null; tenants: number; updated_at: string | null }[] }[];
  tenants: number;
  rules: number;
  differs: number;
}

export interface PlanRuleChange {
  rule: { code: string; name: string };
  from: string;
  to: string;
  effect: "gain" | "lose";
  affected_tenants: { code: string; name: string; plan: string }[];
  dry_run: boolean;
}

export interface TenantHealthRow {
  id: string;
  code: string;
  name: string;
  status: "activo" | "prueba" | "suspendido";
  trial_ends_at: string | null;
  plan: { code: string; name: string } | null;
  health: "ok" | "atencion" | "critico";
  integrations: { total: number; active: number; failing: number };
  jobs: { total: number; paused: number; errors: number; warnings: number; last_run_at: string | null };
  open_errors: number;
  definitive_errors: number;
  last_heartbeat_at: string | null;
}

export interface TenantHealthOverview {
  rows: TenantHealthRow[];
  kpis: { tenants: number; ok: number; attention: number; critical: number; open_errors: number };
}

export interface PlatformHomeOverview {
  tenants: { active: number; trial: number; suspended: number; total: number; users: number };
  mrr: number;
  arr: number;
  arpa: number;
  mrr_change: number | null;
  series: { month: string; mrr: number }[];
  failed: FailedSummary;
  plans: { code: string; name: string; rank: number; tenants: number }[];
  alerts: HomeAlert[];
  activity: AuditEvent[];
}

export interface PlatformJob {
  code: string;
  command: string;
  name: string;
  description: string | null;
  cron: string;
  cron_label: string;
  queue: string;
  paused: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  last_status: "ok" | "advertencia" | "error" | "en_curso" | null;
  last_result: string | null;
  runnable: boolean;
  runs: { status: string; trigger: string; result: string | null; started_at: string; duration_ms: number | null }[];
}

export interface QueueStat {
  queue: string;
  label: string;
  pending: number;
  failed: number;
  scheduled: number;
  runs: number;
  errors: number;
  warnings: number;
}

export interface AgencyJobs {
  name: string;
  jobs: number;
  paused: number;
  errors: number;
  warnings: number;
  open_errors: number;
  last_run_at: string | null;
}

export interface IntegrationError {
  id: string;
  code: string | null;
  tenant: string | null;
  source: "job" | "notification" | "integration";
  ref: string;
  target: string;
  error: string;
  class: "transitorio" | "permanente";
  attempt: number;
  max_attempts: number;
  next_retry_at: string | null;
  status: "reintentando" | "fallo_definitivo" | "resuelto";
  at: string;
}

export interface OperationsOverview {
  jobs: PlatformJob[];
  queues: QueueStat[];
  agencies: AgencyJobs[];
  errors: IntegrationError[];
}

export const monthLabel = (month: string) => new Intl.DateTimeFormat("es-PE", { month: "short" }).format(new Date(`${month}-15T12:00:00`)).replace(".", "");

export const invoicePeriod = (invoice: Pick<InvoiceSummary, "period_from" | "period_to">) => `${invoice.period_from.slice(8, 10)}/${invoice.period_from.slice(5, 7)} al ${invoice.period_to.slice(8, 10)}/${invoice.period_to.slice(5, 7)}`;

export const AUDIT_ACTIONS: Record<string, { label: string; tone: Tone }> = {
  login: { label: "Inicio de sesión", tone: "info" },
  login_fallido: { label: "Ingreso fallido", tone: "warn" },
  cuenta_bloqueada: { label: "Cuenta bloqueada", tone: "bad" },
  logout: { label: "Cierre de sesión", tone: "mute" },
  alta: { label: "Alta", tone: "ok" },
  editar: { label: "Edición", tone: "violet" },
  editar_plan: { label: "Edición de plan", tone: "violet" },
  cambio_plan: { label: "Cambio de plan", tone: "t1" },
  cambio_plan_programado: { label: "Cambio de plan programado", tone: "t1" },
  anular_cambio_programado: { label: "Cambio programado anulado", tone: "warn" },
  cambiar_plan_minimo: { label: "Plan mínimo de regla", tone: "violet" },
  restablecer_demo: { label: "Matriz restablecida", tone: "warn" },
  enviar_enlace_pago: { label: "Enlace de pago enviado", tone: "info" },
  reenviar: { label: "Factura reenviada", tone: "info" },
  reintentar: { label: "Reintento", tone: "warn" },
  resolver_error: { label: "Error resuelto", tone: "ok" },
  suspender: { label: "Suspensión", tone: "bad" },
  reactivar: { label: "Reactivación", tone: "ok" },
  extender_trial: { label: "Prueba extendida", tone: "info" },
  convertir_trial: { label: "Prueba convertida", tone: "ok" },
  cobro_exitoso: { label: "Cobro aprobado", tone: "ok" },
  cobro_rechazado: { label: "Cobro rechazado", tone: "bad" },
  pago_manual: { label: "Pago manual", tone: "ok" },
  anular: { label: "Anulación", tone: "bad" },
  prorroga_dunning: { label: "Prórroga", tone: "warn" },
  crear: { label: "Creación", tone: "ok" },
  activar: { label: "Activación", tone: "ok" },
  desactivar: { label: "Desactivación", tone: "mute" },
  editar_politica: { label: "Política de cobranza", tone: "violet" },
  plan_entitlement: { label: "Funcionalidad por plan", tone: "t1" },
  override: { label: "Excepción concedida", tone: "info" },
  quitar_override: { label: "Excepción retirada", tone: "mute" },
  ejecutar: { label: "Ejecución manual", tone: "t4" },
  pausar: { label: "Tarea pausada", tone: "warn" },
  reanudar: { label: "Tarea reanudada", tone: "ok" },
  acceso_denegado: { label: "Acceso bloqueado", tone: "warn" },
};

export const actionMeta = (action: string) => AUDIT_ACTIONS[action] ?? { label: capitalize(action.replace(/_/g, " ")), tone: "mute" as Tone };

export const isCollectible = (invoice: Pick<InvoiceSummary, "status">) => ["open", "failed", "uncollectible"].includes(invoice.status);
