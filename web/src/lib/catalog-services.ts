import type { Tone } from "./tone";

export type SupplyState = "activo" | "inactivo" | "vencido";

export interface ServiceRow {
  ref: string;
  name: string;
  type: string;
  unit: string;
  cost: string | null;
  currency: string;
  capacity: number | null;
  valid_from: string;
  valid_to: string;
  status: SupplyState;
  state: SupplyState;
  expires_in: number;
  provider: { id: string; ref: string; name: string; state: SupplyState };
  products: { code: string; name: string }[];
}

export interface ServicesOverview {
  today: string;
  services: ServiceRow[];
  options: {
    providers: { id: string; name: string; type: string; state: SupplyState }[];
    types: string[];
    units: string[];
    currencies: string[];
  };
  can: { manage: boolean; see_cost: boolean };
}

export interface CatalogHistoryEvent {
  code: string;
  action: string;
  before_value: string | null;
  after_value: string | null;
  occurred_at: string;
  actor: string | null;
}

export interface ServiceDetail extends Pick<ServicesOverview, "today" | "options" | "can"> {
  service: ServiceRow & { scheduled_cost: string | null; scheduled_cost_from: string | null };
  fx: { rate: number; date: string; cost_pen: number } | null;
  provider: {
    id: string;
    ref: string;
    name: string;
    type: string;
    state: SupplyState;
    contract_start: string;
    contract_end: string;
    contract_days: number;
    payment_terms: string | null;
    currency: string;
    rating: number;
  } | null;
  usage: { code: string; name: string; status: string; quantity: number; unit: string | null; required: boolean; included: boolean }[];
  cost_history: { cost: string; currency: string; effective_from: string; effective_to: string | null; source: string | null }[];
  history: CatalogHistoryEvent[] | null;
}

export const SUPPLY_STATE: Record<SupplyState, { label: string; tone: Tone }> = {
  activo: { label: "Activo", tone: "ok" },
  inactivo: { label: "Inactivo", tone: "mute" },
  vencido: { label: "Vencido", tone: "bad" },
};
