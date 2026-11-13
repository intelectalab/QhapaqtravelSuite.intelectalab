import type { Tone } from "@/lib/tone";

export type Money = Record<string, number>;

export interface SupplierSession {
  provider: { ref: string; name: string; type: string; city: string | null; initials: string };
  agency: { name: string; initials: string };
  user: { name: string; email: string };
  counts: { pending: number; rooming: number; incidents: number };
  frame: SupplierFrame;
}

export interface SupplierFrame {
  pending: number;
  alternatives: number;
  response_hours: number;
  upcoming: number;
  upcoming_pax: number;
  receivable: Money;
  open_incidents: number;
}

export interface SupplierRequest {
  code: string;
  lock_version: number;
  reservation: string;
  holder: string;
  service: string;
  kind: string;
  date: string;
  time: string | null;
  pax: number;
  rooms: number | null;
  nights: number | null;
  net_cost: number;
  currency: string;
  status: string;
  state: string;
  confirmation_code: string | null;
  confirmed_by: string | null;
  confirmed_at: string | null;
  requested_at: string | null;
  deadline: string | null;
  overdue: boolean;
  days_to: number;
  alternative_of: string | null;
  proposal: SupplierProposal | null;
}

export interface SupplierProposal {
  kind: string;
  date: string | null;
  service: { ref: string; name: string } | null;
  net_cost: number | null;
  currency: string;
  hold_until: string | null;
  note: string;
  review_status: "pendiente" | "aceptada" | "rechazada" | "expirada";
  review_note: string | null;
  at: string | null;
}

export interface SupplierRelated {
  code: string;
  date: string;
  status: string;
}

export interface SupplierHistoryItem {
  key: string;
  kind: string;
  at: string;
  title: string;
  detail: string;
  note: string | null;
}

export interface SupplierRequestDetail extends SupplierRequest {
  reasons: string[];
  alternative_kinds: string[];
  catalog: { value: string; label: string; hint?: string }[];
  today: string;
  contact: string;
  passengers: { name: string; type: string; nationality: string | null; diet: string | null; lead: boolean; placeholder: boolean }[];
  pickup: string | null;
  reject_reason: string | null;
  voucher: { code: string; version: number; status: string; issued_at: string | null; used_at: string | null } | null;
  alternative_service: SupplierRelated | null;
  replaced_by: SupplierRelated | null;
  rooming: { check_in: string; check_out: string; status: string; acknowledged_at: string | null; confirmed_at: string | null; rooms: number } | null;
  history: SupplierHistoryItem[];
}

export interface SupplierRequests {
  today: string;
  response_hours: number;
  rows: SupplierRequest[];
  reasons: string[];
  alternative_kinds: string[];
  catalog: { value: string; label: string; hint?: string }[];
}

export interface SupplierPayable {
  code: string;
  reservation: string | null;
  service: string | null;
  concept: string;
  amount: number;
  paid: number;
  balance: number;
  currency: string;
  due_date: string;
  scheduled_date: string | null;
  days_to: number;
  status: string;
  supplier_doc: string | null;
  invoice: { number: string; issue_date: string; amount: number; difference: number; status: string; file: string; uploaded_at: string; note: string | null } | null;
  can_invoice: boolean;
  payouts: { code: string; paid_on: string; amount: number; method: string; reference: string | null }[];
}

export interface SupplierPayables {
  today: string;
  payment_terms: string | null;
  max_kb: number;
  rows: SupplierPayable[];
  totals: { balance: Money; paid: Money; overdue: number; without_invoice: number };
}

export interface SupplierAlert {
  kind: "request" | "contract" | "invoice" | "rate" | "rooming" | "voucher";
  tone: Tone;
  title: string;
  detail: string;
  href: string;
}

export interface SupplierHome {
  today: string;
  kpis: { pending: number; alternatives: number; overdue: number; upcoming: number; upcoming_pax: number; receivable: Money; contract_days: number; open_incidents: number };
  pending: SupplierRequest[];
  upcoming: SupplierRequest[];
  payments: SupplierPayable[];
  alerts: SupplierAlert[];
}

export interface SupplierCalendar {
  today: string;
  month: string;
  months: { month: string; count: number }[];
  rows: SupplierRequest[];
}

