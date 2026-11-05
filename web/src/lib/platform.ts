export type TenantStatus = "activo" | "prueba" | "suspendido";

export interface PlatformMe {
  id: string;
  name: string;
  email: string;
  home: string;
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
}

export interface TenantDetail extends TenantSummary {
  fiscal_address: string;
  business_type: string;
  timezone: string;
  base_currency: string;
  admins: { name: string; email: string; status: string; last_login_at: string | null }[];
  history: { action: string; before_value: string | null; after_value: string | null; occurred_at: string; actor: string | null }[];
  locations: { code: string; name: string; city: string; status: string; is_main: boolean }[];
}

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
