import type { Tone } from "@/lib/tone";

export interface StatusMeta {
  label: string;
  tone: Tone;
}

const STATUS: Record<string, StatusMeta> = {
  borrador: { label: "Borrador", tone: "mute" },
  en_revision: { label: "En revisión", tone: "sun" },
  publicado: { label: "Publicado", tone: "ok" },
  rechazado: { label: "Rechazado", tone: "bad" },
  despublicado: { label: "Pausado", tone: "mute" },
  archivado: { label: "Archivado", tone: "mute" },
  confirmada: { label: "Confirmada", tone: "info" },
  asistio: { label: "Asistió", tone: "ok" },
  no_show: { label: "No se presentó", tone: "warn" },
  cancelada: { label: "Cancelada", tone: "mute" },
  activa: { label: "Activa", tone: "ok" },
  suspendida: { label: "Suspendida", tone: "bad" },
  rechazada: { label: "Rechazada", tone: "bad" },
  pendiente: { label: "Pendiente", tone: "sun" },
  pausada: { label: "Pausada", tone: "mute" },
  error: { label: "Con error", tone: "bad" },
  activo: { label: "Activo", tone: "ok" },
  vencido: { label: "Vencido", tone: "mute" },
  convertido: { label: "Convertido", tone: "t1" },
  revocado: { label: "Revocado", tone: "bad" },
  pendiente_dns: { label: "Esperando DNS", tone: "sun" },
  verificado: { label: "Verificado", tone: "ok" },
  retirado: { label: "Retirado", tone: "mute" },
  emitido: { label: "Emitido", tone: "ok" },
  renovando: { label: "Renovando", tone: "info" },
  pendiente_consentimiento: { label: "Esperando consentimiento", tone: "sun" },
  estimado: { label: "Estimada", tone: "sun" },
  liquidado: { label: "Liquidada", tone: "ok" },
  ajustado: { label: "Ajustada", tone: "info" },
};

export function vitrinaStatus(status: string): StatusMeta {
  return STATUS[status] ?? { label: status, tone: "mute" };
}

export const LANGUAGE_LABELS: Record<string, string> = { es: "Español", en: "Inglés", pt: "Portugués", fr: "Francés", de: "Alemán", it: "Italiano" };

export const FEE_BASIS: Record<string, string> = { cupo_gratis: "Cupo gratis", por_asistente: "Por asistente", comision: "Comisión", plan: "Incluido en el plan" };

export interface ShowcaseAgency {
  id: string;
  code: string;
  name: string;
  slug: string;
  city: string;
  ruc: string | null;
  email: string;
  phone: string | null;
  license_ref: string | null;
  status: string;
  verified_at: string | null;
  rating: number | null;
  reviews: number;
  has_account: boolean;
  created_at: string;
}

export interface ShowcaseListing {
  id: string;
  code: string;
  slug: string;
  title: string;
  city: string;
  zone: string | null;
  theme: string | null;
  languages: string[];
  start_times: string[];
  highlights: string[];
  duration_hours: number;
  meeting_point: string;
  model: "propina" | "pago";
  price: string;
  currency: string;
  capacity: number;
  status: string;
  reject_reason: string | null;
  featured: boolean;
  rating: number | null;
  reviews: number;
  published_at: string | null;
  updated_at: string;
  agency: { code: string; name: string; slug: string; city: string; verified: boolean; rating: number | null; reviews: number };
  can_pause?: boolean;
  can_resume?: boolean;
}

export interface ShowcaseRules {
  free_monthly_bookings: number;
  fee_per_attendee: string;
  fee_currency: string;
  commission_pct: Record<string, string>;
}

export interface AgencyShowcase {
  agency: ShowcaseAgency | null;
  plan: { code: string; label: string; commission_pct: string; has_plan: boolean };
  rules: ShowcaseRules;
  benefits: [string, string][];
  kpis: { published: number; in_review: number; bookings: number; pax: number; attendance_pct: number | null; month_fee: string };
  items: ShowcaseListing[];
  options: { themes: string[]; languages: string[] };
}

export interface ShowcaseBooking {
  code: string;
  listing: { code: string; title: string; model: string };
  service_date: string;
  start_time: string;
  traveler_name: string;
  traveler_email: string;
  pax: number;
  language: string;
  status: string;
  amount: string | null;
  currency: string;
  commission_pct: string | null;
  fee_amount: string;
  fee_basis: string;
  source: string | null;
  created_at: string;
  can_mark: boolean;
}

export interface ShowcaseFeeMonth {
  month: string;
  bookings: number;
  attendees: number;
  free_used: number;
  free_quota: number;
  attendee_fees: string;
  commissions: string;
  paid_sales: string;
  total: string;
  currency: string;
}

export interface ShowcaseFees {
  plan: string;
  rules: ShowcaseRules;
  months: ShowcaseFeeMonth[];
}

export interface SiteDomain {
  id: string;
  host: string;
  purpose: string;
  status: string;
  ssl_status: string;
  ssl_expires_at: string | null;
  ssl_renews_on: string | null;
  verified_at: string | null;
  last_check_at: string | null;
  last_error: string | null;
  dns: { type: string; name: string; value: string }[];
}

export interface DomainsOverview {
  items: SiteDomain[];
  kpis: { total: number; verified: number; pending: number };
  purposes: string[];
  fallback_host: string;
}

export interface SeoPage {
  id: string;
  path: string;
  title: string;
  meta_description: string | null;
  focus_keyword: string | null;
  schema_types: string[];
  canonical_url: string | null;
  indexable: boolean;
  h1_count: number;
  word_count: number;
  images: number;
  images_with_alt: number;
  speed_mobile: number | null;
  score: number | null;
  issues: { code: string; label: string }[];
  clicks_28d: number;
  avg_position: number | null;
  audited_at: string | null;
}

