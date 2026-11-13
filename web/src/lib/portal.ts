import { channelStatus, type Money } from "@/lib/channels";
import type { CorporateBadge } from "@/lib/corporate";
import type { Tone } from "@/lib/tone";

export type PortalRole = "customer" | "passenger";

export interface PortalAdvisor {
  name: string;
  email: string;
  phone: string | null;
  color?: string | null;
}

export interface PortalSession {
  role: PortalRole;
  agency: { name: string; initials: string; email: string | null; phone: string | null };
  client: { code: string; name: string; email: string | null };
  user: { name: string; email: string; color: string | null };
  trip: string | null;
  counts: { quotes: number; trips: number };
  corporate?: CorporateBadge | null;
  menu?: PassengerMenu | null;
}

export interface PassengerMenu {
  trip: string;
  sections: { messages: boolean; feedback: boolean; companions: boolean; reviews: boolean };
  counts: { messages: number; companions: number; reviews: number; alerts: number };
  alert: { code: string; severity: string; title: string } | null;
}

export interface PaxService {
  code: string;
  name: string;
  date: string;
  time: string | null;
  kind: string;
  status: string;
  state: string;
  pax: number;
  nights: number | null;
  confirmation: string | null;
  guide: string | null;
  driver: string | null;
  vehicle: string | null;
  guide_languages: string[];
  meeting_point: string | null;
  provider: { name: string; phone: string | null } | null;
  includes: string[];
}

export interface PaxSection {
  code: string;
  section: string;
  items: PaxService[];
}

export interface PaxVoucherSummary {
  code: string;
  label: string;
  date: string;
  status: string;
  version: number;
  pax: number;
}

export interface PaxVouchers {
  code: string;
  items: PaxVoucherSummary[];
}

export interface PaxVoucher extends PaxVoucherSummary {
  reservation: string;
  service: { name: string; time: string | null; confirmation: string | null; kind: string } | null;
  provider: { name: string; phone: string | null; type: string | null } | null;
  meeting_point: string | null;
  passengers: { name: string; type: string; lead: boolean }[];
  qr: string;
  qr_image: string | null;
}

export interface PaxDocuments {
  code: string;
  items: { kind: string; code?: string; label: string; available: boolean }[];
  invoices: { number: string; type: string; date: string; status: string }[];
  policy: { cancellation: string | null; tiers: unknown[] };
  insurance: { passenger: string; status: string; number: string | null; expires_on: string | null; note: string | null }[];
  passports: { passenger: string; document: string | null; nationality: string | null; status: string | null; expires_on: string | null }[];
}

export interface PortalTripSummary {
  code: string;
  title: string;
  status: string;
  from: string;
  to: string;
  total: number | null;
  currency: string;
  services: number;
  confirmed: number;
  passengers: number;
  phase?: TripPhase;
}

export type TripPhase = "proximo" | "en_curso" | "pasado" | "cancelado";

export interface PortalAlert {
  kind: "payment" | "document" | "quote";
  tone: Tone;
  title: string;
  detail: string;
  amount: number | null;
  currency: string | null;
  date: string | null;
  href: string;
}

export interface PortalQuoteSummary {
  code: string;
  title: string;
  status: string;
  valid_until: string | null;
  travel_from: string | null;
  version: number;
  total: number | null;
  currency: string;
  expired: boolean;
  can_decide?: boolean;
}

export interface PortalContentItem {
  code: string;
  title: string;
  type: string;
  slug: string;
  body: string;
  placement: string | null;
  updated_at: string | null;
}

export interface PortalHome {
  today: string;
  advisor: PortalAdvisor | null;
  next_trip: {
    code: string;
    title: string;
    status: string;
    from: string;
    to: string;
    days_left: number;
    nights: number;
    day_number: number | null;
    passengers: number;
    services: number;
    confirmed: number;
    next_service: { name: string; service_date: string; service_time: string | null } | null;
  } | null;
  alerts: PortalAlert[];
  trips: PortalTripSummary[];
  quotes: PortalQuoteSummary[];
  balance: Money;
  documents: number;
  banners: PortalContentItem[];
}

