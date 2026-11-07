import { channelStatus, type Money } from "@/lib/channels";
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

export interface PortalProfile {
  client: { code: string; name: string; kind: string; document: string | null; email: string | null; phone: string | null; country: string | null; city: string | null; birth_date: string | null };
  login_email: string;
  locale: string;
  editable: boolean;
  consents: { channel: "email" | "whatsapp"; granted: boolean; since: string | null; source: string | null; policy: string | null }[];
  claims: { code: string; number: string | null; type: string; status: string; received_at: string | null; due_date: string | null; subject: string; reservation: string | null }[];
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

export function portalStatus(status: string, scope?: "message"): { label: string; tone: Tone } {
  if (scope === "message") {
    if (status === "abierta") return { label: "Esperando respuesta", tone: "warn" };
    if (status === "pendiente") return { label: "Respondida", tone: "ok" };
  }
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
