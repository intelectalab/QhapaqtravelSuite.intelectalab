import type { ProductStatus } from "./catalog";
import type { Tone } from "./tone";

export type RateState = "vigente" | "programada" | "vencida" | "inactiva";

export interface RateRow {
  ref: string;
  product: { id: string; code: string; name: string; status?: ProductStatus | null };
  type: string;
  segment: string;
  channel: string;
  currency: string;
  basis: string;
  cost: string | null;
  price: string;
  min_price: string | null;
  max_price: string | null;
  margin_pct: number | null;
  valid_from: string;
  valid_to: string;
  season: { id: string; ref: string; name: string } | null;
  conditions: string | null;
  status: "vigente" | "inactiva";
  state: RateState;
  lock_version: number;
}

export interface SeasonRow {
  id: string;
  ref: string;
  name: string;
  type: string;
  date_from: string;
  date_to: string;
  priority: number;
  factor: number;
  status: "activa" | "inactiva";
  phase: "pasada" | "en_curso" | "proxima";
  rates: number;
  products: number;
}

export interface SeasonOverlap {
  a: string;
  b: string;
  from: string;
  to: string;
  winner: string;
}

export interface SeasonResolution {
  date: string;
  season: SeasonRow | null;
  factor: number;
  others: SeasonRow[];
  rule: string;
}

export interface RatesOverview {
  today: string;
  rates: RateRow[];
  seasons: SeasonRow[];
  overlaps: SeasonOverlap[];
  current_season: SeasonRow | null;
  options: {
    products: { id: string; code: string; name: string }[];
    types: string[];
    segments: string[];
    channels: string[];
    bases: string[];
    currencies: string[];
    season_types: string[];
  };
  can: { manage: boolean; see_cost: boolean; see_margin: boolean };
}

export const RATE_STATE: Record<RateState, { label: string; tone: Tone }> = {
  vigente: { label: "Vigente", tone: "ok" },
  programada: { label: "Programada", tone: "info" },
  vencida: { label: "Vencida", tone: "mute" },
  inactiva: { label: "Inactiva", tone: "bad" },
};

export const SEASON_TONE: Record<string, Tone> = {
  Alta: "t1",
  Media: "t4",
  Baja: "info",
  Feriado: "sun",
  "Fecha especial": "violet",
  Personalizada: "accent",
};

export const SEASON_PHASE: Record<SeasonRow["phase"], string> = {
  pasada: "Terminó",
  en_curso: "En curso",
  proxima: "Próxima",
};

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}
