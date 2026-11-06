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

export const SUPPLY_STATE: Record<SupplyState, { label: string; tone: Tone }> = {
  activo: { label: "Activo", tone: "ok" },
  inactivo: { label: "Inactivo", tone: "mute" },
  vencido: { label: "Vencido", tone: "bad" },
};