export interface SeoOverview {
  items: SeoPage[];
  kpis: { pages: number; average: number | null; clicks_28d: number; with_issues: number };
  checks: Record<string, string>;
  sitemap: { host: string; urls: string[]; robots: string };
}

export interface SiteRedirect {
  id: string;
  from_path: string;
  to_path: string;
  code: number;
  hits: number;
  active: boolean;
  created_at: string;
}

export interface RedirectsOverview {
  items: SiteRedirect[];
  kpis: { active: number; hits: number };
}

export interface TravelStory {
  id: string;
  slug: string;
  title: string;
  city: string | null;
  quote: string | null;
  body: string | null;
  photo_count: number;
  status: string;
  client: { code: string; name: string; email: string | null };
  reservation: string | null;
  product: { code: string; name: string } | null;
  consent: { at: string; by: string; channel: string; name_mode: string; photos: boolean; revoked_at: string | null; valid: boolean } | null;
  published_at: string | null;
  seo_score: number | null;
  views: number;
  can_publish: boolean;
  needs_consent: boolean;
}

export interface Option {
  value: string;
  label: string;
}

export interface StoriesOverview {
  can_publish: boolean;
  items: TravelStory[];
  kpis: Record<string, number>;
  options: { reservations: Option[]; products: Option[]; name_modes: Option[] };
}

export interface PublicStory {
  slug: string;
  title: string;
  city: string | null;
  quote: string | null;
  photo_count: number;
  traveler: string | null;
  published_at: string;
  product: { slug: string; name: string } | null;
  body?: string | null;
}

export interface GatewayAccount {
  id: string;
  provider: string;
  provider_label: string;
  label: string;
  account_ref: string;
  status: string;
  mode: string;
  currency: string;
  fee_currency: string;
  fee_pct: string;
  fee_fixed: string;
  fx_spread_pct: string;
  tax_on_fee: boolean;
  settle_days: number;
  pass_fee_to_customer: boolean;
  has_credentials: boolean;
  credentials_in_vault: boolean;
  addon_required: string | null;
  totals: { currency: string; count: number; gross: string; cost: string; net: string }[];
}

export interface GatewaysOverview {
  can_manage: boolean;
  providers: Option[];
  igv_pct: string;
  items: GatewayAccount[];
}

export interface GatewayFee {
  id: string;
  gateway: { id: string; label: string; provider: string };
  payment: string;
  reservation: string | null;
  paid_on: string;
  currency: string;
  gross: string;
  fee: string;
  fee_tax: string;
  fx_spread: string;
  net: string;
  effective_pct: string;
  status: string;
  external_ref: string | null;
  settled_on: string | null;
  passed_to_customer: boolean;
}

export interface GatewayFeesOverview {
  items: GatewayFee[];
  totals: { currency: string; count: number; gross: string; fee: string; fee_tax: string; fx_spread: string; net: string }[];
  kpis: Record<string, number>;
}

export interface AccessPass {
  code: string;
  name: string;
  tenant: { code: string; name: string; status: string };
  starts_on: string;
  ends_on: string;
  days: number;
  days_left: number | null;
  price: string;
  currency: string;
  features: { key: string; label: string }[];
  reason: string;
  status: string;
  source: string;
  convert_to: { code: string; name: string } | null;
  invoice: string | null;
  author: string | null;
  created_at: string;
}

export interface AddonBilling {
  code: string;
  label: string;
  unit: string | null;
  billing_mode: "mensual" | "unico" | "ambos";
  price_once: string | null;
  price_month: string | null;
}

export interface PassesOverview {
  kpis: { active: number; expiring: number; converted: number; revenue: string };
  items: AccessPass[];
  tenants: { code: string; name: string; status: string; plan: string | null; has_active_pass: boolean }[];
  features: { key: string; label: string; module: string | null }[];
  default_features: string[];
  plans: { code: string; name: string }[];
  addons: AddonBilling[];
  rules: { max_days: number; default_days: number; default_price: string; read_only_days: number };
}

export interface ModerationOverview {
  brand: { name: string; domain: string };
  kpis: { pending_listings: number; pending_agencies: number; agencies: number; published: number; month_visits: number; month_bookings: number; fees: string };
  listings: ShowcaseListing[];
  agencies: (ShowcaseAgency & { listings: number; bookings: number; fees: string; plan: string })[];
}

export interface FunnelMonth {
  month: string;
  visita: number;
  reserva: number;
  registro_agencia: number;
  pase_iniciado: number;
  plan_pagado: number;
  addon_comprado: number;
  conversion_pct: number | null;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body: string | null;
  city: string | null;
  focus_keyword: string;
  status: string;
  word_count: number;
  seo_score: number | null;
  published_at: string | null;
  linked_listing_ids: string[];
  author: string | null;
  updated_at: string;
}

export interface PostsOverview {
  items: BlogPost[];
  kpis: Record<string, number>;
  rules: { min_words: number; min_listings: number };
  listings: { id: string; code: string; title: string; city: string }[];
}

export function cityLabel(city: string): string {
  return city ? city.charAt(0).toUpperCase() + city.slice(1) : "";
}

export function monthLabel(month: string): string {
  const [year, value] = month.split("-").map(Number);
  return new Date(Date.UTC(year, value - 1, 1)).toLocaleDateString("es-PE", { month: "long", year: "numeric", timeZone: "UTC" });
}
