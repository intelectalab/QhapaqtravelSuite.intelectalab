export interface Option {
  value: string;
  label: string;
  hint?: string;
}

export interface SurveyItem {
  code: string;
  score: number;
  category: "promotor" | "pasivo" | "detractor";
  comment: string | null;
  channel_code: string;
  channel: string;
  responded_at: string;
  client: { code: string; name: string };
  reservation: { code: string; title: string } | null;
  recorded_by: string | null;
}

export interface TripItem {
  code: string;
  title: string;
  status: string;
  travel_from: string;
  travel_to: string;
  days_since: number;
  total: number;
  currency: string;
  client: { code: string; name: string };
  owner: string;
  survey: { code: string; score: number } | null;
}

export interface CaseItem {
  code: string;
  lock_version: number;
  is_book?: boolean;
  type_code: string;
  type: string;
  priority: string;
  subject: string;
  description: string;
  status: string;
  status_label: string;
  origin: "manual" | "nps_auto";
  resolution: string | null;
  created_at: string;
  resolved_at: string | null;
  closed_at: string | null;
  client: { code: string; name: string } | null;
  reservation: string | null;
  survey: { code: string; score: number } | null;
  owner: { id: string; name: string };
  log: { event: string; message: string; at: string; by: string }[];
}

export interface AfterSalesOverview {
  today: string;
  kpis: { to_close: number; nps: number | null; average: number | null; responses: number; open_cases: number; promoters: number; passives: number; detractors: number };
  distribution: { score: number; count: number }[];
  trend: { key: string; label: string; responses: number; nps: number | null }[];
  trips: TripItem[];
  surveys: SurveyItem[];
  cases: CaseItem[];
  clients: Option[];
  channels: Option[];
  case_types: Option[];
  owners: { id: string; name: string }[];
  can: { manage: boolean };
}

export const CATEGORY_TONE = { promotor: "ok", pasivo: "warn", detractor: "bad" } as const;

export const CATEGORY_LABEL = { promotor: "Promotor", pasivo: "Pasivo", detractor: "Detractor" } as const;

export interface RebuyProposal {
  title: string;
  destination: string;
  amount: number;
  currency: "PEN" | "USD";
  stage: string;
  expected_close_date: string;
  owner_id: string;
  notes: string;
}

export interface LoyaltyRow {
  code: string;
  name: string;
  segment: string | null;
  owner: string | null;
  last_purchase_date: string | null;
  days_since: number | null;
  destinations: string[];
  purchases: number;
  total_pen: number;
  average_pen: number;
  nps: number | null;
  has_open_opportunity: boolean;
  open_opportunities: { code: string; title: string; stage: string }[];
  proposal: RebuyProposal;
}

export interface LoyaltyMeta {
  total: number;
  segments: string[];
  destinations: string[];
  recency: Option[];
  can: { rebuy: boolean };
}

export function recencyBuckets(days: number | null): string[] {
  if (days === null) return ["none"];
  return [days <= 30 ? "30" : null, days > 90 ? "90" : null, days > 180 ? "180" : null].filter((bucket): bucket is string => bucket !== null);
}
