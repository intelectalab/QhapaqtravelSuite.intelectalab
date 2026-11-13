import type { Tone } from "@/lib/tone";

export type Labels = Record<string, string>;

export interface Option {
  value: string;
  label: string;
}

export interface AiRequest {
  id: string;
  kind: string;
  kind_label: string;
  status: "pending" | "completed" | "failed" | "applied" | "discarded";
  prompt: string;
  source: { type: string; label: string; code: string | null } | null;
  text: string | null;
  tokens_in: number;
  tokens_out: number;
  cost_usd: string;
  error: string | null;
  created_at: string;
  applied_at: string | null;
}

export interface AiUsage {
  enabled: boolean;
  month: string;
  plan: string;
  used: number;
  limit: number;
  remaining: number;
  pct: number;
  warning: boolean;
  by_kind: Record<string, number>;
  tokens_in: number;
  tokens_out: number;
  cost_usd: string;
  recent: AiRequest[];
  kinds: Labels;
  sources: Labels;
}

export interface WhatsappTemplate {
  id: string;
  name: string;
  lang: string;
  category: string;
  category_label: string;
  purpose: string;
  purpose_label: string;
  body: string;
  variables: string[];
  meta_template_id: string | null;
  status: "borrador" | "enviada" | "aprobada" | "rechazada" | "pausada";
  status_label: string;
  rejected_reason: string | null;
  updated_at: string;
  updated_by: string | null;
}

export interface WhatsappOverview {
  enabled: boolean;
  account: { name: string; phone: string | null; status: string; mode: string } | null;
  kpis: { total: number; approved: number; in_review: number; rejected: number };
  templates: WhatsappTemplate[];
  catalogs: { categories: Labels; purposes: Labels; statuses: Labels; langs: Labels };
}

export interface RecoveryFlow {
  code: string;
  name: string;
  trigger_kind: "cart" | "quote";
  trigger_label: string;
  delay_minutes: number;
  channel: "email" | "whatsapp";
  channel_label: string;
  template_ref: string;
  max_attempts: number;
  include_payment_link: boolean;
  active: boolean;
  stats: { attempts: number; scheduled: number; sent: number; recovered: number; recovered_amount: string | null; rate: number | null };
}

export interface RecoveryOverview {
  enabled: boolean;
  kpis: { active: number; scheduled: number; sent: number; recovered: number; recovered_amount: string | null };
  flows: RecoveryFlow[];
  options: { email: Option[]; whatsapp: (Option & { approved: boolean })[] };
  catalogs: { triggers: Labels; channels: Labels; statuses: Labels };
}

export interface RecoveryAttempt {
  id: string;
  flow: { code: string; name: string; channel: string };
  origin: { type: string; label: string; code: string | null };
  client: string | null;
  to: string;
  attempt_no: number;
  scheduled_at: string;
  sent_at: string | null;
  status: string;
  status_label: string;
  reservation: string | null;
  recovered_amount: string | null;
}

export interface CatalogImportSummary {
  code: string;
  source_type: string;
  source_label: string;
  source: string | null;
  status: string;
  status_label: string;
  products_detected: number;
  products_created: number;
  created_at: string;
  created_by: string | null;
}

export interface ImportedProduct {
  key: string;
  name: string;
  destination: string | null;
  duration_days: number;
  price: string | null;
  currency: string;
  confidence: number;
  created_code: string | null;
  destination_known: boolean;
}

export interface CatalogImportDetail extends CatalogImportSummary {
  error: string | null;
  products: ImportedProduct[];
}

export interface ImportsOverview {
  enabled: boolean;
  kpis: { total: number; review: number; detected: number; created: number };
  imports: CatalogImportSummary[];
  catalogs: { sources: Labels; statuses: Labels };
}

export interface PriceRule {
  code: string;
  name: string;
  product: { code: string; name: string } | null;
  basis: string;
  basis_label: string;
  conditions: Record<string, unknown>;
  adjust_pct: string;
  floor_pct: string;
  ceiling_pct: string;
  priority: number;
  channels: string[];
  valid_from: string | null;
  valid_to: string | null;
  active: boolean;
  lock_version: number;
}

export interface PriceRulesPage {
  data: PriceRule[];
  meta: {
    enabled: boolean;
    counts: { total: number; active: number; inactive: number };
    catalogs: { bases: Labels; channels: Labels; conditions: Record<string, string[]> };
    products: Option[];
  };
}

export interface PriceSimulation {
  base_price: string;
  currency: string;
  applied: { code: string; name: string; basis: string; adjust_pct: string; priority: number }[];
  cumulative_pct: string;
  floor_pct: string;
  ceiling_pct: string;
  final_pct: string;
  clamped: boolean;
  final_price: string;
  days_before: number;
}

export interface OtaConnection {
  code: string;
  ota: string;
  ota_label: string;
  name: string;
  account_ref: string | null;
  has_credentials: boolean;
  commission_pct: string;
  markup_pct: string;
  sync_availability: boolean;
  status: "borrador" | "conectado" | "pausado" | "error" | "desconectado";
  status_label: string;
  last_sync_at: string | null;
  last_error: string | null;
  lock_version: number;
  mappings: { total: number; active: number };
  bookings: { total: number; failed: number };
}

