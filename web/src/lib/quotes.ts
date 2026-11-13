import type { QuoteQuote } from "@/lib/api/types";

type QuoteContractFields = Pick<QuoteQuote, "id" | "code" | "client_id" | "owner_id" | "title" | "current_version_no" | "travel_from" | "travel_to" | "valid_until" | "currency" | "lock_version">;

export interface QuoteRow extends QuoteContractFields {
  opportunity_id: string | null;
  status: QuoteQuote["status"];
  client: { code: string; name: string };
  owner: { name: string; color: string | null };
  opportunity: { code: string; title: string; stage?: string | null } | null;
  version: number;
  current_version_id: string | null;
  reservation_id: string | null;
  fx_rate: string;
  total: string;
  total_pen: string;
  margin_pct: string | null;
  internal_status: "pend" | "req" | "ok" | "rejected" | null;
  version_count: number;
  days_left: number | null;
  pax: { adt: number; chd: number; inf: number };
  created_at: string;
}

export interface QuoteListMeta {
  kpis: { open: number; open_pen: string; expiring: number; approved: number; conversion: number | null; total: number; pending_internal: number | null; followup_pen: string };
  can: { manage: boolean };
  today: string;
}

export interface QuoteItem {
  line: number;
  product: { code: string; name: string };
  date: string;
  qty: number;
  pax: number;
  segment: string;
  unit_price: string;
  total: string;
  unit_cost: string | null;
  margin_pct: string | null;
  rate_id?: string | null;
  rate_ref?: string | null;
  price_source?: "rate" | "manual";
}

export interface QuoteVersion {
  number: number;
  status: string;
  issued_on: string;
  author: string;
  notes: string | null;
  snapshot: string;
  discount_pct: string;
  tax_pct: string;
  totals: { sale: string; discount: string; net: string; tax: string; grand: string; cost: string | null; profit: string | null; margin_pct: string | null };
  items: QuoteItem[];
  conditions?: string | null;
  markup_pct?: string | null;
  fx_rate?: string | null;
  frozen_at?: string | null;
  internal_status?: string | null;
  item_count?: number;
  seasons?: Record<number, string | null>;
  itinerary?: QuoteItineraryBlock[];
}

export interface QuoteItineraryBlock {
  product: { code: string; name: string };
  start: string | null;
  days: { day: number; title: string }[];
}

export interface QuoteTimelineEvent {
  kind: "envio" | "vista" | "negociacion" | "aprobacion" | "rechazo";
  at: string;
  channel: string | null;
  detail: string | null;
  note: string | null;
  version: number | null;
  actor: string | null;
}

export interface QuoteInternalDetail {
  status: string;
  reasons: string[];
  over_cap: boolean;
  requested_by: string | null;
  requested_at: string | null;
  request_note: string | null;
  decided_by: string | null;
  decided_at: string | null;
  decision_note: string | null;
}

export interface QuoteActivityItem {
  code: string;
  type: string;
  subject: string;
  status: string;
  due_at: string | null;
  completed_at: string | null;
  related_type: string;
  owner: string | null;
}

export interface QuoteAuditEvent {
  id: string;
  action: string;
  before: string | null;
  after: string | null;
  actor: string | null;
  at: string;
  ip?: string | null;
  correlation?: string | null;
}

export interface QuoteDetail extends QuoteRow {
  approval: { at: string; by: string | null; channel: string | null; reference: string | null; version: number | null } | null;
  rejected_at: string | null;
  internal_detail: QuoteInternalDetail | null;
  timeline: QuoteTimelineEvent[];
  activities: QuoteActivityItem[];
  itinerary: QuoteItineraryBlock[];
  approval_rules: { discount_limit: string; margin_floor: string; max_discount: string };
  reservation: { code: string } | null;
  approved_at: string | null;
  approved_by_name: string | null;
  rejected_reason: string | null;
  viewed_at: string | null;
  see_margin: boolean;
  internal: { required: boolean; status: string | null; note: string | null } | null;
  can: { edit: boolean; send: boolean; approve_internal: boolean; register_approval: boolean; reassign: boolean; duplicate: boolean };
  contact: { email: string | null; phone: string | null } | null;
  share: { active: boolean; url: string | null; created_at: string | null; expires_at: string | null; last_view_at: string | null; last_view_source: string | null } | null;
  evidence_types: string[];
  versions: QuoteVersion[];
  history: { action: string; before_value: string | null; after_value: string | null; occurred_at: string }[];
}

