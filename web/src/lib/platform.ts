import type { AuditEntry } from "@/lib/admin";
import type { Branding } from "@/lib/me";
export type TenantStatus = "activo" | "prueba" | "suspendido";

export interface PlatformMe {
  id: string;
  name: string;
  email: string;
  home: string;
  branding: Branding;
}

export interface PlatformSettingsOverview {
  sections: {
    issuer: { name: string; ruc: string; address: string; email: string; web: string };
    taxes: { igv_pct: number; currency: string };
    notices: { trial_days: number[]; usage_warn_pct: number; api_key_days: number };
    dunning: { retry_days: number[]; suspend_after_last: boolean };
    form_protection: { provider: string; enabled: boolean; site_key: string; secret_set: boolean; secret_hint: string | null; verified_at: string | null; status: "activa" | "incompleta" | "apagada" };
    outgoing_mail: OutgoingMailSummary;
    whatsapp_webhook: { verify_token_set: boolean; callback_url: string; changed_at: string | null };
    fiscal_webhook: { secret_set: boolean; callback_url: string; signature_header: string; simulated: boolean; changed_at: string | null };
    antivirus: { driver: string; simulated: boolean; ok: boolean; message: string | null };
  };
  lock_version: number;
  updated_at: string | null;
  history: AuditEntry[];
}

export type MailEncryption = "ssl" | "tls" | "none";

export interface OutgoingMailSummary {
  enabled: boolean;
  host: string;
  port: number | null;
  encryption: MailEncryption;
  username: string;
  password_set: boolean;
  from_address: string;
  from_name: string;
  verified_at: string | null;
  last_test: { to: string; ok: boolean; at: string } | null;
  status: "activa" | "incompleta" | "apagada";
  webhook_secrets: { ses: boolean; fcm: boolean };
}

export interface TenantSummary {
  id: string;
  code: string;
  name: string;
  legal_name: string;
  ruc: string;
  subdomain: string;
  initials: string;
  admin_email: string;
  status: TenantStatus;
  plan: { code: string; name: string; rank: number; price_month: string } | null;
  users: number;
  sedes: number;
  modules: number;
  mrr: string;
  storage_used_bytes: number;
  trial_ends_at: string | null;
  suspend_reason: string | null;
  suspended_at: string | null;
  created_at: string | null;
  lock_version: number;
}

export interface TenantDetail extends TenantSummary {
  usage: { metric: PlanMetric; used: number; limit: number | null }[];
  entitlements: { key: string; label: string; source: "plan" | "addon" | "override"; valid_until: string | null }[];
  fiscal_address: string;
  business_type: string;
  timezone: string;
  base_currency: string;
  alt_currency: string;
  country: string;
  locale: string;
  admins: { name: string; email: string; status: string; last_login_at: string | null }[];
  history: { action: string; before_value: string | null; after_value: string | null; occurred_at: string; actor: string | null }[];
  locations: { code: string; name: string; city: string; status: string; is_main: boolean }[];
  subscription: TenantSubscription | null;
}

export type BillingCycle = "monthly" | "annual";

export type PlanEffective = "immediate" | "next_cycle";

export interface TenantSubscription {
  code: string;
  status: "trialing" | "active" | "past_due" | "cancel_scheduled" | "suspended" | "canceled";
  cycle: BillingCycle;
  period_start: string;
  period_end: string;
  trial_ends_at: string | null;
  credit_balance: string;
  lock_version: number;
  scheduled: { kind: "upgrade" | "downgrade" | "cycle"; plan: { code: string; name: string }; cycle: BillingCycle; effective_at: string } | null;
}

export const CYCLE_LABEL: Record<BillingCycle, string> = { monthly: "Mensual", annual: "Anual" };

export type PlanMetric = "users" | "sedes" | "storage_gb" | "reservations_month" | "whatsapp_month" | "email_month" | "api_calls_month" | "api_rate_per_min" | "webhooks" | "api_keys";

export interface PlanSummary {
  id: string;
  code: string;
  name: string;
  rank: number;
  price_month: string;
  price_year: string;
  currency: string;
  trial_days: number;
  module_count: number;
  status: "active" | "hidden" | "retired";
  limits: Partial<Record<PlanMetric, number | null>>;
  tenants: { active: number; trial: number; suspended: number };
  rules_included: number;
  rules_total: number;
}

