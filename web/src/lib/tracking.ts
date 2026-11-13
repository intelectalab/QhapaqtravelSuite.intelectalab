import type { Tone } from "@/lib/tone";

export type TagStatus = "borrador" | "en_revision" | "activo" | "pausado" | "rechazado";
export type DispatchStatus = "pendiente" | "enviado" | "fallido" | "sin_consentimiento" | "duplicado";
export type ConsentCategory = "necesarias" | "analiticas" | "marketing";

export interface TrackingProvider {
  code: string;
  name: string;
  short: string;
  id_label: string | null;
  placeholder: string | null;
  consent: ConsentCategory;
  server: string | null;
  min_plan: string;
  allowed: boolean;
}

export interface TrackingTag {
  code: string;
  name: string;
  provider: string;
  provider_name: string;
  provider_short: string;
  site: "vitrina" | "blog" | "ambos" | null;
  measurement_id: string | null;
  consent_category: ConsentCategory;
  placement: string;
  pages: string;
  exclude: string;
  server_side: boolean;
  server_label: string | null;
  enhanced_conversions: boolean;
  secret_saved: boolean;
  script_src: string | null;
  sri_hash: string | null;
  script_body: string | null;
  csp_domains: string[];
  status: TagStatus;
  created_by: string | null;
  created_by_name: string | null;
  approved_by_name: string | null;
  approved_at: string | null;
  submitted_at: string | null;
  reject_reason: string | null;
  verified_at: string | null;
  verify_result: "ok" | "fallo" | null;
  verify_note: string | null;
  pending_revision: { fields: string[]; author: string | null; author_name: string | null; at: string | null; script_src: string | null; measurement_id: string | null } | null;
  mapped_events: number;
  lock_version: number;
}

export interface TrackingKpis {
  active: number;
  configured: number;
  in_review: number;
  sent_24h: number;
  deduplicated_24h: number;
  failed: number;
  mapped_events: number;
}

export interface ConsentCategoryInfo {
  code: ConsentCategory;
  label: string;
  description: string;
  required: boolean;
}

export interface TrackingOverview {
  rows: TrackingTag[];
  kpis: TrackingKpis;
  providers: TrackingProvider[];
  consent: { policy_version: string; categories: ConsentCategoryInfo[] };
  plan: { rank: number; full: boolean; addon: boolean; retention_days: number };
  can_manage: boolean;
  can_approve: boolean;
  admins: number;
  me: string;
}

export interface ConversionMapping {
  provider_event: string;
  conversion_label: string | null;
  send_value: boolean;
  server_side: boolean;
}

export interface ConversionMatrix {
  tags: { code: string; name: string; provider: string; provider_name: string; status: TagStatus; site: string | null; server_capable: boolean; mappings: Record<string, ConversionMapping>; defaults: Record<string, string> }[];
  events: { code: string; label: string; ga4: string; value: boolean }[];
}

export interface Dispatch {
  id: number;
  event_id: string;
  event: string;
  event_label: string;
  tag: string;
  tag_name: string;
  provider: string;
  provider_event: string;
  channel: "navegador" | "servidor";
  status: DispatchStatus;
  attempts: number;
  http_status: number | null;
  error: string | null;
  value: string | null;
  currency: string | null;
  reference: string | null;
  occurred_at: string;
  sent_at: string | null;
  retryable: boolean;
}

export interface DispatchList {
  rows: Dispatch[];
  kpis: Record<DispatchStatus, number>;
  retention_days: number;
}

export interface WebMetrics {
  visits: number;
  visitors: number;
  pageviews: number;
  bounces: number;
  engaged_seconds: number;
  conversions: number;
  revenue: string;
  bounce_rate: number;
  avg_seconds: number;
  pages_per_visit: number;
  conversion_rate: number;
}

export interface WebRealtime {
  visitors: number;
  pages: { path: string; visitors: number }[];
  window_minutes: number;
}