export const paxLabel = (pax: QuoteRow["pax"]) =>
  [pax.adt ? `${pax.adt} ${pax.adt === 1 ? "adulto" : "adultos"}` : null, pax.chd ? `${pax.chd} ${pax.chd === 1 ? "niño" : "niños"}` : null, pax.inf ? `${pax.inf} ${pax.inf === 1 ? "infante" : "infantes"}` : null].filter(Boolean).join(", ");

export const OPEN_QUOTE = ["borrador", "enviada", "vista", "negociacion"];

export const QUOTE_STEPS = ["Datos generales", "Viaje y pasajeros", "Ítems de la cotización", "Resumen económico"] as const;

export const QUOTE_JOURNEY = [
  { status: "borrador", label: "Borrador" },
  { status: "enviada", label: "Enviada" },
  { status: "vista", label: "Vista" },
  { status: "negociacion", label: "Negociación" },
  { status: "aprobada", label: "Aprobada" },
  { status: "convertida", label: "Reserva" },
];

export interface QuoteSegmentOption {
  value: string;
  price: string | null;
  currency: string | null;
  pct: string | null;
}

export interface QuoteRateOption {
  id: string;
  ref: string;
  type: string;
  segment: string;
  channel: string;
  currency: string;
  price: string;
  cost: string | null;
  valid_from: string;
  valid_to: string;
  active: boolean;
}

export interface QuoteFormOptions {
  clients: { code: string; name: string; country: string; domestic: boolean; channel: string }[];
  opportunities: { code: string; title: string; currency: string; pax: number; client_code: string }[];
  products: { code: string; name: string; duration: string; segments: QuoteSegmentOption[]; rates: QuoteRateOption[] }[];
  defaults: { valid_until: string; validity_days: number; tax_pct: number; max_tax: number; max_discount: number; margin_floor: number };
  can: { edit_cost: boolean };
}

export const MANUAL_RATE = "manual";

export interface QuoteLineInput {
  key: string;
  product_code: string;
  date: string;
  qty: number;
  pax: number;
  segment: string;
  rate_id: string;
  unit_price: string;
  unit_cost: string;
}

export const rateValidOn = (rate: QuoteRateOption, date: string) => rate.active && rate.valid_from <= date && rate.valid_to >= date;

export interface QuotePreviewLine {
  rate_id: string | null;
  rate_ref: string | null;
  unit_price: string;
  unit_cost: string | null;
  rate_price: string | null;
  rate_cost: string | null;
  price_source: "rate" | "manual";
  season_factor: string | null;
  total: string;
  margin_pct: string | null;
}

export interface QuotePreview {
  lines: QuotePreviewLine[];
  totals: { sale_total: string; discount_total: string; net_total: string; tax_total: string; grand_total: string; cost_total: string | null; profit_total: string | null; margin_pct: string | null; tax_pct: string; grand_total_pen: string; per_pax: string | null };
  tax_default: string;
  itinerary?: QuoteItineraryBlock[];
  needs_internal_approval: boolean;
}

export interface QuoteConversion {
  code: string;
  status: string;
  reservation: string | null;
  currency: string;
  total: string;
  pax: number;
  version: number;
  checks: { key: string; title: string; ok: boolean; detail: string }[];
  ready: boolean;
  blocked: boolean;
  can_convert: boolean;
  receivables: { concept: string; amount: string; due: string }[];
  items: { line: number; product: string; date: string; pax: number; ok: boolean; status: "disponible" | "proveedor" | "bloqueado"; departure?: string; note: string; alternatives: { ref: string; date: string; free: number }[] }[];
}

type ComparedItem = QuoteItem;

export interface QuoteComparison {
  code: string;
  a: { number: number; status: string; totals: QuoteVersion["totals"]; discount_pct: string };
  b: { number: number; status: string; totals: QuoteVersion["totals"]; discount_pct: string };
  lines: { key: string; product: { code: string; name: string }; segment: string; change: "agregada" | "quitada" | "modificada" | "igual"; fields: string[]; before: ComparedItem | null; after: ComparedItem | null }[];
  summary: { added: number; removed: number; changed: number; grand_delta: string | null; margin_delta: string | null };
}
