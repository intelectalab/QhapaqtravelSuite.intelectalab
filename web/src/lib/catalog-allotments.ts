import type { Tone } from "./tone";

export type AllotmentKind = "hotel" | "tren" | "entrada";

export type AllotmentStatus = "activo" | "en_release" | "liberado" | "vencido";

export type CellState = "off" | "past" | "over" | "free" | "ret" | "rel" | "full" | "mid" | "ok";

export type AlertType = "vencido" | "proximo" | "retenido" | "sobreventa";

export type RequestStatus = "solicitada" | "aceptada" | "rechazada";

export interface AllotmentWindow {
  blocked: number;
  released: number;
  capacity: number;
  used: number;
  pending: number;
  available: number;
  utilization: number;
}

export interface AllotmentSummary {
  code: string;
  name: string;
  contract_ref: string | null;
  kind: AllotmentKind;
  unit: string;
  provider: { id: string; code: string; name: string };
  service: { id: string; code: string; name: string };
  valid_from: string;
  valid_to: string;
  base_qty: number;
  release_days: number;
  net_rate: number;
  currency: string;
  penalty_pct: number;
  status: AllotmentStatus;
  lock_version: number;
}

export interface AllotmentRow extends AllotmentSummary {
  utilization: number | null;
  window: AllotmentWindow;
  penalties: number;
  exposure: number;
  penalties_pen: number;
  exposure_pen: number;
}

export interface AllotmentAlert {
  type: AlertType;
  contract: string;
  name: string;
  provider: string;
  kind: AllotmentKind;
  currency: string;
  date: string;
  deadline: string;
  to_deadline: number;
  units: number;
  penalty: number;
  reason: string | null;
}

export interface AllotmentOptions {
  providers: { id: string; code: string; name: string; type: string }[];
  services: { id: string; code: string; name: string; type: string; provider_id: string; cost: number; currency: string; kind: AllotmentKind }[];
  kinds: { value: AllotmentKind; unit: string }[];
}

export interface AllotmentsOverview {
  today: string;
  usd_rate: number;
  contracts: AllotmentRow[];
  alerts: AllotmentAlert[];
  job: { schedule: string; last_run_at: string | null; status: string | null; result: string | null; paused: boolean } | null;
  options: AllotmentOptions;
  can: { manage: boolean };
}

export interface ConsumptionRow {
  date: string;
  reservation: string;
  service: string;
  service_status: string;
  qty: number;
  state: "consumido" | "en_tramite";
  booked_at: string;
}

export interface AllotmentCell {
  date: string;
  state: CellState;
  blocked?: number;
  released?: number;
  used?: number;
  pending?: number;
  capacity?: number;
  available?: number;
  over?: number;
  deadline?: string;
  to_deadline?: number;
  retained?: string | null;
  closed?: boolean;
  exposure?: number;
  lock_version?: number;
  charge?: number | null;
  refs?: ConsumptionRow[];
}

export interface AllotmentGrid {
  today: string;
  from: string;
  to: string;
  length: number;
  kind: AllotmentKind | null;
  all: boolean;
  dates: string[];
  rows: (AllotmentSummary & { cells: AllotmentCell[] })[];
}

export interface PickupRow extends AllotmentSummary {
  window: AllotmentWindow;
  pickup_7: number;
  pickup_30: number;
  recommendation: "liberado" | "ampliar" | "reducir" | "mantener";
  curve: number[];
}

export interface AllotmentPickup {
  today: string;
  horizon: number;
  cuts: string[];
  rows: PickupRow[];
}

export interface AllotmentRequest {
  code: string;
  date_from: string;
  date_to: string;
  extra_qty: number;
  note: string;
  status: RequestStatus;
  response: string | null;
  requested_by: string | null;
  requested_at: string;
  answered_by: string | null;
  answered_at: string | null;
}

export interface AllotmentCharge {
  date: string;
  qty: number;
  amount: number;
  currency: string;
  reason: string;
  payable: string | null;
  created_at: string;
}

export interface AllotmentDetail {
  today: string;
  contract: AllotmentSummary & {
    provider_contact: string | null;
    payment_terms: string | null;
    owner: string | null;
    notes: string | null;
    released_at: string | null;
    release_reason: string | null;
    created_at: string;
  };
  window: AllotmentWindow;
  window_from: string;
  exposure: number;
  exposure_units: number;
  upcoming: AllotmentCell[];
  pending: AllotmentCell[];
  special: { date: string; blocked: number }[];
  days: AllotmentCell[];
  consumptions: ConsumptionRow[];
  requests: AllotmentRequest[];
  charges: AllotmentCharge[];
  penalties: number;
  events: { at: string; message: string; user: string | null }[];
  options: AllotmentOptions;
  can: { manage: boolean };
}

export const KIND_LABEL: Record<AllotmentKind, string> = { hotel: "Hotel", tren: "Tren", entrada: "Entradas" };

export const ALLOTMENT_STATUS: Record<AllotmentStatus, { label: string; tone: Tone }> = {
  activo: { label: "Activo", tone: "ok" },
  en_release: { label: "En release", tone: "sun" },
  liberado: { label: "Liberado", tone: "mute" },
  vencido: { label: "Vencido", tone: "bad" },
};

export const CELL_STATE: Record<CellState, { label: string; tone: Tone }> = {
  ok: { label: "Holgado", tone: "ok" },
  mid: { label: "50 % o más usado", tone: "info" },
  full: { label: "Completo", tone: "sun" },
  rel: { label: "Release en 3 días o vencido", tone: "warn" },
  ret: { label: "Retenido con riesgo de penalidad", tone: "violet" },
  over: { label: "Sobreventa", tone: "bad" },
  free: { label: "Cupo liberado", tone: "mute" },
  past: { label: "Fecha pasada", tone: "mute" },
  off: { label: "Fuera de vigencia", tone: "mute" },
};

export const ALERT_TYPE: Record<AlertType, { label: string; tone: Tone }> = {
  vencido: { label: "Release vencido", tone: "bad" },
  proximo: { label: "Vence pronto", tone: "warn" },
  retenido: { label: "Retenido", tone: "violet" },
  sobreventa: { label: "Sobreventa", tone: "bad" },
};

export const REQUEST_STATUS: Record<RequestStatus, { label: string; tone: Tone }> = {
  solicitada: { label: "Solicitada", tone: "sun" },
  aceptada: { label: "Aceptada", tone: "ok" },
  rechazada: { label: "Rechazada", tone: "bad" },
};

export const RECOMMENDATION: Record<PickupRow["recommendation"], { label: string; tone: Tone }> = {
  ampliar: { label: "Solicitar ampliación", tone: "ok" },
  reducir: { label: "Reducir o liberar antes", tone: "warn" },
  mantener: { label: "Mantener y vigilar", tone: "info" },
  liberado: { label: "Contrato liberado", tone: "mute" },
};

export const CONTRACT_STEPS: AllotmentStatus[] = ["activo", "en_release", "liberado", "vencido"];

export function isClosed(status: AllotmentStatus): boolean {
  return status === "liberado" || status === "vencido";
}