export interface SupplierRateService {
  ref: string;
  name: string;
  type: string;
  unit: string;
  cost: number;
  currency: string;
  capacity: number | null;
  valid_from: string;
  valid_to: string;
  status: string;
  scheduled_cost: number | null;
  scheduled_from: string | null;
  bookings: number;
  pending: { code: string; proposed: number; from: string } | null;
  history: { cost: number; currency: string; from: string; to: string | null; source: string | null }[];
}

export interface SupplierRateRequest {
  code: string;
  service_ref: string;
  service: string;
  unit: string;
  current: number;
  proposed: number;
  change_pct: number | null;
  currency: string;
  effective_from: string;
  reason_type: string;
  reason_detail: string | null;
  status: string;
  requested_at: string;
  reviewed_at: string | null;
  review_note: string | null;
}

export interface SupplierRates {
  today: string;
  earliest: string;
  notice_days: number;
  reasons: string[];
  currency: string;
  services: SupplierRateService[];
  requests: SupplierRateRequest[];
}

export interface SupplierContact {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
}

export interface SupplierAgencyContact {
  kind: "operaciones" | "pagos" | "emergencias";
  label: string;
  name: string;
  email: string | null;
  phone: string | null;
  note: string | null;
}

export interface SupplierCompany {
  provider: { ref: string; name: string; type: string; ruc: string; city: string | null; stars: number | null; contact: string; phone: string | null; email: string | null; currency: string; payment_terms: string | null; status: string };
  contract: { start: string; end: string; days_left: number; alert: string | null };
  agency: { name: string; legal_name: string | null; ruc: string | null; address: string | null };
  agency_contacts: SupplierAgencyContact[];
  contacts: SupplierContact[];
  users: { name: string; email: string; status: string; last_login_at: string | null }[];
  activity: { services: number; reservations: number; catalog: number };
}

export interface SupplierRoomingRoom {
  id: string;
  number: string;
  type: string;
  capacity: number;
  status: string;
  note: string | null;
  incident: { code: string; status: string } | null;
  guests: { name: string; type: string }[];
}

export interface SupplierRoomingList {
  id: string;
  lock_version: number;
  reservation: string;
  holder: string;
  check_in: string;
  check_out: string;
  nights: number;
  days_to: number;
  in_house: boolean;
  state: "por_acusar" | "recibida" | "confirmada";
  modified: boolean;
  sent_at: string | null;
  sent_version: number;
  acknowledged_at: string | null;
  confirmed_at: string | null;
  guests: number;
  observed: number;
  rooms: SupplierRoomingRoom[];
}

export interface SupplierRooming {
  today: string;
  reasons: string[];
  impacts: string[];
  items: SupplierRoomingList[];
  kpis: { arrivals_week: number; in_house: number; observed: number };
}

export interface SupplierVoucher {
  code: string;
  lock_version: number;
  version: number;
  issued_at: string | null;
  service: string;
  reservation: string;
  holder: string;
  date: string;
  days_to: number;
  pax: number;
  status: string;
  used_at: string | null;
  used_via: string | null;
  void_at: string | null;
}

export interface SupplierVouchers {
  today: string;
  early_days: number;
  items: SupplierVoucher[];
  kpis: { today: number; used_month: number };
}

export interface SupplierIncident {
  code: string;
  title: string;
  type: string;
  severity: string;
  status: string;
  reservation: string | null;
  created_at: string;
  updated_at: string;
  can_comment: boolean;
  own: boolean;
  last: { message: string; at: string } | null;
}

export interface SupplierIncidentDetail extends Omit<SupplierIncident, "own" | "last"> {
  description: string;
  resolution: string | null;
  service: { code: string; name: string; date: string } | null;
  logs: { id: string; kind: string; message: string; at: string; mine: boolean; author: string }[];
}

export interface SupplierIncidents {
  today: string;
  types: string[];
  severities: string[];
  sla_hours: Record<string, number>;
  services: { value: string; label: string; hint: string }[];
  items: SupplierIncident[];
}

type Meta = { label: string; tone: Tone };

const REQUEST_STATES: Record<string, Meta> = {
  por_responder: { label: "Por responder", tone: "warn" },
  alternativa_propuesta: { label: "Alternativa propuesta", tone: "violet" },
  confirmado: { label: "Confirmado", tone: "ok" },
  rechazado: { label: "Rechazado", tone: "bad" },
  en_curso: { label: "En curso", tone: "t4" },
  completado: { label: "Completado", tone: "t1" },
  cancelado: { label: "Cancelado", tone: "mute" },
};