export type FeatureKind = "module" | "limit" | "addon" | "beta";

export interface PlanDetail extends PlanSummary {
  support_level: string | null;
  previous: string | null;
  highlights: string[];
  features: { key: string; label: string; group: string | null; kind: FeatureKind; value: string | null }[];
  addons: { code: string; label: string; unit: string | null; included: boolean; price: string | null }[];
  rules: { group: string; rules: { code: string; name: string; description: string; from: string; included: boolean }[] }[];
  agencies: { code: string; name: string; status: TenantStatus; mrr: string }[];
}

export function planTone(rank: number): "t4" | "t1" | "t3" {
  return rank <= 1 ? "t4" : rank === 2 ? "t1" : "t3";
}

export function tenantTotal(plan: Pick<PlanSummary, "tenants">): number {
  return plan.tenants.active + plan.tenants.trial + plan.tenants.suspended;
}

export const PLAN_STATUS: Record<PlanSummary["status"], { label: string; tone: "ok" | "mute" | "warn" }> = {
  active: { label: "Disponible", tone: "ok" },
  hidden: { label: "Oculto", tone: "warn" },
  retired: { label: "Retirado", tone: "mute" },
};

export function formatBytes(bytes: number): string {
  if (bytes <= 0) return "Sin uso";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** power).toLocaleString("es-PE", { maximumFractionDigits: 1 })} ${units[power]}`;
}

export interface ProvisionOption {
  value: string;
  label: string;
}

export interface ProvisionRole {
  id: string;
  name: string;
  description: string | null;
  scope: string;
  required: boolean;
  templates: Record<string, { permissions: number; modules: string[] }>;
}

export interface ProvisionOptions {
  business_types: string[];
  countries: string[];
  locales: ProvisionOption[];
  base_currencies: ProvisionOption[];
  alt_currencies: ProvisionOption[];
  timezones: string[];
  rounding: ProvisionOption[];
  fx_sources: string[];
  templates: ProvisionOption[];
  plans: { code: string; name: string; rank: number; price_month: number; trial_days: number }[];
  channels: { key: string; label: string; description: string; plan_rank: number; plan: string }[];
  roles: ProvisionRole[];
  defaults: Record<string, string | number | string[]>;
}

export interface ProvisionPayload {
  commercial_name: string;
  subdomain: string;
  plan: string;
  status: "prueba" | "activo";
  legal_name: string;
  ruc: string;
  fiscal_address: string;
  business_type: string;
  legal_rep: string;
  country: string;
  locale: string;
  base_currency: string;
  alt_currency: string;
  timezone: string;
  sede_name: string;
  sede_city: string;
  sede_address: string;
  sede_phone: string;
  admin_name: string;
  admin_email: string;
  admin_phone: string;
  admin_mfa: boolean;
  roles: string[];
  permission_template: string;
  quote_validity_days: number;
  hold_minutes: number;
  markup_pct: number;
  max_discount_pct: number;
  tax_pct: number;
  rounding: string;
  advance_pct: number;
  fx_rate: number;
  fx_source: string;
  invoice_series: string;
  receipt_series: string;
  channels: string[];
}

export const TENANT_STEPS = ["Agencia y plan", "Empresa", "País, moneda y zona", "Sede principal", "Administrador", "Roles iniciales", "Permisos", "Configuración comercial", "Configuración financiera", "Canales", "Revisión"] as const;

export const TENANT_STEP_FIELDS: Record<string, number> = {
  commercial_name: 1, subdomain: 1, plan: 1, status: 1,
  legal_name: 2, ruc: 2, fiscal_address: 2, business_type: 2, legal_rep: 2,
  country: 3, locale: 3, base_currency: 3, alt_currency: 3, timezone: 3,
  sede_name: 4, sede_city: 4, sede_address: 4, sede_phone: 4,
  admin_name: 5, admin_email: 5, admin_phone: 5, admin_mfa: 5,
  roles: 6, permission_template: 7,
  quote_validity_days: 8, hold_minutes: 8, markup_pct: 8, max_discount_pct: 8,
  tax_pct: 9, rounding: 9, advance_pct: 9, fx_rate: 9, fx_source: 9, invoice_series: 9, receipt_series: 9,
  channels: 10,
};

