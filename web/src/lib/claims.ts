import type { Tone } from "@/lib/tone";

export type Deadline = "en_plazo" | "por_vencer" | "vencido" | "respondido_en_plazo" | "respondido_fuera_de_plazo";

export interface ClaimSheet {
  code: string;
  lock_version: number;
  book_number: string;
  type_code: string;
  type: string;
  priority: string;
  subject: string;
  detail: string;
  request: string | null;
  sede: string | null;
  sede_id: string | null;
  channel: string;
  channel_label: string;
  book_status: "received" | "in_review" | "answered" | "closed";
  book_status_label: string;
  consumer: { name: string; doc_type: string | null; doc_number: string | null; email: string | null; phone: string | null; address: string | null; minor: boolean };
  good: { kind: string; description: string; amount: number; currency: string } | null;
  received_at: string;
  received_on: string;
  due_date: string | null;
  days_left: number | null;
  deadline: Deadline;
  business_days_to_answer: number | null;
  response: { decision: string | null; text: string | null; actions: string | null; answered_at: string | null; sent_at: string | null; sent_to: string | null } | null;
  close_note: string | null;
  closed_at: string | null;
  client: { code: string; name: string } | null;
  reservation: string | null;
  owner: string | null;
  log: { message: string; at: string; by: string }[];
}

export interface ClaimsOverview {
  today: string;
  settings: { response_days: number; alert_days: number; retention_years: number };
  kpis: { month: number; open: number; due_soon: number; overdue: number; avg_days: number | null; on_time_pct: number | null };
  by_type: { label: string; count: number }[];
  by_sede: { label: string; count: number }[];
  claims: ClaimSheet[];
  options: { sedes: { value: string; label: string }[]; clients: { value: string; label: string }[]; reservations: { value: string; label: string; hint?: string }[] };
  can: { manage: boolean; settings: boolean };
}

export const DEADLINE: Record<Deadline, { label: string; tone: Tone }> = {
  en_plazo: { label: "En plazo", tone: "info" },
  por_vencer: { label: "Por vencer", tone: "warn" },
  vencido: { label: "Vencida", tone: "bad" },
  respondido_en_plazo: { label: "Respondida a tiempo", tone: "ok" },
  respondido_fuera_de_plazo: { label: "Respondida fuera de plazo", tone: "bad" },
};

export const BOOK_STATUS_TONE: Record<ClaimSheet["book_status"], Tone> = { received: "info", in_review: "accent", answered: "ok", closed: "mute" };

export const DOC_TYPES = [
  { value: "DNI", label: "DNI" },
  { value: "CE", label: "Carné de extranjería" },
  { value: "Pasaporte", label: "Pasaporte" },
  { value: "RUC", label: "RUC" },
];

export const DECISIONS = [
  { value: "Procedente", label: "Procedente" },
  { value: "Procedente en parte", label: "En parte" },
  { value: "No procedente", label: "No procedente" },
];
