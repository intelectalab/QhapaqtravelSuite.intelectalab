export interface QuoteRow {
  code: string;
  title: string;
  status: string;
  client: { code: string; name: string };
  owner: { name: string; color: string | null };
  version: number;
  currency: string;
  total: number;
  total_pen: number;
  margin_pct: number | null;
  travel_from: string;
  travel_to: string;
  valid_until: string;
  days_left: number | null;
  pax: { adt: number; chd: number; inf: number };
  created_at: string;
}

export interface QuoteList {
  items: QuoteRow[];
  can: { manage: boolean };
  kpis: { open: number; open_pen: number; expiring: number; approved: number; conversion: number | null };
  today: string;
}

export interface QuoteItem {
  line: number;
  product: { code: string; name: string };
  date: string;
  qty: number;
  pax: number;
  segment: string;
  unit_price: number;
  total: number;
  unit_cost: number | null;
  margin_pct: number | null;
}

export interface QuoteVersion {
  number: number;
  status: string;
  issued_on: string;
  author: string;
  notes: string | null;
  snapshot: string;
  discount_pct: number;
  tax_pct: number;
  totals: { sale: number; discount: number; net: number; tax: number; grand: number; cost: number | null; profit: number | null; margin_pct: number | null };
  items: QuoteItem[];
}

export interface QuoteDetail extends QuoteRow {
  opportunity: { code: string; title: string } | null;
  reservation: { code: string } | null;
  approved_at: string | null;
  approved_by_name: string | null;
  rejected_reason: string | null;
  viewed_at: string | null;
  see_margin: boolean;
  lock_version: number;
  internal: { required: boolean; status: string | null; note: string | null } | null;
  can: { edit: boolean; send: boolean; approve_internal: boolean; register_approval: boolean };
  contact: { email: string | null; phone: string | null } | null;
  versions: QuoteVersion[];
  history: { action: string; before_value: string | null; after_value: string | null; occurred_at: string }[];
}

export const paxLabel = (pax: QuoteRow["pax"]) =>
  [pax.adt ? `${pax.adt} ${pax.adt === 1 ? "adulto" : "adultos"}` : null, pax.chd ? `${pax.chd} ${pax.chd === 1 ? "niño" : "niños"}` : null, pax.inf ? `${pax.inf} ${pax.inf === 1 ? "infante" : "infantes"}` : null].filter(Boolean).join(", ");

export const OPEN_QUOTE = ["borrador", "enviada", "vista", "negociacion"];

export const QUOTE_JOURNEY = [
  { status: "borrador", label: "Borrador" },
  { status: "enviada", label: "Enviada" },
  { status: "vista", label: "Vista" },
  { status: "negociacion", label: "Negociación" },
  { status: "aprobada", label: "Aprobada" },
  { status: "convertida", label: "Reserva" },
];

export interface QuoteFormOptions {
  clients: { code: string; name: string }[];
  opportunities: { code: string; title: string; currency: string; pax: number; client_code: string }[];
  products: { code: string; name: string; duration: string; rates: { segment: string; currency: string; price: number }[] }[];
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
  lines: { total: number; margin_pct: number | null }[];
  totals: { sale_total: number; discount_total: number; net_total: number; tax_total: number; grand_total: number; cost_total: number | null; profit_total: number | null; margin_pct: number | null };
  needs_internal_approval: boolean;
}

export interface QuoteConversion {
  code: string;
  status: string;
  reservation: string | null;
  currency: string;
  total: number;
  pax: number;
  receivables: { concept: string; amount: number; due: string }[];
  items: { line: number; product: string; date: string; pax: number; ok: boolean; note: string }[];
}
