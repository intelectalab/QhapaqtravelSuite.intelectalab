import type { ActivityItem } from "./activities";
import type { RecordEvent } from "./history";
import type { Tone } from "./tone";

export type OpportunityStage = "calificacion" | "descubrimiento" | "cotizacion" | "negociacion" | "ganada" | "perdida";

export const OPEN_STAGES: OpportunityStage[] = ["calificacion", "descubrimiento", "cotizacion", "negociacion"];

export interface PipelineStage {
  code: OpportunityStage;
  name: string;
  probability: number;
  closed: boolean;
}

export interface OpportunityItem {
  code: string;
  title: string;
  stage: OpportunityStage;
  amount: string;
  currency: string;
  amount_pen: number;
  probability: number;
  expected_close_date: string;
  closed_at: string | null;
  destination: string | null;
  pax: number;
  client: { code: string; name: string };
  owner: { name: string; color: string | null };
  quotes_count?: number;
  updated_at: string;
  lock_version: number;
}

export interface OpportunityBoard {
  stages: PipelineStage[];
  items: OpportunityItem[];
  kpis: { open_pen: number; weighted_pen: number; won_month_pen: number; close_rate: number | null };
}

export interface OpportunityDetail extends OpportunityItem {
  notes: string | null;
  product: { id: string; code: string; name: string } | null;
  lock_version: number;
  owner_id: string;
  origin: string | null;
  lost_reason: string | null;
  lost_detail: string | null;
  lost_at_stage: string | null;
  lead: { code: string; name: string } | null;
  client_card: {
    kind: string | null;
    document: string | null;
    email: string | null;
    phone: string | null;
    segment: string | null;
    contact: { name: string; role: string | null; email: string | null; phone: string | null } | null;
  };
  quotes: { code: string; title: string; status: string; valid_until: string; version: number; currency: string; total: string | null }[];
  activities: ActivityItem[];
  pending_activities: number;
  close_overdue: boolean;
  history: RecordEvent[];
  stages: PipelineStage[];
}

export const STAGE_TONE: Record<OpportunityStage, Tone> = {
  calificacion: "info",
  descubrimiento: "accent",
  cotizacion: "violet",
  negociacion: "sun",
  ganada: "ok",
  perdida: "mute",
};

export interface OpportunityFormOptions {
  clients: { code: string; name: string; kind: string }[];
  advisors: { id: string; name: string; color: string | null }[];
  can_reassign: boolean;
  stages: PipelineStage[];
  products: { id: string; code: string; name: string }[];
}