const PAYABLE_STATES: Record<string, Meta> = {
  abierta: { label: "En revisión", tone: "info" },
  aprobada: { label: "Programado", tone: "t1" },
  parcial: { label: "Pago parcial", tone: "t2" },
  pagada: { label: "Pagado", tone: "ok" },
  vencida: { label: "Vencido", tone: "bad" },
};

const INVOICE_STATES: Record<string, Meta> = {
  registrada: { label: "Factura registrada", tone: "info" },
  validada: { label: "Factura validada", tone: "ok" },
  observada: { label: "Factura observada", tone: "warn" },
  rechazada: { label: "Factura rechazada", tone: "bad" },
};

const RATE_STATES: Record<string, Meta> = {
  pendiente: { label: "En revisión", tone: "violet" },
  aprobada: { label: "Aprobada", tone: "ok" },
  rechazada: { label: "Rechazada", tone: "bad" },
  retirada: { label: "Retirada", tone: "mute" },
};

const VOUCHER_STATES: Record<string, Meta> = {
  emitido: { label: "Emitido", tone: "t1" },
  utilizado: { label: "Utilizado", tone: "ok" },
  anulado: { label: "Anulado", tone: "bad" },
};

const ROOMING_STATES: Record<string, Meta> = {
  por_acusar: { label: "Por acusar recibo", tone: "warn" },
  recibida: { label: "Recibida", tone: "info" },
  confirmada: { label: "Confirmada por el hotel", tone: "ok" },
};

const ROOM_STATES: Record<string, Meta> = {
  pendiente: { label: "Pendiente", tone: "warn" },
  confirmada: { label: "Confirmada", tone: "ok" },
  observada: { label: "Observada", tone: "bad" },
};

const INCIDENT_STATES: Record<string, Meta> = {
  abierta: { label: "Abierta", tone: "bad" },
  en_proceso: { label: "En proceso", tone: "warn" },
  resuelta: { label: "Resuelta", tone: "ok" },
  cerrada: { label: "Cerrada", tone: "mute" },
};

const SEVERITY_STATES: Record<string, Meta> = {
  baja: { label: "Baja", tone: "t1" },
  media: { label: "Media", tone: "warn" },
  alta: { label: "Alta", tone: "bad" },
  critica: { label: "Crítica", tone: "bad" },
};

const SCOPES = { request: REQUEST_STATES, payable: PAYABLE_STATES, invoice: INVOICE_STATES, rate: RATE_STATES, voucher: VOUCHER_STATES, rooming: ROOMING_STATES, room: ROOM_STATES, incident: INCIDENT_STATES, severity: SEVERITY_STATES };

export type SupplierScope = keyof typeof SCOPES;

export function supplierStatus(status: string, scope: SupplierScope): Meta {
  return SCOPES[scope][status] ?? { label: status.replace(/_/g, " "), tone: "mute" };
}

export const SERVICE_KINDS: Record<string, string> = {
  alojamiento: "Alojamiento",
  traslado: "Traslado",
  tour: "Tour",
  tren_entrada: "Tren o entrada",
  libre: "Servicio",
};

export const PAX_TYPES: Record<string, string> = { ADT: "Adulto", CHD: "Niño", INF: "Infante" };

export function dayDistance(days: number): string {
  if (days === 0) return "Hoy";
  if (days === 1) return "Mañana";
  if (days === -1) return "Ayer";
  return days > 0 ? `En ${days} días` : `Hace ${-days} días`;
}

export function deadlineLabel(row: Pick<SupplierRequest, "deadline" | "overdue">): string | null {
  if (!row.deadline) return null;
  const moment = new Date(row.deadline);
  const text = moment.toLocaleString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Lima" });
  return row.overdue ? `Plazo vencido el ${text}` : `Responder antes del ${text}`;
}

export function scheduleLabel(row: Pick<SupplierRequest, "kind" | "time">): string {
  if (!row.time) return "Hora por confirmar";
  return row.kind === "alojamiento" ? `${row.time} h` : `Recojo ${row.time} h`;
}
