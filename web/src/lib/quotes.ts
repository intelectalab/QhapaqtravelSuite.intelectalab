import type { QuoteQuote } from "@/lib/api/types";

type QuoteContractFields = Pick<QuoteQuote, "id" | "code" | "client_id" | "owner_id" | "title" | "current_version_no" | "travel_from" | "travel_to" | "valid_until" | "currency" | "lock_version">;

export interface QuoteRow extends QuoteContractFields {
  opportunity_id: string | null;
  status: QuoteQuote["status"];
  client: { code: string; name: string };
  owner: { name: string; color: string | null };
  version: number;
  current_version_id: string | null;
  reservation_id: string | null;
  fx_rate: string;
  total: string;
  total_pen: string;
  margin_pct: string | null;
  days_left: number | null;
  pax: { adt: number; chd: number; inf: number };
  created_at: string;
}

export interface QuoteListMeta {
  kpis: { open: number; open_pen: string; expiring: number; approved: number; conversion: number | null; total: number };
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
}

export interface QuoteDetail extends QuoteRow {
  approval: { at: string; by: string | null; channel: string | null; reference: string | null; version: number | null } | null;
  rejected_at: string | null;
  internal_detail: QuoteInternalDetail | null;
  timeline: QuoteTimelineEvent[];
  activities: QuoteActivityItem[];
  itinerary: { product: { code: string; name: string }; start: string; days: { day: number; title: string }[] }[];
  approval_rules: { discount_limit: string; margin_floor: string; max_discount: string };
  opportunity: { code: string; title: string } | null;
  reservation: { code: string } | null;
  approved_at: string | null;
  approved_by_name: string | null;
  rejected_reason: string | null;
  viewed_at: string | null;
  see_margin: boolean;
  internal: { required: boolean; status: string | null; note: string | null } | null;
  can: { edit: boolean; send: boolean; approve_internal: boolean; register_approval: boolean; reassign: boolean; duplicate: boolean };
  contact: { email: string | null; phone: string | null } | null;
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

export interface QuoteFormOptions {
  clients: { code: string; name: string }[];
  opportunities: { code: string; title: string; currency: string; pax: number; client_code: string }[];
  products: { code: string; name: string; duration: string; segments: QuoteSegmentOption[] }[];
  defaults: { valid_until: string; tax_pct: number; max_discount: number };
}

export interface QuoteLineInput {
  key: string;
  product_code: string;
  date: string;
  qty: number;
  pax: number;
  segment: string;
  unit_price: string;
}

export interface QuotePreview {
  lines: { unit_price: string; rate_price: string | null; price_source: "rate" | "manual"; total: string; margin_pct: string | null }[];
  totals: { sale_total: string; discount_total: string; net_total: string; tax_total: string; grand_total: string; cost_total: string | null; profit_total: string | null; margin_pct: string | null };
  needs_internal_approval: boolean;
}

export interface QuoteConversion {
  code: string;
  status: string;
  reservation: string | null;
  currency: string;
  total: string;
  pax: number;
  receivables: { concept: string; amount: string; due: string }[];
  items: { line: number; product: string; date: string; pax: number; ok: boolean; note: string }[];
}

type ComparedItem = QuoteItem;

export interface QuoteComparison {
  code: string;
  a: { number: number; status: string; totals: QuoteVersion["totals"]; discount_pct: string };
  b: { number: number; status: string; totals: QuoteVersion["totals"]; discount_pct: string };
  lines: { key: string; product: { code: string; name: string }; segment: string; change: "agregada" | "quitada" | "modificada" | "igual"; fields: string[]; before: ComparedItem | null; after: ComparedItem | null }[];
  summary: { added: number; removed: number; changed: number; grand_delta: string | null; margin_delta: string | null };
}