export type ServiceState = "completado" | "en_curso" | "hoy" | "proximo";

export interface PortalInstallment {
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
  reported?: number;
}

export interface PortalPayment {
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
}

export interface PortalTrip {
  today: string;
  code: string;
  title: string;
  status: string;
  phase: TripPhase;
  from: string;
  to: string;
  currency: string;
  total: number | null;
  days_left: number;
  advisor: PortalAdvisor | null;
  progress: { services: number; confirmed: number };
  days: {
    date: string;
    number: number;
    services: { code: string; name: string; time: string | null; kind: string; status: string; state: ServiceState; pax: number; nights: number | null; confirmation: string | null }[];
  }[];
  passengers: { seq: number; name: string; type: string; nationality: string | null; document: string | null; lead: boolean; missing: boolean }[];
  vouchers: { code: string; label: string; date: string; status: string; version: number; pax: number }[];
  invoices: { number: string; type: string; date: string; total: number; currency: string; status: string }[];
  billing: { amount: number; paid: number; balance: number; currency: string; installments: PortalInstallment[]; payments: PortalPayment[] } | null;
  notices: { code: string; subject: string | null; body: string; sent_at: string | null; channel: string }[];
}

export interface PortalQuote {
  code: string;
  lock_version: number;
  title: string;
  status: string;
  valid_until: string | null;
  travel_from: string | null;
  travel_to: string | null;
  currency: string;
  pax: { adults: number; children: number; infants: number };
  version: number | null;
  issued_on: string | null;
  conditions: string | null;
  total: number | null;
  tax: number | null;
  discount: number | null;
  items: { line: number; name: string; segment: string | null; date: string | null; qty: number; pax: number; total: number }[];
  approval: { at: string; by: string; channel: string } | null;
  rejection: { at: string; reason: string } | null;
  can_decide: boolean;
  advisor: PortalAdvisor | null;
}

export interface PortalBilling {
  today: string;
  balance: Money;
  installments: PortalInstallment[];
  payments: PortalPayment[];
  methods: { value: string; label: string; requires_reference: boolean }[];
}

export interface PortalClaim {
  code: string;
  number: string | null;
  type: string;
  status: string;
  book_status: "received" | "in_review" | "answered" | "closed" | null;
  received_at: string | null;
  due_date: string | null;
  subject: string;
  reservation: string | null;
  response: { decision: string | null; text: string; actions: string | null; answered_at: string | null } | null;
  receipt: {
    agency: string;
    sede: string | null;
    response_days: number | null;
    consumer: { name: string | null; document: string | null; email: string | null };
    good: { kind: string | null; description: string | null; amount: number | null; currency: string | null };
    detail: string;
    request: string;
  };
}

export interface PortalProfile {
  client: { code: string; name: string; kind: string; document: string | null; email: string | null; phone: string | null; country: string | null; city: string | null; birth_date: string | null };
  login_email: string;
  locale: string;
  editable: boolean;
  consents: { channel: "email" | "whatsapp"; granted: boolean; since: string | null; source: string | null; policy: string | null }[];
  claims: PortalClaim[];
  claims_book: string;
  arco_requests: { code: string; subject: string; status: string; due_date: string | null; created_at: string; resolution: string | null }[];
}

export interface PortalConversation {
  code: string;
  subject: string;
  status: string;
  last_message_at: string;
  reservation: string | null;
  assignee: string | null;
  messages: { mine: boolean; author: string | null; body: string; at: string }[];
}

export interface PortalMessages {
  advisor: PortalAdvisor | null;
  trips: { code: string; title: string }[];
  conversations: PortalConversation[];
}

