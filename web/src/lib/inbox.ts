import type { Tone } from "@/lib/tone";

export interface ConversationSummary {
  code: string;
  channel: string;
  channel_label: string;
  contact: { name: string; email: string | null; phone: string | null };
  subject: string;
  status: "abierta" | "pendiente" | "resuelta";
  status_label: string;
  priority: string;
  tags: string[];
  assignee: { id: string; name: string } | null;
  mine: boolean;
  unread: number;
  last_message_at: string;
  created_at: string;
  preview: string | null;
  preview_inbound: boolean;
  preview_note?: boolean;
  sla: { due_at: string; responded_at: string | null; state: "met" | "late" | "breached" | "warning" | "running" };
  window_open: boolean;
  lock_version: number;
}

export interface ConversationMessage {
  id: string;
  direction: "in" | "out" | "internal" | "system";
  body: string;
  at: string;
  author: string;
  delivery: string | null;
  files: { id: string; name: string; mime: string; size: number; available: boolean }[];
}
export interface ConversationCard {
  client: { code: string; name: string; segment: string; country: string; nps: number | null; owner: string | null } | null;
  lead: { code: string; name: string; status: string } | null;
  reservation: { code: string; title: string; status: string } | null;
  reservations: { code: string; title: string; status: string; date: string; total: number; currency: string; linked: boolean }[];
  quotes: { code: string; title: string; status: string; date: string; linked: boolean }[];
  opportunity: { code: string; title: string; stage: string } | null;
  in_trip: { code: string; until: string } | null;
  ticket: { code: string; status: string } | null;
}

export interface ConversationThread extends ConversationSummary {
  messages: ConversationMessage[];
  card: ConversationCard;
}

export interface ReplyTemplate {
  code: string;
  name: string;
  body: string;
  channels: string[];
  whatsapp_approved: boolean;
}

export interface InboxOverview {
  kpis: { open: number; unassigned: number; sla_breached: number; resolved_week: number; first_response_minutes: number | null };
  items: ConversationSummary[];
  templates: ReplyTemplate[];
  agents: { id: string; name: string }[];
  can: { manage: boolean; reassign: boolean; link: LinkKind[]; quote?: boolean };
  me: string;
  scope?: "all" | "assigned" | "own";
  agency?: { name: string; emergency_phone: string | null };
}

export const INBOX_SCOPE: Record<NonNullable<InboxOverview["scope"]>, { label: string; detail: string }> = {
  all: { label: "Todo el equipo", detail: "Ves todas las conversaciones de la agencia." },
  assigned: { label: "Según mi rol", detail: "Ves las conversaciones asignadas a ti y las de pasajeros que están en viaje." },
  own: { label: "Mis conversaciones", detail: "Ves las conversaciones asignadas a ti y las que aún no tienen responsable." },
};

export type LinkKind = "client" | "lead" | "reservation";

export interface LinkOption {
  code: string;
  label: string;
  hint: string | null;
  linked: boolean;
}

export const LINK_KINDS: Record<LinkKind, { label: string; article: string; href: (code: string) => string; placeholder: string }> = {
  client: { label: "Cliente", article: "un cliente", href: (code) => `/crm/clientes/${code}`, placeholder: "Nombre, código, correo o teléfono" },
  lead: { label: "Lead", article: "un lead", href: (code) => `/crm/leads/${code}`, placeholder: "Nombre, código, correo o teléfono" },
  reservation: { label: "Reserva", article: "una reserva", href: (code) => `/reservas/${code}`, placeholder: "Código, viaje o cliente" },
};

export const CHANNEL_TONES: Record<string, Tone> = { whatsapp: "ok", email: "info", webchat: "violet", form: "sun", portal: "t3" };

export const SLA_STATE: Record<ConversationSummary["sla"]["state"], { label: string; tone: Tone }> = {
  met: { label: "Respondida a tiempo", tone: "ok" },
  late: { label: "Respondida tarde", tone: "warn" },
  breached: { label: "Sin responder, fuera de plazo", tone: "bad" },
  warning: { label: "Por vencer", tone: "warn" },
  running: { label: "En plazo", tone: "info" },
};

export function slaCountdown(dueAt: string, now: number = Date.now()): string {
  const minutes = Math.max(0, Math.round((new Date(dueAt).getTime() - now) / 60000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  return hours < 48 ? `${hours} h${minutes % 60 ? ` ${minutes % 60} min` : ""}` : `${Math.floor(hours / 24)} días`;
}

export const PRIORITY_OPTIONS = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];

export const ATTACHMENT_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

export const ATTACHMENT_MAX_FILES = 5;

export const ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;

export type InboxChannel = "whatsapp" | "email";

export type ChannelAccountStatus = "activo" | "sandbox" | "inactivo";

export interface ChannelAccount {
  channel: InboxChannel;
  label: string;
  connected: boolean;
  name: string;
  phone_number_id: string | null;
  mailbox: string | null;
  first_response_sla_minutes: number;
  status: ChannelAccountStatus;
  status_label: string;
  webhook_secret_set: boolean;
  webhook_url: string;
  signature_header: string;
  updated_at: string | null;
}

export const CHANNEL_ACCOUNT_STATUS: Record<ChannelAccountStatus, { label: string; tone: Tone }> = {
  activo: { label: "Conectado", tone: "ok" },
  sandbox: { label: "Modo de prueba", tone: "warn" },
  inactivo: { label: "Desconectado", tone: "mute" },
};
