import { BedDouble, Bus, Car, Coffee, Map as MapIcon, TrainFront, type LucideIcon } from "lucide-react";

export interface ReservationRow {
  code: string;
  title: string;
  status: string;
  channel: string;
  travel_from: string;
  travel_to: string;
  total?: string;
  currency: string;
  total_pen?: number;
  client: { code: string; name: string };
  owner: { name: string; color: string | null };
  passengers: number;
  balance_pen?: number;
  open_incidents: number;
  services: { confirmed: number; total: number };
  supplier_cost_pen?: number;
  origin: { kind: "cotizacion" | "web" | "directa"; label: string };
  cancel_requested: boolean;
}

export interface Occupancy {
  month: string;
  today: string;
  days: { date: string; pax: number; reservations: number }[];
  next: { date: string; pax: number; reservations: number }[];
  departures: { ref: string; product: string; date: string; time: string | null; capacity: number; sold: number; free: number; status: string }[];
}

export interface ReservationView {
  mode: "full" | "operations" | "amounts";
  margin: boolean;
  cost: boolean;
  price: boolean;
}

export interface ReservationKpis {
  confirmed: number;
  in_operation: number;
  pending: number;
  traveling_pax: number;
  total: number;
}

export interface ReservationListMeta {
  today: string;
  can: { modify: boolean; cancel: boolean; create: boolean };
  view: ReservationView;
  kpis: ReservationKpis;
}

export interface ReservationList extends ReservationListMeta {
  items: ReservationRow[];
}

export interface ReservationService {
  code: string;
  name: string;
  date: string;
  time: string | null;
  kind: string;
  status: string;
  confirmation: string | null;
  reject_reason: string | null;
  replaced: boolean;
  alt_of?: string | null;
  provider: { ref?: string | null; name: string; active: boolean } | null;
  alternatives?: { id: string; name: string; city: string | null }[];
  price?: string;
  cost?: string;
  currency: string;
}

export interface ReservationCan {
  modify: boolean;
  cancel: boolean;
  request_cancel: boolean;
  reassign: boolean;
  approve_changes: boolean;
  confirm: boolean;
  start_operation: boolean;
  complete: boolean;
  services: boolean;
  generate_receivables: boolean;
  operation_order: boolean;
}

export interface ReservationDetail extends Omit<ReservationRow, "passengers" | "balance_pen" | "open_incidents" | "services" | "origin" | "cancel_requested"> {
  today: string;
  notes: string | null;
  sede: string | null;
  quote: { code: string; title: string } | null;
  cancel_reason: string | null;
  view: ReservationView;
  margin_pct?: number | null;
  economics?: { sale_net: number; cost: number; profit: number };
  passengers: ReservationPassenger[];
  owner_id: string;
  lock_version: number;
  order: string | null;
  can: ReservationCan;
  reject_reasons: string[];
  changes: ReservationChange[];
  cancel_request: { id: string; reason: string; requested_at: string } | null;
  cancellation: { penalty_amount?: string; refund_amount?: string; owed_amount?: string; cancelled_at: string } | null;
  services: ReservationService[];
  receivables?: { code: string; kind: string; concept: string; amount: string; paid_amount: string; currency: string; due_date: string; status: string }[];
  incidents: { code: string; title: string; type: string; severity: string; status: string; created_at: string }[];
  vouchers: { code: string; label: string; date: string; status: string; version: number }[];
  history: { action: string; before_value: string | null; after_value: string | null; occurred_at: string }[];
  created_at: string;
  snapshot_label: string | null;
  policies: { source: "snapshot" | "product" | "none"; items: ReservationPolicy[] };
  change_log: ReservationChangeLog[];
  operation: ReservationOperation | null;
  counts: { web: number; feedback: number; unread_feedback: number };
  payments?: ReservationPayment[];
  invoices?: ReservationInvoice[];
}

export interface ReservationPolicy {
  product: string;
  cancellation: string | null;
  modification: string | null;
  no_show: string | null;
  refund: string | null;
}

