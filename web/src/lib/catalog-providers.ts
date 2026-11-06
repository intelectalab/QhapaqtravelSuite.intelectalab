import type { SupplyState } from "./catalog-services";

export interface ProviderContact {
  id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
}

export interface ProviderRow {
  id: string;
  ref: string;
  name: string;
  type: string;
  ruc: string;
  city: string | null;
  stars: number | null;
  contact_name: string;
  phone: string | null;
  email: string | null;
  contract_start: string;
  contract_end: string;
  contract_days: number;
  currency: string;
  payment_terms: string | null;
  status: SupplyState;
  state: SupplyState;
  rating: number;
  rating_note: string | null;
  contacts: ProviderContact[];
  services: { ref: string; name: string; type: string; status: string }[];
  products: { code: string; name: string; status: string }[];
}

export interface ProvidersOverview {
  today: string;
  providers: ProviderRow[];
  options: { types: string[]; currencies: string[] };
  can: { manage: boolean };
}
