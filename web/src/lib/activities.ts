import { CalendarCheck, Mail, MessageCircle, Phone, Repeat, Users, type LucideIcon } from "lucide-react";
import type { RecordEvent } from "./history";
import type { Tone } from "./tone";

export type ActivityType = "llamada" | "email" | "whatsapp" | "reunion" | "tarea" | "postventa";
export type ActivityBucket = "overdue" | "today" | "week" | "later" | "done";

export interface ActivityItem {
  code: string;
  type: ActivityType;
  subject: string;
  description: string | null;
  status: "pendiente" | "vencida" | "completada";
  bucket: ActivityBucket;
  due_at: string;
  result: string | null;
  completed_at: string | null;
  owner: { id: string; name: string; color: string | null };
  related: { type: string; code: string; name: string; href: string } | null;
  lock_version: number;
  merged?: boolean;
}

export interface ActivityDetail extends ActivityItem {
  created_at: string;
  created_by: string | null;
  completed_by: string | null;
  auto_closed: boolean;
  previous: { code: string; subject: string } | null;
  next: { code: string; subject: string } | null;
  merged_from: { code: string; name: string } | null;
  history: RecordEvent[];
}

export interface Agenda {
  items: ActivityItem[];
  kpis: { overdue: number; today: number; week: number; done_week: number };
  now: string;
}

export interface RelatedOptions {
  lead: { code: string; name: string }[];
  opportunity: { code: string; name: string }[];
  client: { code: string; name: string }[];
  quote: { code: string; name: string }[];
  owners: { id: string; name: string; color: string | null }[];
}

export type RelationType = "lead" | "opportunity" | "client" | "quote";

export const RELATION_TYPES: RelationType[] = ["lead", "opportunity", "client", "quote"];

export const ACTIVITY_TYPES: Record<ActivityType, { label: string; icon: LucideIcon; tone: Tone }> = {
  llamada: { label: "Llamada", icon: Phone, tone: "t1" },
  email: { label: "Correo", icon: Mail, tone: "info" },
  whatsapp: { label: "WhatsApp", icon: MessageCircle, tone: "ok" },
  reunion: { label: "Reunión", icon: Users, tone: "violet" },
  tarea: { label: "Tarea", icon: CalendarCheck, tone: "sun" },
  postventa: { label: "Postventa", icon: Repeat, tone: "t4" },
};

export const BUCKETS: { id: ActivityBucket; title: string; tone: Tone }[] = [
  { id: "overdue", title: "Vencidas", tone: "bad" },
  { id: "today", title: "Hoy", tone: "t1" },
  { id: "week", title: "Próximos 7 días", tone: "violet" },
  { id: "later", title: "Más adelante", tone: "mute" },
  { id: "done", title: "Completadas", tone: "ok" },
];

export const RELATION_LABEL: Record<string, string> = { lead: "Lead", opportunity: "Oportunidad", client: "Cliente", quote: "Cotización", reservation: "Reserva" };
