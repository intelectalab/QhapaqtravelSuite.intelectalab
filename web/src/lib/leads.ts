import type { ActivityItem } from "./activities";
import type { RecordEvent } from "./history";

export type LeadStatus = "nuevo" | "contactado" | "calificado" | "convertido" | "duplicado" | "descartado";

export interface LeadRow {
  code: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  source: string;
  channel: string;
  interest: string;
  destination: string | null;
  destination_id: string | null;
  travel_date: string | null;
  pax: number;
  score: number;
  status: LeadStatus;
  lock_version: number;
  codes: { source: string; channel: string; interest: string };
  owner_id: string | null;
  owner: { name: string; color: string | null } | null;
  created_at: string;
}

export interface LeadDetail extends LeadRow {
  notes: string | null;
  product: { id: string; code: string; name: string } | null;
  bant: { budget: number; authority: number; need: number; timeline: number; score: number; declared_amount: string | null; currency: string | null; notes: string | null; qualified_at: string; qualified_by: string | null } | null;
  validated_at: string | null;
  assigned_at: string | null;
  first_contact_at: string | null;
  discard_reason: string | null;
  discard_detail: string | null;
  discarded_at: string | null;
  duplicate_of: { type: "lead" | "client"; code: string; name: string } | null;
  duplicates: LeadMatch[];
  absorbed: { code: string; name: string }[];
  activities: ActivityItem[];
  history: RecordEvent[];
  converted: {
    at: string | null;
    client: { code: string; name: string };
    opportunity: { code: string; title: string; stage: string; amount: string; currency: string } | null;
  } | null;
}

export function scoreTone(score: number): "ok" | "sun" | "mute" {
  return score >= 70 ? "ok" : score >= 40 ? "sun" : "mute";
}

export interface CatalogItem {
  code: string;
  label: string;
  requires_detail: boolean;
}

export type CatalogKind = "lead_source" | "lead_channel" | "lead_interest" | "client_segment" | "activity_type" | "discard_reason" | "lost_reason";

export interface CatalogDestination {
  id: string;
  name: string;
  type: string;
  path: string;
}

export interface CatalogProduct {
  id: string;
  code: string;
  name: string;
}

export type CrmCatalogs = Record<CatalogKind, CatalogItem[]> & { destinations: CatalogDestination[]; products: CatalogProduct[] };

export const catalogOptions = (items: CatalogItem[]) => items.map((item) => ({ value: item.code, label: item.label }));

export const destinationOptions = (items: CatalogDestination[]) => items.map((item) => ({ value: item.id, label: item.name, hint: item.path }));

export const productOptions = (items: CatalogProduct[]) => items.map((item) => ({ value: item.id, label: item.name, hint: item.code }));

export interface LeadMatch {
  type: "lead" | "client";
  id: string;
  code: string;
  name: string;
  status: string;
  by: ("email" | "phone")[];
  mergeable: boolean;
}

export interface DuplicateMatch {
  type: "lead" | "client";
  code: string;
  name: string;
  status: string;
}

export const BANT_LEVELS = [
  { value: "0", label: "No" },
  { value: "10", label: "Poco" },
  { value: "18", label: "Bastante" },
  { value: "25", label: "Sí, claramente" },
];

export interface Advisor {
  id: string;
  name: string;
  color: string | null;
}
