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
  sla: { due_at: string; responded_at: string | null; state: "met" | "late" | "breached" | "warning" | "running" };
  window_open: boolean;
}

export interface ConversationMessage {
  id: string;
  direction: "in" | "out" | "internal" | "system";
  body: string;
  at: string;
  author: string;
  delivery: string | null;
  files: { name: string; size: number }[];
}

export interface ConversationCard {
  client: { code: string; name: string; segment: string; country: string; nps: number | null; owner: string | null } | null;
  lead: { code: string; name: string; status: string } | null;
  reservations: { code: string; title: string; status: string; date: string; total: number; currency: string; linked: boolean }[];
  quotes: { code: string; title: string; status: string; date: string; linked: boolean }[];
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
  can: { manage: boolean; reassign: boolean };
  me: string;
}

export const CHANNEL_TONES: Record<string, Tone> = { whatsapp: "ok", email: "info", webchat: "violet", form: "sun", portal: "t3" };

export const SLA_STATE: Record<ConversationSummary["sla"]["state"], { label: string; tone: Tone }> = {
  met: { label: "Respondida a tiempo", tone: "ok" },
  late: { label: "Respondida tarde", tone: "warn" },
  breached: { label: "Sin responder, fuera de plazo", tone: "bad" },
  warning: { label: "Por vencer", tone: "warn" },
  running: { label: "En plazo", tone: "info" },
};

export const PRIORITY_OPTIONS = [
  { value: "baja", label: "Baja" },
  { value: "media", label: "Media" },
  { value: "alta", label: "Alta" },
  { value: "critica", label: "Crítica" },
];
