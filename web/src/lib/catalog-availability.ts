import type { Tone } from "./tone";

export type RangeStatus = "disponible" | "cerrado" | "agotado";

export type HoldStatus = "hold" | "confirmada" | "liberada" | "expirada" | "consumida";

export interface RangeRow {
  code: string;
  product: { id: string; code: string; name: string };
  date_from: string;
  date_to: string;
  days: number;
  status: RangeStatus;
  capacity_per_day: number;
  note: string | null;
  phase: "pasado" | "en_curso" | "proximo";
}

export interface HoldRow {
  ref: string;
  departure: { ref: string; date: string; time: string } | null;
  product: { code: string | null; name: string | null };
  quantity: number;
  reference: string;
  status: HoldStatus;
  expired: boolean;
  expires_at: string;
  created_at: string;
  user: string | null;
  released_reason: string | null;
  notes: string | null;
}

export interface AvailabilityOverview {
  today: string;
  ranges: RangeRow[];
  holds: HoldRow[];
  options: {
    products: { id: string; code: string; name: string }[];
    departures: { id: string; ref: string; label: string; date: string; time: string; available: number }[];
  };
  can: { manage_ranges: boolean; manage_holds: boolean };
}

export const RANGE_STATUS: Record<RangeStatus, { label: string; tone: Tone }> = {
  disponible: { label: "Disponible", tone: "ok" },
  cerrado: { label: "Cerrado", tone: "mute" },
  agotado: { label: "Agotado", tone: "bad" },
};

export const HOLD_STATUS: Record<HoldStatus, { label: string; tone: Tone }> = {
  hold: { label: "En hold", tone: "sun" },
  confirmada: { label: "Confirmado", tone: "ok" },
  liberada: { label: "Liberado", tone: "mute" },
  expirada: { label: "Expirado", tone: "bad" },
  consumida: { label: "Usado", tone: "info" },
};