const CUSTOMER_STATUS: Record<string, { label: string; tone: Tone }> = {
  pendiente_proveedor: { label: "En confirmación", tone: "warn" },
  pendiente_disponibilidad: { label: "En confirmación", tone: "warn" },
  pendiente_pago: { label: "Pago pendiente", tone: "warn" },
  pago_pendiente: { label: "Pago pendiente", tone: "warn" },
  confirmada: { label: "Confirmado", tone: "ok" },
  en_operacion: { label: "En viaje", tone: "info" },
  completada: { label: "Viaje realizado", tone: "mute" },
  solicitado: { label: "En confirmación", tone: "warn" },
  pendiente: { label: "Por validar", tone: "info" },
  aplicado: { label: "Acreditado", tone: "ok" },
  confirmado: { label: "Confirmado", tone: "ok" },
  enviada: { label: "Nueva", tone: "violet" },
  vista: { label: "Por responder", tone: "violet" },
  negociacion: { label: "En conversación", tone: "info" },
  aprobada: { label: "Aceptada", tone: "ok" },
  convertida: { label: "Reservada", tone: "ok" },
  rechazada: { label: "No aceptada", tone: "mute" },
  abierta: { label: "Por pagar", tone: "info" },
  parcial: { label: "Pago parcial", tone: "warn" },
  pagada: { label: "Pagada", tone: "ok" },
  emitido: { label: "Emitido", tone: "ok" },
  aceptado: { label: "Emitido", tone: "ok" },
  utilizado: { label: "Utilizado", tone: "mute" },
  en_proceso: { label: "En atención", tone: "info" },
  resuelta: { label: "Resuelta", tone: "ok" },
  cerrada: { label: "Cerrada", tone: "mute" },
};

export type PortalStatusScope = "message" | "trip" | "service";

const TRIP_STATUS: Record<string, { label: string; tone: Tone }> = {
  parcial: { label: "Cancelado en parte", tone: "warn" },
  reprogramada: { label: "Reprogramado", tone: "info" },
  cancelada: { label: "Cancelado", tone: "bad" },
};

const SERVICE_STATUS: Record<string, { label: string; tone: Tone }> = {
  pendiente: { label: "Por confirmar", tone: "warn" },
  rechazado: { label: "Sin cupo, buscando alternativa", tone: "warn" },
  en_curso: { label: "En curso", tone: "info" },
  completado: { label: "Realizado", tone: "mute" },
  cancelado: { label: "Cancelado", tone: "bad" },
};

export function portalStatus(status: string, scope?: PortalStatusScope): { label: string; tone: Tone } {
  if (scope === "message") {
    if (status === "abierta") return { label: "Esperando respuesta", tone: "warn" };
    if (status === "pendiente") return { label: "Respondida", tone: "ok" };
  }
  if (scope === "trip" && TRIP_STATUS[status]) return TRIP_STATUS[status];
  if (scope === "service" && SERVICE_STATUS[status]) return SERVICE_STATUS[status];
  return CUSTOMER_STATUS[status] ?? channelStatus(status);
}

export const PHASES: Record<TripPhase, { label: string; tone: Tone }> = {
  proximo: { label: "Próximo", tone: "t1" },
  en_curso: { label: "En viaje", tone: "t4" },
  pasado: { label: "Realizado", tone: "mute" },
  cancelado: { label: "Cancelado", tone: "bad" },
};

export const SERVICE_STATES: Record<ServiceState, { label: string; tone: Tone }> = {
  completado: { label: "Realizado", tone: "ok" },
  en_curso: { label: "En curso", tone: "t4" },
  hoy: { label: "Hoy", tone: "t2" },
  proximo: { label: "Próximo", tone: "t1" },
};

export const PAX_TYPES: Record<string, string> = { ADT: "Adulto", CHD: "Niño", INF: "Infante" };

export const REJECT_REASONS = ["Precio", "Cambio de fechas", "Eligió otra agencia", "Cambio de destino", "Viaje cancelado", "Otro"];

