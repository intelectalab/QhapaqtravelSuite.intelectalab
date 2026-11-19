import type { Tone } from "@/lib/tone";

export type DemoRequestStatus = "nueva" | "contactada" | "convertida" | "descartada";

export interface DemoRequest {
  code: string;
  kind: "demo" | "trial";
  full_name: string;
  email: string;
  phone: string | null;
  company: string;
  business_type: string;
  city: string | null;
  team_size: string;
  message: string | null;
  status: DemoRequestStatus;
  next_statuses: DemoRequestStatus[];
  source: string;
  plan: { code: string; name: string; billing_cycle: "month" | "year" | null } | null;
  notes: string | null;
  handled_by: string | null;
  handled_at: string | null;
  created_at: string;
}

export interface DemoRequestsOverview {
  kpis: { total: number; new: number; contacted: number; converted: number; trials: number; demos: number; last_7_days: number };
  items: DemoRequest[];
}

export const DEMO_STATUS: Record<DemoRequestStatus, { label: string; tone: Tone; action: string }> = {
  nueva: { label: "Nueva", tone: "info", action: "Volver a nueva" },
  contactada: { label: "Contactada", tone: "sun", action: "Marcar como contactada" },
  convertida: { label: "Convertida", tone: "ok", action: "Marcar como convertida" },
  descartada: { label: "Descartada", tone: "mute", action: "Descartar" },
};

export const DEMO_KIND: Record<DemoRequest["kind"], string> = { demo: "Demo guiada", trial: "Prueba gratis" };
