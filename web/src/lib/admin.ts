import type { PlansCatalog } from "@/lib/software";
export interface AdminActionState {
  message: string | null;
  done: boolean;
  warnings?: string[];
  secret?: string;
  label?: string;
}

export const ADMIN_INITIAL: AdminActionState = { message: null, done: false };

export interface Option {
  value: string;
  label: string;
}

export interface AuditEntry {
  code: number;
  at: string;
  entity: string;
  entity_id: string;
  action: string;
  before: string | null;
  after: string | null;
  critical: boolean;
  actor: string;
  actor_code: string | null;
  role: string | null;
  ip: string | null;
  correlation: string;
}

export interface AuditDetail extends AuditEntry {
  diff: Record<string, unknown> | null;
  evidence: Record<string, unknown> | null;
  user_agent: string | null;
  related: AuditEntry[];
}

export interface AuditOverview {
  days: number;
  total: number;
  truncated: boolean;
  events: AuditEntry[];
  kpis: { total: number; critical: number; actors: number; today: number; denied: number };
  top_entities: { label: string; total: number }[];
  daily: { date: string; total: number }[];
  by_actor?: { label: string; total: number }[];
  critical_by_action?: { label: string; total: number }[];
}

interface SectionState<T> {
  values: T;
  updated_at: string | null;
  updated_by: string | null;
  lock_version: number;
}

export interface GeneralSettings {
  email?: string;
  phone?: string;
  web?: string;
  address?: string;
  mincetur_registry?: string;
  lang?: string;
  date_format?: string;
  main_sede_id?: string;
}

export interface CurrencySettings {
  base_currency?: string;
  alt_currency?: string;
  price_with_tax?: boolean;
  fx_source?: string;
  tax_pct?: number;
  rounding?: string;
  round_mode?: string;
  invoice_void_days?: number;
}

export interface PolicySettings {
  quote_validity_days?: number;
  hold_minutes?: number;
  markup_pct?: number;
  max_discount_pct?: number;
  approval_margin_pct?: number;
  discount_cap_pct?: number;
  advance_pct?: number;
  balance_days_before?: number;
  cancel_text?: string;
  modify_text?: string;
  noshow_text?: string;
  refund_text?: string;
}

export type OperationSettings = Record<string, number>;

export interface SettingsChannel {
  key: string;
  label: string;
  description: string;
  enabled: boolean;
  allowed: boolean;
  min_plan: string;
  integration?: ChannelIntegration | null;
}

export interface ChannelIntegration {
  code: string;
  name: string;
  status: string;
  status_label: string;
  ready: boolean;
  warning: string | null;
}

export interface WhatsappIntegration {
  code: string;
  name: string;
  status: string;
  status_label: string;
  sandbox: boolean;
}

export interface SchedulerInfo {
  timezone: string;
  queued: number;
  oldest_queued_at: string | null;
  workers: number | null;
  paused: number;
  next_run_at: string | null;
  policy: { base_seconds: number; jitter_pct: number; steps: { attempt: number; seconds: number }[] };
}

export interface ConnectionTestLog {
  correlation_id: string;
  at: string;
  duration_ms: number;
  timeout_s: number;
  steps: { label: string; status: "ok" | "warn" | "bad" | "info"; ms: number | null }[];
}

export interface SettingsSequence {
  doc_type: string;
  series: string;
  label: string;
  prefix: string;
  pad: number;
  next: number;
  year_reset: boolean;
  preview: string;
  updated_at: string;
}