export interface ReservationChangeLog {
  type: string;
  description: string;
  extra_pax: number | null;
  service_date: string | null;
  delta_amount?: string | null;
  status: string;
  requested_at: string;
  decided_at: string | null;
  applied_at: string | null;
  requested_by: string | null;
  decided_by: string | null;
}

export interface ReservationOperation {
  code: string;
  status: string;
  date_from: string;
  date_to: string;
  coordinator: string | null;
  tasks: { title: string; done: boolean; done_at: string | null }[];
  assignments: { service_date: string; service_time: string | null; service_label: string; status: string; guide: string | null; driver: string | null; vehicle: string | null; vehicle_type: string | null }[];
}

export interface ReservationPayment {
  code: string;
  paid_on: string;
  method: string;
  reference: string | null;
  amount: string;
  currency: string;
  status: string;
  reject_reason: string | null;
  receivable_code: string | null;
  receivable_concept: string | null;
}

export interface ReservationInvoice {
  number: string;
  doc_type: string;
  issue_date: string;
  total_amount: string;
  currency: string;
  status: string;
  description: string | null;
}

export interface ReservationWebSnapshot {
  product: { code: string; name: string } | null;
  service_date: string;
  pax: { adt: number; chd: number; inf: number };
  source: string | null;
  order_code: string | null;
  currency_display: string;
  charge_currency: string;
  fx_rate: string;
  lines?: { label?: string; name?: string; amount?: string | number; qty?: number }[];
  adjustments?: { label?: string; reason?: string; amount?: string | number }[];
  total?: string;
  total_display?: string;
  payment?: { mode: string | null; deposit_pct: string | null; deposit: string | null; balance: string | null; balance_due: string | null };
  lodging: { city: string; hotel_name: string | null; room_type: string | null; rooms: number; nights: number }[];
  addons: { name: string; qty: number; amount?: string }[];
  pickup: { point: string | null; address: string | null; flight: string | null; arrival: string | null };
  comments: string | null;
  companions: { pending: boolean; due: string | null };
  rules_applied: string[];
}

export interface ReservationFeedback {
  code: string;
  passenger_name: string | null;
  type: string;
  rating: number | null;
  text: string;
  status: string;
  reply: string | null;
  replied_at: string | null;
  channel: string | null;
  created_at: string;
  service_name: string | null;
  incident_code: string | null;
  replied_by: string | null;
}

export interface ReservationPaxMessage {
  code: string;
  channel: string;
  recipient: string | null;
  subject: string | null;
  status: string;
  direction: string;
  origin: string | null;
  scheduled_at: string | null;
  sent_at: string | null;
  read_at: string | null;
  error: string | null;
}

export interface ReservationHistoryEvent {
  id: string;
  entity: string;
  entity_id: string;
  action: string;
  before: string | null;
  after: string | null;
  actor: string | null;
  occurred_at: string;
}

export const DOC_TYPE: Record<string, string> = { "01": "Factura", "03": "Boleta", "07": "Nota de crédito", "08": "Nota de débito" };

export const SERVICE_KIND: Record<string, { label: string; icon: LucideIcon }> = {
  tour: { label: "Tour", icon: MapIcon },
  traslado: { label: "Traslado", icon: Car },
  alojamiento: { label: "Alojamiento", icon: BedDouble },
  tren_entrada: { label: "Tren o entrada", icon: TrainFront },
  libre: { label: "Libre", icon: Coffee },
  transporte: { label: "Transporte", icon: Bus },
};

export const PAX_TYPE: Record<string, string> = { ADT: "Adulto", CHD: "Niño", INF: "Infante" };

export interface ReservationPassenger {
  id: string;
  full_name: string;
  doc_type: string | null;
  doc_number: string | null;
  pax_type: string;
  nationality: string | null;
  birth_date: string | null;
  age: number | null;
  phone: string | null;
  email: string | null;
  diet_notes: string | null;
  relationship: string | null;
  is_lead: boolean;
  is_placeholder: boolean;
  age_warning?: string | null;
}

