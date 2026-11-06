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
}

export interface OpportunityBoard {
  stages: PipelineStage[];
  items: OpportunityItem[];
  kpis: { open_pen: number; weighted_pen: number; won_month_pen: number; close_rate: number | null };
}

export interface OpportunityDetail extends OpportunityItem {
  notes: string | null;
  lock_version: number;
  owner_id: string;
  origin: string | null;
  lost_reason: string | null;
  lost_detail: string | null;
  lost_at_stage: string | null;
  lead: { code: string; name: string } | null;
  quotes: { code: string; title: string; status: string; valid_until: string }[];
  history: { action: string; before_value: string | null; after_value: string | null; occurred_at: string }[];
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
}