export interface OtaOverview {
  enabled: boolean;
  kpis: { connected: number; mapped: number; bookings_30: number; errors: number };
  connections: OtaConnection[];
  catalogs: { otas: Labels; statuses: Labels; price_modes: Labels; mapping_statuses: Labels; booking_statuses: Labels };
}

export interface OtaMapping {
  product: { code: string; name: string };
  ota_product_ref: string;
  ota_option_ref: string | null;
  price_mode: string;
  price_mode_label: string;
  fixed_price: string | null;
  status: string;
  status_label: string;
  last_sync_at: string | null;
}

export interface OtaBooking {
  id: string;
  ota_booking_ref: string;
  connection: { code: string; name: string; ota: string; ota_label: string };
  product: { code: string; name: string } | null;
  reservation: string | null;
  travel_date: string | null;
  pax: number | null;
  gross_amount: string | null;
  net_amount: string | null;
  currency: string | null;
  status: string;
  status_label: string;
  error: string | null;
  received_at: string;
}

export interface MarketKpis {
  published: number;
  partners: number;
  pending: number;
  sold_month: number;
  bought_month: number;
}

export interface MarketListing {
  id: string;
  title: string;
  destination: string | null;
  summary: string | null;
  currency: string;
  from_price: string | null;
  net_price: string | null;
  reseller_commission_pct: string;
  status: string;
  status_label: string;
  seller: string | null;
  product_code: string | null;
  partnership: string | null;
}

export interface MarketListings {
  enabled: boolean;
  kpis: MarketKpis;
  listings: MarketListing[];
  products: Option[];
}

export interface MarketPartnership {
  id: string;
  role: "vendedor" | "revendedor";
  partner: string;
  status: string;
  status_label: string;
  commission_pct: string;
  platform_fee_pct: string;
  payment_terms: string;
  credit_limit: string | null;
  requested_at: string;
  actions: string[];
}

export interface MarketOrder {
  id: string;
  code: string;
  role: "venta" | "compra";
  partner: string;
  listing: { title: string; destination: string | null };
  gross_amount: string;
  commission_amount: string;
  platform_fee_amount: string;
  currency: string;
  status: string;
  status_label: string;
  created_at: string;
}

export const STATUS_TONES: Record<string, Tone> = {
  aprobada: "ok",
  activa: "ok",
  activo: "ok",
  conectado: "ok",
  publicado: "ok",
  confirmada: "ok",
  importado: "ok",
  recuperado: "ok",
  completed: "info",
  applied: "ok",
  enviada: "sun",
  enviado: "info",
  revision: "sun",
  solicitada: "sun",
  pendiente: "sun",
  programado: "info",
  procesando: "info",
  en_cola: "info",
  pending: "info",
  borrador: "mute",
  pausada: "mute",
  pausado: "mute",
  suspendida: "mute",
  descartado: "mute",
  discarded: "mute",
  cancelado: "mute",
  retirado: "mute",
  desconectado: "mute",
  terminada: "mute",
  recibida: "info",
  liquidada: "violet",
  rechazada: "bad",
  error: "bad",
  fallido: "bad",
  failed: "bad",
  cancelada: "bad",
};

export const toneOf = (status: string): Tone => STATUS_TONES[status] ?? "mute";

export const labelOptions = (labels: Labels): Option[] => Object.entries(labels).map(([value, label]) => ({ value, label }));

export function delayLabel(minutes: number): string {
  if (minutes % 1440 === 0) return `${minutes / 1440} ${minutes === 1440 ? "día" : "días"}`;
  if (minutes % 60 === 0) return `${minutes / 60} ${minutes === 60 ? "hora" : "horas"}`;
  return `${minutes} min`;
}

export function conditionLabel(basis: string, conditions: Record<string, unknown>): string {
  const pct = (value: unknown) => `${Math.round(Number(value) * 100)} %`;
  const days = ["", "lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
  const parts: string[] = [];
  if (conditions.occupancy_gte !== undefined) parts.push(`ocupación desde ${pct(conditions.occupancy_gte)}`);
  if (conditions.occupancy_lte !== undefined) parts.push(`ocupación hasta ${pct(conditions.occupancy_lte)}`);
  if (conditions.demand_gte !== undefined) parts.push(`demanda desde ${pct(conditions.demand_gte)}`);
  if (conditions.demand_lte !== undefined) parts.push(`demanda hasta ${pct(conditions.demand_lte)}`);
  if (conditions.days_before_gte !== undefined) parts.push(`${conditions.days_before_gte} días o más antes`);
  if (conditions.days_before_lte !== undefined) parts.push(`hasta ${conditions.days_before_lte} días antes`);
  if (Array.isArray(conditions.weekdays)) parts.push(conditions.weekdays.map((day) => days[Number(day)] ?? day).join(", "));
  if (basis === "temporada" && conditions.from && conditions.to) parts.push(`del ${String(conditions.from)} al ${String(conditions.to)}`);
  return parts.join(" · ") || "Sin condición";
}