export interface WebOverview {
  period: { from: string; to: string; days: number; clamped: boolean; retention_days: number };
  kpis: WebMetrics;
  previous: WebMetrics | null;
  trend: { day: string; visits: number; visitors: number; pageviews: number; conversions: number }[];
  realtime: WebRealtime;
  ga4?: { measurement_id: string; note: string } | null;
  can_export?: boolean;
}

export type WebPage = WebMetrics & { path: string };
export type WebSource = WebMetrics & { source: string; medium: string; campaign: string | null };
export interface WebDevices {
  devices: (WebMetrics & { device: string; label: string })[];
  countries: (WebMetrics & { country: string })[];
}

export type PlatformWebOverview = WebOverview & { pages: WebPage[]; sources: WebSource[]; devices: WebDevices; filters: { site: string | null; agency: string | null } };

export type AgencyVisits = WebMetrics & { code: string; name: string; city: string; status: string; plan: string; trend: number[] };

export interface PlatformTracking {
  rows: TrackingTag[];
  kpis: TrackingKpis;
  conversions: ConversionMatrix;
  providers: TrackingProvider[];
  me: string;
}

export interface BlogSyncStatus {
  kpis: { synced: number; pending: number; published: number; below_minimum: number };
  last_webhook: { at: string; ok: boolean; note: string } | null;
  admin_url: string;
  configured: boolean;
  posts: { payload_id: string | null; slug: string; title: string; status: string; word_count: number; seo_score: number | null; focus_keyword: string; published_at: string | null; synced_at: string | null; noindex: boolean; source: "payload" | "nativo" }[];
}

export interface LandingSignup {
  tenant: string;
  agency: string;
  ruc: string;
  email: string;
  plan: string;
  cycle: "mensual" | "anual" | "prueba" | null;
  state: "prueba" | "pago_pendiente" | "pagada" | "fallida" | "abandonada";
  state_label: string;
  total: string;
  coupon: string | null;
  source: string;
  campaign: string | null;
  doc_type: string | null;
  invoice: string | null;
  invoice_status: string | null;
  mrr: string;
  trial_ends_at: string | null;
  created_at: string;
  history: { state: string; at: string }[];
}

export interface LandingSignups {
  rows: LandingSignup[];
  kpis: { total: number; last_30_days: number; paid: number; trials: number; pending: number; abandoned: number; new_mrr: string; conversion_rate: number };
  funnel: { step: string; label: string; count: number }[];
}

export const TAG_STATUS: Record<TagStatus, { label: string; tone: Tone }> = {
  borrador: { label: "Borrador", tone: "mute" },
  en_revision: { label: "En revisión", tone: "warn" },
  activo: { label: "Activa", tone: "ok" },
  pausado: { label: "Pausada", tone: "mute" },
  rechazado: { label: "Rechazada", tone: "bad" },
};

export const DISPATCH_STATUS: Record<DispatchStatus, { label: string; tone: Tone }> = {
  pendiente: { label: "Pendiente", tone: "warn" },
  enviado: { label: "Enviado", tone: "ok" },
  fallido: { label: "Fallido", tone: "bad" },
  sin_consentimiento: { label: "Sin consentimiento", tone: "sun" },
  duplicado: { label: "Deduplicado", tone: "info" },
};

export const SIGNUP_TONE: Record<LandingSignup["state"], Tone> = { prueba: "info", pago_pendiente: "warn", pagada: "ok", fallida: "bad", abandonada: "mute" };

export const CONSENT_LABEL: Record<ConsentCategory, string> = { necesarias: "Necesarias", analiticas: "Analíticas", marketing: "Marketing" };

export const PROVIDER_TONE: Record<string, Tone> = { ga4: "sun", gtm: "info", google_ads: "accent", meta_pixel: "brand", tiktok: "mute", clarity: "violet", linkedin: "t4", script: "t2" };

export const SITE_LABEL: Record<string, string> = { vitrina: "Vitrina", blog: "Blog", ambos: "Vitrina y blog" };

export function secondsLabel(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${minutes} min ${String(seconds % 60).padStart(2, "0")} s`;
}

export function deltaPercent(current: number, previous: number | undefined): number | null {
  if (previous === undefined || previous === 0) return null;
  return ((current - previous) / previous) * 100;
}