export const LOCALES = [
  { value: "es", label: "Español" },
  { value: "en", label: "English" },
  { value: "de", label: "Deutsch" },
  { value: "fr", label: "Français" },
  { value: "pt", label: "Português" },
];

export const ARCO_RIGHTS = [
  { value: "acceso", label: "Acceso: saber qué datos míos guardan" },
  { value: "rectificacion", label: "Rectificación: corregir un dato que no está bien" },
  { value: "cancelacion", label: "Cancelación: que eliminen mis datos personales" },
  { value: "oposicion", label: "Oposición: que dejen de usar mis datos para algo" },
];

export const CONSENT_CHANNELS: Record<string, { label: string; hint: string }> = {
  email: { label: "Novedades por correo", hint: "Ofertas y novedades de viaje en tu correo." },
  whatsapp: { label: "Novedades por WhatsApp", hint: "Promociones y recordatorios en tu WhatsApp." },
};

export const MESSAGE_TOPICS = [
  { value: "general", label: "Consulta general" },
  { value: "cambios", label: "Cambios en mi viaje" },
  { value: "pagos", label: "Pagos" },
  { value: "documentos", label: "Documentos" },
  { value: "salud", label: "Salud o emergencia" },
];

export function countdownLabel(days: number): string {
  if (days > 1) return `Faltan ${days} días`;
  if (days === 1) return "Sales mañana";
  if (days === 0) return "Sales hoy";
  return "En viaje";
}

export interface PaxFeedbackOverview {
  trip: { code: string; title: string };
  claims_book: string;
  types: { value: string; label: string }[];
  services: { code: string; name: string; date: string }[];
  history: { code: string; type: string; type_label: string; rating: number | null; text: string; status: string; reply: string | null; replied_at: string | null; created_at: string; service: string | null }[];
}

export interface PaxReviewOverview {
  trip: { code: string; title: string; status: string };
  subratings: { key: string; label: string }[];
  items: { product: { id: string; code: string; name: string }; date: string; eligible: boolean; reason: string | null; review: { code: string; stars: number; title: string; status: string } | null }[];
}

export const FEEDBACK_STATUS: Record<string, { label: string; tone: Tone }> = {
  nuevo: { label: "Enviado", tone: "info" },
  leido: { label: "Leído por la agencia", tone: "t1" },
  respondido: { label: "Respondido", tone: "ok" },
  derivado: { label: "En atención", tone: "warn" },
};

export const REVIEW_STATUS: Record<string, { label: string; tone: Tone }> = {
  pendiente: { label: "En revisión", tone: "warn" },
  publicada: { label: "Publicada", tone: "ok" },
  oculta: { label: "Solo para la agencia", tone: "mute" },
  rechazada: { label: "No publicada", tone: "mute" },
};

export interface PaxAlerts {
  code: string;
  alerts: { id: string; code: string; type: string; severity: string; title: string; message: string | null; at: string; acked: boolean }[];
  notices: { code: string; subject: string; body: string; at: string; channel: string; read: boolean }[];
}

export interface PaxContacts {
  code: string;
  emergency: { label: string; phone: string | null; office: { name: string; phone: string | null; address: string | null } | null };
  coordinator: { name: string; phone: string | null; email: string | null } | null;
  advisor: { name: string; email: string | null; phone: string | null } | null;
  guide: { name: string; phone: string | null; service: string; date: string } | null;
}

export interface PaxCompanions {
  code: string;
  lock_version: number;
  editable: boolean;
  when: string;
  passengers: { seq: number; name: string; type: "ADT" | "CHD" | "INF"; doc_type: string | null; document: string | null; nationality: string | null; birth_date: string | null; diet: string | null; lead: boolean; pending: boolean }[];
  pickup: { point: string | null; address: string | null; flight: string | null; arrival: string | null; points?: { label: string; kind: string; requires_address: boolean }[] } | null;
}

export const OTHER_PICKUP = "Otra dirección";