export interface SettingsOverview {
  agency: {
    legal_name: string;
    commercial_name: string;
    logo_initials: string;
    ruc: string;
    country: string;
    timezone: string;
    fiscal_address: string;
    legal_rep: string | null;
    business_type: string;
    subdomain: string;
    plan: string;
    lock_version: number;
  };
  sections: {
    general: SectionState<GeneralSettings>;
    currency: SectionState<CurrencySettings>;
    policies: SectionState<PolicySettings>;
    operations: SectionState<OperationSettings>;
    channels: SectionState<Record<string, boolean>>;
  };
  main_sede: string | null;
  fx: { rate: number; date: string; source: string } | null;
  base_locked: boolean;
  channels: SettingsChannel[];
  sequences: SettingsSequence[];
  sequence_types: { value: string; label: string; pad: number; year_reset: boolean }[];
  options: {
    sedes: Option[];
    timezones: string[];
    langs: Option[];
    date_formats: Option[];
    fx_sources: string[];
    rounding: Option[];
    round_modes: Option[];
    alt_currencies: Option[];
  };
  kpis: { changes_30d: number; channels_on: number; channels_allowed: number; sequences: number; updated_at: string | null };
  history: AuditEntry[];
  can_manage: boolean;
}

export type TileVariantName = "stacked" | "side" | "inline" | "watermark" | "stripe" | "bento-split" | "bento" | "bento-stack";

export interface BrandingValues {
  brand: string;
  accent: string;
  menu: string;
  tile_variant: TileVariantName;
}

export interface BrandingOverview {
  branding: BrandingValues;
  defaults: BrandingValues;
  variants: { value: TileVariantName; label: string }[];
  agency: { name: string; initials: string };
  history: AuditEntry[];
  can_manage: boolean;
}

export interface RuleParam {
  key: string;
  label: string;
  type: "number" | "bool" | "choice";
  value: number | boolean | string;
  unit: string | null;
  min: number | null;
  max: number | null;
  options: Option[] | null;
}

export interface BookingRule {
  code: string;
  group: string;
  name: string;
  description: string;
  enabled: boolean;
  params: RuleParam[];
  scope: string[];
  product_override: boolean;
  custom: boolean;
  depends_on: string | null;
  min_plan: string;
  locked: boolean;
  modified: boolean;
  updated_at: string;
  updated_by: string | null;
  lock_version: number;
}

export interface RulesOverview {
  rules: BookingRule[];
  groups: { name: string; total: number; active: number }[];
  plan: string;
  history: AuditEntry[];
  templates: RuleTemplate[];
  template_applied: { code: string; name: string; at: string; by: string | null } | null;
  can_manage: boolean;
}

export interface RuleRef {
  code: string;
  name: string;
}

export interface RuleTemplate {
  code: string;
  name: string;
  description: string;
  active: number;
  inactive: number;
  enable: RuleRef[];
  disable: RuleRef[];
  blocked: RuleRef[];
}

export interface PaxMessage {
  code: string;
  reservation: string | null;
  reservation_title: string | null;
  template: string | null;
  template_name: string | null;
  channel: string;
  recipient: string;
  subject: string | null;
  status: "programado" | "enviado" | "entregado" | "leido" | "fallido" | "cancelado";
  direction: "saliente" | "entrante";
  origin: "auto" | "manual" | "prueba";
  scheduled_at: string | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  attempts: number;
  error: string | null;
  lang: string;
  at: string;
}

export interface PaxTemplate {
  code: string;
  name: string;
  event: string;
  event_label: string;
  offset_hours: number;
  offset_from_rule: boolean;
  channels: string[];
  subject: string | null;
  body: string;
  lang: "ES" | "EN";
  group_code?: string | null;
  only_if_balance: boolean;
  only_if_missing_docs: boolean;
  products: string[];
  sales_channels: string[];
  rule: { code: string; name: string; enabled: boolean } | null;
  active: boolean;
  sent: number;
  failed: number;
  updated_at: string;
  updated_by: string | null;
}

export interface PaxTemplatesOverview {
  templates: PaxTemplate[];
  events: Option[];
  channels: Option[];
  variables: { key: string; label: string }[];
  rules: (Option & { enabled: boolean })[];
  messages_enabled: boolean;
  products: (Option & { hint?: string })[];
  sales_channels: Option[];
  reservations: (Option & { hint?: string })[];
  can_send: boolean;
  sample: { reservation: string | null; values: Record<string, string> };
  history: AuditEntry[];
  can_manage: boolean;
}

export interface NotificationRule {
  event: string;
  label: string;
  group: string;
  channels: Record<"email" | "whatsapp" | "push" | "portal", boolean>;
  recipients: string;
  timing: string;
  condition: string;
  critical: boolean;
  updated_at: string | null;
  updated_by: string | null;
  custom_templates: Partial<Record<"email" | "whatsapp" | "push", number>>;
}