export interface ReservationCancellation {
  code: string;
  currency: string;
  total: string;
  paid: string;
  penalty_services: string;
  consumed: string;
  factor_k: string;
  penalty: string;
  refund: string;
  owed: string;
  lines: { code: string; name: string; date: string; days: number; policy: string; tiers: string; tiers_source: "tramos" | "texto"; pct: number; price: string; penalty: string }[];
  reasons: string[];
  request: string | null;
  request_id: string | null;
}

export const CLOSED_RESERVATION = ["cancelada", "completada"];

export const RELATIONSHIPS = ["Titular", "Cónyuge / pareja", "Hijo/a", "Padre / madre", "Hermano/a", "Amigo/a", "Otro"];

export interface ReservationChange {
  id: string;
  type: string;
  description: string;
  extra_pax: number | null;
  service_date: string | null;
  delta_amount: string;
  requested_at: string;
  requested_by: string;
  product: string | null;
}

export interface ChangeOptions {
  pax: number;
  can_approve: boolean;
  products: { code: string; name: string }[];
  pending: ReservationChange[];
}

export interface ChangeImpact {
  pax: number;
  unit_cost: string;
  available: boolean;
  note: string | null;
  suggested: string;
}

export const CHANGE_TYPE: Record<string, string> = { pax: "Pasajeros", servicio: "Servicio", upgrade: "Mejora", otro: "Otro ajuste" };

export interface ConfirmPreview {
  code: string;
  status: string;
  confirmable: boolean;
  services: { code: string; name: string; date: string; status: string; provider: string | null; ok: boolean; kind: "cupo" | "proveedor" | "rechazo" | "reemplazado"; message: string; alternatives: { ref: string; date: string; free: number }[] }[];
  passengers: { ok: boolean; count: number };
  blocked: boolean;
  reschedule: boolean;
  waiting: boolean;
}

export interface ReschedulePlan {
  code: string;
  currency: string;
  from: string;
  to: string;
  suggested: string;
  new_from: string;
  new_to: string;
  shift: number;
  diff: string;
  blocked: string | null;
  lines: { id: string; code: string; name: string; date: string; new_date: string; pax: number; price: string; new_price: string; ok: boolean; note: string }[];
}

export const DIRECT_STEPS = ["Cliente y canal", "Producto, fecha y pasajeros", "Disponibilidad y precio"] as const;

export interface DirectFormOptions {
  clients: { code: string; name: string }[];
  advisors: { id: string; name: string }[];
  channels: string[];
  products: { code: string; name: string; model: string; duration: string; advance_min_days: number; max_pax: number | null }[];
  owner_id: string;
  today: string;
}

export interface DirectRateOption {
  id: string;
  ref: string;
  type: string;
  segment: string;
  channel: string;
  currency: string;
  price: string;
  valid: boolean;
}

export interface DirectDeparture {
  id: string;
  ref: string;
  date: string;
  time: string | null;
  free: number;
}

export interface DirectPlan {
  product: { code: string; name: string; model: string; advance_min_days: number; max_pax: number | null };
  departures: DirectDeparture[];
  pax: { adt: number; chd: number; inf: number };
  priced: boolean;
  rates: DirectRateOption[];
  rate_id?: string;
  rate_ref?: string;
  season_factor?: string | null;
  channel?: string;
  date?: string;
  travel_from?: string;
  travel_to?: string;
  departure?: { id: string; ref: string; time: string | null; free: number } | null;
  currency?: string;
  adult_price?: string;
  child_price?: string | null;
  total?: string;
  cost?: string;
  available?: boolean;
  note?: string;
}

export interface DirectPayload {
  client_id: string;
  product_id: string;
  channel: string;
  owner_id: string;
  departure_id: string;
  rate_id: string;
  date: string;
  adt: number;
  chd: number;
  inf: number;
  notes: string;
}
