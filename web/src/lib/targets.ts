import type { Tone } from "@/lib/tone";

export interface TargetGoals {
  sales: number;
  bookings: number | null;
  margin: number | null;
  conversion: number | null;
}

export interface SalesTarget {
  code: string;
  scope_type: "asesor" | "sede" | "equipo";
  scope_label: string;
  scope: { id: string; name: string };
  period_type: "mes" | "trimestre";
  period_key: string;
  period_label: string;
  period_from: string;
  period_to: string;
  elapsed_pct: number;
  days_left: number;
  status: "borrador" | "vigente" | "cerrada" | "anulada";
  health: string;
  goals: TargetGoals;
  actual: { sales: number; bookings: number; margin: number; conversion: number | null };
  progress_pct: number;
  projection: number;
  projection_pct: number;
  bonus: { amount: number; currency: string; pct: number; estimated: number } | null;
  reservations: { code: string; title: string; total: number; currency: string; total_pen: number; created_at: string }[];
  pipeline: { code: string; title: string; amount: number; currency: string; probability: number; close: string; stage: string }[];
  closed_at: string | null;
}

export interface TargetsOverview {
  today: string;
  current_period: string | null;
  periods: { value: string; label: string }[];
  targets: SalesTarget[];
  ranking: { position: number; name: string; me: boolean; progress_pct: number; sales: number | null; goal: number | null }[];
  policy: { tiers: { min: number; pay: number }[]; lock_decrease_after_pct: number };
  options: { advisors: { value: string; label: string }[]; sedes: { value: string; label: string }[]; teams: { value: string; label: string }[]; periods: { value: string; label: string }[] } | null;
  can: { manage: boolean; reduce_late: boolean };
}

export const HEALTH: Record<string, { label: string; tone: Tone }> = {
  borrador: { label: "Borrador", tone: "mute" },
  anulada: { label: "Anulada", tone: "mute" },
  cumplida: { label: "Cumplida", tone: "ok" },
  no_cumplida: { label: "No cumplida", tone: "bad" },
  por_iniciar: { label: "Por iniciar", tone: "info" },
  por_cerrar: { label: "Por cerrar", tone: "violet" },
  en_camino: { label: "En camino", tone: "ok" },
  en_riesgo: { label: "En riesgo", tone: "warn" },
  critico: { label: "Crítico", tone: "bad" },
};