export interface NotificationMessage {
  code: string;
  event: string;
  event_label: string;
  channel: string;
  to: string;
  subject: string;
  status: "pendiente" | "enviado" | "fallido";
  retries: number;
  error: string | null;
  permanent: boolean;
  fallback: boolean;
  audience: string;
  at: string;
  sent_at: string | null;
  can_fallback: boolean;
  body?: string | null;
  address?: string | null;
  read_at?: string | null;
}

export interface NotificationRuleRecord extends Omit<NotificationRule, "updated_by"> {
  event_code: string;
  updated_by: string | null;
  updated_by_name: string | null;
}

export interface NotificationMessageRecord {
  id: string;
  code: string;
  event_code: string;
  event_label: string;
  channel: string;
  to: string;
  subject: string;
  status: NotificationMessage["status"];
  retries: number;
  last_error: string | null;
  permanent: boolean;
  is_fallback: boolean;
  can_fallback: boolean;
  audience: string;
  created_at: string;
  sent_at: string | null;
  body_rendered?: string | null;
  recipient_address?: string | null;
  read_at?: string | null;
}

export interface NotificationRulesMeta {
  kpis: NotificationsOverview["kpis"];
  options: NotificationsOverview["options"];
  history: AuditEntry[];
  can_manage: boolean;
  whatsapp?: WhatsappIntegration | null;
}

export interface NotificationsOverview {
  rules: NotificationRule[];
  messages: NotificationMessage[];
  kpis: { sent_7d: number; failed: number; pending: number; routes: number; messages: number };
  options: { channels: Option[]; timings: Option[]; conditions: Option[] };
  history: AuditEntry[];
  can_manage: boolean;
  whatsapp?: WhatsappIntegration | null;
}

export interface UsageMetric {
  metric: string;
  label: string;
  unit: string;
  used: number;
  limit: number | null;
  hard: boolean;
}

export interface PlatformInvoice {
  number: string;
  kind: string;
  period_from: string;
  period_to: string;
  issue_date: string;
  due_date: string;
  currency: string;
  subtotal: number;
  igv: number;
  total: number;
  status: string;
  paid_at: string | null;
  method: string | null;
  sunat: string;
  sunat_hash: string | null;
  bill_to: { name?: string; ruc?: string; address?: string; ubigeo?: string | null } | null;
  attempts: { number: number; source: string; result: string; message: string | null; at: string }[];
  lines: { description: string; quantity: number; amount: number }[];
}

export interface AddonOffer {
  code: string;
  label: string;
  description: string | null;
  available_in: string[];
  included_in: string[];
  feature: string | null;
  unit: string;
  quantity_allowed: boolean;
  price: number;
  included: boolean;
  available: boolean;
}

export type BillingCycle = "monthly" | "annual";

export interface PaymentMethod {
  brand: string;
  last4: string;
  exp: string;
  holder: string;
  status: "active" | "expired" | "removed";
  token_hint: string;
  updated_at: string;
  updated_by: string | null;
}

export interface NextCharge {
  date: string;
  plan: string;
  cycle: BillingCycle;
  base: number;
  addons: number;
  discount: number;
  credit: number;
  net: number;
  igv: number;
  total: number;
}

export interface PlanOption {
  code: string;
  name: string;
  rank: number;
  price_month: number;
  price_year: number;
  currency: string;
  saving_percent: number;
  modules: number;
  highlights: string[];
  rules_included: number;
  rules_total: number;
}

export type PlanRules = PlansCatalog & { current: string };

export interface PlanChangePreview {
  kind: "upgrade" | "downgrade" | "cycle";
  immediate: boolean;
  effective_at: string;
  from: { code: string; name: string; cycle: BillingCycle };
  plan: { code: string; name: string };
  cycle: BillingCycle;
  price: string;
  proration: { days_left: number; period_days: number; charge: string; credit: string; net: string } | null;
  blockers: string[];
  rules: { gained: string[]; lost: string[] };
}

