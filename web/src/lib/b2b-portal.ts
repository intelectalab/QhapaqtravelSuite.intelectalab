import type { Money } from "@/lib/channels";
import { portalStatus } from "@/lib/portal";
import type { Tone } from "@/lib/tone";

export const AGENCY_HOME = "/agencia";

export type PayMode = "credito" | "prepago";

export interface AgencyCard {
  code: string;
  name: string;
  initials: string;
  status: string;
  block_reason: string | null;
  valid_to: string;
}

export interface AgencySession {
  agency: AgencyCard;
  tenant: { name: string; initials: string; email: string | null; phone: string | null };
  user: { name: string; email: string; color: string | null };
  counts: { reservations: number; catalog: number; due: number };
}

export interface AgencyCredit {
  currency: string;
  limit: number;
  used: number;
  available: number;
  pct: number | null;
  status: string;
  block: string | null;
  can_book: boolean;
  commission_pct: number;
}

export interface AgencyAlert {
  kind: "block" | "credit" | "payment" | "names";
  tone: Tone;
  title: string;
  detail: string;
  amount: number | null;
  currency: string | null;
  date: string | null;
  href: string;
}

export interface CatalogCard {
  code: string;
  name: string;
  summary: string | null;
  type: string;
  destination: string | null;
  image: string | null;
  duration: string;
  days: number;
  pax: { min: number; max: number };
  advance_days: number;
  model: string;
  bookable: boolean;
  reason: string | null;
  currency: string | null;
  net: number | null;
  pvp: number | null;
  commission_pct: number | null;
  commission: number | null;
  credit: boolean;
  rate_valid_to: string | null;
  next_date: string | null;
  departures: { date: string; spots: number }[];
}

export interface UpcomingDeparture {
  code: string;
  title: string;
  status: string;
  from: string;
  to: string;
  days_left: number;
  pax: number;
  pending_names: number;
  client: string | null;
  reference: string | null;
}

export interface AgencyHome {
  today: string;
  credit: AgencyCredit;
  commission_month: Money;
  commission_pending: Money;
  sales_month: Money;
  bookings_month: number;
  trend: { month: string; count: number }[];
  active: number;
  upcoming: UpcomingDeparture[];
  alerts: AgencyAlert[];
  catalog: CatalogCard[];
}

export interface AgencyCatalog {
  today: string;
  credit: AgencyCredit;
  blocked: string | null;
  products: CatalogCard[];
}

export interface CalendarDay {
  date: string;
  status: string;
  label: string;
  spots: number | null;
  note: string | null;
  pvp: number | null;
  sellable: boolean;
}

export interface ProductDetail extends CatalogCard {
  description: string | null;
  conditions: string | null;
  restrictions: string | null;
  min_age: number | null;
  policies: Partial<Record<"cancellation" | "modification" | "no_show", string>>;
  month: string;
  seats: number;
  calendar: CalendarDay[];
}

export interface AgencyProduct {
  today: string;
  credit: AgencyCredit;
  product: ProductDetail;
  doc_types: string[];
}

export interface PriceQuote {
  product: string;
  name: string;
  date: string;
  end: string;
  adults: number;
  children: number;
  seats: number;
  currency: string;
  net_unit: number;
  net_total: number;
  commission_pct: number;
  commission: number;
  pvp_total: number | null;
  margin: number | null;
  fx: number;
  credit: { currency: string; amount: number; available: number; after: number; allowed: boolean; reason: string | null };
  availability: { status: string; label: string; spots: number | null; departure: { ref: string; time: string; meeting_point: string | null } | null };
  outcome: Record<PayMode, string>;
  errors: string[];
  ok: boolean;
}

export interface AgencyReservationRow {
  code: string;
  title: string;
  status: string;
  from: string;
  to: string;
  created_at: string;
  client: string | null;
  reference: string | null;
  pay_mode: PayMode | null;
  pax: number;
  pending_names: number;
  total: number;
  currency: string;
  paid: number;
  balance: number;
  vouchers: number;
  cancel_pending: boolean;
}

export interface AgencyInstallment {
  code: string;
  concept: string;
  reservation: string | null;
  reservation_title?: string;
  amount: number;
  paid: number;
  balance: number;
  currency: string;
  due_date: string;
  status: string;
  overdue: boolean;
  reported: number;
}

export interface AgencyPayment {
  code: string;
  method: string;
  amount: number;
  currency: string;
  paid_on: string;
  status: string;
  source: string;
  reference: string | null;
  reject_reason: string | null;
  receivable: string | null;
  concept: string | null;
  reservation: string | null;
}

export interface PaymentMethodOption {
  value: string;
  label: string;
  requires_reference: boolean;
}

export interface AgencyPassenger {
  seq: number;
  name: string;
  type: string;
  doc_type: string | null;
  doc_number: string | null;
  nationality: string | null;
  birth_date: string | null;
  lead: boolean;
  missing: boolean;
}

