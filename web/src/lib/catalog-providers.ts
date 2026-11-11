import type { CatalogHistoryEvent, SupplyState } from "./catalog-services";

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

export interface ProviderDetail extends Pick<ProvidersOverview, "today" | "options" | "can"> {
  provider: ProviderRow;
  services: { ref: string; name: string; type: string; unit: string; cost: string | null; currency: string; valid_to: string; state: SupplyState }[];
  products: { code: string; name: string; status: string; role: "principal" | "componente" }[];
  reservations: { code: string; client: string; service_code: string; service: string; date: string; pax: number; status: string; confirmation_code: string | null; cost: string | null; currency: string }[] | null;
  payables: { code: string; reservation: string | null; concept: string; due_date: string | null; overdue: boolean; amount: string; balance: string; currency: string; status: string }[] | null;
  history: CatalogHistoryEvent[] | null;
}