export interface SubscriptionOverview {
  plan: { code: string; name: string; price_month: number; price_year: number; currency: string; support: string | null; modules: number } | null;
  subscription: {
    code: string;
    status: string;
    status_label: string;
    cycle: "monthly" | "annual";
    period_start: string;
    period_end: string;
    auto_renew: boolean;
    cancel_at: string | null;
    credit_balance: number;
    customer_since: string;
    lock_version: number;
    trial_ends_at: string | null;
    scheduled: { kind: string; plan: string | null; cycle: "monthly" | "annual" | null; effective_at: string } | null;
    coupon: { code: string; label: string; remaining_cycles: number } | null;
    billing: { ruc: string; name: string; address: string; ubigeo: string | null; email: string; contact: string | null; doc_type: "Factura" | "Boleta" };
  } | null;
  addons: { code: string; label: string; quantity: number; unit_price: number; since: string; ends_at: string | null; detail: string | null }[];
  addon_catalog: AddonOffer[];
  payment_method: PaymentMethod | null;
  next_charge: NextCharge | null;
  modules: { key: string; label: string; enabled: boolean; source: "plan" | "addon" | "override" | "none"; valid_until: string | null }[];
  usage: UsageMetric[];
  history: Record<string, { month: string; value: number }[]>;
  invoices: PlatformInvoice[];
  changes: AuditEntry[];
  can_manage: boolean;
}

export interface ApiKey {
  code: string;
  name: string;
  environment: "live" | "test";
  masked: string;
  scopes: string[];
  ips: string[];
  expires_at: string | null;
  last_used_at: string | null;
  last_used_ip: string | null;
  status: "active" | "revoked" | "expired";
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  created_at: string;
  created_by: string | null;
}

export interface Webhook {
  code: string;
  url: string;
  description: string | null;
  events: string[];
  secret: string;
  api_version: string;
  status: "active" | "paused" | "disabled";
  failures: number;
  disabled_reason: string | null;
  failure_limit: number;
  rotated_at: string | null;
  delivered: number;
  total: number;
  last_at: string | null;
  last_status: string | null;
  created_at: string;
}

export interface WebhookDelivery {
  code: string;
  webhook: string;
  url: string;
  event: string;
  entity: string | null;
  attempt: number;
  status: "pending" | "delivered" | "retrying" | "failed";
  http: number | null;
  ms: number | null;
  error: string | null;
  next_retry_at: string | null;
  at: string;
}

export interface ApiOverview {
  keys: ApiKey[];
  webhooks: Webhook[];
  deliveries: WebhookDelivery[];
  apps: { name: string; vendor: string; scopes: string[]; redirects: string[]; status: string; created_at: string; last_token_at: string }[];
  limits: { api_keys: number | null; webhooks: number | null; calls_month: number | null; rate_per_min: number | null };
  calls_month: number;
  calls_history: { month: string; value: number }[];
  api_version: string;
  scopes: Option[];
  events: Option[];
  history: AuditEntry[];
  key_history: AuditEntry[];
  can_manage: boolean;
}

export interface Adapter {
  code: string;
  name: string;
  kind: string;
  kind_label: string;
  status: string;
  status_label: string;
  environment: "sandbox" | "production";
  max_retries: number;
  backoff: number;
  timeout: number;
  has_secret: boolean;
  note: string | null;
  owner: { id: string; name: string } | null;
  last_test: { at: string; ok: boolean; result: string } | null;
  open_errors: number;
}

export interface ScheduledJob {
  code: string;
  name: string;
  cron: string;
  cron_label: string;
  queue: string;
  queue_label: string;
  paused: boolean;
  last_run_at: string | null;
  next_run_at: string | null;
  status: "ok" | "advertencia" | "error" | "en_curso" | null;
  result: string | null;
  system: boolean;
  runs: { trigger: string; status: string; result: string | null; at: string }[];
}

