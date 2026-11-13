export interface Option {
  key: string;
  label: string;
}

export interface CursorPage<T, K = Record<string, unknown>> {
  data: T[];
  meta: { per_page: number; next_cursor: string | null; prev_cursor: string | null; kpis: K } & Record<string, unknown>;
}

export interface MoneyKpi {
  count: number;
  pen: string;
  usd: string;
}

export interface PaymentLinkRow {
  id: string;
  code: string;
  status: "activo" | "pagado" | "vencido" | "anulado";
  status_label: string;
  amount: string;
  currency: string;
  methods: string[];
  method_labels: string[];
  installments_max: number;
  url: string | null;
  sent_via: string | null;
  expires_at: string;
  paid_at: string | null;
  created_at: string;
  created_by: string | null;
  reservation: { code: string; title: string } | null;
  receivable: { code: string; concept: string | null } | null;
  client: { name: string | null; email: string | null; phone: string | null };
  payment: string | null;
  lock_version: number;
}

export interface PaymentTarget {
  code: string;
  label: string;
  detail: string;
  currency: string;
  open: string;
  due_date: string;
}

export type PaymentLinkKpis = Record<PaymentLinkRow["status"], MoneyKpi>;

export interface GiftCardRow {
  id: string;
  code: string;
  last4: string;
  status: "pendiente" | "activa" | "agotada" | "vencida" | "anulada";
  status_label: string;
  initial_amount: string;
  balance: string;
  currency: string;
  used_pct: number;
  recipient_name: string | null;
  recipient_email: string | null;
  message: string | null;
  buyer: { code: string; name: string } | null;
  expires_at: string;
  created_at: string;
  created_by: string;
  lock_version: number;
}

export interface GiftCardKpis {
  pendiente: { count: number; balance_pen: string; balance_usd: string };
  activa: { count: number; balance_pen: string; balance_usd: string };
  agotada: { count: number; balance_pen: string; balance_usd: string };
  vencida: { count: number; balance_pen: string; balance_usd: string };
  anulada: { count: number; balance_pen: string; balance_usd: string };
  redeemed: { pen: string; usd: string };
}

export interface MappingConcept {
  concept: string;
  label: string;
  account_code: string | null;
  cost_center: string | null;
}

export interface MappingTarget {
  target: string;
  label: string;
  mapped: number;
  total: number;
  ready: Record<string, boolean>;
  concepts: MappingConcept[];
}

export interface AccountMappings {
  targets: MappingTarget[];
  scopes: { key: string; label: string; concepts: string[] }[];
}

export interface AccountingExportRow {
  id: string;
  code: string;
  target: string;
  target_label: string;
  period_from: string;
  period_to: string;
  scope: string[];
  scope_labels: string[];
  status: string;
  status_label: string;
  rows_count: number;
  sha256: string | null;
  file_name: string | null;
  created_at: string;
  created_by: string | null;
}

export interface AccountingKpis {
  generated: number;
  failed: number;
  rows: number;
  last: { code: string; period_to: string; at: string } | null;
}

export interface CheckinDay {
  date: string;
  services: { id: string; code: string; name: string; time: string | null; reservation: string; guide: string | null; status: string; total: number; checked_in: number }[];
  totals: { services: number; passengers: number; checked_in: number };
}

export interface ManifestPassenger {
  id: string;
  name: string;
  pax_type: string;
  is_lead: boolean;
  minor: boolean;
  document: string;
  diet_notes: string | null;
  pass_status: string;
  pass_label: string;
  scanned_at: string | null;
  scanned_by: string | null;
  device: string | null;
  waiver: "no_aplica" | "pendiente" | "falta_tutor" | "firmado";
  waiver_label: string;
  signed_name: string | null;
}

export interface Manifest {
  service: { id: string; code: string; name: string; date: string; time: string | null; kind: string; status: string; is_today: boolean; reservation: { code: string; title: string }; guide: string | null; driver: string | null };
  waiver_template: { code: string; name: string; version: number; requires_guardian_for_minors: boolean } | null;
  passengers: ManifestPassenger[];
  counts: { total: number; checked_in: number; pending: number; waiver_missing: number };
  generated_at: string;
}

export interface WaiverVersion {
  id: string;
  version: number;
  name: string;
  body: string;
  requires_guardian_for_minors: boolean;
  active: boolean;
  signatures: number;
  created_by: string | null;
  created_at: string;
}

export interface WaiverTemplate {
  code: string;
  name: string;
  lang: string;
  lang_label: string;
  active: boolean;
  current_version: number;
  signatures: number;
  versions: WaiverVersion[];
}

export interface WaiverTemplates {
  templates: WaiverTemplate[];
  langs: Option[];
}

export interface InsightRow {
  id: string;
  kind: string;
  kind_label: string;
  severity: "alta" | "media" | "baja";
  severity_label: string;
  title: string;
  detail: string;
  source: { type: string | null; code: string | null };
  metric: Record<string, string | number | null>;
  status: string;
  status_label: string;
  generated_at: string;
  resolved_at: string | null;
}

export interface InsightKpis {
  open: number;
  new: number;
  high: number;
  resolved: number;
  by_kind: Record<string, number>;
}

export interface PassengerPasses {
  trip: { code: string; title: string; travel_from: string; travel_to: string } | null;
  passes: { service: { code: string; name: string; date: string; time: string | null; is_today: boolean }; passengers: { passenger_id: string; name: string; status: string; status_label: string; token: string | null; qr: string | null; scanned_at: string | null }[] }[];
  passengers: { id: string; name: string; is_lead: boolean; minor: boolean; waiver: string; waiver_label: string; signed_at: string | null }[];
  waiver: { code: string; name: string; version: number; lang: string; body: string; requires_guardian_for_minors: boolean } | null;
}

export interface PublicPayLink {
  code: string;
  status: string;
  status_label: string;
  agency: string;
  concept: string;
  reservation: { code: string; title: string; travel_from: string } | null;
  client_name: string | null;
  amount: string;
  currency: string;
  methods: Option[];
  installments_max: number;
  expires_at: string;
  paid_at: string | null;
}