export interface AgencyReservation {
  today: string;
  code: string;
  title: string;
  status: string;
  from: string;
  to: string;
  created_at: string;
  days_left: number;
  client: { code: string; name: string; own: boolean } | null;
  reference: string | null;
  pay_mode: PayMode | null;
  price_list: string | null;
  currency: string;
  total: number;
  pvp: number | null;
  commission: { amount: number; pct: number; currency: string; status: string } | null;
  editable: boolean;
  days: { date: string; number: number; services: { code: string; name: string; time: string | null; kind: string; status: string; pax: number; confirmation: string | null }[] }[];
  passengers: AgencyPassenger[];
  vouchers: { code: string; label: string; date: string; status: string; version: number; pax: number; issued_at: string }[];
  billing: { amount: number; paid: number; balance: number; currency: string; installments: AgencyInstallment[]; payments: AgencyPayment[] };
  methods: PaymentMethodOption[];
  cancel: { allowed: boolean; reasons: string[]; request: { reason: string; status: string; requested_at: string; decided_at: string | null; note: string | null } | null };
  doc_types: string[];
}

export interface AgencyCommission {
  code: string;
  reservation: string | null;
  reservation_title: string | null;
  base: number;
  pct: number;
  amount: number;
  currency: string;
  status: string;
  requested: boolean;
  paid_at: string | null;
  created_at: string;
}

export interface AgencyStatement {
  today: string;
  credit: AgencyCredit;
  kpis: { billed: Money; paid: Money; due: Money; overdue: number; commission_pending: Money; commission_paid: Money };
  installments: AgencyInstallment[];
  payments: AgencyPayment[];
  commissions: AgencyCommission[];
  settlements: { code: string; amount: number; status: string; created_at: string; count: number }[];
  can_settle: boolean;
  methods: PaymentMethodOption[];
}

export interface AgencyProfile {
  agency: AgencyCard & { ruc: string; contact: string; email: string | null; price_list: string | null; commission_pct: number; valid_from: string; client: { code: string; name: string } | null };
  credit: AgencyCredit;
  rates: number;
  manager: { name: string; email: string; phone: string | null; color: string | null } | null;
  users: { code: string; name: string; email: string; phone: string | null; status: string; last_login_at: string | null; color: string | null; me: boolean }[];
  movements: { type: string; amount: number; currency: string; balance: number; note: string | null; at: string; reservation: string | null }[];
}

const CONVENTION_STATUS: Record<string, { label: string; tone: Tone }> = {
  activa: { label: "Convenio activo", tone: "ok" },
  bloqueada: { label: "Crédito bloqueado", tone: "bad" },
  vencida: { label: "Convenio vencido", tone: "bad" },
  inactiva: { label: "Convenio inactivo", tone: "mute" },
};

export function conventionStatus(status: string): { label: string; tone: Tone } {
  return CONVENTION_STATUS[status] ?? { label: status, tone: "mute" };
}

const AGENCY_STATUS: Record<string, { label: string; tone: Tone }> = {
  pendiente_proveedor: { label: "En confirmación", tone: "warn" },
  pendiente_pago: { label: "Prepago pendiente", tone: "warn" },
  confirmada: { label: "Confirmada", tone: "ok" },
  cancelada: { label: "Anulada", tone: "bad" },
  calculada: { label: "Calculada", tone: "info" },
  aprobada: { label: "Aprobada", tone: "violet" },
  pagada: { label: "Pagada", tone: "ok" },
  solicitada: { label: "Solicitada", tone: "info" },
  rechazado: { label: "Rechazado", tone: "bad" },
  rechazada: { label: "Rechazada", tone: "bad" },
  retirada: { label: "Retirada", tone: "mute" },
};

export function agencyStatus(status: string): { label: string; tone: Tone } {
  return AGENCY_STATUS[status] ?? portalStatus(status);
}

export const PAY_MODES: Record<PayMode, { label: string; hint: string }> = {
  credito: { label: "Crédito", hint: `Se descuenta de tu línea y la cuota vence en 15 días.` },
  prepago: { label: "Prepago", hint: "Pagas antes de la emisión de vouchers. La cuota vence mañana." },
};

export const MOVEMENT_TYPES: Record<string, string> = {
  cargo_reserva: "Reserva",
  pago_aplicado: "Pago aplicado",
  reversion_pago: "Pago revertido",
  anulacion_reserva: "Anulación",
  ajuste: "Ajuste",
};

export const AVAILABILITY_TONES: Record<string, Tone> = {
  disponible: "ok",
  pocos: "warn",
  sin_cupo: "warn",
  agotado: "bad",
  cerrado: "mute",
  fuera_plazo: "mute",
  no_opera: "mute",
  sin_tarifa: "mute",
  pasado: "mute",
};

export function creditTone(pct: number | null, status: string): Tone {
  if (status !== "activa") return "bad";
  if (pct === null) return "mute";
  if (pct >= 90) return "bad";
  if (pct >= 80) return "warn";
  return "ok";
}