export interface IntegrationError {
  code: string;
  source: "job" | "notification" | "integration";
  ref: string;
  target: string;
  error: string;
  class: "transitorio" | "permanente";
  attempt: number;
  max: number;
  next_retry_at: string | null;
  status: "reintentando" | "fallo_definitivo" | "resuelto";
  resolution: string | null;
  resolved_by: string | null;
  at: string;
}

export interface IntegrationsOverview {
  adapters: Adapter[];
  jobs: ScheduledJob[];
  errors: IntegrationError[];
  owners: Option[];
  history: AuditEntry[];
  can_manage: boolean;
  scheduler?: SchedulerInfo | null;
}

export interface AdaptersMeta {
  owners: Option[];
  history: AuditEntry[];
  can_manage: boolean;
}

export interface IntegrationErrorRecord extends Omit<IntegrationError, "resolved_by"> {
  resolved_by: string | null;
  resolved_by_name: string | null;
}

export interface AuditMeta {
  days: number;
  total: number;
  kpis: AuditOverview["kpis"];
  top_entities: AuditOverview["top_entities"];
  daily: AuditOverview["daily"];
  by_actor?: AuditOverview["top_entities"];
  critical_by_action?: AuditOverview["top_entities"];
}

export const CHANNEL_LABELS: Record<string, string> = { email: "Correo", whatsapp: "WhatsApp", push: "Push", portal: "Portal" };

export function offsetLabel(hours: number): string {
  if (hours === 0) return "En el momento";
  const abs = Math.abs(hours);
  const amount = abs % 24 === 0 ? `${abs / 24} ${abs / 24 === 1 ? "día" : "días"}` : `${abs} h`;
  return hours < 0 ? `${amount} antes` : `${amount} después`;
}

export function fillTemplate(text: string, values: Record<string, string>): { text: string; missing: string[] } {
  const missing = new Set<string>();
  const filled = text.replace(/\{\{\s*([a-z_]+)\s*\}\}/g, (match, key: string) => {
    if (values[key]) return values[key];
    missing.add(key);
    return match;
  });
  return { text: filled, missing: [...missing] };
}

export function actionLabel(action: string): string {
  return action.charAt(0).toUpperCase() + action.slice(1).replace(/_/g, " ");
}

export function latest(values: (string | null)[]): string | null {
  return values.filter((value): value is string => Boolean(value)).sort().at(-1) ?? null;
}

export interface SimulatorOptions {
  products: (Option & { hint?: string })[];
  plans: string[];
  current_plan: string;
  today: string;
}

export interface RuleSimulation {
  product: { code: string; name: string };
  plan: string | null;
  current_plan: boolean;
  day: { status: string; label: string; left: number | null; note: string | null };
  pax: { ok: boolean; errors: string[]; seats: number };
  quote: {
    currency: string;
    lines: { key: string; kind: string; label: string; qty: number; amount: string; removed: boolean }[];
    adjustments: { key: string; label: string; amount: string }[];
    total: string;
    payment_mode: string;
    modes: string[];
    deposit_pct: number;
    deposit: string;
    balance_due: string | null;
    hold_hours: number | null;
    warnings: string[];
  };
  warning: string | null;
  rules: { code: string; name: string; group: string; enabled: boolean; effective: boolean; plan_allows: boolean; overridden: boolean }[];
}

export interface CurrencyRow {
  code: string;
  name: string;
  symbol: string;
  active: boolean;
  is_base: boolean;
  is_charge: boolean;
  rate: number | null;
  client_rate: number | null;
  rate_date: string | null;
}

export interface CurrenciesOverview {
  currencies: CurrencyRow[];
  settings: { margin_pct: number; alert_pct: number; multicurrency: boolean };
  can_manage: boolean;
}

export interface WebhookDeliveryDetail {
  code: string;
  webhook: string;
  url: string;
  event: string;
  event_id: string;
  entity: string | null;
  attempt: number;
  status: "pending" | "delivered" | "retrying" | "failed";
  http: number | null;
  ms: number | null;
  error: string | null;
  response: string | null;
  next_retry_at: string | null;
  manual: boolean;
  at: string;
  payload: unknown;
  headers: Record<string, string>;
  related: { code: string; status: string; http: number | null; manual: boolean; at: string }[];
}
